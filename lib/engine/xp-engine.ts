import { db } from "@/lib/db";
import { tashkentDayDiff } from "@/lib/utils";

/**
 * XP Engine — the SINGLE authority for writing Student.totalPoints.
 *
 * Nothing else in the app may mutate totalPoints. Every movement of XP declares
 * a typed `source`, is written to ActivityLog for audit, and only genuine
 * LEARNING sources advance the verified streak (spending points on a reward or
 * escrowing a commitment stake must never look like a day of study).
 *
 * Optionally idempotent: pass `idempotencyKey` (e.g. a per-attempt submission id)
 * and a retried request will be recognised and skipped instead of double-awarding.
 */

/** Sources that represent verified learning — these advance the streak. */
const LEARNING_SOURCES = [
  "test",
  "homework",
  "achievement",
  "challenge",
  "srs_review",
  "commitment_reward",
] as const;

/** Sources that move XP without being a learning event. */
const NON_LEARNING_SOURCES = [
  "teacher_bonus", // discretionary: audited, but not evidence of study
  "reward_spend",
  "reward_refund",
  "commitment_stake",
  "grade_adjust",
  "legacy",
] as const;

export type LearningSource = (typeof LEARNING_SOURCES)[number];
export type XpSource = LearningSource | (typeof NON_LEARNING_SOURCES)[number];

const LEARNING = new Set<string>(LEARNING_SOURCES);

/** ActivityLog action names, kept stable for existing analytics/league queries. */
const ACTION_FOR: Record<XpSource, string> = {
  test: "IELTS_TEST_COMPLETED",
  homework: "HOMEWORK_SUBMITTED",
  achievement: "ACHIEVEMENT_UNLOCKED",
  challenge: "CHALLENGE_COMPLETED",
  srs_review: "SRS_REVIEW",
  commitment_reward: "COMMITMENT_SUCCEEDED",
  teacher_bonus: "BONUS_POINTS",
  reward_spend: "REWARD_REDEEMED",
  reward_refund: "REWARD_REFUNDED",
  commitment_stake: "COMMITMENT_STAKED",
  grade_adjust: "GRADE_ADJUSTED",
  legacy: "POINTS_ADJUSTED",
};

export interface AwardXpInput {
  studentId: string;
  /** Signed: positive to grant, negative to spend/escrow. */
  amount: number;
  source: XpSource;
  /** Extra context stored on the audit entry (module, reward name, etc.). */
  details?: Record<string, unknown>;
  /** When set, a repeat call with the same key is a no-op (retry safety). */
  idempotencyKey?: string;
  /** Skip writing an ActivityLog row (for callers that write their own). */
  skipLog?: boolean;
}

export interface AwardXpResult {
  applied: boolean;
  amount: number;
  duplicate: boolean;
}

/**
 * Apply an XP movement. The only function permitted to write totalPoints.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const amount = Math.round(Number(input.amount) || 0);
  if (!input.studentId || amount === 0) {
    return { applied: false, amount: 0, duplicate: false };
  }

  // Idempotency: has this exact movement already been recorded?
  if (input.idempotencyKey) {
    const existing = await db.activityLog
      .findFirst({
        where: { studentId: input.studentId, details: { path: ["idem"], equals: input.idempotencyKey } },
        select: { id: true },
      })
      .catch(() => null);
    if (existing) {
      return { applied: false, amount: 0, duplicate: true };
    }
  }

  await db.student.update({
    where: { id: input.studentId },
    data: { totalPoints: { increment: amount } },
  });

  if (!input.skipLog) {
    await db.activityLog
      .create({
        data: {
          studentId: input.studentId,
          action: ACTION_FOR[input.source] ?? "POINTS_ADJUSTED",
          details: {
            ...(input.details ?? {}),
            source: input.source,
            ...(input.idempotencyKey ? { idem: input.idempotencyKey } : {}),
          },
          points: amount,
        },
      })
      .catch(() => {
        /* audit write must never break a learning action */
      });
  }

  // Only genuine learning, and only a net gain, counts as a day of study.
  if (LEARNING.has(input.source) && amount > 0) {
    await advanceStreak(input.studentId);
  }

  return { applied: true, amount, duplicate: false };
}

/**
 * Advance the verified learning streak. Called only from awardXp for learning
 * sources — never on page load, never on spending points. Idempotent per day.
 */
export async function advanceStreak(studentId: string) {
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) return null;

  const today = new Date();
  const lastActive = new Date(student.lastActiveDate);
  // Compare by Tashkent/Fergana calendar day (UTC+5), not elapsed milliseconds,
  // so the streak depends on the date — not the time of day someone studies.
  const daysDiff = tashkentDayDiff(today, lastActive);

  let newStreak = student.currentStreak;
  let freezes = (student as { streakFreezes?: number }).streakFreezes ?? 0;

  if (daysDiff === 1) {
    newStreak = student.currentStreak + 1;
  } else if (daysDiff === 2 && freezes > 0) {
    // Missed exactly one day, but a streak freeze saves the streak.
    newStreak = student.currentStreak + 1;
    freezes -= 1;
  } else if (daysDiff > 1) {
    newStreak = 1; // streak broken
  } else {
    // Same day: keep it, but a first verified activity starts it at 1.
    newStreak = Math.max(student.currentStreak, 1);
  }

  return await db.student.update({
    where: { id: studentId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, student.longestStreak),
      lastActiveDate: today,
      streakFreezes: freezes,
    },
  });
}
