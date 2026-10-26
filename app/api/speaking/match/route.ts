import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boundedJson } from "@/lib/security/json-body";
import { reserveLimits } from "@/lib/security/rate-limit";
import { trustedMutation } from "@/lib/security/same-origin";
import { clampBand } from "@/lib/speaking/level";
import {
  FRESH_MS,
  STALE_MS,
  SUGGEST_ALTERNATIVES_MS,
  isPeerFormat,
  pickPartner,
  recentPartnersOf,
  type MatchContext,
  type PeerFormat,
  type WaitingEntry,
} from "@/lib/speaking/matching";
import { buildPeerContent, peerContentTitle } from "@/lib/speaking/peer-content";
import { PAUSED_MESSAGE, firstName, isPeerSpeakingPaused, peerPresence, studentPeerLevel } from "@/lib/speaking/peer-store";
import { initialSessionState, type Seat } from "@/lib/speaking/session";

export const dynamic = "force-dynamic";

/**
 * Peer speaking matchmaking (docs/peer-speaking.md §3).
 *   POST   { format }  join (or switch format)        → MatchStatus   (6 per minute per student)
 *   GET               heartbeat + match attempt       → MatchStatus   (client: every 3 s while visible)
 *   DELETE            leave the queue                 → { ok: true }
 */

const JOIN_LIMIT = { limit: 6, seconds: 60 };
/** Matched queue rows are kept this long so the partner's next poll still finds the room. */
const MATCHED_KEEP_MS = 30 * 60_000;
const RECENT_WINDOW_MS = 30 * 24 * 3600_000;

const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

type QueueRow = {
  id: string;
  studentId: string;
  roomId: string | null;
  format: string;
  level: number;
  groupId: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  studentName: string;
};

const toEntry = (r: QueueRow): WaitingEntry => ({
  id: r.id,
  studentId: r.studentId,
  groupId: r.groupId,
  level: r.level,
  format: (isPeerFormat(r.format) ? r.format : "conversation") as PeerFormat,
  joinedAt: r.createdAt.getTime(),
  lastSeenAt: r.lastSeenAt.getTime(),
});

async function caller() {
  const session = await auth();
  if (!session?.user) return { fail: reply({ error: "Please sign in again.", code: "auth" }, 401) } as const;
  if (session.user.role !== "STUDENT")
    return { fail: reply({ error: "Peer speaking is for students.", code: "role" }, 403) } as const;
  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, groupId: true, level: true, targetBand: true, user: { select: { name: true } } },
  });
  if (!student) return { fail: reply({ error: "Student profile not found.", code: "profile" }, 404) } as const;
  return { student } as const;
}

/** The room of a matched entry, while it is still active. */
async function activeRoomId(roomId: string | null): Promise<string | null> {
  if (!roomId) return null;
  const room = await db.speakingRoom.findUnique({ where: { id: roomId }, select: { status: true } });
  return room?.status === "ACTIVE" ? roomId : null;
}

class ClaimLost extends Error {}

async function waiting(me: QueueRow, now: number) {
  const presence = await peerPresence(now, me.studentId).catch(() => ({ total: 0, byFormat: {} }));
  const waitedMs = Math.max(0, now - me.createdAt.getTime());
  return reply({
    status: "waiting",
    format: me.format,
    level: me.level,
    waitingSec: Math.floor(waitedMs / 1000),
    lookingNow: presence.total,
    byFormat: presence.byFormat,
    suggestAlternatives: waitedMs >= SUGGEST_ALTERNATIVES_MS,
  });
}

