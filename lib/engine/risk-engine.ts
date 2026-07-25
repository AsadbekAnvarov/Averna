import { db } from "@/lib/db";
import { getMissionControl } from "@/lib/admin-intel";
import { getExecutiveSnapshot } from "@/lib/engine/business-engine";
import { getProfitSnapshot } from "@/lib/engine/finance-engine";
import { getTuitionSummary } from "@/lib/engine/tuition-engine";
import { getPayrollPeriod, periodKey, periodLabel } from "@/lib/engine/payroll-engine";

/**
 * Risk Engine (M9) — one prioritised risk register for the whole business.
 *
 * Composition, not duplication: the operational/educational risks already
 * produced by `getMissionControl` (unplaced students, churn, overloaded teachers,
 * engagement drop) are folded in as-is, and this engine adds the FINANCIAL risks
 * that only became computable once expenses, payroll and tuition existed.
 *
 * Every risk carries the number it rests on (`evidence`) and a concrete
 * recommendation — a severity badge with no evidence is just anxiety. Risks we
 * genuinely cannot assess (no inventory or contract data) are reported as gaps
 * instead of being silently absent.
 */

export type RiskSeverity = "critical" | "high" | "medium" | "low";
export type RiskCategory = "finance" | "students" | "teachers" | "operations";

export interface Risk {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  /** The figure this risk is based on. */
  evidence: string;
  /** What to do about it. */
  recommendation: string;
  href: string;
}

export interface RiskRegister {
  risks: Risk[];
  counts: Record<RiskSeverity, number>;
  /** Dimensions with no data source yet — stated openly. */
  gaps: string[];
}

const SEVERITY_RANK: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  finance: "Moliya",
  students: "Oʻquvchilar",
  teachers: "Oʻqituvchilar",
  operations: "Operatsiyalar",
};
export const riskCategoryLabel = (c: RiskCategory) => CATEGORY_LABEL[c];

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  critical: "Tanqidiy",
  high: "Yuqori",
  medium: "Oʻrta",
  low: "Past",
};
export const riskSeverityLabel = (s: RiskSeverity) => SEVERITY_LABEL[s];

const fmt = (n: number) => n.toLocaleString("en-US");

