/**
 * XP for a live speaking-partner call (docs/elegance-roadmap.md, idea 3). SERVER ONLY.
 * Same pattern as peer speaking (lib/speaking/peer-xp.ts): SPEAKING_SESSION_COMPLETED
 * (details.kind "live") through awardXp with an idempotency key per call, after the
 * daily learning budget taper. Paid only when the student spoke ≥ 60 s (capped by the
 * call's own server-measured length) and at most 3 calls a Tashkent day.
 */
import { db } from "@/lib/db";
import { awardXp, BUDGETED_ACTIONS, findAward } from "@/lib/engine/xp-engine";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { applyDailyBudget } from "@/lib/engine/progression/xp";
import { tashkentDayStart } from "@/lib/utils";

export type LiveXpHold = "short" | "daily";

export const LIVE_XP_HOLD_TEXT: Record<LiveXpHold, string> = {
  short: "Talk for at least 1 minute in a call to earn XP.",
  daily: "You've earned today's live-call XP. Practice still counts.",
};

export const liveXpKey = (callRowId: string, studentId: string) => `live-speaking:${callRowId}:${studentId}`;

/** Why no XP is paid, or null when it is. Pure. */
export function liveXpHold(input: { speechSec: number; callSec: number; awardsToday: number }): LiveXpHold | null {
  const speech = Math.min(Math.max(0, input.speechSec || 0), Math.max(0, input.callSec || 0));
  if (!(speech >= XP_CONFIG.liveSpeaking.minSpeechSec)) return "short";
  if (input.awardsToday >= XP_CONFIG.liveSpeaking.callsPerDay) return "daily";
  return null;
}

async function earnedToday(studentId: string): Promise<number> {
  const logs = await db.activityLog.findMany({
    where: { studentId, createdAt: { gte: tashkentDayStart() }, action: { in: BUDGETED_ACTIONS }, points: { gt: 0 } },
    select: { points: true },
  });
  return logs.reduce((s, l) => s + (l.points ?? 0), 0);
}

async function liveAwardsToday(studentId: string, callRowId: string): Promise<number> {
  const logs = await db.activityLog.findMany({
    where: { studentId, action: "SPEAKING_SESSION_COMPLETED", createdAt: { gte: tashkentDayStart() } },
    select: { details: true },
    take: 50,
  });
  return logs.filter((l) => {
    const d = l.details as { kind?: unknown; callRowId?: unknown } | null;
    return d?.kind === "live" && d.callRowId !== callRowId;
  }).length;
}

export interface LiveXpResult {
  xp: number;
  hold: LiveXpHold | null;
}

/** Award one finished call; a repeat returns the original amount. Never throws. */
export async function awardLiveCall(input: { callRowId: string; studentId: string; speechSec: number; callSec: number; mode: string }): Promise<LiveXpResult> {
  const key = liveXpKey(input.callRowId, input.studentId);
  try {
    const paid = await findAward(input.studentId, key);
    if (paid) return { xp: paid.amount, hold: null };
    const hold = liveXpHold({ speechSec: input.speechSec, callSec: input.callSec, awardsToday: await liveAwardsToday(input.studentId, input.callRowId) });
    if (hold) return { xp: 0, hold };
    const amount = Math.round(applyDailyBudget(XP_CONFIG.liveSpeaking.perCall, await earnedToday(input.studentId)));
    const speech = Math.round(Math.min(input.speechSec, input.callSec));
    const result = await awardXp({
      studentId: input.studentId,
      amount,
      source: "test",
      idempotencyKey: key,
      activity: "live-speaking",
      refId: input.callRowId,
      skipLog: true,
      atomicWith: [
        db.activityLog.create({
          data: {
            studentId: input.studentId,
            action: "SPEAKING_SESSION_COMPLETED",
            details: { kind: "live", title: "Live speaking partner", callRowId: input.callRowId, mode: input.mode, duration: input.callSec, speechSec: speech, idem: key },
            points: amount,
          },
        }),
      ],
    });
    if (result.duplicate) return { xp: (await findAward(input.studentId, key))?.amount ?? 0, hold: null };
    return { xp: result.applied ? result.amount : 0, hold: null };
  } catch (e) {
    console.error("Live speaking XP failed", e instanceof Error ? e.name : "unknown");
    return { xp: 0, hold: null };
  }
}
