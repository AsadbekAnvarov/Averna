/**
 * XP for a finished peer speaking session (docs/peer-speaking.md, Phase B). Server only.
 * Both students get SPEAKING_SESSION_COMPLETED once per room through awardXp — the
 * ledger's (studentId, idempotencyKey) index makes a repeat a no-op — after the
 * daily learning budget taper — and only when the fair-XP rules allow it
 * (lib/speaking/xp-rules.ts: ≥ 50% timed, one award per partner per day, 3 per day).
 */
import { db } from "@/lib/db";
import { awardXp, BUDGETED_ACTIONS, findAward } from "@/lib/engine/xp-engine";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { applyDailyBudget } from "@/lib/engine/progression/xp";
import { tashkentDayStart } from "@/lib/utils";
import { plannedTimedMs, type PeerSessionState, type Seat } from "./session";
import { peerXpHold, type PeerXpHold } from "./xp-rules";

export const peerXpKey = (roomId: string, studentId: string) => `peer-speaking:${roomId}:${studentId}`;

/** Raw XP for a format before the daily budget. */
export const peerSessionXp = (format: string): number => XP_CONFIG.peerSpeaking[format] ?? XP_CONFIG.peerSpeaking.conversation;

async function earnedToday(studentId: string): Promise<number> {
  const logs = await db.activityLog.findMany({
    where: { studentId, createdAt: { gte: tashkentDayStart() }, action: { in: BUDGETED_ACTIONS }, points: { gt: 0 } },
    select: { points: true },
  });
  return logs.reduce((s, l) => s + (l.points ?? 0), 0);
}

/**
 * Peer awards a student already got today (Tashkent), overall and with `partnerId`,
 * excluding `roomId` itself. Reads the SPEAKING_SESSION_COMPLETED rows written with
 * each award (details.kind "peer") and their rooms.
 */
export async function peerAwardsToday(studentId: string, partnerId: string, roomId: string, now = Date.now()) {
  const logs = await db.activityLog.findMany({
    where: { studentId, action: "SPEAKING_SESSION_COMPLETED", createdAt: { gte: tashkentDayStart(new Date(now)) } },
    select: { details: true },
    take: 50,
  });
  const roomIds = [
    ...new Set(
      logs
        .map((l) => l.details as { kind?: unknown; roomId?: unknown } | null)
        .filter((d) => d?.kind === "peer" && typeof d.roomId === "string" && d.roomId !== roomId)
        .map((d) => d!.roomId as string),
    ),
  ];
  if (!roomIds.length) return { awardsToday: 0, pairAwardsToday: 0 };
  const withPartner = await db.speakingRoom.count({
    where: { id: { in: roomIds }, OR: [{ studentAId: partnerId }, { studentBId: partnerId }] },
  });
  return { awardsToday: roomIds.length, pairAwardsToday: withPartner };
}

/** Rule check for both seats of a naturally finished room. Throws on a database error (the caller pays nothing then). */
export async function peerXpHolds(
  room: { id: string; studentAId: string; studentBId: string },
  state: PeerSessionState,
  now = Date.now(),
): Promise<Record<Seat, PeerXpHold | null>> {
  const natural = state.endedBy === null;
  const base = { natural, timedMs: state.timedMs ?? 0, plannedMs: plannedTimedMs(state) };
  const first = peerXpHold({ ...base, pairAwardsToday: 0, awardsToday: 0 });
  if (first) return { A: first, B: first };
  const [a, b] = await Promise.all([
    peerAwardsToday(room.studentAId, room.studentBId, room.id, now),
    peerAwardsToday(room.studentBId, room.studentAId, room.id, now),
  ]);
  return { A: peerXpHold({ ...base, ...a }), B: peerXpHold({ ...base, ...b }) };
}

/** Award one student; returns the XP paid (the original amount when it was already paid). Never throws. */
export async function awardPeerSession(input: { roomId: string; studentId: string; format: string; durationSec: number | null }): Promise<number> {
  const key = peerXpKey(input.roomId, input.studentId);
  try {
    const amount = Math.round(applyDailyBudget(peerSessionXp(input.format), await earnedToday(input.studentId)));
    const result = await awardXp({
      studentId: input.studentId,
      amount,
      source: "test",
      idempotencyKey: key,
      activity: "peer-speaking",
      refId: input.roomId,
      skipLog: true,
      // The feed/analytics row commits with the award, so a repeat writes neither.
      atomicWith: [
        db.activityLog.create({
          data: {
            studentId: input.studentId,
            action: "SPEAKING_SESSION_COMPLETED",
            details: { kind: "peer", roomId: input.roomId, format: input.format, duration: input.durationSec, idem: key },
            points: amount,
          },
        }),
      ],
    });
    if (result.duplicate) return (await findAward(input.studentId, key))?.amount ?? 0;
    return result.applied ? result.amount : 0;
  } catch (e) {
    console.error("Peer speaking XP failed", e instanceof Error ? e.name : "unknown");
    return 0;
  }
}

/** XP already paid to a student for a room (ledger read), or null. */
export async function peerSessionAward(roomId: string, studentId: string): Promise<number | null> {
  const row = await findAward(studentId, peerXpKey(roomId, studentId));
  return row ? row.amount : null;
}
