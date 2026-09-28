/**
 * Data for the bot's reports and /status — batched Prisma queries whose rows go
 * to the pure builders in builders.ts (tested offline on synthetic data).
 *
 * Scope rules: a teacher only ever sees the students of their own groups, a
 * parent only their own child, and nothing here reads private teacher notes.
 * "Waiting for review" reuses the review queue's own count (pendingReviewCount),
 * so the number in Telegram matches the teacher's queue in the app.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { BUDGETED_ACTIONS } from "@/lib/engine/xp-engine";
import { STREAK_CONFIG } from "@/lib/engine/progression/config";
import { pendingReviewCount } from "@/lib/review/queue";
import {
  addDays,
  buildStudentReminder,
  buildStudentStatus,
  buildTeacherDigest,
  buildTeacherStatus,
  buildWeeklyReport,
  dayBounds,
  pairKey,
  weekOf,
  type ActivityRow,
  type AdminSummary,
  type GroupRow,
  type HomeworkRow,
  type StudentReminder,
  type StudentStatus,
  type TeacherDigest,
  type TeacherStatus,
  type WeeklyReport,
} from "./builders";

/** Writing / Speaking attempts count as "waiting for review" for this many days. */
export const REVIEW_WINDOW_DAYS = 14;
/** Days ahead covered by a teacher's /status. */
const UPCOMING_DAYS = 7;

const HW_SELECT = { id: true, title: true, contentTitle: true, groupId: true, dueDate: true } as const;
const STUDENT_SELECT = {
  id: true,
  userId: true,
  groupId: true,
  currentStreak: true,
  lastActiveDate: true,
  streakFreezes: true,
  user: { select: { name: true } },
} as const;

type StudentRow = {
  id: string;
  userId: string;
  groupId: string | null;
  currentStreak: number;
  lastActiveDate: Date;
  streakFreezes: number;
  user: { name: string | null } | null;
};
type SubmissionRow = { homeworkId: string; studentId: string };

const unique = (xs: (string | null | undefined)[]): string[] => Array.from(new Set(xs.filter((x): x is string => !!x)));

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

/** Map with at most `limit` calls in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker()));
  return out;
}

async function submissionsFor(homeworkIds: string[], studentIds?: string[]): Promise<SubmissionRow[]> {
  if (!homeworkIds.length || (studentIds && !studentIds.length)) return [];
  return db.homeworkSubmission.findMany({
    where: { homeworkId: { in: homeworkIds }, ...(studentIds ? { studentId: { in: studentIds } } : {}) },
    select: { homeworkId: true, studentId: true },
  });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/** 19:00 reminders for these student users (only those with something to say). */
export async function loadStudentReminders(userIds: string[], now: Date): Promise<StudentReminder[]> {
  if (!userIds.length) return [];
  const students: StudentRow[] = await db.student.findMany({ where: { userId: { in: userIds } }, select: STUDENT_SELECT });
  if (!students.length) return [];
  const { tomorrow, dayAfter } = dayBounds(now);
  const groupIds = unique(students.map((s) => s.groupId));
  const homework: HomeworkRow[] = groupIds.length
    ? await db.homework.findMany({ where: { groupId: { in: groupIds }, dueDate: { gte: tomorrow, lt: dayAfter } }, select: HW_SELECT })
    : [];
  const subs = await submissionsFor(
    homework.map((h) => h.id),
    students.map((s) => s.id)
  );
  const submitted = new Set(subs.map((s) => pairKey(s.studentId, s.homeworkId)));
  const out: StudentReminder[] = [];
  for (const s of students) {
    const r = buildStudentReminder({ ...s, name: s.user?.name ?? null }, homework, submitted, now);
    if (r) out.push(r);
  }
  return out;
}

