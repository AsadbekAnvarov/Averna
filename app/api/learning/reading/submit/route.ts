import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore } from "@/lib/utils";
import { READING_TESTS } from "@/lib/reading-tests-data";

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

    // Build map of correct answers from the shared data file
    const correctAnswers: Record<string, number | string> = {};
    for (const passage of testData.passages) {
      for (const q of passage.questions) {
        correctAnswers[q.id] = q.correctAnswer;
      }
    }

    let correctCount = 0;
    const results: Record<string, boolean> = {};

    Object.entries(correctAnswers).forEach(([questionId, correctAnswer]) => {
      const userAnswer = answers?.[questionId];
      let isCorrect = false;

      if (typeof correctAnswer === "number") {
        isCorrect = userAnswer === correctAnswer;
      } else if (typeof correctAnswer === "string") {
        const normalized = (userAnswer ?? "").toString().toLowerCase().trim();
        const correct = correctAnswer.toLowerCase().trim();
        isCorrect = normalized === correct || normalized.includes(correct);
      }

      results[questionId] = isCorrect;
      if (isCorrect) correctCount++;
    });

    const totalQuestions = Object.keys(correctAnswers).length;
    const percentage = (correctCount / totalQuestions) * 100;
    const bandScore = calculateBandScore(percentage);

    const answeredCount = Object.keys(answers || {}).length;
    const earnsPoints = answeredCount > 0 && correctCount > 0;

    const test = await saveIELTSTest(
      student.id,
      "READING",
      bandScore,
      { answers, results },
      { correctCount, totalQuestions, percentage },
      timeSpent || 0,
      earnsPoints ? undefined : { pointsOverride: 0 }
    );

    return NextResponse.json({
      testId: test.id,
      correctCount,
      totalQuestions,
      bandScore,
      pointsAwarded: earnsPoints,
    });
  } catch (error: any) {
    console.error("Reading submission error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit test" }, { status: 500 });
  }
}
