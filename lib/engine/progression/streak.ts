/**
 * Streak rules — pure. The DB side (advanceStreak) lives in xp-engine; these
 * helpers decide what the numbers mean and what to show.
 */

import { STREAK_CONFIG } from "./config";

export interface StreakStep {
  /** New current streak. */
  streak: number;
  /** Freezes left after this step. */
  freezes: number;
  /** A freeze was spent to save the streak. */
  usedFreeze: boolean;
  /** A freeze was earned by hitting a freeze milestone. */
  earnedFreeze: boolean;
  broken: boolean;
}

/**
 * Advance a streak given the calendar-day gap since the last qualifying day.
 *   gap 0  → same day, unchanged (a first qualifying day starts at 1)
 *   gap 1  → +1
 *   gap 2  → +1 if a freeze is available (spent), else reset
 *   gap >2 → reset to 1
 */
export function stepStreak(current: number, gap: number, freezes: number): StreakStep {
  let streak = current;
  let f = Math.max(0, freezes);
  let usedFreeze = false;
  let broken = false;
  if (gap <= 0) {
    streak = Math.max(current, 1);
  } else if (gap === 1) {
    streak = current + 1;
  } else if (gap === 2 && f > 0 && current > 0) {
    streak = current + 1;
    f -= 1;
    usedFreeze = true;
  } else {
    broken = current > 1;
    streak = 1;
  }
  let earnedFreeze = false;
  if (streak !== current && streak > 0 && streak % STREAK_CONFIG.freezeEvery === 0 && f < STREAK_CONFIG.maxFreezes) {
    f += 1;
    earnedFreeze = true;
  }
  return { streak, freezes: f, usedFreeze, earnedFreeze, broken };
}

export function nextStreakMilestone(streak: number): number | null {
  return STREAK_CONFIG.milestones.find((m) => m > streak) ?? null;
}

export function lastStreakMilestone(streak: number): number | null {
  const reached = STREAK_CONFIG.milestones.filter((m) => m <= streak);
  return reached.length ? reached[reached.length - 1] : null;
}

/**
 * Is today's streak still open? `gap` is the calendar-day difference between
 * today and the last qualifying day.
 */
export function streakStatus(current: number, gap: number, freezes: number): "done_today" | "at_risk" | "freeze_will_save" | "broken" | "none" {
  if (current <= 0) return "none";
  if (gap <= 0) return "done_today";
  if (gap === 1) return "at_risk";
  if (gap === 2 && freezes > 0) return "freeze_will_save";
  return "broken";
}