/** /status for a student: streak and the next homework to submit. */
export async function loadStudentStatus(userId: string, now: Date): Promise<StudentStatus | null> {
  const s: StudentRow | null = await db.student.findUnique({ where: { userId }, select: STUDENT_SELECT });
  if (!s) return null;
  let next: { title: string | null; contentTitle: string | null; dueDate: Date } | null = null;
  let pending = 0;
  if (s.groupId) {
    const where = { groupId: s.groupId, dueDate: { gte: now }, submissions: { none: { studentId: s.id } } };
    [next, pending] = await Promise.all([
      db.homework.findFirst({ where, orderBy: { dueDate: "asc" }, select: { title: true, contentTitle: true, dueDate: true } }),
      db.homework.count({ where }),
    ]);
  }
  return buildStudentStatus({ ...s, name: s.user?.name ?? null }, next, pending, now);
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

type TeacherRow = {
  id: string;
  userId: string;
  user: { name: string | null } | null;
  groups: { id: string; name: string; students: { id: string; lastActiveDate: Date; user: { name: string | null } | null }[] }[];
};

function teachersWithGroups(userIds: string[]): Promise<TeacherRow[]> {
  return db.teacher.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      user: { select: { name: true } },
      groups: {
        select: {
          id: true,
          name: true,
          students: { select: { id: true, lastActiveDate: true, user: { select: { name: true } } } },
        },
      },
    },
  });
}

const groupRows = (t: TeacherRow): GroupRow[] =>
  t.groups.map((g) => ({
    id: g.id,
    name: g.name,
    students: g.students.map((s) => ({ id: s.id, name: s.user?.name ?? null, lastActiveDate: s.lastActiveDate })),
  }));

async function homeworkDue(groupIds: string[], from: Date, to: Date): Promise<{ homework: HomeworkRow[]; submissions: SubmissionRow[] }> {
  if (!groupIds.length) return { homework: [], submissions: [] };
  const homework: HomeworkRow[] = await db.homework.findMany({
    where: { groupId: { in: groupIds }, dueDate: { gte: from, lt: to } },
    select: HW_SELECT,
    orderBy: { dueDate: "asc" },
  });
  return { homework, submissions: await submissionsFor(homework.map((h) => h.id)) };
}

/** 19:00 reports for these teacher users: homework due yesterday / today, reviews waiting, inactive students. */
export async function loadTeacherDigests(userIds: string[], now: Date): Promise<TeacherDigest[]> {
  if (!userIds.length) return [];
  const teachers = await teachersWithGroups(userIds);
  if (!teachers.length) return [];
  const { yesterday, tomorrow } = dayBounds(now);
  const { homework, submissions } = await homeworkDue(
    unique(teachers.flatMap((t) => t.groups.map((g) => g.id))),
    yesterday,
    tomorrow
  );
  const subsByHomework = groupBy(submissions, (s) => s.homeworkId);
  const reviews = await mapLimit(teachers, 4, (t) => pendingReviewCount({ id: t.userId, role: "TEACHER" }, REVIEW_WINDOW_DAYS));
  return teachers.map((t, i) => {
    const groups = groupRows(t);
    const mine = new Set(groups.map((g) => g.id));
    const hw = homework.filter((h) => mine.has(h.groupId));
    return buildTeacherDigest({
      userId: t.userId,
      name: t.user?.name ?? null,
      groups,
      homework: hw,
      submissions: hw.flatMap((h) => subsByHomework.get(h.id) ?? []),
      reviewsWaiting: reviews[i],
      now,
    });
  });
}

/** /status for a teacher: homework due in the next 7 days and reviews waiting. */
export async function loadTeacherStatus(userId: string, now: Date): Promise<TeacherStatus | null> {
  const [t] = await teachersWithGroups([userId]);
  if (!t) return null;
  const { today } = dayBounds(now);
  const groups = groupRows(t);
  const [{ homework, submissions }, reviewsWaiting] = await Promise.all([
    homeworkDue(
      groups.map((g) => g.id),
      today,
      addDays(today, UPCOMING_DAYS)
    ),
    pendingReviewCount({ id: userId, role: "TEACHER" }, REVIEW_WINDOW_DAYS),
  ]);
  return buildTeacherStatus({ name: t.user?.name ?? null, groups, homework, submissions, reviewsWaiting, now });
}

// ---------------------------------------------------------------------------
// Admins
// ---------------------------------------------------------------------------

async function countOr0(label: string, p: Promise<number>): Promise<number> {
  try {
    return await p;
  } catch (e) {
    console.error(`Telegram admin summary: ${label} failed:`, e);
    return 0;
  }
}

