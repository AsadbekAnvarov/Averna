import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submitHomework } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    
    const student = await db.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { homeworkId, content } = await req.json();

    if (!homeworkId || !content || typeof homeworkId !== "string" || typeof content !== "string") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const homework: { groupId: string; contentKind: string | null } | null = await db.homework.findUnique({
      where: { id: homeworkId },
      select: { groupId: true, contentKind: true },
    });
    if (!homework) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }
    // Only homework set for the student's own group.
    if (homework.groupId !== student.groupId) {
      return NextResponse.json({ error: "This homework isn't set for your group." }, { status: 403 });
    }
    // Exam homework (a test from the library) is completed by taking that test.
    if (homework.contentKind) {
      return NextResponse.json(
        { error: "This homework is a test — open it from your homework page and complete it there." },
        { status: 400 }
      );
    }

    const submission = await submitHomework(student.id, homeworkId, content);

    return NextResponse.json({
      success: true,
      position: submission.position,
      points: submission.pointsAwarded,
    });
  } catch (error: any) {
    console.error("Homework submission error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
