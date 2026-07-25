export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertTriangle, CheckCircle2, Clock, Bell, Settings2, TrendingUp } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications";
import { getTuitionSummary, riskLabel, type PaymentRisk } from "@/lib/engine/tuition-engine";
import { can } from "@/lib/engine/permissions";
import { MethodBreakdown } from "@/components/admin/method-breakdown";
import {
  PAYMENT_METHODS,
  normaliseMethod,
  paymentMethodLabel,
  summariseByMethod,
} from "@/lib/engine/payment-methods";

const fmt = (n: number) => n.toLocaleString("en-US");

const RISK_STYLE: Record<PaymentRisk, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  late: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  watch: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan",
  unset: "border-white/15 bg-white/5 text-gray-400",
  ok: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon",
};

/** Set the tuition terms for one student. */
async function saveTerms(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "payments")) redirect("/auth/signin");

  const studentId = formData.get("studentId") as string;
  if (!studentId) return;

  const feeRaw = (formData.get("feeOverride") as string)?.trim();
  const dueRaw = (formData.get("dueDay") as string)?.trim();
  const discount = Math.max(0, Math.min(100, Math.round(Number(formData.get("discountPct")) || 0)));
  const scholarship = formData.get("scholarship") === "on";

  await db.student.update({
    where: { id: studentId },
    data: {
      feeOverride: feeRaw ? Math.max(0, Math.round(Number(feeRaw))) : null,
      dueDay: dueRaw ? Math.min(28, Math.max(1, Math.round(Number(dueRaw)))) : null,
      discountPct: discount,
      scholarship,
    },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Updated tuition terms",
    `studentId=${studentId} fee=${feeRaw || "-"} due=${dueRaw || "-"} discount=${discount} scholarship=${scholarship}`
  );
  revalidatePath("/admin/payments");
}

/** Record a tuition payment: credits the wallet and files it in the ledger. */
async function recordTuitionPayment(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "payments")) redirect("/auth/signin");

  const studentId = formData.get("studentId") as string;
  const amount = Math.round(Number(formData.get("amount")));
  // Anything unrecognised falls back to cash, which is what a desk payment
  // without a selection is in practice.
  const method = normaliseMethod(formData.get("method") as string) ?? "CASH";
  if (!studentId || !Number.isFinite(amount) || amount <= 0) return;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true, user: { select: { name: true } } },
  });
  if (!student) return;

  await db.$transaction([
    db.student.update({ where: { id: studentId }, data: { balance: { increment: amount } } }),
    db.payment.create({
      data: {
        studentId,
        amount,
        // `type` is what was paid for; `method` is how it arrived. Cash used to
        // overwrite `type`, which hid it from course-income totals.
        type: "COURSE",
        method,
        status: "COMPLETED",
        description: `Kurs toʻlovi · ${paymentMethodLabel(method)}`,
      },
    }),
  ]);

  await notifyUser(student.userId, {
    type: "system",
    title: "Payment received",
    message: `We've received your payment of ${fmt(amount)} UZS. Thank you!`,
    link: "/billing",
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Recorded tuition payment",
    `name=${student.user?.name ?? "?"} amount=${amount} method=${method}`
  );
  revalidatePath("/admin/payments");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/dashboard");
}

/** Send the student a payment reminder (no money movement). */
async function sendReminder(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "payments")) redirect("/auth/signin");

  const studentId = formData.get("studentId") as string;
  const amount = Math.round(Number(formData.get("amount")) || 0);
  if (!studentId) return;

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { userId: true, user: { select: { name: true } } },
  });
  if (!student) return;

  await notifyUser(student.userId, {
    type: "system",
    title: "Payment reminder",
    message:
      amount > 0
        ? `A tuition payment of ${fmt(amount)} UZS is due. Please contact the centre if you need help.`
        : "A tuition payment is due. Please contact the centre if you need help.",
    link: "/billing",
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Sent payment reminder",
    `name=${student.user?.name ?? "?"} amount=${amount}`
  );
  revalidatePath("/admin/payments");
}

