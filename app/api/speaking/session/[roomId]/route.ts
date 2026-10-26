import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { applyVersioned, isDone, isPeerSessionState, isSessionAction, type Seat } from "@/lib/speaking/session";

export const dynamic = "force-dynamic";

/**
 * Peer speaking room session (docs/peer-speaking.md §4). Members only.
 *   GET                       → SessionView
 *   POST { action, version }  → { state, version, changed } | 409 { error, state, version } on a stale version
 */

type Params = { params: Promise<{ roomId: string }> };

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

type RoomRow = {
  id: string;
  topic: string;
  format: string;
  status: string;
  state: unknown;
  version: number;
  studentAId: string;
  studentAName: string;
  studentBId: string;
  studentBName: string;
};

/** The caller's seat in the room, or a ready error response. */
async function member(roomId: string) {
  const session = await auth();
  if (!session?.user) return { fail: reply({ error: "Please sign in again.", code: "auth" }, 401) } as const;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(roomId)) return { fail: reply({ error: "Invalid room" }, 400) } as const;
  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const room = (await db.speakingRoom.findUnique({ where: { id: roomId } })) as RoomRow | null;
  if (!room) return { fail: reply({ error: "Room not found" }, 404) } as const;
  const seat: Seat | null = !student ? null : room.studentAId === student.id ? "A" : room.studentBId === student.id ? "B" : null;
  if (!seat) return { fail: reply({ error: "Not your room" }, 403) } as const;
  return { room, seat } as const;
}

function view(room: RoomRow, seat: Seat) {
  const state = isPeerSessionState(room.state) ? room.state : null;
  const person = (s: Seat) => ({
    seat: s,
    firstName: s === "A" ? room.studentAName : room.studentBName,
    level: state ? state.levels[s] : null,
  });
  return {
    roomId: room.id,
    status: room.status,
    format: room.format,
    topic: room.topic,
    state,
    version: room.version,
    serverNow: Date.now(),
    me: person(seat),
    partner: person(seat === "A" ? "B" : "A"),
  };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { roomId } = await params;
    const m = await member(roomId);
    if (m.fail) return m.fail;
    return reply(view(m.room, m.seat));
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
      const latest = (await db.speakingRoom.findUnique({ where: { id: room.id } })) as RoomRow | null;
      return reply({ error: "The session moved on — refresh.", state: latest?.state ?? null, version: latest?.version ?? room.version }, 409);
    }
    if (done) await db.speakingQueue.deleteMany({ where: { roomId: room.id } }).catch(() => undefined);
    return reply({ state: next.state, version: next.version, changed: true });
  } catch (e) {
    console.error("Speaking session update failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Session unavailable right now." }, 503);
  }
}
