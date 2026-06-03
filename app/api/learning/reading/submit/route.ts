import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore } from "@/lib/utils";

// Reading test data with correct answers
const READING_TESTS: Record<string, any> = {
  "academic-1": {
    correctAnswers: {
      "q1": 1, "q2": "true", "q3": "false", "q4": 2, "q5": "common sense reasoning",
      "q6": 1, "q7": "false", "q8": "25%", "q9": 1, "q10": "false",
      "q11": 1, "q12": "false", "q13": "urban and rural", "q14": "false", "q15": 2
    }
  },
  "academic-2": {
    correctAnswers: {
      "q1": 1, "q2": "90%", "q3": "true", "q4": "false", "q5": 2
    }
  }
};

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

    // Calculate score
    let correctCount = 0;
    const results: Record<string, boolean> = {};
    
    Object.entries(testData.correctAnswers).forEach(([questionId, correctAnswer]) => {
      const userAnswer = answers[questionId];
      let isCorrect = false;

      if (typeof correctAnswer === "number") {
        isCorrect = userAnswer === correctAnswer;
      } else if (typeof correctAnswer === "string") {
        const normalized = (userAnswer || "").toString().toLowerCase().trim();
        const correct = correctAnswer.toLowerCase().trim();
        isCorrect = normalized === correct || normalized.includes(correct);
      }

      results[questionId] = isCorrect;
      if (isCorrect) correctCount++;
    });

    const totalQuestions = Object.keys(testData.correctAnswers).length;
    const percentage = (correctCount / totalQuestions) * 100;
    const bandScore = calculateBandScore(percentage);

    // Save test result
    const test = await saveIELTSTest(
      student.id,
      "READING",
      bandScore,
      { answers, results },
      { correctCount, totalQuestions, percentage },
      timeSpent || 0
    );

    return NextResponse.json({
      testId: test.id,
      correctCount,
      totalQuestions,
      bandScore,
    });
  } catch (error: any) {
    console.error("Reading submission error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit test" }, { status: 500 });
  }
}
