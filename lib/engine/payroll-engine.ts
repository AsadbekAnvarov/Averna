import { db } from "@/lib/db";

/**
 * Payroll Engine (M5) — computes what each teacher is owed for a month.
 *
 * Design rule: this engine owns the *calculation and approval workflow*; it never
 * touches the P&L directly. When a payroll is paid, an `Expense` row is created
 * (category SALARY_TEACHER) and linked via `Payroll.expenseId`, so `Expense`
 * remains the single ledger the Profit Engine reads and salaries can never be
 * double-counted.
 *
 * Lesson counts come from real `LessonLog` entries, with distinct attendance days
 * as a fallback for teachers who mark attendance but don't log lessons.
 */

export const SALARY_TYPES: { key: string; label: string }[] = [
  { key: "monthly", label: "Oylik (fiksirlangan)" },
  { key: "per_lesson", label: "Har bir dars uchun" },
  { key: "hourly", label: "Soatbay" },
];

const TYPE_LABEL = new Map(SALARY_TYPES.map((t) => [t.key, t.label]));
export const salaryTypeLabel = (k?: string | null) => TYPE_LABEL.get(k ?? "") ?? "Belgilanmagan";

/** "YYYY-MM" for a given date (defaults to now). */
export function periodKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Human label for a period key, e.g. "2026-07" → "July 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

/** The last `count` period keys, newest first. */
export function recentPeriods(count = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) out.push(periodKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  return out;
}

function periodRange(period: string): { from: Date; to: Date } {
  const [y, m] = period.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  return { from, to };
}

/**
 * Net pay for a set of inputs. Pure, so the same maths drives the suggestion in
 * the UI and the stored value — they can never disagree.
 */
export function computeNet(input: {
  salaryType: string;
  baseSalary: number;
  hourlyRate: number;
  lessons: number;
  extraHours: number;
  bonus: number;
  deduction: number;
}): number {
  const base =
    input.salaryType === "monthly"
      ? input.baseSalary
      : Math.max(0, input.lessons) * Math.max(0, input.hourlyRate);
  const extra = Math.max(0, input.extraHours) * Math.max(0, input.hourlyRate);
  return Math.max(0, Math.round(base + extra + Math.max(0, input.bonus) - Math.max(0, input.deduction)));
}

export interface PayrollRow {
  teacherId: string;
  name: string;
  /** Configured salary type, or null when the admin hasn't set one yet. */
  salaryType: string | null;
  baseSalary: number;
  hourlyRate: number;
  /** Lessons counted for the period from real activity. */
  lessons: number;
  students: number;
  groups: number;
  /** What the engine suggests, before bonuses/deductions. */
  suggestedNet: number;
  /** Existing payroll record for this period, if any. */
  record: {
    id: string;
    status: string;
    net: number;
    bonus: number;
    deduction: number;
    extraHours: number;
    /** Lessons stored on the record (may differ from the live count). */
    lessons: number;
    paidAt: Date | null;
    note: string | null;
  } | null;
  /** True when no salary type is configured — the admin must set it first. */
  needsConfig: boolean;
}

export interface PayrollPeriod {
  period: string;
  label: string;
  rows: PayrollRow[];
  totalSuggested: number;
  totalApproved: number;
  totalPaid: number;
  totalOutstanding: number;
}

export async function getPayrollPeriod(period: string): Promise<PayrollPeriod> {
  const { from, to } = periodRange(period);

  const [teachers, lessonCounts, attendanceDays, records] = await Promise.all([
    db.teacher.findMany({
      select: {
        id: true,
        salaryType: true,
        baseSalary: true,
        hourlyRate: true,
        user: { select: { name: true } },
        groups: { select: { _count: { select: { students: true } } } },
      },
    }),
    db.lessonLog
      .groupBy({ by: ["teacherId"], where: { date: { gte: from, lt: to } }, _count: { _all: true } })
      .catch(() => [] as { teacherId: string; _count: { _all: number } }[]),
    // Fallback signal: distinct days a teacher marked attendance.
    db.attendance
      .findMany({
        where: { date: { gte: from, lt: to }, teacherId: { not: null } },
        select: { teacherId: true, date: true },
      })
      .catch(() => [] as { teacherId: string | null; date: Date }[]),
    db.payroll.findMany({ where: { period } }).catch(() => null),
  ]);

  const lessonsBy = new Map(lessonCounts.map((r) => [r.teacherId, r._count._all]));
  const attendanceBy = new Map<string, Set<string>>();
  for (const a of attendanceDays) {
    if (!a.teacherId) continue;
    const set = attendanceBy.get(a.teacherId) ?? new Set<string>();
    set.add(new Date(a.date).toISOString().slice(0, 10));
    attendanceBy.set(a.teacherId, set);
  }
  const recordBy = new Map((records ?? []).map((r) => [r.teacherId, r]));

  const rows: PayrollRow[] = teachers.map((t) => {
    const lessons = lessonsBy.get(t.id) ?? attendanceBy.get(t.id)?.size ?? 0;
    const students = t.groups.reduce((s, g) => s + g._count.students, 0);
    const salaryType = t.salaryType ?? null;
    const baseSalary = t.baseSalary ?? 0;
    const hourlyRate = t.hourlyRate ?? 0;
    const rec = recordBy.get(t.id) ?? null;

    return {
      teacherId: t.id,
      name: t.user?.name ?? "Oʻqituvchi",
      salaryType,
      baseSalary,
      hourlyRate,
      lessons,
      students,
      groups: t.groups.length,
      suggestedNet: salaryType
        ? computeNet({ salaryType, baseSalary, hourlyRate, lessons, extraHours: 0, bonus: 0, deduction: 0 })
        : 0,
      record: rec
        ? {
            id: rec.id,
            status: rec.status,
            net: rec.net,
            bonus: rec.bonus,
            deduction: rec.deduction,
            extraHours: rec.extraHours,
            lessons: rec.lessons,
            paidAt: rec.paidAt,
            note: rec.note,
          }
        : null,
      needsConfig: !salaryType,
    };
  });

  const sumBy = (pred: (r: PayrollRow) => boolean, val: (r: PayrollRow) => number) =>
    rows.filter(pred).reduce((a, r) => a + val(r), 0);

  const totalPaid = sumBy((r) => r.record?.status === "paid", (r) => r.record!.net);
  const totalApproved = sumBy((r) => r.record?.status === "approved", (r) => r.record!.net);

  return {
    period,
    label: periodLabel(period),
    rows,
    totalSuggested: rows.reduce((a, r) => a + (r.record?.net ?? r.suggestedNet), 0),
    totalApproved,
    totalPaid,
    totalOutstanding: totalApproved + sumBy((r) => !r.record && !r.needsConfig, (r) => r.suggestedNet),
  };
}
