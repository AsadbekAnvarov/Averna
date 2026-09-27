import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { tashkentDayDiff } from "@/lib/utils";
import { STREAK_CONFIG } from "@/lib/engine/progression/config";
import { stepStreak } from "@/lib/engine/progression/streak";

/**
 * XP Engine — the SINGLE authority for writing Student.totalPoints.
 *
 * Nothing else in the app may mutate totalPoints. Every movement of XP declares
 * a typed `source`, is written to the XP ledger (xp_transactions) and, unless
 * the caller writes its own, to ActivityLog for the student-facing feed.
 *
 * RELIABILITY (Progression Engine):
 *   - The ledger row, the totalPoints increment and any `atomicWith` writes
 *     (e.g. the IELTSTest row a test award belongs to) commit in ONE database
 *     transaction — XP can't exist without its activity, or vice versa.
 *   - The ledger has a unique (studentId, idempotencyKey) index. A double click,
 *     refresh, network retry or duplicate submission reuses the key, and the
 *     database rejects the second award outright (race-proof, unlike a
 *     read-then-write check). The caller is told it was a duplicate and gets the
 *     original `refId` back, so it can return the original result.
 *
 * STREAK: only meaningful learning advances the streak (STREAK_CONFIG). Badges,
 * rewards, commitments and teacher adjustments never do.
 */

