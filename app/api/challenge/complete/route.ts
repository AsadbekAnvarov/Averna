import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateStudentPoints } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const score = Math.max(0, Math.min(5, Number(body.score) || 0));

    // Only award the daily challenge once per calendar day
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const already = await db.activityLog.findFirst({
      where: { studentId: student.id, action: "DAILY_CHALLENGE", createdAt: { gte: dayStart } },
    });
    if (already) {
      return NextResponse.json({ alreadyDone: true, pointsEarned: 0 });
    }

    const pointsEarned = score * 5; // up to 25 points/day
    await db.activityLog.create({
      data: {
        studentId: student.id,
        action: "DAILY_CHALLENGE",
        details: { score },
        points: pointsEarned,
      },
    });
    if (pointsEarned > 0) {
      await updateStudentPoints(student.id, pointsEarned);
    }

    return NextResponse.json({ alreadyDone: false, pointsEarned });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
