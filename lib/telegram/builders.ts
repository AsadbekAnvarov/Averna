/**
 * Pure report builders for the Averna bot: database rows in, plain report
 * objects out (messages.ts turns them into text, reports.ts runs the queries).
 * No I/O — unit-tested on synthetic data.
 *
 * Day boundaries are Tashkent calendar days (lib/utils); the streak reading
 * reuses the Progression Engine's rule (streakStatus) so the bot never says
 * "at risk" about a streak the dashboard shows as broken.
 */

import { streakStatus } from "@/lib/engine/progression/streak";
import { tashkentDateKey, tashkentDayDiff, tashkentDayStart, tashkentWeekday } from "@/lib/utils";

export const DAY_MS = 86_400_000;
export type Skill = "READING" | "LISTENING" | "WRITING" | "SPEAKING";
export const SKILL_ORDER: readonly Skill[] = ["READING", "LISTENING", "WRITING", "SPEAKING"];
/** Students with no learning for this many Tashkent days appear in the teacher's report. */
export const INACTIVE_DAYS = 7;
/** Streaks shorter than this aren't worth an "at risk" reminder. */
export const STREAK_REMINDER_MIN = 2;

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);
export const pairKey = (studentId: string, homeworkId: string): string => `${studentId}:${homeworkId}`;

export function homeworkTitle(h: { title?: string | null; contentTitle?: string | null }): string {
  return (h.title ?? "").trim() || (h.contentTitle ?? "").trim() || "Homework";
}

export function personName(name: string | null | undefined, fallback = "Student"): string {
  return (name ?? "").replace(/\s+/g, " ").trim() || fallback;
}

const byName = (a: string, b: string) => a.localeCompare(b);
const toDate = (v: Date | string | null | undefined): Date | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Tashkent midnights around `now`. */
export function dayBounds(now: Date) {
  const today = tashkentDayStart(now);
  return { yesterday: addDays(today, -1), today, tomorrow: addDays(today, 1), dayAfter: addDays(today, 2) };
}

