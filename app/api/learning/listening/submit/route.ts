import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore } from "@/lib/utils";
import { listListeningTests } from "@/lib/listening-content";
import { assessSubmission, applyTrust, logAssessment } from "@/lib/engine/integrity-engine";
import { computeObjectiveXp } from "@/lib/engine/progression/xp";
import { buildSessionOutcome, findSubmittedTest, loadXpHistory } from "@/lib/engine/progression/service";
import { getListeningExam } from "@/lib/ielts/catalog";
import { clientAttemptKey, resolvePartIndex, submitObjectiveExam } from "@/lib/ielts/submit";
import { paperLockedByMock } from "@/lib/ielts/mock";
import { examHomeworkFor, recordExamHomework } from "@/lib/homework/exam-homework";

export const dynamic = "force-dynamic";

/**
 * Listening submission — scored SERVER-SIDE from the authoritative answer key.
 * The client sends the test id and its chosen options (keyed by the flat
 * question index, the same order the runner renders: sections -> questions);
 * the server looks up the real test and recomputes correctness. A client can no
 * longer forge a `correctCount` to fake a band / farm XP.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json();

    // Exam-format papers (CD-IELTS runner): graded against the exam-v2 key by
    // the shared scorer (same rules as the mock exam).
    if (body?.format === "exam-v2") {
      const exam = typeof body.testId === "string" ? await getListeningExam(body.testId) : null;
      if (!exam) {
        return NextResponse.json({ error: "This Listening test couldn't be found. Please pick it again from the list." }, { status: 400 });
      }
      // The paper of a running mock section can't be practised until that section is
      // handed in — the practice result page would reveal its answer key.
      if (await paperLockedByMock(student.id, exam.id)) {
        return NextResponse.json(
          { error: "This paper is part of your mock exam in progress. Finish that section first, then practise it here." },
          { status: 409 }
        );
      }
      const r = await submitObjectiveExam({
        studentId: student.id,
        test: exam,
        partIndex: resolvePartIndex(exam, body.part),
        rawAnswers: body.answers,
        timeSpent: body.timeSpent,
        idempotencyKey: clientAttemptKey(body.submissionId),
        auto: body.auto === true,
      });
      // Exam homework (?hw): the first attempt at this exact paper / Part completes it.
      if (body.homeworkId) {
        const part = resolvePartIndex(exam, body.part);
        const target = await examHomeworkFor(student.id, body.homeworkId, { kind: "LISTENING", contentId: exam.id, part });
        if (target) {
          await recordExamHomework({
            studentId: student.id,
            target,
            testId: r.testId,
            band: r.band,
            summary: `${part == null ? "Full test" : `Part ${part + 1}`} · ${r.correct}/${r.total} correct · band ${r.band.toFixed(1)}`,
            genuine: r.answered > 0,
          });
        }
      }
      return NextResponse.json({
        testId: r.testId,
        correctCount: r.correct,
        totalQuestions: r.total,
        bandScore: r.band,
        xpAwarded: r.xpAwarded,
        duplicate: r.duplicate,
        integrityNotice: r.integrityNotice,
      });
    }

    const { testId, answers, timeSpent } = body;

    const tests = await listListeningTests();
    const testData = tests.find((t) => t.id === testId);
    if (!testData) {
      return NextResponse.json({ error: "This Listening test couldn't be found. Please pick it again from the list." }, { status: 400 });
    }

    // Retry / double-click safety: the same attempt id returns the original result.
    const previous = await findSubmittedTest(student.id, body.submissionId);
    if (previous) {
      const outcome = await buildSessionOutcome(student.id, previous.id);
      return NextResponse.json({ testId: previous.id, duplicate: true, outcome });
    }

    // Flatten in the exact order the runner indexes answers by.
    const allQuestions = testData.sections.flatMap((s) => s.questions);
    const total = allQuestions.length;
    if (total <= 0) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    const ans = (answers ?? {}) as Record<string, number>;
    let correct = 0;
    let answeredCount = 0;
    allQuestions.forEach((q, i) => {
      const sel = ans[i] ?? ans[String(i)];
      if (sel !== undefined && sel !== null) answeredCount++;
      if (sel === q.answer) correct++;
    });

    const percentage = (correct / total) * 100;
    const bandScore = calculateBandScore(percentage);

    // Effort gate: only award points for a genuine attempt.
    const earnsPoints = answeredCount > 0 && correct > 0;

    // Integrity Engine (S4) — assess BEFORE awarding so the verdict scales the
    // reward and the burst check doesn't count this very attempt.
    const chances = allQuestions.map((q) => 1 / Math.max(2, q.options?.length ?? 4));
    const facts = {
      studentId: student.id,
      module: "LISTENING",
      correct,
      total,
      answered: answeredCount,
      timeSpent: Number(timeSpent) || 0,
      chanceLevel: chances.reduce((a, b) => a + b, 0) / chances.length,
    };
    const verdict = await assessSubmission(facts);
    const trust = applyTrust(verdict);

    const xp = earnsPoints
      ? computeObjectiveXp({
          skill: "LISTENING",
          correct,
          total,
          answered: answeredCount,
          band: bandScore,
          difficulty: testData.difficulty,
          history: { ...(await loadXpHistory(student.id, "LISTENING", testId)), trust: trust.multiplier },
        })
      : undefined;

    const test = await saveIELTSTest(
      student.id,
      "LISTENING",
      bandScore,
      { testId, answers: ans },
      { correctCount: correct, totalQuestions: total, percentage },
      Number(timeSpent) || 0,
      {
        contentKey: testId,
        difficulty: testData.difficulty,
        idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined,
        ...(xp ? { xp } : { pointsOverride: 0 }),
        logDetails: { accuracy: Math.round(percentage) },
      }
    );

    await logAssessment(facts, verdict, test.pointsAwarded ?? 0);

    return NextResponse.json({
      testId: test.id,
      correctCount: correct,
      totalQuestions: total,
      bandScore,
      pointsAwarded: test.pointsAwarded > 0,
      xpAwarded: test.pointsAwarded,
      xpNotes: xp?.notes ?? (earnsPoints ? [] : ["Answer at least one question correctly to earn XP."]),
      integrityNotice: trust.reduced ? trust.notice : undefined,
      outcome: await buildSessionOutcome(student.id, test.id),
    });
  } catch (error: unknown) {
    console.error("Listening submission error:", error);
    return NextResponse.json(
      { error: "Your answers weren't saved. Your result is still shown — please try saving again." },
      { status: 500 }
    );
  }
}
