import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function myStudent(userId: string) {
  return db.student.findUnique({
    where: { userId },
    include: { user: { select: { name: true } } },
  });
}

// GET ?roomId= : room info + messages
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const roomId = req.nextUrl.searchParams.get("roomId");
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

    const room = await db.speakingRoom.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    const student = await myStudent(user.id);
    const isParticipant = student && (room.studentAId === student.id || room.studentBId === student.id);
    if (!isParticipant) return NextResponse.json({ error: "Not your room" }, { status: 403 });

    const messages = await db.speakingMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json({
      room: {
        id: room.id,
        topic: room.topic,
        studentAName: room.studentAName,
        studentBName: room.studentBName,
        status: room.status,
      },
      messages,
      meId: student!.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST { roomId, content } : send a message
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { roomId, content } = await req.json();
    const text = (content as string)?.trim();
    if (!roomId || !text) return NextResponse.json({ error: "missing" }, { status: 400 });

    const room = await db.speakingRoom.findUnique({ where: { id: roomId } });
    if (!room || room.status !== "ACTIVE") {
      return NextResponse.json({ error: "Room not active" }, { status: 400 });
    }
    const student = await myStudent(user.id);
    if (!student || (room.studentAId !== student.id && room.studentBId !== student.id)) {
      return NextResponse.json({ error: "Not your room" }, { status: 403 });
    }

    await db.speakingMessage.create({
      data: {
        roomId,
        senderId: student.id,
        senderName: student.user.name ?? "Student",
        content: text.slice(0, 500),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE { roomId } : leave / end the room
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const roomId = req.nextUrl.searchParams.get("roomId");
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

    const room = await db.speakingRoom.findUnique({ where: { id: roomId } });
    if (!room) return NextResponse.json({ ok: true });

    await db.speakingRoom.update({
      where: { id: roomId },
      data: { status: "ENDED", endedAt: new Date() },
    });
    // Clear both students' queue entries so they can re-match
    await db.speakingQueue.deleteMany({
      where: { studentId: { in: [room.studentAId, room.studentBId] } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