/** The Monday–Sunday week containing `now` (Tashkent): start, exclusive end, days elapsed incl. today. */
export function weekOf(now: Date): { start: Date; end: Date; days: number; lastDay: Date } {
  const today = tashkentDayStart(now);
  const back = (tashkentWeekday(now) + 6) % 7; // Monday → 0 … Sunday → 6
  const start = addDays(today, -back);
  return { start, end: addDays(start, 7), days: back + 1, lastDay: today };
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

export type StreakState = "done_today" | "at_risk" | "freeze_will_save" | "broken" | "none";

export interface StreakRow {
  currentStreak: number;
  lastActiveDate: Date | string | null;
  streakFreezes?: number | null;
}

/** The streak as it stands now: a stored streak whose last day is too long ago reads 0. */
export function streakNow(s: StreakRow, now: Date): { days: number; state: StreakState } {
  const last = toDate(s.lastActiveDate);
  const current = Math.max(0, Math.floor(Number(s.currentStreak) || 0));
  if (!last || current <= 0) return { days: 0, state: "none" };
  const state = streakStatus(current, tashkentDayDiff(now, last), s.streakFreezes ?? 0);
  return { days: state === "broken" || state === "none" ? 0 : current, state };
}

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

export interface HomeworkRow {
  id: string;
  title: string | null;
  contentTitle?: string | null;
  groupId: string;
  dueDate: Date;
}

export interface DueItem {
  title: string;
  dueDate: Date;
}

const byDue = (a: { dueDate: Date }, b: { dueDate: Date }) => a.dueDate.getTime() - b.dueDate.getTime();

export interface GroupStudent {
  id: string;
  name: string | null;
  lastActiveDate?: Date | string | null;
}

export interface GroupRow {
  id: string;
  name: string;
  students: GroupStudent[];
}

export interface HomeworkProgress {
  id: string;
  title: string;
  group: string;
  dueDate: Date;
  /** Tashkent day of the deadline relative to today. */
  when: "yesterday" | "today" | "tomorrow" | "other";
  /** Current group members who submitted. */
  submitted: number;
  total: number;
  /** Names of current members without a submission (sorted). */
  missing: string[];
}

export function buildHomeworkProgress(hw: HomeworkRow, group: GroupRow, submittedStudentIds: Set<string>, now: Date): HomeworkProgress {
  const missing = group.students
    .filter((s) => !submittedStudentIds.has(s.id))
    .map((s) => personName(s.name))
    .sort(byName);
  const gap = tashkentDayDiff(now, hw.dueDate);
  return {
    id: hw.id,
    title: homeworkTitle(hw),
    group: personName(group.name, "Group"),
    dueDate: hw.dueDate,
    when: gap === 1 ? "yesterday" : gap === 0 ? "today" : gap === -1 ? "tomorrow" : "other",
    submitted: group.students.length - missing.length,
    total: group.students.length,
    missing,
  };
}

function progressList(
  homework: HomeworkRow[],
  groups: GroupRow[],
  submissions: { homeworkId: string; studentId: string }[],
  now: Date
): HomeworkProgress[] {
  const byGroup = new Map(groups.map((g) => [g.id, g]));
  const subs = new Map<string, Set<string>>();
  for (const s of submissions) {
    const set = subs.get(s.homeworkId) ?? new Set<string>();
    set.add(s.studentId);
    subs.set(s.homeworkId, set);
  }
  return homework
    .filter((h) => byGroup.has(h.groupId))
    .sort(byDue)
    .map((h) => buildHomeworkProgress(h, byGroup.get(h.groupId) as GroupRow, subs.get(h.id) ?? new Set<string>(), now));
}

// ---------------------------------------------------------------------------
// Students — 19:00 reminder and /status
// ---------------------------------------------------------------------------

export interface ReminderStudent extends StreakRow {
  id: string;
  userId: string;
  name: string | null;
  groupId: string | null;
}

export interface StudentReminder {
  studentId: string;
  userId: string;
  name: string;
  /** Homework due tomorrow (Tashkent) that this student hasn't submitted. */
  dueTomorrow: DueItem[];
  /** A streak of 2+ days that ends tonight unless the student practises. */
  streak: { days: number; state: "at_risk" | "freeze_will_save" } | null;
}

/**
 * `homework`: every homework due tomorrow (any group); `submitted`: pairKey(studentId, homeworkId).
 * null when there's nothing to remind about.
 */
export function buildStudentReminder(
  student: ReminderStudent,
  homework: HomeworkRow[],
  submitted: Set<string>,
  now: Date
): StudentReminder | null {
  const dueTomorrow = student.groupId
    ? homework
        .filter((h) => h.groupId === student.groupId && !submitted.has(pairKey(student.id, h.id)))
        .sort(byDue)
        .map((h) => ({ title: homeworkTitle(h), dueDate: h.dueDate }))
    : [];
  const s = streakNow(student, now);
  const streak =
    s.days >= STREAK_REMINDER_MIN && (s.state === "at_risk" || s.state === "freeze_will_save")
      ? { days: s.days, state: s.state }
      : null;
  if (!dueTomorrow.length && !streak) return null;
  return { studentId: student.id, userId: student.userId, name: personName(student.name), dueTomorrow, streak };
}

export interface StudentStatus {
  name: string;
  streak: { days: number; state: StreakState };
  /** The earliest homework still to submit (due now or later). */
  next: DueItem | null;
  /** How many homework are still to submit. */
  pending: number;
}

export function buildStudentStatus(
  student: StreakRow & { name: string | null },
  next: { title: string | null; contentTitle?: string | null; dueDate: Date } | null,
  pending: number,
  now: Date
): StudentStatus {
  return {
    name: personName(student.name),
    streak: streakNow(student, now),
    next: next ? { title: homeworkTitle(next), dueDate: next.dueDate } : null,
    pending: Math.max(next ? 1 : 0, Math.floor(pending) || 0),
  };
}

// ---------------------------------------------------------------------------
// Teachers — 19:00 report and /status
// ---------------------------------------------------------------------------

export interface TeacherDigest {
  userId: string;
  name: string;
  /** Homework due yesterday and today in the teacher's groups, oldest deadline first. */
  homework: HomeworkProgress[];
  /** Writing / Speaking attempts waiting for review (last 14 days). */
  reviewsWaiting: number;
  /** Students without learning for INACTIVE_DAYS+ days, longest first. */
  inactive: { name: string; days: number }[];
}

export interface TeacherDigestInput {
  userId: string;
  name: string | null;
  groups: GroupRow[];
  /** Homework of these groups due yesterday or today. */
  homework: HomeworkRow[];
  submissions: { homeworkId: string; studentId: string }[];
  reviewsWaiting: number;
  now: Date;
}

export function buildTeacherDigest(i: TeacherDigestInput): TeacherDigest {
  const seen = new Set<string>();
  const inactive: { name: string; days: number }[] = [];
  for (const g of i.groups) {
    for (const s of g.students) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const last = toDate(s.lastActiveDate);
      if (!last) continue;
      const days = tashkentDayDiff(i.now, last);
      if (days >= INACTIVE_DAYS) inactive.push({ name: personName(s.name), days });
    }
  }
  inactive.sort((a, b) => b.days - a.days || byName(a.name, b.name));
  return {
    userId: i.userId,
    name: personName(i.name, "Teacher"),
    homework: progressList(i.homework, i.groups, i.submissions, i.now),
    reviewsWaiting: Math.max(0, Math.floor(i.reviewsWaiting) || 0),
    inactive,
  };
}

export const digestIsEmpty = (d: TeacherDigest): boolean => !d.homework.length && d.reviewsWaiting <= 0 && !d.inactive.length;

export interface TeacherStatus {
  name: string;
  hasGroups: boolean;
  /** Homework due from today through the next 7 days. */
  upcoming: HomeworkProgress[];
  reviewsWaiting: number;
}

