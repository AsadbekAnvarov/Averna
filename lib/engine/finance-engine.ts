import { db } from "@/lib/db";

/**
 * Finance Engine — the P&L of the learning centre (Modules 3 + 4).
 *
 * Revenue comes from Payment, expenses from Expense. Only expenses that are
 * `approved` or `paid` count toward profit — a draft or unapproved cost must not
 * quietly change the bottom line.
 *
 * Every DB call is defensive: before the `expenses` table is deployed the engine
 * returns `hasExpenseData: false` and the UI keeps showing "—" for profit rather
 * than presenting revenue as if it were earnings.
 */

/** Expense categories, in the order they're shown. Uzbek labels (admin UI). */
export const EXPENSE_CATEGORIES: { key: string; label: string }[] = [
  { key: "SALARY_TEACHER", label: "Oʻqituvchi maoshi" },
  { key: "SALARY_ADMIN", label: "Administratsiya maoshi" },
  { key: "RENT", label: "Ijara" },
  { key: "UTILITIES", label: "Kommunal xizmatlar" },
  { key: "ELECTRICITY", label: "Elektr energiya" },
  { key: "WATER", label: "Suv" },
  { key: "INTERNET", label: "Internet" },
  { key: "EQUIPMENT", label: "Jihozlar" },
  { key: "FURNITURE", label: "Mebel" },
  { key: "OFFICE", label: "Ofis buyumlari" },
  { key: "CLEANING", label: "Tozalash" },
  { key: "MARKETING", label: "Marketing" },
  { key: "ADVERTISING", label: "Reklama" },
  { key: "BOOKS", label: "Kitoblar" },
  { key: "LICENSES", label: "Litsenziyalar" },
  { key: "MAINTENANCE", label: "Taʼmirlash" },
  { key: "TAXES", label: "Soliqlar" },
  { key: "SOFTWARE", label: "Dasturiy taʼminot" },
  { key: "EVENTS", label: "Tadbirlar" },
  { key: "OTHER", label: "Boshqa" },
];

export const EXPENSE_METHODS: { key: string; label: string }[] = [
  { key: "CASH", label: "Naqd" },
  { key: "CARD", label: "Karta" },
  { key: "TERMINAL", label: "Terminal" },
  { key: "TRANSFER", label: "Bank oʻtkazmasi" },
];

const CATEGORY_LABEL = new Map(EXPENSE_CATEGORIES.map((c) => [c.key, c.label]));
export const expenseCategoryLabel = (key: string) => CATEGORY_LABEL.get(key) ?? key;

/** Expenses that actually hit the P&L. */
const COUNTED = ["approved", "paid"];

export interface CategoryTotal {
  key: string;
  label: string;
  amount: number;
  share: number; // % of total expenses
}

export interface PeriodPnl {
  revenue: number;
  expenses: number;
  grossProfit: number;
  /** % — null when there's no revenue to divide by. */
  margin: number | null;
}

export interface ProfitSnapshot {
  /** False until the Expense table exists / has data — profit stays unknown. */
  hasExpenseData: boolean;
  month: PeriodPnl;
  prevMonth: PeriodPnl;
  year: PeriodPnl;
  today: PeriodPnl;
  revenueGrowthPct: number | null;
  expenseGrowthPct: number | null;
  profitGrowthPct: number | null;
  byCategory: CategoryTotal[];
  /** Expenses awaiting approval — they don't count yet, but admins must see them. */
  pendingApproval: { count: number; amount: number };
  /** Last 6 months, oldest first — for the trend chart. */
  trend: { label: string; revenue: number; expenses: number; profit: number }[];
}

const pnl = (revenue: number, expenses: number): PeriodPnl => ({
  revenue,
  expenses,
  grossProfit: revenue - expenses,
  margin: revenue > 0 ? Math.round(((revenue - expenses) / revenue) * 100) : null,
});

const growth = (curr: number, prev: number): number | null =>
  prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

export async function getProfitSnapshot(): Promise<ProfitSnapshot> {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startYear = new Date(now.getFullYear(), 0, 1);
  // Six-month window, aligned to month boundaries.
  const startTrend = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [payments, expenses, pending] = await Promise.all([
    db.payment
      .findMany({
        where: { status: "COMPLETED", createdAt: { gte: startTrend < startYear ? startTrend : startYear } },
        select: { amount: true, createdAt: true },
      })
      .catch(() => [] as { amount: number; createdAt: Date }[]),
    db.expense
      .findMany({
        where: { status: { in: COUNTED }, incurredAt: { gte: startTrend < startYear ? startTrend : startYear } },
        select: { amount: true, category: true, incurredAt: true },
      })
      .catch(() => null),
    db.expense
      .aggregate({ where: { status: { in: ["draft", "pending"] } }, _count: { _all: true }, _sum: { amount: true } })
      .catch(() => null),
  ]);

  const hasExpenseData = expenses !== null;
  const exp = expenses ?? [];
  const income = payments.filter((p) => p.amount > 0);

  const sumRev = (from: Date, to?: Date) =>
    income.filter((p) => p.createdAt >= from && (!to || p.createdAt < to)).reduce((a, p) => a + p.amount, 0);
  const sumExp = (from: Date, to?: Date) =>
    exp.filter((e) => e.incurredAt >= from && (!to || e.incurredAt < to)).reduce((a, e) => a + e.amount, 0);

  const month = pnl(sumRev(startMonth), sumExp(startMonth));
  const prevMonth = pnl(sumRev(startPrev, startMonth), sumExp(startPrev, startMonth));
  const year = pnl(sumRev(startYear), sumExp(startYear));
  const today = pnl(sumRev(startToday), sumExp(startToday));

  // Expense mix for the current month.
  const monthExp = exp.filter((e) => e.incurredAt >= startMonth);
  const totals = new Map<string, number>();
  for (const e of monthExp) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  const totalExp = monthExp.reduce((a, e) => a + e.amount, 0);
  const byCategory: CategoryTotal[] = Array.from(totals.entries())
    .map(([key, amount]) => ({
      key,
      label: expenseCategoryLabel(key),
      amount,
      share: totalExp > 0 ? Math.round((amount / totalExp) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Six-month trend.
  const trend: ProfitSnapshot["trend"] = [];
  for (let i = 5; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const r = sumRev(from, to);
    const e = sumExp(from, to);
    trend.push({
      label: new Intl.DateTimeFormat("en-GB", { month: "short" }).format(from),
      revenue: r,
      expenses: e,
      profit: r - e,
    });
  }

  return {
    hasExpenseData,
    month,
    prevMonth,
    year,
    today,
    revenueGrowthPct: growth(month.revenue, prevMonth.revenue),
    expenseGrowthPct: growth(month.expenses, prevMonth.expenses),
    profitGrowthPct: growth(month.grossProfit, prevMonth.grossProfit),
    byCategory,
    pendingApproval: {
      count: pending?._count?._all ?? 0,
      amount: pending?._sum?.amount ?? 0,
    },
    trend,
  };
}
