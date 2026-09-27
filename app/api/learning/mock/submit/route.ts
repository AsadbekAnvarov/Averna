import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore, heuristicWritingAssessmentSafe, isGenuineWriting, isOnTopic } from "@/lib/utils";
import { MOCK_EXAMS } from "@/lib/mock-exams-data";
import { assessSubmission, applyTrust, logAssessment } from "@/lib/engine/integrity-engine";
import { computeObjectiveXp, computeWritingXp } from "@/lib/engine/progression/xp";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { loadXpHistory } from "@/lib/engine/progression/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const essay: string = body.essay || "";
    const timeSpent = Number(body.timeSpent) || 0;

    // Score listening & reading SERVER-SIDE from the real exam answer keys, so a
    // client can't forge section scores. The runner sends its raw chosen options
    // (keyed by question index) plus the exam id.
    const exam = MOCK_EXAMS.find((e) => e.id === body.examId);
    if (!exam) {
      return NextResponse.json({ error: "This mock exam couldn't be found. Please start it again." }, { status: 400 });
    }

    // Retry safety: each section is saved under its own idempotency key
    // (`<submissionId>:L|R|W`), so a retry only fills in what's missing and
    // never scores a section twice.
    const submissionId = typeof body.submissionId === "string" && body.submissionId ? body.submissionId : undefined;

    const lQ = exam.listening.questions;
    const rQ = exam.reading.questions;
    const lTotal = lQ.length || 1;
    const rTotal = rQ.length || 1;
    const lAns = (body.listeningAnswers ?? {}) as Record<string, number>;
    const rAns = (body.readingAnswers ?? {}) as Record<string, number>;

    let lCorrect = 0;
    lQ.forEach((q, i) => {
      if ((lAns[i] ?? lAns[String(i)]) === q.a) lCorrect++;
    });
    let rCorrect = 0;
    rQ.forEach((q, i) => {
      if ((rAns[i] ?? rAns[String(i)]) === q.a) rCorrect++;
    });

    const listeningBand = calculateBandScore((lCorrect / lTotal) * 100);
    const readingBand = calculateBandScore((rCorrect / rTotal) * 100);
    const writingBand = heuristicWritingAssessmentSafe(essay);

    const overall = Math.round(((listeningBand + readingBand + writingBand) / 3) * 2) / 2;

    const wMin = XP_CONFIG.writing.task2.minWords;
    const wGenuine = isGenuineWriting(essay, wMin) && isOnTopic(essay, exam.writing.prompt);

    // Integrity Engine (S4) — assess the whole attempt BEFORE awarding, so the
    // verdict scales every section's XP and the burst check excludes this attempt.
    const mockChances = [...lQ, ...rQ].map((q) => 1 / Math.max(2, q.options?.length ?? 4));
    const facts = {
      studentId: student.id,
      module: "MOCK",
      correct: lCorrect + rCorrect,
      total: lTotal + rTotal,
      answered: Object.keys(lAns).length + Object.keys(rAns).length,
      timeSpent,
      chanceLevel: mockChances.length ? mockChances.reduce((a, b) => a + b, 0) / mockChances.length : 0.25,
      essay: { genuine: isGenuineWriting(essay, wMin), onTopic: isOnTopic(essay, exam.writing.prompt) },
    };
    const verdict = await assessSubmission(facts);
    const trust = applyTrust(verdict);

    // Progression Engine: each section is scored with the same rules as the
    // standalone modules (accuracy, completion, quality, repeat decay, budget),
    // plus a small mock-exam multiplier, then scaled by integrity trust. The exam
    // id is stored as `testId` so retaking the same mock decays XP.
    const mult = XP_CONFIG.mock.sectionMultiplier;
    const lAnswered = Object.keys(lAns).length;
    const rAnswered = Object.keys(rAns).length;
    // Sections are scored in order and each one's XP counts toward the daily
    // budget of the next, so a mock exam can't sidestep the daily taper.
    let earnedSoFar = 0;
    const withBudget = async (skill: "LISTENING" | "READING" | "WRITING") => {
      const h = await loadXpHistory(student.id, skill, exam.id);
      return { ...h, earnedToday: h.earnedToday + earnedSoFar, trust: trust.multiplier };
    };
    const lXp = lCorrect > 0
      ? computeObjectiveXp({ skill: "LISTENING", correct: lCorrect, total: lTotal, answered: lAnswered, band: listeningBand, difficulty: exam.difficulty, multiplier: mult, history: await withBudget("LISTENING") })
      : undefined;
    earnedSoFar += lXp?.xp ?? 0;
    const rXp = rCorrect > 0
      ? computeObjectiveXp({ skill: "READING", correct: rCorrect, total: rTotal, answered: rAnswered, band: readingBand, difficulty: exam.difficulty, multiplier: mult, history: await withBudget("READING") })
      : undefined;
    earnedSoFar += rXp?.xp ?? 0;
    const essayWordCount = essay.trim().split(/\s+/).filter(Boolean).length;
    const wXp = computeWritingXp({ task: "task2", words: essayWordCount, band: writingBand, genuine: isGenuineWriting(essay, wMin), onTopic: isOnTopic(essay, exam.writing.prompt), multiplier: mult, history: await withBudget("WRITING") });

    const sectionTime = Math.round(timeSpent / 3);
    const key = (s: string) => (submissionId ? `${submissionId}:${s}` : undefined);
    const lTest = await saveIELTSTest(student.id, "LISTENING", listeningBand, { mock: true, testId: exam.id, lCorrect, lTotal }, { type: "mock", correctCount: lCorrect, totalQuestions: lTotal, percentage: (lCorrect / lTotal) * 100 }, sectionTime, { contentKey: exam.id, idempotencyKey: key("L"), ...(lXp ? { xp: lXp } : { pointsOverride: 0 }), logDetails: { mock: true, accuracy: Math.round((lCorrect / lTotal) * 100) }, skipSettle: true });
    const rTest = await saveIELTSTest(student.id, "READING", readingBand, { mock: true, testId: exam.id, rCorrect, rTotal }, { type: "mock", correctCount: rCorrect, totalQuestions: rTotal, percentage: (rCorrect / rTotal) * 100 }, sectionTime, { contentKey: exam.id, idempotencyKey: key("R"), ...(rXp ? { xp: rXp } : { pointsOverride: 0 }), logDetails: { mock: true, accuracy: Math.round((rCorrect / rTotal) * 100) }, skipSettle: true });
    const wTest = await saveIELTSTest(student.id, "WRITING", writingBand, { mock: true, testId: exam.id, essay: essay.slice(0, 2000), taskType: "task2" }, { type: "mock", wordCount: essayWordCount }, sectionTime, { contentKey: exam.id, idempotencyKey: key("W"), ...(wGenuine ? { xp: wXp } : { pointsOverride: 0 }), logDetails: { mock: true, words: essayWordCount } });
    const lPts = lTest.pointsAwarded;
    const rPts = rTest.pointsAwarded;
    const wPts = wTest.pointsAwarded;

    const pointsEarned = lPts + rPts + wPts;

    await logAssessment(facts, verdict, pointsEarned);

    return NextResponse.json({
      listeningBand,
      readingBand,
      writingBand,
      overall,
      pointsEarned,
      sections: { listening: lPts, reading: rPts, writing: wPts },
      xpNotes: Array.from(new Set([...(lXp?.notes ?? []), ...(rXp?.notes ?? []), ...wXp.notes])).slice(0, 3),
      integrityNotice: trust.reduced ? trust.notice : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit mock exam";
    console.error("Mock submit error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