export function buildTeacherStatus(i: Omit<TeacherDigestInput, "userId">): TeacherStatus {
  return {
    name: personName(i.name, "Teacher"),
    hasGroups: i.groups.length > 0,
    upcoming: progressList(i.homework, i.groups, i.submissions, i.now),
    reviewsWaiting: Math.max(0, Math.floor(i.reviewsWaiting) || 0),
  };
}

// ---------------------------------------------------------------------------
// Admins — 19:00 summary and /status
// ---------------------------------------------------------------------------

export interface AdminSummary {
  day: Date;
  newStudents: number;
  placementsFinished: number;
  /** Every payment still PENDING (a to-do, not just today's). */
  pendingPayments: number;
  reviewsWaiting: number;
  homeworkCreated: number;
}

// ---------------------------------------------------------------------------
// Parents — the Sunday report and /status
// ---------------------------------------------------------------------------

export interface ActivityRow {
  createdAt: Date;
  action: string;
  points: number;
  details?: unknown;
}

/**
 * Tashkent days in [from, to] with meaningful learning — the dashboard's
 * definition: an XP-earning test / homework / challenge, or a flashcard
 * session of at least `srsMin` reviews that day.
 */
export function activeDayKeys(logs: ActivityRow[], from: Date, to: Date, srsMin: number): Set<string> {
  const days = new Set<string>();
  const srs = new Map<string, number>();
  for (const l of logs) {
    const at = toDate(l.createdAt);
    if (!at || at < from || at > to) continue;
    const k = tashkentDateKey(at);
    if (l.action === "SRS_REVIEW") {
      const d = l.details && typeof l.details === "object" ? (l.details as Record<string, unknown>).count : null;
      srs.set(k, (srs.get(k) ?? 0) + (typeof d === "number" && Number.isFinite(d) ? d : 0));
    } else if (l.points > 0) {
      days.add(k);
    }
  }
  for (const [k, n] of srs) if (n >= srsMin) days.add(k);
  return days;
}

export interface WeeklyInput {
  student: StreakRow & { id: string; name: string | null };
  /** ActivityLog rows of the week (learning actions). */
  logs: ActivityRow[];
  /** IELTSTest rows completed this week. */
  tests: { module: string; score: number; completedAt: Date }[];
  /** Homework of the child's group due this week (Monday–Sunday). */
  homework: HomeworkRow[];
  submittedHomeworkIds: Set<string>;
  /** Attendance marks of the week so far. */
  attendance: { status: string }[];
  /** Teacher reviews (TestReview) received this week. */
  reviews: number;
  now: Date;
  srsMinReviews: number;
}

export interface WeeklyReport {
  studentId: string;
  name: string;
  weekStart: Date;
  /** Today (Tashkent midnight) — the last day covered. */
  lastDay: Date;
  /** Days of the week covered so far, 1–7. */
  days: number;
  activeDays: number;
  /** Skills practised this week (READING, LISTENING, WRITING, SPEAKING order). */
  tests: { skill: Skill; count: number; latestBand: number | null }[];
  homework: { assigned: number; submitted: number; missing: DueItem[] };
  attendance: { present: number; absent: number; late: number; excused: number };
  streak: number;
  reviews: number;
}

export function buildWeeklyReport(i: WeeklyInput): WeeklyReport {
  const week = weekOf(i.now);
  const activeDays = Math.min(week.days, activeDayKeys(i.logs, week.start, i.now, i.srsMinReviews).size);

  const tests: WeeklyReport["tests"] = [];
  for (const skill of SKILL_ORDER) {
    const rows = i.tests
      .filter((t) => String(t.module).toUpperCase() === skill && Number(t.score) > 0)
      .filter((t) => {
        const at = toDate(t.completedAt);
        return !!at && at >= week.start && at <= i.now;
      })
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
    if (!rows.length) continue;
    const latest = Number(rows[rows.length - 1].score);
    tests.push({ skill, count: rows.length, latestBand: Number.isFinite(latest) ? Math.round(latest * 2) / 2 : null });
  }

  const due = i.homework
    .filter((h) => h.dueDate >= week.start && h.dueDate < week.end)
    .sort(byDue);
  const missing = due.filter((h) => !i.submittedHomeworkIds.has(h.id)).map((h) => ({ title: homeworkTitle(h), dueDate: h.dueDate }));

  const attendance = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const a of i.attendance) {
    const s = String(a.status).toUpperCase();
    if (s === "PRESENT") attendance.present++;
    else if (s === "ABSENT") attendance.absent++;
    else if (s === "LATE") attendance.late++;
    else if (s === "EXCUSED") attendance.excused++;
  }

  return {
    studentId: i.student.id,
    name: personName(i.student.name),
    weekStart: week.start,
    lastDay: week.lastDay,
    days: week.days,
    activeDays,
    tests,
    homework: { assigned: due.length, submitted: due.length - missing.length, missing },
    attendance,
    streak: streakNow(i.student, i.now).days,
    reviews: Math.max(0, Math.floor(i.reviews) || 0),
  };
}
