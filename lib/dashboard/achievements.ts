/**
 * Rows of the dashboard's "Achievements" card. Pure.
 *
 * Badges are awarded on the student's next activity (checkAndAwardAchievements),
 * so a badge can be complete (current >= target) but not unlocked yet. Such a
 * row is `ready`: it shows a "Ready" pill instead of a "10/10" count that looks
 * stuck next to "0/8 unlocked".
 */
export interface AchievementProgressValue {
  current: number;
  target: number;
  percent: number;
}

export interface AchievementRow<T> {
  a: T;
  /** Unlocked (awarded). */
  done: boolean;
  /** Locked, but the target is already reached: unlocks with the next activity. */
  ready: boolean;
  /** Progress, capped at `target`. */
  current: number;
  target: number;
  pct: number;
}

/**
 * Locked first (ready ones at the top, then by percent), unlocked last (by percent).
 * Stable for ties. Returns at most `limit` rows.
 */
export function rankAchievementRows<T extends { id: string; type: string }>(
  achievements: readonly T[],
  unlockedIds: ReadonlySet<string>,
  progress: (type: T["type"]) => AchievementProgressValue,
  limit = 5,
): AchievementRow<T>[] {
  return achievements
    .map((a): AchievementRow<T> => {
      const done = unlockedIds.has(a.id);
      const { current: raw, target, percent: pct } = progress(a.type);
      return { a, done, ready: !done && raw >= target, current: Math.min(raw, target), target, pct };
    })
    .sort((x, y) => {
      if (x.done !== y.done) return x.done ? 1 : -1;
      if (x.ready !== y.ready) return x.ready ? -1 : 1;
      return y.pct - x.pct;
    })
    .slice(0, Math.max(0, limit));
}
