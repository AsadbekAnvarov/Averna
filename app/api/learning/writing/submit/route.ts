import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessWritingTask } from "@/lib/ai";
import { saveIELTSTest } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Get student profile
    const student = await db.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { essay, taskType, prompt, timeSpent } = body;

    // Validate
    if (!essay || !taskType || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get AI assessment
    const assessment = await assessWritingTask(
      essay,
      taskType,
      prompt
    );

    // Save test result
    const test = await saveIELTSTest(
      student.id,
      "WRITING",
      assessment.overallBand,
      { essay, prompt },
      assessment,
      timeSpent || 0
    );

    return NextResponse.json({
      testId: test.id,
      assessment,
    });
  } catch (error: any) {
    console.error("Writing submission error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit essay" },
      { status: 500 }
    );
  }
}
