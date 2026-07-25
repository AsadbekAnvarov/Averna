import { db } from "@/lib/db";

/**
 * Tuition Engine (M6) — what each student owes, when, and how likely they are to
 * pay on time.
 *
 * Honest about method: the "prediction" is a transparent heuristic built from the
 * student's own payment punctuality, not a trained model. It reports a confidence
 * that reflects how many months of history it is based on, and says so in the UI.
 * A confident-looking score from two data points would mislead an administrator.
 */

const DAY = 86_400_000;

export type PaymentRisk = "ok" | "watch" | "late" | "critical" | "unset";

export interface StudentPaymentRow {
  studentId: string;
  name: string;
  email: string;
  group: string | null;
  /** Effective monthly price after discount (0 when not priced). */
  fee: number;
  baseFee: number;
  discountPct: number;
  scholarship: boolean;
  /** Wallet balance (top-ups minus spending). */
  balance: number;
  /** Paid toward THIS month. */
  paidThisMonth: number;
  /** Still owed this month (0 when settled or unpriced). */
  outstanding: number;
  dueDay: number | null;
  /** Next due date; null when no schedule is configured. */
  nextDue: Date | null;
  /** Negative = overdue by N days, positive = N days remaining. */
  daysToDue: number | null;
  lastPaymentAt: Date | null;
  lastPaymentAmount: number;
  paymentsCount: number;
  risk: PaymentRisk;
  riskReason: string;
  /** 0-100 heuristic likelihood of paying this month on time. */
  onTimeScore: number | null;
  /** How much history the score rests on. */
  scoreConfidence: "low" | "medium" | "high" | null;
}

export interface TuitionSummary {
  expectedMonth: number;
  collectedMonth: number;
  outstandingMonth: number;
  collectionRate: number | null;
  dueSoon: number;
  overdue: number;
  unpriced: number;
  rows: StudentPaymentRow[];
}

const RISK_LABEL: Record<PaymentRisk, string> = {
  ok: "Yaxshi",
  watch: "Kuzatuvda",
  late: "Kechikkan",
  critical: "Tanqidiy",
  unset: "Sozlanmagan",
};
export const riskLabel = (r: PaymentRisk) => RISK_LABEL[r];

function nextDueDate(dueDay: number, now: Date): Date {
  const day = Math.min(Math.max(dueDay, 1), 28);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  // If this month's date has passed, the relevant deadline is still this month's
  // (so it shows as overdue) until the month rolls over.
  return thisMonth;
}

