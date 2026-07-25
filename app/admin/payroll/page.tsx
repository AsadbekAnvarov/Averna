export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banknote, Users, CheckCircle2, Settings2, Wallet, AlertTriangle } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import {
import { can } from "@/lib/engine/permissions";
  getPayrollPeriod,
  computeNet,
  periodKey,
  periodLabel,
  recentPeriods,
  salaryTypeLabel,
  SALARY_TYPES,
} from "@/lib/engine/payroll-engine";

const fmt = (n: number) => n.toLocaleString("en-US");

async function saveSalaryConfig(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "payroll")) redirect("/auth/signin");

  const teacherId = formData.get("teacherId") as string;
  const salaryType = (formData.get("salaryType") as string)?.trim();
  const baseSalary = Math.round(Number(formData.get("baseSalary")) || 0);
  const hourlyRate = Math.round(Number(formData.get("hourlyRate")) || 0);
  if (!teacherId || !salaryType) return;

  await db.teacher.update({
    where: { id: teacherId },
    data: { salaryType, baseSalary: Math.max(0, baseSalary), hourlyRate: Math.max(0, hourlyRate) },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Updated salary config",
    `teacherId=${teacherId} type=${salaryType} base=${baseSalary} rate=${hourlyRate}`
  );
  revalidatePath("/admin/payroll");
}

/** Create or update the payroll record for a teacher+period, then approve it. */
async function approvePayroll(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "payroll")) redirect("/auth/signin");

  const teacherId = formData.get("teacherId") as string;
  const period = (formData.get("period") as string)?.trim();
  if (!teacherId || !period) return;

  const teacher = await db.teacher.findUnique({
    where: { id: teacherId },
    select: { salaryType: true, baseSalary: true, hourlyRate: true, user: { select: { name: true } } },
  });
  if (!teacher?.salaryType) return;

  const lessons = Math.round(Number(formData.get("lessons")) || 0);
  const extraHours = Math.round(Number(formData.get("extraHours")) || 0);
  const bonus = Math.round(Number(formData.get("bonus")) || 0);
  const deduction = Math.round(Number(formData.get("deduction")) || 0);
  const note = (formData.get("note") as string)?.trim() || null;

  const payload = {
    salaryType: teacher.salaryType,
    baseSalary: teacher.baseSalary ?? 0,
    hourlyRate: teacher.hourlyRate ?? 0,
    lessons,
    extraHours,
    bonus,
    deduction,
  };
  const net = computeNet(payload);

  await db.payroll.upsert({
    where: { teacherId_period: { teacherId, period } },
    create: {
      teacherId,
      period,
      ...payload,
      net,
      note,
      status: "approved",
      approvedByName: session.user.name ?? "Admin",
    },
    update: { ...payload, net, note, status: "approved", approvedByName: session.user.name ?? "Admin" },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Approved payroll",
    `teacher=${teacher.user?.name ?? teacherId} period=${period} net=${net}`
  );
  revalidatePath("/admin/payroll");
}

/**
 * Mark a payroll as paid. This is where money enters the P&L: an Expense row is
 * created (SALARY_TEACHER) and linked, so the Profit Engine sees it exactly once.
 */
async function payPayroll(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "payroll")) redirect("/auth/signin");

  const id = formData.get("id") as string;
  if (!id) return;

  const row = await db.payroll.findUnique({
    where: { id },
    include: { teacher: { select: { user: { select: { name: true } } } } },
  });
  if (!row || row.status === "paid" || row.net <= 0) return;

  const teacherName = row.teacher?.user?.name ?? "Oʻqituvchi";
  const [y, m] = row.period.split("-").map(Number);

  const expense = await db.expense.create({
    data: {
      category: "SALARY_TEACHER",
      amount: row.net,
      method: "TRANSFER",
      vendor: teacherName,
      note: `${periodLabel(row.period)} maoshi`,
      status: "paid",
      // Attribute the cost to the month it was earned, not the day it was paid.
      incurredAt: new Date(y, (m || 1) - 1, 28),
      recordedById: session.user.id,
      recordedByName: session.user.name ?? "Admin",
    },
  });

  await db.payroll.update({
    where: { id },
    data: { status: "paid", paidAt: new Date(), expenseId: expense.id },
  });

  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Paid payroll",
    `teacher=${teacherName} period=${row.period} net=${row.net} expenseId=${expense.id}`
  );
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/dashboard");
}

