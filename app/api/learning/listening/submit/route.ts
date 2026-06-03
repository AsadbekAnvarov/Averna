import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore } from "@/lib/utils";

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
    const { correctCount, totalQuestions, answers, timeSpent } = body;

    const total = Number(totalQuestions) || 0;
    const correct = Number(correctCount) || 0;
    if (total <= 0) {
      return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
    }

    const percentage = (correct / total) * 100;
    const bandScore = calculateBandScore(percentage);

    const test = await saveIELTSTest(
      student.id,
      "LISTENING",
      bandScore,
      { answers: answers ?? {} },
      { correctCount: correct, totalQuestions: total, percentage },
      Number(timeSpent) || 0
    );

    return NextResponse.json({
      testId: test.id,
      correctCount: correct,
      totalQuestions: total,
      bandScore,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit test";
    console.error("Listening submission error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
