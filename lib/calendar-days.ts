/**
 * Pure helpers for the phone month view of the student and teacher calendars
 * (components/calendar/phone-month.tsx): what happens on each day of a month and
 * which day the `?d=` search param selects.
 */

export type DayItemKind = "lesson" | "tutoring" | "homework";

export interface DayItem {
  kind: DayItemKind;
  /** Full name shown in the day panel (group name, slot time / topic, homework title). */
  label: string;
}

/** Something that repeats every week on `weekday` (0 = Sunday … 6 = Saturday, like Date#getDay). */
export interface WeeklyItem {
  kind: "lesson" | "tutoring";
  weekday: number;
  label: string;
}

/** A homework deadline; only the ones inside the given month are used (local time). */
export interface DueItem {
  due: Date;
  label: string;
}

export function daysInMonthOf(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Items of every day 1…daysInMonth of `month` (0-based) in `year`: weekly items on matching
 * weekdays (lessons before tutoring, input order kept), then the homework due that day.
 * Days without anything map to an empty list.
 */
export function buildDayItems({
  year,
  month,
  weekly,
  homework,
}: {
  year: number;
  month: number;
  weekly: readonly WeeklyItem[];
  homework: readonly DueItem[];
}): Record<number, DayItem[]> {
  const days = daysInMonthOf(year, month);
  const out: Record<number, DayItem[]> = {};
  const lessons = weekly.filter((w) => w.kind === "lesson");
  const tutoring = weekly.filter((w) => w.kind === "tutoring");
  for (let d = 1; d <= days; d++) {
    const weekday = new Date(year, month, d).getDay();
    out[d] = [
      ...lessons.filter((w) => w.weekday === weekday).map((w) => ({ kind: w.kind, label: w.label })),
      ...tutoring.filter((w) => w.weekday === weekday).map((w) => ({ kind: w.kind, label: w.label })),
    ];
  }
  for (const h of homework) {
    const due = h.due;
    if (Number.isNaN(due.getTime()) || due.getFullYear() !== year || due.getMonth() !== month) continue;
    out[due.getDate()].push({ kind: "homework", label: h.label });
  }
  return out;
}

/**
 * The selected day from the `?d=` search param, always in [1, daysInMonth]. A number outside
 * the month is clamped to it; a missing or malformed value selects today when `todayDay` is a
 * day of this month (the pages pass -1 for other months), else the 1st.
 */
export function parseSelectedDay(
  d: string | string[] | null | undefined,
  daysInMonth: number,
  todayDay: number
): number {
  const max = Math.max(1, Math.floor(Number.isFinite(daysInMonth) ? daysInMonth : 1));
  const fallback = Number.isInteger(todayDay) && todayDay >= 1 && todayDay <= max ? todayDay : 1;
  const raw = (Array.isArray(d) ? d[0] : d)?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const n = Number.parseInt(raw, 10);
  return Math.min(max, Math.max(1, n));
}
