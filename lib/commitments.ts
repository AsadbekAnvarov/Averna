import { db } from "@/lib/db";
import { updateStudentPoints } from "@/lib/db-helpers";
import { tashkentDateKey } from "@/lib/utils";

/** Bonus is 50% of the stake (rounded), so success = net +50%, failure = -stake. */
export function bonusFor(stake: number): number {
  return Math.max(10, Math.round(stake * 0.5));
}

export const STAKE_OPTIONS = [50, 100, 200];
export const DAYS_OPTIONS = [3, 5, 7];
const WINDOW_DAYS = 7;

export interface Commitment {
  id: string;
  studentId: string;
  targetDays: number;
  stake: number;
  reward: number;
  startAt: Date;
  endAt: Date;
  status: string;
  createdAt: Date;
}

/** Distinct Tashkent calendar days on which the student did a logged activity. */
async function studyDays(studentId: string, from: Date, to: Date): Promise<number> {
  const logs = await db.activityLog.findMany({
    where: { studentId, createdAt: { gte: from, lte: to } },
    select: { createdAt: true },
  });
  const days = new Set(logs.map((l) => tashkentDateKey(l.createdAt)));
  return days.size;
}

/** Live progress for a commitment (capped at its end date). */
export async function commitmentProgress(c: Commitment, now: Date = new Date()): Promise<number> {
  const to = now < c.endAt ? now : c.endAt;
  return studyDays(c.studentId, c.startAt, to);
}

/**
 * Lazily resolve any active commitments whose window has ended: award stake +
 * bonus on success, or leave the (already-escrowed) stake lost on failure.
 * Safe to call on every dashboard load. Returns the results just resolved.
 */
export async function resolveDueCommitments(
  studentId: string
): Promise<{ status: "succeeded" | "failed"; reward: number; stake: number }[]> {
  const results: { status: "succeeded" | "failed"; reward: number; stake: number }[] = [];
  try {
    const due = (await db.commitment.findMany({
      where: { studentId, status: "active", endAt: { lte: new Date() } },
    })) as Commitment[];

    for (const c of due) {
      const progress = await studyDays(c.studentId, c.startAt, c.endAt);
      if (progress >= c.targetDays) {
        await updateStudentPoints(studentId, c.stake + c.reward); // return stake + bonus
        await db.commitment.update({ where: { id: c.id }, data: { status: "succeeded" } });
        results.push({ status: "succeeded", reward: c.reward, stake: c.stake });
      } else {
        await db.commitment.update({ where: { id: c.id }, data: { status: "failed" } });
        results.push({ status: "failed", reward: c.reward, stake: c.stake });
      }
    }
  } catch {
    /* table not migrated yet — ignore */
  }
  return results;
}

/** The student's current active commitment, if any. */
export async function getActiveCommitment(studentId: string): Promise<Commitment | null> {
  try {
    return (await db.commitment.findFirst({
      where: { studentId, status: "active" },
      orderBy: { createdAt: "desc" },
    })) as Commitment | null;
  } catch {
    return null;
  }
}

/** The most recently resolved commitment (for a short "last result" note). */
export async function getLastResolved(studentId: string): Promise<Commitment | null> {
  try {
    return (await db.commitment.findFirst({
      where: { studentId, status: { in: ["succeeded", "failed"] } },
      orderBy: { endAt: "desc" },
    })) as Commitment | null;
  } catch {
    return null;
  }
}

/** Create a commitment, escrowing the stake immediately (loss aversion). */
export async function createCommitment(
  studentId: string,
  targetDays: number,
  stake: number
): Promise<{ ok: boolean; error?: string }> {
  const td = DAYS_OPTIONS.includes(targetDays) ? targetDays : 5;
  const st = STAKE_OPTIONS.includes(stake) ? stake : 50;

  const student = await db.student.findUnique({ where: { id: studentId }, select: { totalPoints: true } });
  if (!student) return { ok: false, error: "no-student" };

  const existing = await getActiveCommitment(studentId);
  if (existing) return { ok: false, error: "active-exists" };

  if (student.totalPoints < st) return { ok: false, error: "not-enough" };

  const now = new Date();
  const endAt = new Date(now.getTime() + WINDOW_DAYS * 86400000);

  await updateStudentPoints(studentId, -st); // escrow the stake
  await db.commitment.create({
    data: { studentId, targetDays: td, stake: st, reward: bonusFor(st), startAt: now, endAt, status: "active" },
  });
  return { ok: true };
}
