import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore, isTextAnswerCorrect } from "@/lib/utils";
import { getReadingTest } from "@/lib/reading-content";
import { assessSubmission, applyTrust, logAssessment } from "@/lib/engine/integrity-engine";
import { computeObjectiveXp } from "@/lib/engine/progression/xp";
import { findSubmittedTest, loadXpHistory } from "@/lib/engine/progression/service";
import { getReadingExam } from "@/lib/ielts/catalog";
import { clientAttemptKey, resolvePartIndex, submitObjectiveExam } from "@/lib/ielts/submit";
import { paperLockedByMock } from "@/lib/ielts/mock";
import { examHomeworkFor, recordExamHomework } from "@/lib/homework/exam-homework";
import { objectiveGate } from "@/lib/homework/exam-attempt";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const student = await db.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json();

    // Exam-format papers (CD-IELTS runner): graded against the exam-v2 key by
    // the shared scorer (same rules as the mock exam).
    if (body?.format === "exam-v2") {
      const exam = typeof body.testId === "string" ? await getReadingExam(body.testId) : null;
      if (!exam) {
        return NextResponse.json({ error: "This Reading test couldn't be found. Please pick it again from the list." }, { status: 400 });
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
      // Exam homework (?hw): the first attempt at this exact paper / Passage that counts completes it
      // (recordExamHomework checks the saved attempt is that content and counts by the same rule).
      if (body.homeworkId) {
        const part = resolvePartIndex(exam, body.part);
        const target = await examHomeworkFor(student.id, body.homeworkId, { kind: "READING", contentId: exam.id, part });
        if (target) {
          await recordExamHomework({
            studentId: student.id,
            target,
            testId: r.testId,
            band: r.band,
            summary: `${part == null ? "Full test" : `Passage ${part + 1}`} · ${r.correct}/${r.total} correct · band ${r.band.toFixed(1)}`,
            // At least half of the questions in the homework's scope answered.
            genuine: objectiveGate(r.answered, r.total).counts,
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

    const testData = typeof testId === "string" ? await getReadingTest(testId) : null;
    if (!testData) {
      return NextResponse.json({ error: "This Reading test couldn't be found. Please pick it again from the list." }, { status: 400 });
    }

    // Retry / double-click safety: the same attempt id returns the original result.
    const previous = await findSubmittedTest(student.id, body.submissionId);
    if (previous) {
      return NextResponse.json({ testId: previous.id, duplicate: true });
    }

    // Build map of correct answers from the shared data file, and the average
    // guess probability per question (used by the Integrity Engine).
    const correctAnswers: Record<string, number | string> = {};
    const chances: number[] = [];
    for (const passage of testData.passages) {
      for (const q of passage.questions) {
        correctAnswers[q.id] = q.correctAnswer;
        if (q.type === "multiple-choice") chances.push(1 / Math.max(2, q.options?.length ?? 4));
        else if (q.type === "true-false-not-given") chances.push(1 / 3);
        else chances.push(0.02); // open text — effectively unguessable
      }
    }
    const chanceLevel = chances.length ? chances.reduce((a, b) => a + b, 0) / chances.length : 0.25;

    let correctCount = 0;
    const results: Record<string, boolean> = {};

    Object.entries(correctAnswers).forEach(([questionId, correctAnswer]) => {
      const userAnswer = answers?.[questionId];
      let isCorrect = false;

      if (typeof correctAnswer === "number") {
        isCorrect = userAnswer === correctAnswer;
      } else if (typeof correctAnswer === "string") {
        isCorrect = isTextAnswerCorrect(userAnswer, correctAnswer);
      }

      results[questionId] = isCorrect;
      if (isCorrect) correctCount++;
    });

    const totalQuestions = Object.keys(correctAnswers).length;
    const percentage = (correctCount / totalQuestions) * 100;
    const bandScore = calculateBandScore(percentage);

    // ---- Learning DNA signals this route is uniquely able to measure ----
    // Words in the passages give a real reading speed (words ÷ minutes), which no
    // other surface can compute; per-question-type error rates give a defensible
    // mistake category instead of a vague "reading is weak".
    const passageWords = testData.passages.reduce(
      (sum, p) => sum + p.text.trim().split(/\s+/).filter(Boolean).length,
      0
    );

    const byType = new Map<string, { wrong: number; total: number }>();
    for (const passage of testData.passages) {
      for (const q of passage.questions) {
        const entry = byType.get(q.type) ?? { wrong: 0, total: 0 };
        entry.total += 1;
        if (results[q.id] === false) entry.wrong += 1;
        byType.set(q.type, entry);
      }
    }
    const TYPE_TAG: Record<string, string> = {
      "true-false-not-given": "inference",
      "multiple-choice": "detail_questions",
      "sentence-completion": "detail_questions",
    };
    const errorTags: string[] = [];
    for (const [type, stats] of byType) {
      // A pattern within the paper, not a single slip: at least two wrong AND a
      // failure rate high enough that it isn't just this student's overall level.
      if (stats.wrong >= 2 && stats.wrong / stats.total >= 0.4) {
        const tag = TYPE_TAG[type];
        if (tag) errorTags.push(tag);
      }
    }

    const answeredCount = Object.keys(answers || {}).length;
    const earnsPoints = answeredCount > 0 && correctCount > 0;

    // Integrity Engine (S4) — assess BEFORE awarding, so the verdict scales the
    // reward and the burst check doesn't count this very attempt.
    const facts = {
      studentId: student.id,
      module: "READING",
      correct: correctCount,
      total: totalQuestions,
      answered: answeredCount,
      timeSpent: Number(timeSpent) || 0,
      chanceLevel,
    };
    const verdict = await assessSubmission(facts);
    const trust = applyTrust(verdict);

    const accuracyPct = Math.round(percentage);
    const xp = earnsPoints
      ? computeObjectiveXp({
          skill: "READING",
          correct: correctCount,
          total: totalQuestions,
          answered: answeredCount,
          band: bandScore,
          history: { ...(await loadXpHistory(student.id, "READING", testId)), trust: trust.multiplier },
        })
      : undefined;

    const test = await saveIELTSTest(
      student.id,
      "READING",
      bandScore,
      { testId, answers, results },
      { correctCount, totalQuestions, percentage },
      timeSpent || 0,
      {
        contentKey: testId,
        idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined,
        ...(xp ? { xp } : { pointsOverride: 0 }),
        logDetails: { accuracy: accuracyPct },
        dna: { channel: "reading", words: passageWords, errorTags },
      }
    );

    await logAssessment(facts, verdict, test.pointsAwarded ?? 0);

    return NextResponse.json({
      testId: test.id,
      correctCount,
      totalQuestions,
      bandScore,
      pointsAwarded: test.pointsAwarded > 0,
      xpAwarded: test.pointsAwarded,
      duplicate: test.duplicate,
      integrityNotice: trust.reduced ? trust.notice : undefined,
    });
  } catch (error: any) {
    console.error("Reading submission error:", error);
    return NextResponse.json(
      { error: "Your answers weren't submitted. Nothing was lost — please try again." },
      { status: 500 }
    );
  }
}
