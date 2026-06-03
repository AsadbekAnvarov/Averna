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

    if (!homeworkId || !content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
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
