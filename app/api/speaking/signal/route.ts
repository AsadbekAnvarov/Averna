import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function participant(userId: string, roomId: string) {
  const student = await db.student.findUnique({ where: { userId } });
  if (!student) return null;
  const room = await db.speakingRoom.findUnique({ where: { id: roomId } });
  if (!room) return null;
  if (room.studentAId !== student.id && room.studentBId !== student.id) return null;
  return { studentId: student.id, room };
}

// POST { roomId, kind, payload } : publish a WebRTC signal (offer/answer/ice)
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { roomId, kind, payload } = await req.json();
    if (!roomId || !kind || !payload) {
      return NextResponse.json({ error: "missing" }, { status: 400 });
    }
    const p = await participant(user.id, roomId);
    if (!p) return NextResponse.json({ error: "Not your room" }, { status: 403 });

    await db.speakingSignal.create({
      data: { roomId, senderId: p.studentId, kind, payload: String(payload).slice(0, 100000) },
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET ?roomId=&since=<iso> : fetch peer signals newer than `since`
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const roomId = req.nextUrl.searchParams.get("roomId");
    const since = req.nextUrl.searchParams.get("since");
    if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

    const p = await participant(user.id, roomId);
    if (!p) return NextResponse.json({ error: "Not your room" }, { status: 403 });

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000);
    const signals = await db.speakingSignal.findMany({
      where: {
        roomId,
        senderId: { not: p.studentId }, // only the peer's signals
        createdAt: { gt: sinceDate },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    return NextResponse.json({
      signals: signals.map((s) => ({ id: s.id, kind: s.kind, payload: s.payload, createdAt: s.createdAt })),
      now: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