/** Lazy cleanup, then try to pair `me` with the best fresh partner; race-safe claim of both rows. */
async function matchStep(me: QueueRow, now: number) {
  await db.speakingQueue
    .deleteMany({
      where: {
        OR: [
          { roomId: null, lastSeenAt: { lt: new Date(now - STALE_MS) } },
          { lastSeenAt: { lt: new Date(now - MATCHED_KEEP_MS) } },
        ],
      },
    })
    .catch(() => undefined);

  const rows = (await db.speakingQueue.findMany({
    where: {
      roomId: null,
      format: me.format,
      studentId: { not: me.studentId },
      lastSeenAt: { gte: new Date(now - FRESH_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  })) as QueueRow[];
  if (!rows.length) return waiting(me, now);

  const ids = rows.map((r) => r.studentId);
  const everyone = [me.studentId, ...ids];
  const [blocks, rooms] = await Promise.all([
    db.speakingBlock.findMany({
      where: {
        OR: [
          { blockerId: me.studentId, blockedId: { in: ids } },
          { blockedId: me.studentId, blockerId: { in: ids } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
    db.speakingRoom.findMany({
      where: {
        createdAt: { gte: new Date(now - RECENT_WINDOW_MS) },
        OR: [{ studentAId: { in: everyone } }, { studentBId: { in: everyone } }],
      },
      orderBy: { createdAt: "desc" },
      select: { studentAId: true, studentBId: true },
      take: 300,
    }),
  ]);
  const ctx: MatchContext = {
    blocks,
    recentPartners: Object.fromEntries(everyone.map((id) => [id, recentPartnersOf(id, rooms)])),
  };
  const pick = pickPartner(toEntry(me), rows.map(toEntry), ctx, now);
  if (!pick) return waiting(me, now);
  const partner = rows.find((r) => r.id === pick.id)!;

  // A is the longer waiter; who leads round 1 is random.
  const [a, b] = partner.createdAt.getTime() <= me.createdAt.getTime() ? [partner, me] : [me, partner];
  const format = toEntry(me).format;
  const level = clampBand((a.level + b.level) / 2);
  const content = buildPeerContent(format, level);
  const starter: Seat = Math.random() < 0.5 ? "A" : "B";
  const state = initialSessionState(content, starter, { A: a.level, B: b.level });
  const roomId = randomUUID();

  try {
    await db.$transaction(async (tx) => {
      // Lock both rows in a fixed order so two crossing claims can never deadlock.
      for (const row of [me, partner].sort((x, y) => x.id.localeCompare(y.id))) {
        const claimed = await tx.speakingQueue.updateMany({
          where: {
            id: row.id,
            roomId: null,
            format: me.format,
            ...(row.id === partner.id ? { lastSeenAt: { gte: new Date(now - FRESH_MS) } } : {}),
          },
          data: { roomId },
        });
        if (claimed.count !== 1) throw new ClaimLost();
      }
      await tx.speakingRoom.create({
        data: {
          id: roomId,
          topic: peerContentTitle(content).slice(0, 200),
          format,
          level,
          state: state as unknown as Prisma.InputJsonValue,
          version: 0,
          studentAId: a.studentId,
          studentAName: a.studentName,
          studentBId: b.studentId,
          studentBName: b.studentName,
        },
      });
    });
    return reply({ status: "matched", roomId });
  } catch (e) {
    if (!(e instanceof ClaimLost)) throw e;
    // Someone else claimed one of us first — maybe me.
    const fresh = (await db.speakingQueue.findUnique({ where: { studentId: me.studentId } })) as QueueRow | null;
    const mine = await activeRoomId(fresh?.roomId ?? null);
    if (mine) return reply({ status: "matched", roomId: mine });
    return waiting(fresh ?? me, now);
  }
}

export async function POST(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const who = await caller();
    if (who.fail) return who.fail;
    const { student } = who;

    let body: unknown;
    try {
      body = await boundedJson(request, 1000);
    } catch {
      return reply({ error: "Invalid request" }, 400);
    }
    const format = (body as { format?: unknown } | null)?.format;
    if (!isPeerFormat(format)) return reply({ error: "Choose a format: exam, quick, conversation or debate." }, 400);

    const rate = await reserveLimits([{ key: `speaking-match:${student.id}`, ...JOIN_LIMIT }]);
    if (!rate.ok)
      return reply(
        { error: rate.unavailable ? "Matching is busy — try again in a minute." : "Too many tries — wait a moment and try again." },
        rate.unavailable ? 503 : 429,
      );

    if (await isPeerSpeakingPaused(student.id)) return reply({ error: PAUSED_MESSAGE, code: "paused" }, 403);

    const now = Date.now();
    const existing = (await db.speakingQueue.findUnique({ where: { studentId: student.id } })) as QueueRow | null;
    const room = await activeRoomId(existing?.roomId ?? null);
    if (room) return reply({ status: "matched", roomId: room });

    const level = await studentPeerLevel(student);
    // Re-joining with the same format keeps the place in the queue (and the widened search).
    const keepPlace = existing && !existing.roomId && existing.format === format && now - existing.lastSeenAt.getTime() <= STALE_MS;
    const data = {
      studentName: firstName(student.user.name),
      roomId: null,
      topic: null,
      format,
      level: level.band,
      groupId: student.groupId,
      lastSeenAt: new Date(now),
      ...(keepPlace ? {} : { createdAt: new Date(now) }),
    };
    const me = (await db.speakingQueue.upsert({
      where: { studentId: student.id },
      create: { studentId: student.id, ...data, createdAt: new Date(now) },
      update: data,
    })) as QueueRow;
    return await matchStep(me, now);
  } catch (e) {
    console.error("Speaking match failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Matching is unavailable right now. Try again." }, 503);
  }
}

export async function GET() {
  try {
    const who = await caller();
    if (who.fail) return who.fail;
    const { student } = who;
    const now = Date.now();
    const entry = (await db.speakingQueue.findUnique({ where: { studentId: student.id } })) as QueueRow | null;
    if (!entry) {
      const presence = await peerPresence(now, student.id).catch(() => ({ total: 0, byFormat: {} }));
      return reply({ status: "idle", lookingNow: presence.total, byFormat: presence.byFormat });
    }
    if (entry.roomId) {
      const room = await activeRoomId(entry.roomId);
      if (room) return reply({ status: "matched", roomId: room });
      await db.speakingQueue.deleteMany({ where: { id: entry.id, roomId: entry.roomId } });
      const presence = await peerPresence(now, student.id).catch(() => ({ total: 0, byFormat: {} }));
      return reply({ status: "idle", lookingNow: presence.total, byFormat: presence.byFormat });
    }
    const me = (await db.speakingQueue.update({
      where: { id: entry.id },
      data: { lastSeenAt: new Date(now) },
    })) as QueueRow;
    return await matchStep(me, now);
  } catch (e) {
    console.error("Speaking match poll failed", e instanceof Error ? e.name : "unknown");
    return reply({ error: "Matching is unavailable right now." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const who = await caller();
    if (who.fail) return who.fail;
    await db.speakingQueue.deleteMany({ where: { studentId: who.student.id, roomId: null } });
    return reply({ ok: true });
  } catch {
    return reply({ ok: false }, 503);
  }
}
