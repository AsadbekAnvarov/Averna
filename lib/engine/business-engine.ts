import { db } from "@/lib/db";

/**
 * Business Engine — the executive view of the learning centre.
 *
 * Everything here is computed from data that ACTUALLY exists today (payments,
 * students, groups, attendance, teachers). Nothing is invented: where a number
 * cannot yet be derived — operating expenses, and therefore true profit, have no
 * table at all — the field is returned as `null` and the UI shows "—" rather than
 * a comforting fiction. Faking a profit line would be the single most dangerous
 * thing this dashboard could do.
 *
 * See docs/BUSINESS_OS_PLAN.md for the modules gated behind the ERP schema.
 */

const DAY = 86_400_000;

export interface RevenueBreakdown {
  cash: number;
  other: number;
}

export interface ExecutiveSnapshot {
  // --- Money (income only; expenses have no data source yet) ---
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
  revenuePrevMonth: number;
  revenueGrowthPct: number | null;
  revenueByMethod: RevenueBreakdown;
  outstandingStudents: number;
  pendingPayments: number;
  /** null until an Expense model exists — never guessed. */
  expensesMonth: null;
  netProfitMonth: null;

  // --- People ---
  activeStudents: number;
  totalStudents: number;
  newStudentsMonth: number;
  unplacedStudents: number;
  teachers: number;

  // --- Operations ---
  attendanceRate: number | null;
  groups: number;
  avgGroupSize: number | null;
  underEnrolledGroups: number;
}

export async function getExecutiveSnapshot(): Promise<ExecutiveSnapshot> {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startYear = new Date(now.getFullYear(), 0, 1);
  const monthAgo = new Date(Date.now() - 30 * DAY);
  const weekAgo = new Date(Date.now() - 7 * DAY);

  const [payments, pendingPayments, students, attendance, groups, teachers] = await Promise.all([
    // Completed income for the year — one scan, then bucketed in memory.
    db.payment.findMany({
      where: { status: "COMPLETED", createdAt: { gte: startYear } },
      select: { amount: true, type: true, createdAt: true },
    }),
    db.payment.count({ where: { status: "PENDING" } }),
    db.student.findMany({ select: { createdAt: true, balance: true, groupId: true, lastActiveDate: true } }),
    db.attendance.findMany({ where: { date: { gte: monthAgo } }, select: { status: true } }),
    db.group.findMany({ select: { _count: { select: { students: true } } } }),
    db.teacher.count(),
  ]);

  const sum = (rows: { amount: number }[]) => rows.reduce((a, p) => a + p.amount, 0);
  const positive = payments.filter((p) => p.amount > 0);

  const revenueToday = sum(positive.filter((p) => p.createdAt >= startToday));
  const monthRows = positive.filter((p) => p.createdAt >= startMonth);
  const revenueMonth = sum(monthRows);
  const revenueYear = sum(positive);
  const revenuePrevMonth = sum(positive.filter((p) => p.createdAt >= startPrevMonth && p.createdAt < startMonth));

  const revenueGrowthPct =
    revenuePrevMonth > 0 ? Math.round(((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100) : null;

  // Payment "method" is only partially expressible today: the schema has a
  // coarse `type` (TOPUP | COURSE | SUBSCRIPTION | CASH), not a real method
  // field. Cash is distinguishable because admins record it explicitly.
  const revenueByMethod: RevenueBreakdown = {
    cash: sum(monthRows.filter((p) => p.type === "CASH")),
    other: sum(monthRows.filter((p) => p.type !== "CASH")),
  };

  const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const attendanceRate = attendance.length >= 5 ? Math.round((present / attendance.length) * 100) : null;

  const sizes = groups.map((g) => g._count.students);
  const avgGroupSize = sizes.length ? Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 10) / 10 : null;

  return {
    revenueToday,
    revenueMonth,
    revenueYear,
    revenuePrevMonth,
    revenueGrowthPct,
    revenueByMethod,
    outstandingStudents: students.filter((s) => s.groupId && s.balance <= 0).length,
    pendingPayments,
    expensesMonth: null,
    netProfitMonth: null,

    activeStudents: students.filter((s) => s.lastActiveDate && s.lastActiveDate >= weekAgo).length,
    totalStudents: students.length,
    newStudentsMonth: students.filter((s) => s.createdAt >= startMonth).length,
    unplacedStudents: students.filter((s) => !s.groupId).length,
    teachers,

    attendanceRate,
    groups: groups.length,
    avgGroupSize,
    underEnrolledGroups: sizes.filter((n) => n > 0 && n < 5).length,
  };
}

// ==================== Business Health Score ====================

export type HealthBand = "excellent" | "very_good" | "good" | "attention" | "critical";

export interface HealthDriver {
  label: string;
  /** 0-100 sub-score. */
  score: number;
  weight: number;
  /** Why this sub-score is what it is, in plain language. */
  note: string;
}

export interface BusinessHealth {
  score: number;
  band: HealthBand;
  bandLabel: string;
  drivers: HealthDriver[];
  /** What is dragging the score down, worst first. */
  recommendations: string[];
  /** Dimensions we cannot score yet (no data source). */
  missing: string[];
}

const BAND_LABEL: Record<HealthBand, string> = {
  excellent: "Ajoyib",
  very_good: "Juda yaxshi",
  good: "Yaxshi",
  attention: "Eʼtibor talab qiladi",
  critical: "Tanqidiy",
};

function bandFor(score: number): HealthBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "very_good";
  if (score >= 55) return "good";
  if (score >= 40) return "attention";
  return "critical";
}