/** Sources that represent learning or learning-derived rewards. */
const LEARNING_SOURCES = [
  "test",
  "homework",
  "achievement",
  "challenge",
  "srs_review",
  "commitment_reward",
  "mission",
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

/** Learning sources that count toward the daily XP budget (earned by studying). */
export const BUDGETED_ACTIONS = [
  "IELTS_TEST_COMPLETED",
  "HOMEWORK_SUBMITTED",
  "DAILY_CHALLENGE",
  "SRS_REVIEW",
  "SPEAKING_SESSION_COMPLETED",
];

/** ActivityLog action names, kept stable for existing analytics/league queries. */
const ACTION_FOR: Record<XpSource, string> = {
  test: "IELTS_TEST_COMPLETED",
  homework: "HOMEWORK_SUBMITTED",
  achievement: "ACHIEVEMENT_UNLOCKED",
  challenge: "CHALLENGE_COMPLETED",
  srs_review: "SRS_REVIEW",
  commitment_reward: "COMMITMENT_SUCCEEDED",
  mission: "MISSION_COMPLETED",
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
  /** Ledger metadata: which skill/system, which row, and the XP explanation. */
  activity?: string;
  refId?: string;
  breakdown?: unknown;
  /** Writes committed in the same transaction as the award. */
  atomicWith?: Prisma.PrismaPromise<unknown>[];
  /**
   * Whether this award advances the streak. Defaults to the source rule in
   * STREAK_CONFIG.qualifyingSources (and only for a net gain).
   */
  countsTowardStreak?: boolean;
}

export interface StreakChange {
  previous: number;
  current: number;
  longest: number;
  earnedFreeze: boolean;
  usedFreeze: boolean;
  broken: boolean;
}

export interface AwardXpResult {
  applied: boolean;
  amount: number;
  duplicate: boolean;
  /** For duplicates: the refId recorded by the ORIGINAL award. */
  existingRefId?: string | null;
  streak?: StreakChange | null;
}

function prismaCode(e: unknown): string | undefined {
  return (e as { code?: string } | null)?.code;
}

function isLedgerKeyViolation(e: unknown): boolean {
  if (prismaCode(e) !== "P2002") return false;
  const target = (e as { meta?: { target?: unknown } }).meta?.target;
  const t = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return t.includes("idempotencyKey") || t.includes("xp_transactions");
}

/** P2021 = table does not exist (deploy.sql not applied yet). */
function isMissingLedger(e: unknown): boolean {
  const code = prismaCode(e);
  return code === "P2021" || (code === "P2010" && String((e as Error).message).includes("xp_transactions"));
}

/** Has this key already been paid? (Read-only; for pre-checks before expensive work.) */
export async function findAward(studentId: string, idempotencyKey: string) {
  try {
    return await db.xpTransaction.findUnique({
      where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
    });
  } catch {
    return null;
  }
}

/**
 * Apply an XP movement. The only function permitted to write totalPoints.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const amount = Math.round(Number(input.amount) || 0);
  const hasAtomic = (input.atomicWith?.length ?? 0) > 0;
  if (!input.studentId || (amount === 0 && !input.idempotencyKey && !hasAtomic)) {
    if (hasAtomic) await db.$transaction(input.atomicWith!);
    return { applied: false, amount: 0, duplicate: false };
  }
  const key = input.idempotencyKey ?? `auto:${randomUUID()}`;

  const increment =
    amount !== 0
      ? [db.student.update({ where: { id: input.studentId }, data: { totalPoints: { increment: amount } } })]
      : [];

  try {
    await db.$transaction([
      db.xpTransaction.create({
        data: {
          studentId: input.studentId,
          idempotencyKey: key,
          source: input.source,
          amount,
          activity: input.activity ?? null,
          refId: input.refId ?? null,
          breakdown: (input.breakdown ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      }),
      ...(input.atomicWith ?? []),
      ...increment,
    ]);
  } catch (e) {
    if (isLedgerKeyViolation(e)) {
      const original = await findAward(input.studentId, key);
      return { applied: false, amount: 0, duplicate: true, existingRefId: original?.refId ?? null };
    }
    if (!isMissingLedger(e)) throw e;

    // Ledger table not deployed yet: legacy best-effort idempotency via ActivityLog.
    if (input.idempotencyKey) {
      const existing = await db.activityLog
        .findFirst({
          where: { studentId: input.studentId, details: { path: ["idem"], equals: input.idempotencyKey } },
          select: { id: true },
        })
        .catch(() => null);
      if (existing) return { applied: false, amount: 0, duplicate: true, existingRefId: null };
    }
    await db.$transaction([...(input.atomicWith ?? []), ...increment]);
  }

  if (!input.skipLog && amount !== 0) {
    await db.activityLog
      .create({
        data: {
          studentId: input.studentId,
          action: ACTION_FOR[input.source] ?? "POINTS_ADJUSTED",
          details: {
            ...(input.details ?? {}),
            source: input.source,
            ...(input.idempotencyKey ? { idem: input.idempotencyKey } : {}),
          } as Prisma.InputJsonValue,
          points: amount,
        },
      })
      .catch(() => {
        /* audit write must never break a learning action */
      });
  }

  const qualifies =
    input.countsTowardStreak ?? STREAK_CONFIG.qualifyingSources.includes(input.source);
  const streak = qualifies && amount > 0 ? await advanceStreak(input.studentId).catch(() => null) : null;

  return { applied: true, amount, duplicate: false, streak };
}

/**
 * Advance the verified learning streak. Called only from awardXp for
 * qualifying learning — never on page load, never on spending points.
 * Idempotent per Tashkent calendar day. Every `freezeEvery` streak days the
 * student earns a streak freeze (recovery for one missed day), up to a cap.
 */
export async function advanceStreak(studentId: string): Promise<StreakChange | null> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { currentStreak: true, longestStreak: true, lastActiveDate: true, streakFreezes: true },
  });
  if (!student) return null;

  const today = new Date();
  const gap = tashkentDayDiff(today, new Date(student.lastActiveDate));
  const step = stepStreak(student.currentStreak, gap, student.streakFreezes ?? 0);
  const longest = Math.max(step.streak, student.longestStreak);

  await db.student.update({
    where: { id: studentId },
    data: {
      currentStreak: step.streak,
      longestStreak: longest,
      lastActiveDate: today,
      streakFreezes: step.freezes,
    },
  });

  return {
    previous: student.currentStreak,
    current: step.streak,
    longest,
    earnedFreeze: step.earnedFreeze,
    usedFreeze: step.usedFreeze,
    broken: step.broken,
  };
}