export async function getTuitionSummary(): Promise<TuitionSummary> {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const [students, payments] = await Promise.all([
    db.student.findMany({
      where: { groupId: { not: null } },
      select: {
        id: true,
        balance: true,
        feeOverride: true,
        discountPct: true,
        dueDay: true,
        scholarship: true,
        user: { select: { name: true, email: true } },
        group: { select: { name: true, monthlyFee: true } },
      },
    }),
    db.payment.findMany({
      where: { status: "COMPLETED", createdAt: { gte: sixMonthsAgo } },
      select: { studentId: true, amount: true, createdAt: true },
    }),
  ]);

  const byStudent = new Map<string, { amount: number; createdAt: Date }[]>();
  for (const p of payments) {
    if (p.amount <= 0) continue;
    const arr = byStudent.get(p.studentId) ?? [];
    arr.push(p);
    byStudent.set(p.studentId, arr);
  }

  const rows: StudentPaymentRow[] = students.map((s) => {
    const baseFee = s.feeOverride ?? s.group?.monthlyFee ?? 0;
    const discountPct = s.scholarship ? 100 : Math.max(0, Math.min(100, s.discountPct ?? 0));
    const fee = Math.max(0, Math.round(baseFee * (1 - discountPct / 100)));

    const history = (byStudent.get(s.id) ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
    const paidThisMonth = history
      .filter((p) => p.createdAt >= startMonth)
      .reduce((a, p) => a + p.amount, 0);
    const outstanding = fee > 0 ? Math.max(0, fee - paidThisMonth) : 0;

    const last = history[history.length - 1] ?? null;
    const dueDay = s.dueDay ?? null;
    const nextDue = dueDay ? nextDueDate(dueDay, now) : null;
    const daysToDue = nextDue ? Math.round((nextDue.getTime() - now.getTime()) / DAY) : null;

    // --- Punctuality heuristic: in how many of the last months did a payment
    // arrive on or before the due day? Only meaningful with a schedule + history.
    let onTimeScore: number | null = null;
    let scoreConfidence: StudentPaymentRow["scoreConfidence"] = null;
    if (dueDay && history.length > 0) {
      const monthsSeen = new Map<string, number>(); // month → earliest pay day
      for (const p of history) {
        const key = `${p.createdAt.getFullYear()}-${p.createdAt.getMonth()}`;
        const d = p.createdAt.getDate();
        monthsSeen.set(key, Math.min(monthsSeen.get(key) ?? 99, d));
      }
      const months = Array.from(monthsSeen.values());
      if (months.length > 0) {
        const onTime = months.filter((d) => d <= dueDay).length;
        onTimeScore = Math.round((onTime / months.length) * 100);
        scoreConfidence = months.length >= 4 ? "high" : months.length >= 2 ? "medium" : "low";
      }
    }

    // --- Risk ---
    let risk: PaymentRisk = "ok";
    let riskReason = "Toʻlovlar joyida.";

    if (s.scholarship) {
      risk = "ok";
      riskReason = "Grant asosida oʻqiydi — toʻlov talab qilinmaydi.";
    } else if (fee === 0) {
      risk = "unset";
      riskReason = "Kurs narxi belgilanmagan — qarzni hisoblab boʻlmaydi.";
    } else if (outstanding > 0 && daysToDue != null && daysToDue < -7) {
      risk = "critical";
      riskReason = `Toʻlov ${Math.abs(daysToDue)} kun kechikkan, ${outstanding.toLocaleString()} UZS qarz.`;
    } else if (outstanding > 0 && daysToDue != null && daysToDue < 0) {
      risk = "late";
      riskReason = `Muddat ${Math.abs(daysToDue)} kun oʻtdi, ${outstanding.toLocaleString()} UZS qarz.`;
    } else if (outstanding > 0 && daysToDue != null && daysToDue <= 3) {
      risk = "watch";
      riskReason = `${daysToDue} kundan soʻng ${outstanding.toLocaleString()} UZS toʻlanishi kerak.`;
    } else if (outstanding > 0 && onTimeScore != null && onTimeScore < 50) {
      risk = "watch";
      riskReason = `Avval koʻp kechiktirgan (${onTimeScore}% oʻz vaqtida) — kuzatib turing.`;
    } else if (outstanding > 0) {
      riskReason = `${outstanding.toLocaleString()} UZS qoldi, muddat hali kelmagan.`;
    } else if (!dueDay) {
      risk = "unset";
      riskReason = "Toʻlov kuni belgilanmagan.";
    }

    return {
      studentId: s.id,
      name: s.user?.name ?? "Nomsiz",
      email: s.user?.email ?? "",
      group: s.group?.name ?? null,
      fee,
      baseFee,
      discountPct,
      scholarship: s.scholarship,
      balance: s.balance,
      paidThisMonth,
      outstanding,
      dueDay,
      nextDue,
      daysToDue,
      lastPaymentAt: last?.createdAt ?? null,
      lastPaymentAmount: last?.amount ?? 0,
      paymentsCount: history.length,
      risk,
      riskReason,
      onTimeScore,
      scoreConfidence,
    };
  });

  const RISK_ORDER: Record<PaymentRisk, number> = { critical: 0, late: 1, watch: 2, unset: 3, ok: 4 };
  rows.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || b.outstanding - a.outstanding);

  const expectedMonth = rows.reduce((a, r) => a + r.fee, 0);
  const collectedMonth = rows.reduce((a, r) => a + Math.min(r.paidThisMonth, r.fee || r.paidThisMonth), 0);
  const outstandingMonth = rows.reduce((a, r) => a + r.outstanding, 0);

  return {
    expectedMonth,
    collectedMonth,
    outstandingMonth,
    collectionRate: expectedMonth > 0 ? Math.round((collectedMonth / expectedMonth) * 100) : null,
    dueSoon: rows.filter((r) => r.risk === "watch").length,
    overdue: rows.filter((r) => r.risk === "late" || r.risk === "critical").length,
    unpriced: rows.filter((r) => r.risk === "unset").length,
    rows,
  };
}