/**
 * One 0-100 score from the dimensions we can actually measure. Each driver
 * carries its own sub-score, weight and reason, so the number is always
 * explainable — a score nobody can explain is worse than no score at all.
 * Weights are renormalised over the drivers that have data, so a young centre
 * isn't punished for dimensions that simply can't be computed yet.
 */
export async function getBusinessHealth(snapshot?: ExecutiveSnapshot): Promise<BusinessHealth> {
  const s = snapshot ?? (await getExecutiveSnapshot());
  const drivers: HealthDriver[] = [];
  const missing: string[] = [];

  // 1. Payment collection — share of enrolled students who are not in arrears.
  const enrolled = s.totalStudents - s.unplacedStudents;
  if (enrolled > 0) {
    const collected = Math.round(((enrolled - s.outstandingStudents) / enrolled) * 100);
    drivers.push({
      label: "Toʻlov yigʻilishi",
      score: collected,
      weight: 25,
      note: `${enrolled} ta oʻquvchidan ${s.outstandingStudents} tasining balansi nol yoki manfiy.`,
    });
  } else {
    missing.push("Toʻlov yigʻilishi — hali guruhga biriktirilgan oʻquvchi yoʻq.");
  }

  // 2. Revenue growth — month over month.
  if (s.revenueGrowthPct != null) {
    // -20% → 0, 0% → 60, +20% and above → 100.
    const score = Math.max(0, Math.min(100, Math.round(60 + s.revenueGrowthPct * 2)));
    drivers.push({
      label: "Daromad oʻsishi",
      score,
      weight: 20,
      note: `Bu oy ${s.revenueMonth.toLocaleString()} — oʻtgan oyga nisbatan ${s.revenueGrowthPct > 0 ? "+" : ""}${s.revenueGrowthPct}%.`,
    });
  } else {
    missing.push("Daromad oʻsishi — taqqoslash uchun oʻtgan oy maʼlumoti yetarli emas.");
  }

  // 3. Attendance.
  if (s.attendanceRate != null) {
    drivers.push({
      label: "Davomat",
      score: s.attendanceRate,
      weight: 20,
      note: `Soʻnggi 30 kunda davomat ${s.attendanceRate}%.`,
    });
  } else {
    missing.push("Davomat — soʻnggi 30 kunda yetarli belgilanish yoʻq.");
  }

  // 4. Student engagement — active in the last 7 days.
  if (s.totalStudents > 0) {
    const score = Math.round((s.activeStudents / s.totalStudents) * 100);
    drivers.push({
      label: "Oʻquvchi faolligi",
      score,
      weight: 20,
      note: `${s.totalStudents} ta oʻquvchidan ${s.activeStudents} tasi soʻnggi 7 kunda oʻqidi.`,
    });
  }

  // 5. Course occupancy — groups big enough to be viable, students all placed.
  if (s.groups > 0) {
    const viable = Math.round(((s.groups - s.underEnrolledGroups) / s.groups) * 100);
    const placement = s.totalStudents > 0 ? ((s.totalStudents - s.unplacedStudents) / s.totalStudents) * 100 : 100;
    const score = Math.round(viable * 0.6 + placement * 0.4);
    drivers.push({
      label: "Guruhlar toʻldirilishi",
      score,
      weight: 15,
      note: `${s.groups} guruhdan ${s.underEnrolledGroups} tasi kam toʻldirilgan; ${s.unplacedStudents} ta oʻquvchi biriktirilmagan.`,
    });
  }

  // Profitability cannot be scored without an expense ledger — say so plainly.
  missing.push("Rentabellik va sof foyda — xarajatlar moduli hali yoʻq (ERP jadvallari kerak).");

  const totalWeight = drivers.reduce((a, d) => a + d.weight, 0);
  const score = totalWeight > 0
    ? Math.round(drivers.reduce((a, d) => a + d.score * d.weight, 0) / totalWeight)
    : 0;

  // Recommendations: address the weakest weighted drivers first.
  const recommendations = [...drivers]
    .filter((d) => d.score < 70)
    .sort((a, b) => a.score * a.weight - b.score * b.weight)
    .slice(0, 3)
    .map((d) => {
      switch (d.label) {
        case "Toʻlov yigʻilishi":
          return `${s.outstandingStudents} ta oʻquvchining qarzini yigʻish — bu eng tez natija beradigan qadam.`;
        case "Daromad oʻsishi":
          return "Daromad pasaymoqda — yangi qabul va uzaytirishlarni faollashtiring.";
        case "Davomat":
          return "Davomat past — dars eslatmalarini yoqing va sabablarini oʻqituvchilar bilan koʻrib chiqing.";
        case "Oʻquvchi faolligi":
          return "Koʻp oʻquvchi faolsiz — eʼlon yoki shaxsiy eslatma yuboring.";
        case "Guruhlar toʻldirilishi":
          return "Kam toʻldirilgan guruhlarni birlashtiring va biriktirilmagan oʻquvchilarni joylashtiring.";
        default:
          return `${d.label} boʻyicha yaxshilash kerak.`;
      }
    });

  const band = bandFor(score);
  return { score, band, bandLabel: BAND_LABEL[band], drivers, recommendations, missing };
}