export default async function AdminPaymentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (!can(session.user.role, "payments")) {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Today's split, not the month's: this page is where money is taken, so the
  // question here is "does the till match what we recorded". The monthly view
  // lives on /admin/finance and is deliberately not repeated.
  const [data, todayPayments] = await Promise.all([
    getTuitionSummary(),
    db.payment.findMany({
      where: { status: "COMPLETED", createdAt: { gte: startToday } },
      select: { amount: true, type: true, method: true, description: true },
    }),
  ]);
  const todayByMethod = summariseByMethod(todayPayments);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={CreditCard}
          iconClassName="text-averna-cyan"
          title={<span className="neon-text">Oʻquvchi toʻlovlari</span>}
          subtitle="Kurs narxi, muddat, qarzdorlik va toʻlov xatti-harakati — bir joyda."
        />

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="glass border-averna-cyan/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-cyan flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Kutilgan (oy)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-cyan">{fmt(data.expectedMonth)}</p><p className="text-[11px] text-gray-500">UZS</p></CardContent>
          </Card>
          <Card className="glass border-averna-neon/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-neon flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Yigʻilgan</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-averna-neon">{fmt(data.collectedMonth)}</p>
              <p className="text-[11px] text-gray-500">{data.collectionRate == null ? "UZS" : `${data.collectionRate}% yigʻildi`}</p>
            </CardContent>
          </Card>
          <Card className="glass border-averna-pink/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-pink flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Qarz</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-pink">{fmt(data.outstandingMonth)}</p><p className="text-[11px] text-gray-500">{data.overdue} ta kechikkan</p></CardContent>
          </Card>
          <Card className="glass border-amber-400/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-amber-400 flex items-center gap-1"><Clock className="h-4 w-4" /> Muddati yaqin</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-amber-400">{data.dueSoon}</p><p className="text-[11px] text-gray-500">{data.unpriced} ta narx/muddat sozlanmagan</p></CardContent>
          </Card>
        </div>

        <MethodBreakdown
          summary={todayByMethod}
          title="Bugun qabul qilingan toʻlovlar"
          periodLabel="Bugun"
        />

        {data.rows.length === 0 ? (
          <Card className="glass border-white/10">
            <CardContent className="py-6">
              <p className="text-gray-400 text-sm">
                Guruhga biriktirilgan oʻquvchi yoʻq. Avval oʻquvchilarni guruhlarga joylashtiring.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.rows.map((r) => (
              <Card key={r.studentId} className="glass border-white/10">
                <CardContent className="p-4">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold flex items-center gap-2 flex-wrap">
                        <span className="truncate">{r.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${RISK_STYLE[r.risk]}`}>
                          {riskLabel(r.risk)}
                        </span>
                        {r.scholarship && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-averna-purple/40 bg-averna-purple/10 text-averna-purple">
                            Grant
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {r.group ?? "Guruhsiz"} · {r.email}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{r.riskReason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xl font-bold ${r.outstanding > 0 ? "text-averna-pink" : "text-averna-neon"}`}>
                        {r.outstanding > 0 ? `−${fmt(r.outstanding)}` : "Toʻlangan"}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Narx {r.fee > 0 ? fmt(r.fee) : "—"}
                        {r.discountPct > 0 && !r.scholarship ? ` (−${r.discountPct}%)` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Facts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-3">
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                      <p className="text-gray-500">Muddat</p>
                      <p className="text-white">
                        {r.nextDue ? formatDate(r.nextDue) : "—"}
                        {r.daysToDue != null && (
                          <span className={r.daysToDue < 0 ? "text-red-300" : "text-gray-400"}>
                            {" "}
                            ({r.daysToDue < 0 ? `${Math.abs(r.daysToDue)} kun oʻtdi` : `${r.daysToDue} kun`})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                      <p className="text-gray-500">Bu oy toʻlagan</p>
                      <p className="text-white">{fmt(r.paidThisMonth)}</p>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                      <p className="text-gray-500">Oxirgi toʻlov</p>
                      <p className="text-white">
                        {r.lastPaymentAt ? `${formatDate(r.lastPaymentAt)} · ${fmt(r.lastPaymentAmount)}` : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-2">
                      <p className="text-gray-500">Oʻz vaqtida toʻlash</p>
                      <p className="text-white">
                        {r.onTimeScore == null ? (
                          "maʼlumot yoʻq"
                        ) : (
                          <>
                            {r.onTimeScore}%{" "}
                            <span className="text-gray-500">
                              ({r.scoreConfidence === "high" ? "ishonchli" : r.scoreConfidence === "medium" ? "oʻrtacha" : "kam maʼlumot"})
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid lg:grid-cols-2 gap-3">
                    {/* Record payment */}
                    <form action={recordTuitionPayment} className="flex items-end gap-2">
                      <input type="hidden" name="studentId" value={r.studentId} />
                      <div className="flex-1 min-w-0">
                        <label className="text-[11px] text-gray-400">Toʻlov summasi</label>
                        <input
                          name="amount"
                          type="number"
                          min="1"
                          step="10000"
                          defaultValue={r.outstanding > 0 ? r.outstanding : undefined}
                          placeholder="summa"
                          className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-1.5 text-sm text-white"
                        />
                      </div>
                      <div className="w-28">
                        <label className="text-[11px] text-gray-400">Usul</label>
                        <select name="method" defaultValue="CASH" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-1.5 text-sm text-white">
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m.key} value={m.key} className="bg-averna-dark">
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button type="submit" size="sm" className="neon-button bg-averna-primary hover:bg-averna-light shrink-0">
                        Qabul
                      </Button>
                    </form>

                    {/* Terms + reminder */}
                    <div className="flex flex-wrap items-end gap-2">
                      <form action={saveTerms} className="flex items-end gap-2 flex-1 min-w-0">
                        <input type="hidden" name="studentId" value={r.studentId} />
                        <div className="w-28">
                          <label className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Settings2 className="h-3 w-3" /> Narx
                          </label>
                          <input name="feeOverride" type="number" min="0" step="50000" defaultValue={r.baseFee || ""} placeholder="guruh narxi" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-1.5 text-sm text-white" />
                        </div>
                        <div className="w-20">
                          <label className="text-[11px] text-gray-400">Chegirma %</label>
                          <input name="discountPct" type="number" min="0" max="100" defaultValue={r.scholarship ? 0 : r.discountPct} className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-1.5 text-sm text-white" />
                        </div>
                        <div className="w-20">
                          <label className="text-[11px] text-gray-400">Kun</label>
                          <input name="dueDay" type="number" min="1" max="28" defaultValue={r.dueDay ?? ""} placeholder="1-28" className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-1.5 text-sm text-white" />
                        </div>
                        <label className="flex items-center gap-1 text-[11px] text-gray-300 pb-2">
                          <input name="scholarship" type="checkbox" defaultChecked={r.scholarship} className="accent-averna-purple" />
                          Grant
                        </label>
                        <Button type="submit" size="sm" variant="outline" className="border-white/20 text-gray-300 shrink-0">
                          Saqlash
                        </Button>
                      </form>

                      {r.outstanding > 0 && !r.scholarship && (
                        <form action={sendReminder}>
                          <input type="hidden" name="studentId" value={r.studentId} />
                          <input type="hidden" name="amount" value={r.outstanding} />
                          <Button type="submit" size="sm" variant="outline" className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10 shrink-0">
                            <Bell className="h-4 w-4 mr-1" /> Eslatma
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-500 mt-6">
          Izoh: «Oʻz vaqtida toʻlash» — oʻquvchining oʻz toʻlov tarixiga asoslangan shaffof koʻrsatkich
          (sunʼiy intellekt modeli emas). Kam maʼlumotda ishonch darajasi past deb belgilanadi.
        </p>
      </div>
    </div>
  );
}