/** Today's school summary (Tashkent day). `viewerId` is an admin's user id. */
export async function loadAdminSummary(now: Date, viewerId: string): Promise<AdminSummary> {
  const { today } = dayBounds(now);
  const [newStudents, placementsFinished, pendingPayments, homeworkCreated, reviewsWaiting] = await Promise.all([
    countOr0("new students", db.student.count({ where: { createdAt: { gte: today } } })),
    countOr0("placements", db.placementAttempt.count({ where: { status: "finished", finishedAt: { gte: today } } })),
    countOr0("payments", db.payment.count({ where: { status: "PENDING" } })),
    countOr0("homework", db.homework.count({ where: { createdAt: { gte: today } } })),
    pendingReviewCount({ id: viewerId, role: "ADMIN" }, REVIEW_WINDOW_DAYS),
  ]);
  return { day: today, newStudents, placementsFinished, pendingPayments, reviewsWaiting, homeworkCreated };
}

// ---------------------------------------------------------------------------
// Parents
// ---------------------------------------------------------------------------

/** The week so far (Monday → now) for each child — the Sunday report and a parent's /status. */
export async function loadWeeklyReports(studentIds: string[], now: Date): Promise<Map<string, WeeklyReport>> {
  const out = new Map<string, WeeklyReport>();
  const wanted = unique(studentIds);
  if (!wanted.length) return out;
  const students: StudentRow[] = await db.student.findMany({ where: { id: { in: wanted } }, select: STUDENT_SELECT });
  if (!students.length) return out;
  const ids = students.map((s) => s.id);
  const groupIds = unique(students.map((s) => s.groupId));
  const week = weekOf(now);
  const range = { gte: week.start, lte: now };

  const [logs, tests, homework, attendance, reviews] = await Promise.all([
    db.activityLog.findMany({
      where: { studentId: { in: ids }, createdAt: range, action: { in: BUDGETED_ACTIONS } },
      select: { studentId: true, createdAt: true, action: true, points: true, details: true },
    }) as Promise<(ActivityRow & { studentId: string })[]>,
    db.iELTSTest.findMany({
      where: { studentId: { in: ids }, completedAt: range },
      select: { studentId: true, module: true, score: true, completedAt: true },
    }) as Promise<{ studentId: string; module: string; score: number; completedAt: Date }[]>,
    groupIds.length
      ? (db.homework.findMany({
          where: { groupId: { in: groupIds }, dueDate: { gte: week.start, lt: week.end } },
          select: HW_SELECT,
        }) as Promise<HomeworkRow[]>)
      : Promise.resolve([] as HomeworkRow[]),
    db.attendance.findMany({
      where: { studentId: { in: ids }, date: range },
      select: { studentId: true, status: true },
    }) as Promise<{ studentId: string; status: string }[]>,
    db.testReview.findMany({
      where: { studentId: { in: ids }, createdAt: range },
      select: { studentId: true },
    }) as Promise<{ studentId: string }[]>,
  ]);
  const subs = await submissionsFor(
    homework.map((h) => h.id),
    ids
  );

  const logsBy = groupBy(logs, (l) => l.studentId);
  const testsBy = groupBy(tests, (t) => t.studentId);
  const hwBy = groupBy(homework, (h) => h.groupId);
  const attBy = groupBy(attendance, (a) => a.studentId);
  const reviewsBy = groupBy(reviews, (r) => r.studentId);
  const subsBy = groupBy(subs, (s) => s.studentId);

  for (const s of students) {
    out.set(
      s.id,
      buildWeeklyReport({
        student: { id: s.id, name: s.user?.name ?? null, currentStreak: s.currentStreak, lastActiveDate: s.lastActiveDate, streakFreezes: s.streakFreezes },
        logs: logsBy.get(s.id) ?? [],
        tests: testsBy.get(s.id) ?? [],
        homework: s.groupId ? hwBy.get(s.groupId) ?? [] : [],
        submittedHomeworkIds: new Set((subsBy.get(s.id) ?? []).map((x) => x.homeworkId)),
        attendance: attBy.get(s.id) ?? [],
        reviews: (reviewsBy.get(s.id) ?? []).length,
        now,
        srsMinReviews: STREAK_CONFIG.srsMinReviewsPerDay,
      })
    );
  }
  return out;
}
