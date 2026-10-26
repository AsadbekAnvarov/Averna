/**
 * XP for a finished peer speaking session (docs/peer-speaking.md, Phase B). Server only.
 * Both students get SPEAKING_SESSION_COMPLETED once per room through awardXp — the
 * ledger's (studentId, idempotencyKey) index makes a repeat a no-op — after the
 * daily learning budget taper.
 */
import { db } from "@/lib/db";
import { awardXp, BUDGETED_ACTIONS, findAward } from "@/lib/engine/xp-engine";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { applyDailyBudget } from "@/lib/engine/progression/xp";
import { tashkentDayStart } from "@/lib/utils";

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
