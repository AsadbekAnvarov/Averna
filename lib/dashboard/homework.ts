/**
 * Which homework the student dashboard shows, and how it is counted. Pure.
 *
 * Unsubmitted homework stays on the dashboard for DASHBOARD_OVERDUE_DAYS after
 * its deadline: the same window the /homework page lists it in and in which a
 * late submission still completes it. Before this, overdue work vanished from
 * the dashboard the moment its deadline passed.
 */
export const DASHBOARD_OVERDUE_DAYS = 30;
/** How many homework cards the Today tab shows (the rest is one tap away on /homework). */
export const DASHBOARD_HOMEWORK_SHOWN = 5;
const DAY_MS = 86_400_000;
/** Earliest deadline still shown: older unsubmitted homework is no longer listed. */
export function overdueWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - DASHBOARD_OVERDUE_DAYS * DAY_MS);
}
export interface HomeworkCounts {
  /** Deadline passed (within the window), not submitted. */
  overdue: number;
  /** Deadline still ahead, not submitted. */
  upcoming: number;
}
/** Splits unsubmitted homework into overdue and upcoming. Rows older than the window are ignored. */
export function homeworkCounts(rows: readonly { dueDate: Date | string }[], now: Date = new Date()): HomeworkCounts {
  const nowMs = now.getTime();
  const fromMs = overdueWindowStart(now).getTime();
  let overdue = 0;
  let upcoming = 0;
  for (const r of rows) {
    const due = new Date(r.dueDate).getTime();
    if (Number.isNaN(due) || due < fromMs) continue;
    if (due < nowMs) overdue++;
    else upcoming++;
  }
  return { overdue, upcoming };
}
/** Display order: overdue first (most overdue at the top), then upcoming by deadline. Stable. Rows outside the window are dropped. */
export function orderDashboardHomework<T extends { dueDate: Date | string }>(rows: readonly T[], now: Date = new Date()): T[] {
  const fromMs = overdueWindowStart(now).getTime();
  return rows
    .map((row, i) => ({ row, i, due: new Date(row.dueDate).getTime() }))
    .filter((x) => !Number.isNaN(x.due) && x.due >= fromMs)
    .sort((a, b) => a.due - b.due || a.i - b.i)
    .map((x) => x.row);
}