export default async function AdminPayrollPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (!can(session.user.role, "payroll")) {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const periods = recentPeriods(6);
  const period = searchParams?.period && periods.includes(searchParams.period) ? searchParams.period : periodKey();
  const data = await getPayrollPeriod(period);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Banknote}
          iconClassName="text-averna-cyan"
          title={<span className="neon-text">Maoshlar</span>}
          subtitle="Oʻqituvchilar maoshini hisoblang, tasdiqlang va toʻlang — toʻlangach xarajatga tushadi."
        />

        {/* Period selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {periods.map((p) => (
            <Link
              key={p}
              href={`/admin/payroll?period=${p}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                p === period
                  ? "border-averna-cyan/50 bg-averna-cyan/15 text-averna-cyan"
                  : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {periodLabel(p)}
            </Link>
          ))}
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="glass border-averna-cyan/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-cyan flex items-center gap-1"><Wallet className="h-4 w-4" /> Jami hisoblangan</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-cyan">{fmt(data.totalSuggested)}</p><p className="text-[11px] text-gray-500">UZS</p></CardContent>
          </Card>
          <Card className="glass border-amber-400/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Tasdiqlangan</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-amber-400">{fmt(data.totalApproved)}</p><p className="text-[11px] text-gray-500">toʻlanishi kerak</p></CardContent>
          </Card>
          <Card className="glass border-averna-neon/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-neon flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Toʻlangan</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-neon">{fmt(data.totalPaid)}</p><p className="text-[11px] text-gray-500">xarajatga tushdi</p></CardContent>
          </Card>
          <Card className="glass border-averna-purple/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-averna-purple flex items-center gap-1"><Users className="h-4 w-4" /> Oʻqituvchilar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-purple">{data.rows.length}</p><p className="text-[11px] text-gray-500">{data.rows.filter((r) => r.needsConfig).length} ta sozlanmagan</p></CardContent>
          </Card>
        </div>

        {/* Teachers */}
        <div className="space-y-4">
          {data.rows.length === 0 && (
            <Card className="glass border-white/10">
              <CardContent className="py-6">
                <p className="text-gray-400 text-sm">Hozircha oʻqituvchilar yoʻq.</p>
              </CardContent>
            </Card>
          )}

          {data.rows.map((r) => {
            const paid = r.record?.status === "paid";
            const approved = r.record?.status === "approved";
            return (
              <Card
                key={r.teacherId}
                className={`glass ${paid ? "border-averna-neon/30" : approved ? "border-amber-400/30" : "border-white/10"}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span className="text-white">{r.name}</span>
                    <span className="flex items-center gap-2 text-xs font-normal">
                      <span className="text-gray-400">
                        {salaryTypeLabel(r.salaryType)} · {r.lessons} dars · {r.students} oʻquvchi
                      </span>
                      {paid && (
                        <span className="px-2 py-0.5 rounded-full border border-averna-neon/40 bg-averna-neon/10 text-averna-neon">
                          Toʻlangan{r.record?.paidAt ? ` · ${formatDate(r.record.paidAt)}` : ""}
                        </span>
                      )}
                      {approved && (
                        <span className="px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300">
                          Tasdiqlangan
                        </span>
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {r.needsConfig ? (
                    /* Salary type not set yet — configure first */
                    <form action={saveSalaryConfig} className="grid sm:grid-cols-4 gap-3 items-end">
                      <input type="hidden" name="teacherId" value={r.teacherId} />
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-400 flex items-center gap-1">
                          <Settings2 className="h-3.5 w-3.5" /> Maosh turi
                        </label>
                        <select
                          name="salaryType"
                          required
                          defaultValue=""
                          className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
                        >
                          <option value="" disabled className="bg-averna-dark">— Tanlang —</option>
                          {SALARY_TYPES.map((t) => (
                            <option key={t.key} value={t.key} className="bg-averna-dark">{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Oylik (UZS)</label>
                        <input name="baseSalary" type="number" min="0" step="100000" defaultValue={r.baseSalary || ""} className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Dars/soat narxi</label>
                        <input name="hourlyRate" type="number" min="0" step="10000" defaultValue={r.hourlyRate || ""} className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
                      </div>
                      <div className="sm:col-span-4">
                        <Button type="submit" size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
                          Maosh sozlamasini saqlash
                        </Button>
                      </div>
                    </form>
                  ) : paid ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-400">
                        {r.record?.note ? `${r.record.note} · ` : ""}Xarajatlar hisobiga kiritilgan.
                      </p>
                      <p className="text-xl font-bold text-averna-neon">{fmt(r.record!.net)}</p>
                    </div>
                  ) : (
                    /* Approve / re-approve, then pay */
                    <div className="space-y-3">
                      <form action={approvePayroll} className="grid sm:grid-cols-5 gap-3 items-end">
                        <input type="hidden" name="teacherId" value={r.teacherId} />
                        <input type="hidden" name="period" value={period} />
                        <div>
                          <label className="text-xs text-gray-400">Darslar</label>
                          <input name="lessons" type="number" min="0" defaultValue={r.record?.lessons ?? r.lessons} className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Qoʻshimcha soat</label>
                          <input name="extraHours" type="number" min="0" defaultValue={r.record?.extraHours ?? 0} className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Bonus</label>
                          <input name="bonus" type="number" min="0" step="10000" defaultValue={r.record?.bonus ?? 0} className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Ushlab qolish</label>
                          <input name="deduction" type="number" min="0" step="10000" defaultValue={r.record?.deduction ?? 0} className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <Button type="submit" size="sm" variant="outline" className="w-full border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
                            Hisoblash va tasdiqlash
                          </Button>
                        </div>
                        <div className="sm:col-span-5">
                          <input name="note" placeholder="Izoh (ixtiyoriy)" defaultValue={r.record?.note ?? ""} className="w-full rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white" />
                        </div>
                      </form>

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
                        <p className="text-sm text-gray-400">
                          {approved ? "Tasdiqlangan summa" : "Taxminiy summa"}
                        </p>
                        <div className="flex items-center gap-3">
                          <p className={`text-xl font-bold ${approved ? "text-amber-300" : "text-gray-300"}`}>
                            {fmt(r.record?.net ?? r.suggestedNet)}
                          </p>
                          {approved && (
                            <form action={payPayroll}>
                              <input type="hidden" name="id" value={r.record!.id} />
                              <Button type="submit" size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Toʻlandi
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