export async function getRiskRegister(): Promise<RiskRegister> {
  const period = periodKey();

  const [mc, snap, pnl, tuition, payroll, teacherLoads] = await Promise.all([
    getMissionControl().catch(() => null),
    getExecutiveSnapshot(),
    getProfitSnapshot(),
    getTuitionSummary().catch(() => null),
    getPayrollPeriod(period).catch(() => null),
    db.teacher
      .findMany({
        select: {
          id: true,
          user: { select: { name: true } },
          groups: { select: { _count: { select: { students: true } } } },
        },
      })
      .catch(() => [] as { id: string; user: { name: string | null } | null; groups: { _count: { students: number } }[] }[]),
  ]);

  const risks: Risk[] = [];

  // ---------------- Finance ----------------
  if (pnl.hasExpenseData && pnl.month.grossProfit < 0) {
    risks.push({
      id: "loss",
      category: "finance",
      severity: "critical",
      title: "Bu oy zarar bilan ishlamoqda",
      evidence: `Daromad ${fmt(pnl.month.revenue)} UZS, xarajat ${fmt(pnl.month.expenses)} UZS — zarar ${fmt(Math.abs(pnl.month.grossProfit))} UZS.`,
      recommendation: "Eng yirik xarajat turkumini qisqartiring va qarzdorlardan toʻlovni yigʻing.",
      href: "/admin/expenses",
    });
  }

  if (pnl.revenueGrowthPct != null && pnl.revenueGrowthPct <= -15) {
    risks.push({
      id: "revenue-drop",
      category: "finance",
      severity: pnl.revenueGrowthPct <= -30 ? "critical" : "high",
      title: `Daromad ${Math.abs(pnl.revenueGrowthPct)}% pasaydi`,
      evidence: `Bu oy ${fmt(pnl.month.revenue)} UZS, oʻtgan oy ${fmt(pnl.prevMonth.revenue)} UZS.`,
      recommendation: "Yangi qabulni faollashtiring va toʻlovni uzaytirmagan oʻquvchilar bilan bogʻlaning.",
      href: "/admin/payments",
    });
  }

  if (pnl.hasExpenseData && pnl.expenseGrowthPct != null && pnl.expenseGrowthPct >= 25) {
    const top = pnl.byCategory[0];
    risks.push({
      id: "expense-spike",
      category: "finance",
      severity: pnl.expenseGrowthPct >= 50 ? "high" : "medium",
      title: `Xarajatlar ${pnl.expenseGrowthPct}% oshdi`,
      evidence: `Bu oy ${fmt(pnl.month.expenses)} UZS, oʻtgan oy ${fmt(pnl.prevMonth.expenses)} UZS.${
        top ? ` Eng katta turkum — ${top.label} (${fmt(top.amount)}, ${top.share}%).` : ""
      }`,
      recommendation: "Oshgan turkumni tekshiring: takrorlanuvchi toʻlovlar yoki bir martalik xaridmi?",
      href: "/admin/expenses",
    });
  }

  // A single expense dominating the month is worth a human look.
  if (pnl.hasExpenseData && pnl.byCategory.length > 1 && pnl.byCategory[0].share >= 60) {
    risks.push({
      id: "expense-concentration",
      category: "finance",
      severity: "low",
      title: "Xarajatlar bitta turkumga qattiq bogʻlangan",
      evidence: `${pnl.byCategory[0].label} umumiy xarajatning ${pnl.byCategory[0].share}%ini tashkil qiladi.`,
      recommendation: "Bu turkum boʻyicha shartnoma va narxlarni qayta koʻrib chiqing.",
      href: "/admin/expenses",
    });
  }

  if (pnl.pendingApproval.count > 0) {
    risks.push({
      id: "expense-approvals",
      category: "finance",
      severity: pnl.pendingApproval.count >= 5 ? "medium" : "low",
      title: `${pnl.pendingApproval.count} ta xarajat tasdiqlanmagan`,
      evidence: `${fmt(pnl.pendingApproval.amount)} UZS foyda hisobiga kirmagan — hozirgi foyda haqiqiydan yuqori koʻrinadi.`,
      recommendation: "Xarajatlarni koʻrib chiqing va tasdiqlang, aks holda foyda notoʻgʻri baholanadi.",
      href: "/admin/expenses",
    });
  }

  if (payroll && payroll.totalApproved > 0) {
    risks.push({
      id: "payroll-unpaid",
      category: "teachers",
      severity: "high",
      title: "Tasdiqlangan maosh hali toʻlanmagan",
      evidence: `${periodLabel(period)} uchun ${fmt(payroll.totalApproved)} UZS toʻlanishi kerak.`,
      recommendation: "Maoshni toʻlang — kechikish oʻqituvchilarni yoʻqotishning eng tez yoʻli.",
      href: "/admin/payroll",
    });
  }

  if (payroll && payroll.rows.filter((r) => r.needsConfig).length > 0) {
    const n = payroll.rows.filter((r) => r.needsConfig).length;
    risks.push({
      id: "payroll-unset",
      category: "teachers",
      severity: "medium",
      title: `${n} ta oʻqituvchining maosh turi sozlanmagan`,
      evidence: "Maosh hisoblanmaydi va xarajatlar toʻliq koʻrinmaydi.",
      recommendation: "Har bir oʻqituvchi uchun maosh turini va summasini belgilang.",
      href: "/admin/payroll",
    });
  }

  // ---------------- Students / collection ----------------
  if (tuition) {
    if (tuition.overdue > 0) {
      risks.push({
        id: "overdue-tuition",
        category: "students",
        severity: tuition.overdue >= 5 ? "critical" : "high",
        title: `${tuition.overdue} ta oʻquvchi toʻlovni kechiktirdi`,
        evidence: `Jami qarz ${fmt(tuition.outstandingMonth)} UZS.`,
        recommendation: "Eslatma yuboring va toʻlov jadvalini kelishib oling.",
        href: "/admin/payments",
      });
    }

    if (tuition.collectionRate != null && tuition.collectionRate < 70 && tuition.expectedMonth > 0) {
      risks.push({
        id: "low-collection",
        category: "finance",
        severity: tuition.collectionRate < 50 ? "high" : "medium",
        title: `Toʻlov yigʻilishi past — ${tuition.collectionRate}%`,
        evidence: `Kutilgan ${fmt(tuition.expectedMonth)} UZS, yigʻilgan ${fmt(tuition.collectedMonth)} UZS.`,
        recommendation: "Qarzdorlar roʻyxatini yuqoridan pastga qarab ishlab chiqing.",
        href: "/admin/payments",
      });
    }

    if (tuition.unpriced > 0) {
      risks.push({
        id: "unpriced-students",
        category: "operations",
        severity: "medium",
        title: `${tuition.unpriced} ta oʻquvchida narx yoki muddat yoʻq`,
        evidence: "Ularning qarzi hisoblanmaydi, ya'ni real qarz koʻrsatilgandan koʻproq boʻlishi mumkin.",
        recommendation: "Guruh narxini va toʻlov kunini belgilang.",
        href: "/admin/payments",
      });
    }

    // Concentration: is most of the debt one family?
    const debtors = tuition.rows.filter((r) => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    if (debtors.length >= 3 && tuition.outstandingMonth > 0) {
      const topShare = Math.round((debtors[0].outstanding / tuition.outstandingMonth) * 100);
      if (topShare >= 40) {
        risks.push({
          id: "debt-concentration",
          category: "finance",
          severity: "medium",
          title: "Qarzning katta qismi bitta oʻquvchida",
          evidence: `${debtors[0].name} — ${fmt(debtors[0].outstanding)} UZS, bu umumiy qarzning ${topShare}%i.`,
          recommendation: "Shu oʻquvchi bilan alohida gaplashib, toʻlov rejasini tuzing.",
          href: "/admin/payments",
        });
      }
    }
  }

  if (snap.attendanceRate != null && snap.attendanceRate < 70) {
    risks.push({
      id: "low-attendance",
      category: "students",
      severity: snap.attendanceRate < 55 ? "high" : "medium",
      title: `Davomat past — ${snap.attendanceRate}%`,
      evidence: "Soʻnggi 30 kunlik belgilanishlar asosida.",
      recommendation: "Sabablarini oʻqituvchilar bilan koʻrib chiqing va eslatmalarni yoqing.",
      href: "/admin/analytics",
    });
  }

  // ---------------- Teachers ----------------
  const loads = teacherLoads.map((t) => ({
    name: t.user?.name ?? "Oʻqituvchi",
    students: t.groups.reduce((s, g) => s + g._count.students, 0),
  }));
  const avgLoad = loads.length ? loads.reduce((a, l) => a + l.students, 0) / loads.length : 0;
  const overloaded = loads.filter((l) => avgLoad > 0 && l.students > avgLoad * 1.5);
  if (overloaded.length > 0) {
    risks.push({
      id: "teacher-overload",
      category: "teachers",
      severity: "medium",
      title: `${overloaded.length} ta oʻqituvchi ortiqcha yuklangan`,
      evidence: `${overloaded[0].name} — ${overloaded[0].students} oʻquvchi (oʻrtacha ${Math.round(avgLoad)}).`,
      recommendation: "Yuklamani qayta taqsimlang — aks holda feedback sifati pasayadi.",
      href: "/admin/teachers",
    });
  }

  // ---------------- Operations ----------------
  if (snap.underEnrolledGroups > 0) {
    risks.push({
      id: "under-enrolled",
      category: "operations",
      severity: snap.underEnrolledGroups >= 3 ? "medium" : "low",
      title: `${snap.underEnrolledGroups} ta guruh kam toʻldirilgan`,
      evidence: `Jami ${snap.groups} guruh, oʻrtacha ${snap.avgGroupSize ?? "—"} oʻquvchi.`,
      recommendation: "Kichik guruhlarni birlashtiring — oʻqituvchi vaqti tejaladi.",
      href: "/admin/groups",
    });
  }

  // Fold in the operational/educational events already computed elsewhere,
  // mapping their severity onto ours. Never recomputed here.
  if (mc) {
    const MAP: Record<string, RiskSeverity> = { high: "high", medium: "medium", low: "low" };
    const CAT: Record<string, RiskCategory> = {
      unplaced: "operations",
      payments: "finance",
      rewards: "operations",
      overloaded: "teachers",
      churn: "students",
      engagement: "students",
    };
    for (const e of mc.events) {
      // Skip anything this engine already states more precisely.
      if (e.id === "overloaded" || e.id === "payments") continue;
      risks.push({
        id: `mc-${e.id}`,
        category: CAT[e.id] ?? "operations",
        severity: MAP[e.severity] ?? "medium",
        title: e.title,
        evidence: e.impact,
        recommendation: e.action,
        href: e.href,
      });
    }
  }

  risks.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const counts: Record<RiskSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const r of risks) counts[r.severity]++;

  const gaps: string[] = [];
  if (!pnl.hasExpenseData) {
    gaps.push("Moliyaviy xavflar toʻliq emas — xarajatlar kiritilmagan, zarar va xarajat oʻsishi aniqlanmaydi.");
  }
  gaps.push("Jihozlarni almashtirish xavfi — inventar moduli hali yoʻq (M7).");
  gaps.push("Shartnoma va litsenziya muddatlari — bu maʼlumot saqlanmaydi (M8).");

  return { risks, counts, gaps };
}
