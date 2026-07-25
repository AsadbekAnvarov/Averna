import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest, computeTestXpForStudent } from "@/lib/db-helpers";
import { calculateBandScore, heuristicWritingAssessmentSafe, isGenuineWriting, isOnTopic } from "@/lib/utils";
import { MOCK_EXAMS } from "@/lib/mock-exams-data";
import { assessSubmission, applyTrust, logAssessment } from "@/lib/engine/integrity-engine";

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
      return NextResponse.json({ error: "Invalid exam ID" }, { status: 400 });
    }

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

    const wGenuine = isGenuineWriting(essay, 100) && isOnTopic(essay, exam.writing.prompt);

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
      essay: { genuine: isGenuineWriting(essay, 100), onTopic: isOnTopic(essay, exam.writing.prompt) },
    };
    const verdict = await assessSubmission(facts);
    const trust = applyTrust(verdict);

    // XP 2.0: growth-aware (improvement, difficulty, repeat-decay, daily cap),
    // then scaled by integrity trust. The exam id is stored as `testId` so
    // retaking the same mock decays XP.
    const scale = (xp: number) => Math.max(0, Math.round(xp * trust.multiplier));
    const lPts = lCorrect > 0 ? scale(await computeTestXpForStudent(student.id, "LISTENING", listeningBand, { difficulty: exam.difficulty, contentKey: exam.id })) : 0;
    const rPts = rCorrect > 0 ? scale(await computeTestXpForStudent(student.id, "READING", readingBand, { difficulty: exam.difficulty, contentKey: exam.id })) : 0;
    const wPts = wGenuine ? scale(await computeTestXpForStudent(student.id, "WRITING", writingBand, { difficulty: exam.difficulty, contentKey: exam.id })) : 0;

    // Save each section as an IELTS test (awards points + updates streak/achievements)
    await saveIELTSTest(student.id, "LISTENING", listeningBand, { mock: true, testId: exam.id, lCorrect, lTotal }, { type: "mock" }, Math.round(timeSpent / 3), { pointsOverride: lPts });
    await saveIELTSTest(student.id, "READING", readingBand, { mock: true, testId: exam.id, rCorrect, rTotal }, { type: "mock" }, Math.round(timeSpent / 3), { pointsOverride: rPts });
    await saveIELTSTest(student.id, "WRITING", writingBand, { mock: true, testId: exam.id, essay: essay.slice(0, 2000) }, { type: "mock" }, Math.round(timeSpent / 3), { pointsOverride: wPts });

    const pointsEarned = lPts + rPts + wPts;

    await logAssessment(facts, verdict, pointsEarned);

    return NextResponse.json({
      listeningBand,
      readingBand,
      writingBand,
      overall,
      pointsEarned,
      integrityNotice: trust.reduced ? trust.notice : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit mock exam";
    console.error("Mock submit error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
