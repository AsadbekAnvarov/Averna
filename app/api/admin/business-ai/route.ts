import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { businessAssistant } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import { getExecutiveSnapshot, getBusinessHealth } from "@/lib/engine/business-engine";
import { getProfitSnapshot } from "@/lib/engine/finance-engine";
import { getPayrollPeriod, periodKey } from "@/lib/engine/payroll-engine";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * M14 — AI Business Assistant for administrators.
 *
 * Assembles one factual snapshot of the business (revenue, expenses, profit,
 * payroll, students, attendance, health) and lets the model answer only from it.
 * Mirrors the evidence-linked pattern already used by the student AI: every claim
 * must cite a figure, and gaps are admitted rather than filled with guesses.
 * Rate-limited via ai-guard so questions can't run away with the AI budget.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Ruxsat yoʻq" }, { status: 403 });
    }

    const { message, history } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Savol kiritilmagan" }, { status: 400 });
    }

    const guard = guardAi(user.id, "averna-ai");
    if (!guard.ok) {
      return NextResponse.json({ reply: guard.message }, { status: 429 });
    }

    const period = periodKey();
    const [snap, pnl, payroll] = await Promise.all([
      getExecutiveSnapshot(),
      getProfitSnapshot(),
      getPayrollPeriod(period),
    ]);
    const health = await getBusinessHealth(snap);

    // ---- The single factual context the model may use ----
    const lines: string[] = [
      `Bugungi daromad: ${fmt(snap.revenueToday)} UZS.`,
      `Shu oy daromad: ${fmt(pnl.month.revenue)} UZS; oʻtgan oy: ${fmt(pnl.prevMonth.revenue)} UZS${
        pnl.revenueGrowthPct == null ? "" : ` (oʻzgarish ${pnl.revenueGrowthPct > 0 ? "+" : ""}${pnl.revenueGrowthPct}%)`
      }.`,
      `Yillik daromad: ${fmt(pnl.year.revenue)} UZS.`,
      `Toʻlov usullari (shu oy): ${
        snap.revenueByMethod.rows
          .filter((r) => r.amount > 0)
          .map((r) => `${r.label} ${fmt(r.amount)} UZS (${r.sharePct ?? 0}%)`)
          .join("; ") || "toʻlov yoʻq"
      }.`,
    ];

    if (pnl.hasExpenseData) {
      lines.push(
        `Shu oy xarajat: ${fmt(pnl.month.expenses)} UZS; oʻtgan oy: ${fmt(pnl.prevMonth.expenses)} UZS${
          pnl.expenseGrowthPct == null ? "" : ` (oʻzgarish ${pnl.expenseGrowthPct > 0 ? "+" : ""}${pnl.expenseGrowthPct}%)`
        }.`,
        `Shu oy sof foyda: ${fmt(pnl.month.grossProfit)} UZS, marja ${pnl.month.margin ?? "—"}%; oʻtgan oy foyda: ${fmt(pnl.prevMonth.grossProfit)} UZS.`,
      );
      if (pnl.byCategory.length) {
        lines.push(
          `Xarajat turkumlari (shu oy): ${pnl.byCategory
            .slice(0, 8)
            .map((c) => `${c.label} ${fmt(c.amount)} (${c.share}%)`)
            .join("; ")}.`,
        );
      }
      if (pnl.pendingApproval.count > 0) {
        lines.push(`Tasdiq kutayotgan xarajat: ${pnl.pendingApproval.count} ta, ${fmt(pnl.pendingApproval.amount)} UZS (foydaga hisoblanmagan).`);
      }
      lines.push(
        `Oxirgi 6 oy (daromad/xarajat/foyda): ${pnl.trend
          .map((t) => `${t.label} ${fmt(t.revenue)}/${fmt(t.expenses)}/${fmt(t.profit)}`)
          .join("; ")}.`,
      );
    } else {
      lines.push("XARAJAT MAʼLUMOTI YOʻQ: xarajatlar hali kiritilmagan, shuning uchun sof foyda hisoblanmaydi. Foyda haqidagi savolga taxmin qilmang — xarajat kiritish kerakligini aytib qoʻying.");
    }

    lines.push(
      `Maosh (${payroll.label}): jami hisoblangan ${fmt(payroll.totalSuggested)} UZS, tasdiqlangan ${fmt(payroll.totalApproved)} UZS, toʻlangan ${fmt(payroll.totalPaid)} UZS; ${payroll.rows.length} oʻqituvchi, ${payroll.rows.filter((r) => r.needsConfig).length} tasining maosh turi sozlanmagan.`,
      `Oʻquvchilar: jami ${snap.totalStudents}, faol (7 kun) ${snap.activeStudents}, bu oy yangi ${snap.newStudentsMonth}, guruhga biriktirilmagan ${snap.unplacedStudents}, balansi nol/manfiy ${snap.outstandingStudents}.`,
      `Guruhlar: ${snap.groups} ta, oʻrtacha ${snap.avgGroupSize ?? "—"} oʻquvchi, kam toʻldirilgan ${snap.underEnrolledGroups} ta. Oʻqituvchilar: ${snap.teachers} ta.`,
      `Davomat (30 kun): ${snap.attendanceRate == null ? "maʼlumot yetarli emas" : `${snap.attendanceRate}%`}.`,
      `Biznes salomatligi: ${health.score}/100 (${health.bandLabel}). Omillar: ${health.drivers
        .map((d) => `${d.label} ${d.score}/100`)
        .join("; ")}.`,
      `Tasdiqlanmagan toʻlovlar: ${snap.pendingPayments} ta.`,
    );

    const businessData = lines.join("\n");

    // ---- Rule-based fallback, grounded in the same figures ----
    const m = message.toLowerCase();
    let fallback: string;

    const profitAsk = /(foyda|profit|sof|daromaddan|marja)/.test(m);
    const expenseAsk = /(xarajat|expense|sarf|maosh|salary)/.test(m);
    const revenueAsk = /(daromad|revenue|tushum|pul kel)/.test(m);
    const studentAsk = /(oʻquvchi|oquvchi|student|qarz|toʻlov|tolov)/.test(m);

    if (profitAsk && !pnl.hasExpenseData) {
      fallback =
        "Sof foydani hozir hisoblab bera olmayman, chunki xarajatlar kiritilmagan — daromaddan foyda chiqarish xato boʻladi. " +
        `Shu oy daromad ${fmt(pnl.month.revenue)} UZS. "Xarajatlar" boʻlimiga ijara, maosh va kommunal xarajatlarni kiritsangiz, foyda avtomatik hisoblanadi.`;
    } else if (profitAsk) {
      fallback =
        `Shu oy sof foyda ${fmt(pnl.month.grossProfit)} UZS (daromad ${fmt(pnl.month.revenue)} − xarajat ${fmt(pnl.month.expenses)}), marja ${pnl.month.margin ?? "—"}%. ` +
        `Oʻtgan oy foyda ${fmt(pnl.prevMonth.grossProfit)} UZS edi. ` +
        (pnl.byCategory[0]
          ? `Eng katta xarajat — ${pnl.byCategory[0].label} (${fmt(pnl.byCategory[0].amount)}, ${pnl.byCategory[0].share}%); shu turkumni qisqartirish eng tez natija beradi.`
          : "Xarajat turkumlarini kiritsangiz, qayerdan tejash mumkinligini aniq koʻrsataman.");
    } else if (expenseAsk && pnl.hasExpenseData) {
      fallback =
        `Shu oy xarajat ${fmt(pnl.month.expenses)} UZS` +
        (pnl.expenseGrowthPct == null ? "" : `, oʻtgan oyga nisbatan ${pnl.expenseGrowthPct > 0 ? "+" : ""}${pnl.expenseGrowthPct}%`) +
        `. Eng yirik turkumlar: ${pnl.byCategory.slice(0, 3).map((c) => `${c.label} ${fmt(c.amount)}`).join(", ") || "—"}. ` +
        `Maosh (${payroll.label}) uchun tasdiqlangan ${fmt(payroll.totalApproved)} UZS toʻlanishi kerak.`;
    } else if (revenueAsk) {
      fallback =
        `Shu oy daromad ${fmt(pnl.month.revenue)} UZS, oʻtgan oy ${fmt(pnl.prevMonth.revenue)} UZS` +
        (pnl.revenueGrowthPct == null ? "" : ` (${pnl.revenueGrowthPct > 0 ? "+" : ""}${pnl.revenueGrowthPct}%)`) +
        `. Bugun ${fmt(snap.revenueToday)} UZS tushdi. ` +
        (snap.outstandingStudents > 0
          ? `${snap.outstandingStudents} ta oʻquvchining balansi nol yoki manfiy — qarzni yigʻish daromadni tez oshiradi.`
          : "Qarzdor oʻquvchi yoʻq, shuning uchun oʻsish yangi qabulga bogʻliq.");
    } else if (studentAsk) {
      fallback =
        `Jami ${snap.totalStudents} oʻquvchi, soʻnggi 7 kunda ${snap.activeStudents} tasi faol, bu oy ${snap.newStudentsMonth} ta yangi qoʻshildi. ` +
        `${snap.outstandingStudents} tasining balansi nol/manfiy, ${snap.unplacedStudents} tasi guruhga biriktirilmagan. ` +
        (snap.unplacedStudents > 0 ? "Biriktirilmaganlarni joylashtirish eng tezkor qadam." : "Keyingi qadam — faolsizlarni qaytarish.");
    } else {
      fallback =
        `Biznes salomatligi ${health.score}/100 (${health.bandLabel}). Shu oy daromad ${fmt(pnl.month.revenue)} UZS` +
        (pnl.hasExpenseData ? `, sof foyda ${fmt(pnl.month.grossProfit)} UZS` : ", xarajat maʼlumoti yoʻq") +
        `. ${health.recommendations[0] ?? "Koʻrsatkichlar barqaror — hozircha shoshilinch chora talab qilinmaydi."}`;
    }

    const reply = await businessAssistant(
      businessData,
      message,
      Array.isArray(history) ? history : [],
      fallback,
    );
    return NextResponse.json({ reply });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Xatolik";
    console.error("Business AI route error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
