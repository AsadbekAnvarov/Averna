import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { awardPeerSession, peerSessionAward } from "@/lib/speaking/peer-xp";
import { applyVersioned, isDone, isPeerSessionState, isSessionAction, type Seat } from "@/lib/speaking/session";
import { finishedNaturally, sessionView, type SessionRoomRow } from "@/lib/speaking/session-view";

export const dynamic = "force-dynamic";

/**
 * Peer speaking room session (docs/peer-speaking.md §4). Members only.
 *   GET                       → SessionView (+ `xp` once the session finished naturally)
 *   POST { action, version }  → { state, version, changed, xp? } | 409 { error, state, version } on a stale version
 * The POST that finishes both rounds awards SPEAKING_SESSION_COMPLETED XP to both students.
 */

type Params = { params: Promise<{ roomId: string }> };

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

/** The caller's seat in the room, or a ready error response. */
async function member(roomId: string) {
  const session = await auth();
  if (!session?.user) return { fail: reply({ error: "Please sign in again.", code: "auth" }, 401) } as const;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId)) return { fail: reply({ error: "Invalid room" }, 400) } as const;
  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const room = (await db.speakingRoom.findUnique({ where: { id: roomId } })) as SessionRoomRow | null;
  if (!room) return { fail: reply({ error: "Room not found" }, 404) } as const;
  const seat: Seat | null = !student ? null : room.studentAId === student.id ? "A" : room.studentBId === student.id ? "B" : null;
  if (!seat || !student) return { fail: reply({ error: "Not your room" }, 403) } as const;
  return { room, seat, studentId: student.id } as const;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const m = await member(roomId);
    if (m.fail) return m.fail;
    const state = isPeerSessionState(m.room.state) ? m.room.state : null;
    const xp = finishedNaturally(state) ? await peerSessionAward(m.room.id, m.studentId).catch(() => null) : null;
    return reply(sessionView(m.room, m.seat, Date.now(), xp));
  } catch (e) {
    console.error("Speaking session read failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Session unavailable right now." }, 503);
  }
}

export async function POST(request: Request, { params }: Params) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const { roomId } = await params;
    const m = await member(roomId);
    if (m.fail) return m.fail;
    const { room, seat } = m;

    let body: unknown;
    try {
      body = await boundedJson(request, 1000);
    } catch {
      return reply({ error: "Invalid request" }, 400);
    }
    const { action, version } = (body ?? {}) as { action?: unknown; version?: unknown };
    if (!isSessionAction(action) || typeof version !== "number" || !Number.isInteger(version) || version < 0)
      return reply({ error: "Send { action, version }." }, 400);

    if (!isPeerSessionState(room.state)) return reply({ error: "This room has no session." }, 409);
    if (room.status !== "ACTIVE")
      return reply({ error: "This session has ended.", state: room.state, version: room.version }, 409);
    if (version !== room.version)
      return reply({ error: "The session moved on — refresh.", state: room.state, version: room.version }, 409);

    const now = Date.now();
    const next = applyVersioned(room.state, room.version, action, seat, now);
    if (!next.changed) return reply({ state: room.state, version: room.version, changed: false });

    const done = isDone(next.state);
    const saved = await db.speakingRoom.updateMany({
      where: { id: room.id, version: room.version, status: "ACTIVE" },
      data: {
        state: next.state as unknown as Prisma.InputJsonValue,
        version: next.version,
        ...(done ? { status: "ENDED", endedAt: new Date(now) } : {}),
      },
    });
    if (saved.count !== 1) {
      const latest = (await db.speakingRoom.findUnique({ where: { id: room.id } })) as SessionRoomRow | null;
      return reply({ error: "The session moved on — refresh.", state: latest?.state ?? null, version: latest?.version ?? room.version }, 409);
    }
    if (done) await db.speakingQueue.deleteMany({ where: { roomId: room.id } }).catch(() => undefined);

    // Only the one write that finished both rounds gets here; the idempotency keys
    // make any repeat a no-op. `end` (endedBy set) earns nothing.
    if (done && finishedNaturally(next.state)) {
      const durationSec = room.createdAt instanceof Date ? Math.max(0, Math.round((now - room.createdAt.getTime()) / 1000)) : null;
      const award = (studentId: string) => awardPeerSession({ roomId: room.id, studentId, format: next.state.format, durationSec });
      const [a, b] = await Promise.all([award(room.studentAId), award(room.studentBId)]);
      return reply({ state: next.state, version: next.version, changed: true, xp: seat === "A" ? a : b });
    }
    return reply({ state: next.state, version: next.version, changed: true });
  } catch (e) {
    console.error("Speaking session update failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Session unavailable right now." }, 503);
  }
}
