import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore, isTextAnswerCorrect } from "@/lib/utils";
import { READING_TESTS } from "@/lib/reading-tests-data";
import { assessSubmission, applyTrust, logAssessment } from "@/lib/engine/integrity-engine";

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
    const { testId, answers, timeSpent } = body;

    const testData = READING_TESTS[testId];
    if (!testData) {
      return NextResponse.json({ error: "Invalid test ID" }, { status: 400 });
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

    const test = await saveIELTSTest(
      student.id,
      "READING",
      bandScore,
      { testId, answers, results },
      { correctCount, totalQuestions, percentage },
      timeSpent || 0,
      earnsPoints
        ? {
            contentKey: testId,
            idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined,
            trustMultiplier: trust.multiplier,
            dna: { channel: "reading", words: passageWords, errorTags },
          }
        : { pointsOverride: 0, dna: { channel: "reading", words: passageWords, errorTags } }
    );

    await logAssessment(facts, verdict, test.pointsAwarded ?? 0);

    return NextResponse.json({
      testId: test.id,
      correctCount,
      totalQuestions,
      bandScore,
      pointsAwarded: earnsPoints,
      integrityNotice: trust.reduced ? trust.notice : undefined,
    });
  } catch (error: any) {
    console.error("Reading submission error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit test" }, { status: 500 });
  }
}
