import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore } from "@/lib/utils";
import { listListeningTests } from "@/lib/listening-content";

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
    const { testId, answers, timeSpent } = body;

    const tests = await listListeningTests();
    const testData = tests.find((t) => t.id === testId);
    if (!testData) {
      return NextResponse.json({ error: "Invalid test ID" }, { status: 400 });
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

    const test = await saveIELTSTest(
      student.id,
      "LISTENING",
      bandScore,
      { testId, answers: ans },
      { correctCount: correct, totalQuestions: total, percentage },
      Number(timeSpent) || 0,
      earnsPoints
        ? {
            contentKey: testId,
            difficulty: testData.difficulty,
            idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined,
          }
        : { pointsOverride: 0 }
    );

    return NextResponse.json({
      testId: test.id,
      correctCount: correct,
      totalQuestions: total,
      bandScore,
      pointsAwarded: earnsPoints,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit test";
    console.error("Listening submission error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
