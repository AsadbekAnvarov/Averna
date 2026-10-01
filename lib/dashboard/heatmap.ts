/**
 * Study-activity heatmap (Progress tab, /progress/streaks). Pure.
 *
 * Days are Tashkent calendar days (UTC+5, no DST), like the rest of the app:
 * keying by UTC put activity between 00:00 and 05:00 Tashkent on the previous
 * day. Columns are Monday–Sunday weeks, so every row is one weekday.
 */
import { tashkentDateKey, tashkentWeekStart } from "@/lib/utils";

export const HEATMAP_WEEKS = 12;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export interface HeatmapCell {
  /** YYYY-MM-DD, Tashkent calendar day. */
  key: string;
  count: number;
  level: 0 | 1 | 2 | 3;
  /** A day after today in the current week (always count 0). */
  future: boolean;
  today: boolean;
}

/** `from` = Monday 00:00 Tashkent, HEATMAP_WEEKS - 1 weeks before this week; weekStarts oldest first. */
export function heatmapRange(now: Date = new Date()): { from: Date; weekStarts: Date[] } {
  const fromMs = tashkentWeekStart(now).getTime() - (HEATMAP_WEEKS - 1) * WEEK_MS;
  const weekStarts = Array.from({ length: HEATMAP_WEEKS }, (_, i) => new Date(fromMs + i * WEEK_MS));
  return { from: new Date(fromMs), weekStarts };
}

/** Colour intensity: 0 → 0, 1 → 1, 2–3 → 2, ≥4 → 3 (negative/NaN → 0). */
export function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (!(count >= 1)) return 0;
  if (count < 2) return 1;
  if (count < 4) return 2;
  return 3;
}

/**
 * Buckets activity times by Tashkent day into HEATMAP_WEEKS columns × 7 rows (Mon..Sun).
 * Times before `from` or after `now` are ignored.
 */
export function buildHeatmap(
  times: readonly Date[],
  now: Date = new Date(),
): { weeks: HeatmapCell[][]; activeDays: number; total: number } {
  const { from, weekStarts } = heatmapRange(now);
  const fromMs = from.getTime();
  const nowMs = now.getTime();

  const counts = new Map<string, number>();
  let total = 0;
  for (const t of times) {
    const ms = new Date(t).getTime();
    if (Number.isNaN(ms) || ms < fromMs || ms > nowMs) continue;
    const key = tashkentDateKey(new Date(ms));
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total++;
  }

  const todayKey = tashkentDateKey(now);
  let activeDays = 0;
  const weeks = weekStarts.map((start) =>
    Array.from({ length: 7 }, (_, d): HeatmapCell => {
      // Tashkent has a fixed offset, so +24h from a Tashkent midnight is the next one.
      const key = tashkentDateKey(new Date(start.getTime() + d * DAY_MS));
      // YYYY-MM-DD strings sort chronologically.
      const future = key > todayKey;
      const count = future ? 0 : counts.get(key) ?? 0;
      if (count > 0) activeDays++;
      return { key, count, level: heatLevel(count), future, today: key === todayKey };
    }),
  );

  return { weeks, activeDays, total };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Hover title for a cell, e.g. "Mon 29 Sep: 2 activities". */
export function heatmapCellTitle(cell: Pick<HeatmapCell, "key" | "count">): string {
  const [y, m, d] = cell.key.split("-").map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  const label = `${WEEKDAYS[date.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
  return `${label}: ${cell.count} ${cell.count === 1 ? "activity" : "activities"}`;
}

/** Screen-reader summary of the whole grid. */
export function heatmapSummary(activeDays: number, total: number): string {
  const days = `${activeDays} active ${activeDays === 1 ? "day" : "days"}`;
  const acts = `${total} ${total === 1 ? "activity" : "activities"}`;
  return `Study activity: ${days} and ${acts} in the last ${HEATMAP_WEEKS} weeks`;
}
