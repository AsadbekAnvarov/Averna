import { db } from "@/lib/db";
import { getPayrollPeriod, periodKey, periodLabel } from "@/lib/engine/payroll-engine";

/**
 * Calendar Engine (M8) — one operational calendar for the whole centre.
 *
 * Two sources, deliberately:
 *   1. MANUAL events (BusinessEvent): rent, utilities, taxes, meetings, renewals.
 *   2. DERIVED deadlines computed from live data — tuition due dates, unpaid
 *      payroll, recurring expenses. These are never stored as events, so the
 *      calendar can't drift out of sync with the finance pages: settle a debt and
 *      the entry disappears by itself.
 *
 * Derived tuition dues are AGGREGATED per due-day (e.g. "12 students · 4.2M UZS")
 * rather than one row per student, so the calendar stays readable at any scale.
 */

const DAY = 86_400_000;

export const EVENT_TYPES: { key: string; label: string }[] = [
  { key: "RENT", label: "Ijara" },
  { key: "UTILITY", label: "Kommunal" },
  { key: "TAX", label: "Soliq" },
  { key: "SALARY", label: "Maosh" },
  { key: "MEETING", label: "Yigʻilish" },
  { key: "EXAM", label: "Imtihon" },
  { key: "MAINTENANCE", label: "Taʼmirlash" },
  { key: "MARKETING", label: "Marketing" },
  { key: "EVENT", label: "Tadbir" },
  { key: "RENEWAL", label: "Uzaytirish" },
  { key: "OTHER", label: "Boshqa" },
];

const TYPE_LABEL = new Map(EVENT_TYPES.map((t) => [t.key, t.label]));
export const eventTypeLabel = (k: string) => TYPE_LABEL.get(k) ?? k;

/** Visual accent per type — kept here so the page stays declarative. */
export const TYPE_ACCENT: Record<string, string> = {
  RENT: "border-averna-pink/40 bg-averna-pink/10 text-averna-pink",
  UTILITY: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan",
  TAX: "border-red-500/40 bg-red-500/10 text-red-300",
  SALARY: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  PAYMENT_DUE: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon",
  MEETING: "border-averna-purple/40 bg-averna-purple/10 text-averna-purple",
  EXAM: "border-averna-blue/40 bg-averna-blue/10 text-averna-blue",
  MAINTENANCE: "border-white/15 bg-white/5 text-gray-300",
  MARKETING: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  EVENT: "border-averna-purple/40 bg-averna-purple/10 text-averna-purple",
  RENEWAL: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan",
  OTHER: "border-white/15 bg-white/5 text-gray-400",
};

export interface CalendarItem {
  /** Unique per occurrence (a recurring event yields several). */
  id: string;
  /** The underlying BusinessEvent id — what delete acts on. Never parsed from `id`. */
  baseId?: string;
  /** Local date key "YYYY-MM-DD" for grouping. */
  dateKey: string;
  date: Date;
  type: string;
  typeLabel: string;
  title: string;
  amount: number | null;
  /** Manual events can be deleted; derived ones reflect live data. */
  source: "manual" | "derived";
  detail?: string;
  href?: string;
  recurring?: string | null;
}

export interface CalendarWindow {
  from: Date;
  to: Date;
  items: CalendarItem[];
  /** Grouped by day, ascending. */
  days: { dateKey: string; date: Date; items: CalendarItem[] }[];
  totalScheduled: number;
  overdueCount: number;
}

const dateKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Expand a recurring manual event into every occurrence inside the window. */
function expand(ev: {
  id: string;
  type: string;
  title: string;
  amount: number | null;
  startsAt: Date;
  recurring: string | null;
  notes: string | null;
}, from: Date, to: Date): CalendarItem[] {
  const out: CalendarItem[] = [];
  const push = (d: Date, suffix = "") => {
    if (d < from || d > to) return;
    out.push({
      id: `${ev.id}${suffix}`,
      baseId: ev.id,
      dateKey: dateKeyOf(d),
      date: d,
      type: ev.type,
      typeLabel: eventTypeLabel(ev.type),
      title: ev.title,
      amount: ev.amount ?? null,
      source: "manual",
      detail: ev.notes ?? undefined,
      recurring: ev.recurring,
    });
  };

  if (!ev.recurring) {
    push(ev.startsAt);
    return out;
  }

  const day = ev.startsAt.getDate();
  if (ev.recurring === "monthly") {
    // Walk month by month across the window.
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to) {
      push(new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, 28)), `-${cursor.getMonth()}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else if (ev.recurring === "yearly") {
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      push(new Date(y, ev.startsAt.getMonth(), Math.min(day, 28)), `-${y}`);
    }
  }
  return out;
}

/**
 * Everything scheduled between `from` and `to` (defaults: 7 days back → 60 ahead,
 * so overdue items stay visible instead of silently vanishing).
 */
export async function getCalendar(from?: Date, to?: Date): Promise<CalendarWindow> {
  const now = new Date();
  const start = from ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const end = to ?? new Date(now.getTime() + 60 * DAY);

  const period = periodKey();
  const [manual, students, recurringExpenses, payroll] = await Promise.all([
    db.businessEvent
      .findMany({ orderBy: { startsAt: "asc" } })
      .catch(() => [] as { id: string; type: string; title: string; amount: number | null; startsAt: Date; endsAt: Date | null; recurring: string | null; notes: string | null }[]),
    db.student
      .findMany({
        where: { groupId: { not: null }, dueDay: { not: null }, scholarship: false },
        select: {
          dueDay: true,
          feeOverride: true,
          discountPct: true,
          group: { select: { monthlyFee: true } },
        },
      })
      .catch(() => [] as { dueDay: number | null; feeOverride: number | null; discountPct: number; group: { monthlyFee: number | null } | null }[]),
    db.expense
      .findMany({
        where: { recurring: { not: null } },
        select: { id: true, category: true, amount: true, incurredAt: true, recurring: true, vendor: true },
      })
      .catch(() => [] as { id: string; category: string; amount: number; incurredAt: Date; recurring: string | null; vendor: string | null }[]),
    getPayrollPeriod(period).catch(() => null),
  ]);

  const items: CalendarItem[] = [];

  // 1. Manual events (with recurrence expanded).
  for (const ev of manual) items.push(...expand(ev, start, end));

  // 2. Derived: tuition due dates, aggregated per due-day.
  const byDueDay = new Map<number, { count: number; total: number }>();
  for (const s of students) {
    if (!s.dueDay) continue;
    const base = s.feeOverride ?? s.group?.monthlyFee ?? 0;
    const fee = Math.max(0, Math.round(base * (1 - Math.max(0, Math.min(100, s.discountPct)) / 100)));
    const cur = byDueDay.get(s.dueDay) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += fee;
    byDueDay.set(s.dueDay, cur);
  }
  if (byDueDay.size > 0) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      for (const [day, agg] of byDueDay) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(day, 28));
        if (d < start || d > end) continue;
        items.push({
          id: `due-${dateKeyOf(d)}-${day}`,
          dateKey: dateKeyOf(d),
          date: d,
          type: "PAYMENT_DUE",
          typeLabel: "Oʻquvchi toʻlovi",
          title: `${agg.count} ta oʻquvchining toʻlov muddati`,
          amount: agg.total || null,
          source: "derived",
          detail: "Jadval oʻquvchilarning toʻlov kunidan olinadi.",
          href: "/admin/payments",
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  // 3. Derived: approved-but-unpaid payroll for the current period.
  if (payroll && payroll.totalApproved > 0) {
    const [y, m] = period.split("-").map(Number);
    const d = new Date(y, (m || 1) - 1, 28);
    if (d >= start && d <= end) {
      items.push({
        id: `payroll-${period}`,
        dateKey: dateKeyOf(d),
        date: d,
        type: "SALARY",
        typeLabel: "Maosh",
        title: `${periodLabel(period)} maoshi toʻlanishi kerak`,
        amount: payroll.totalApproved,
        source: "derived",
        detail: "Tasdiqlangan, lekin hali toʻlanmagan.",
        href: "/admin/payroll",
      });
    }
  }

  // 4. Derived: recurring expenses repeat on their original day.
  for (const e of recurringExpenses) {
    if (e.recurring !== "monthly" && e.recurring !== "yearly") continue;
    items.push(
      ...expand(
        {
          id: `rec-${e.id}`,
          type: e.category === "RENT" ? "RENT" : e.category === "UTILITIES" ? "UTILITY" : "OTHER",
          title: e.vendor ? `${e.vendor} — takrorlanuvchi toʻlov` : "Takrorlanuvchi xarajat",
          amount: e.amount,
          startsAt: e.incurredAt,
          recurring: e.recurring,
          notes: null,
        },
        start,
        end
      ).map((i) => ({ ...i, source: "derived" as const, href: "/admin/expenses" }))
    );
  }

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by day.
  const map = new Map<string, CalendarItem[]>();
  for (const i of items) {
    const arr = map.get(i.dateKey) ?? [];
    arr.push(i);
    map.set(i.dateKey, arr);
  }
  const days = Array.from(map.entries())
    .map(([dateKey, list]) => ({ dateKey, date: list[0].date, items: list }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const todayKey = dateKeyOf(now);
  return {
    from: start,
    to: end,
    items,
    days,
    totalScheduled: items.reduce((a, i) => a + (i.amount ?? 0), 0),
    overdueCount: items.filter((i) => i.dateKey < todayKey).length,
  };
}
