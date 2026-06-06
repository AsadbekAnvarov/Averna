import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateStudentPoints } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

/**
 * Lightweight activity tracker for learning-path steps that don't otherwise
 * persist a record (e.g. flashcards study, peer/AI speaking practice).
 *
 * It logs an ActivityLog entry so the daily Learning Path can detect that the
 * student completed the step, and awards a small amount of points the FIRST
 * time the activity is done each day (de-duplicated to prevent point farming).
 */
const ACTIVITY_CONFIG: Record<string, { action: string; points: number }> = {
  FLASHCARDS: { action: "FLASHCARDS_STUDIED", points: 10 },
  SPEAKING: { action: "SPEAKING_PRACTICE", points: 15 },
  PRONUNCIATION: { action: "PRONUNCIATION_PRACTICE", points: 10 },
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const student = await db.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const config = ACTIVITY_CONFIG[String(body?.type)];

    if (!config) {
      return NextResponse.json({ error: "Unknown activity type" }, { status: 400 });
    }

    // De-duplicate per day: only the first completion each day is rewarded.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const already = await db.activityLog.findFirst({
      where: {
        studentId: student.id,
        action: config.action,
        createdAt: { gte: dayStart },
      },
    });

    if (already) {
      return NextResponse.json({ ok: true, alreadyDone: true, pointsEarned: 0 });
    }

    await db.activityLog.create({
      data: {
        studentId: student.id,
        action: config.action,
        details: {},
        points: config.points,
      },
    });

    await updateStudentPoints(student.id, config.points);

    return NextResponse.json({ ok: true, pointsEarned: config.points });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to track activity";
    console.error("Activity track error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
