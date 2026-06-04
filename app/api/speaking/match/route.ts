import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTodayTopic } from "@/lib/speaking-topics";

export const dynamic = "force-dynamic";

// POST: join the matchmaking queue; pair with a waiting student if possible.
export async function POST() {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({
      where: { userId: user.id },
      include: { user: { select: { name: true } } },
    });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const myName = student.user.name ?? "Student";
    const topic = getTodayTopic().topic;

    // Already matched or waiting?
    const existing = await db.speakingQueue.findUnique({ where: { studentId: student.id } });
    if (existing?.roomId) {
      return NextResponse.json({ roomId: existing.roomId });
    }
    if (existing) {
      // try to find a partner now
    } else {
      await db.speakingQueue.create({
        data: { studentId: student.id, studentName: myName, topic },
      });
    }

    // Find another waiting student (no room yet)
    const partner = await db.speakingQueue.findFirst({
      where: { roomId: null, studentId: { not: student.id } },
      orderBy: { createdAt: "asc" },
    });

    if (!partner) {
      return NextResponse.json({ waiting: true });
    }

    // Create a room and claim the partner atomically-ish
    const claim = await db.speakingQueue.updateMany({
      where: { id: partner.id, roomId: null },
      data: { roomId: "PENDING" },
    });
    if (claim.count === 0) {
      // Someone else grabbed them; stay waiting
      return NextResponse.json({ waiting: true });
    }

    const room = await db.speakingRoom.create({
      data: {
        topic,
        studentAId: partner.studentId,
        studentAName: partner.studentName,
        studentBId: student.id,
        studentBName: myName,
      },
    });

    await db.speakingQueue.update({ where: { id: partner.id }, data: { roomId: room.id } });
    await db.speakingQueue.update({ where: { studentId: student.id }, data: { roomId: room.id } });

    return NextResponse.json({ roomId: room.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: poll my matchmaking status
export async function GET() {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) return NextResponse.json({ error: "no student" }, { status: 404 });
    const entry = await db.speakingQueue.findUnique({ where: { studentId: student.id } });
    return NextResponse.json({
      roomId: entry?.roomId && entry.roomId !== "PENDING" ? entry.roomId : null,
      waiting: !!entry && (!entry.roomId || entry.roomId === "PENDING"),
    });
  } catch {
    return NextResponse.json({ roomId: null, waiting: false });
  }
}

// DELETE: leave the queue (cancel waiting)
export async function DELETE() {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (student) {
      await db.speakingQueue.deleteMany({ where: { studentId: student.id, roomId: null } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
