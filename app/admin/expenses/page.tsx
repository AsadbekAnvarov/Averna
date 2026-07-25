export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt, Wallet, TrendingDown, CheckCircle2, PieChart, Clock } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { formatDate } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import {
import { can } from "@/lib/engine/permissions";
  getProfitSnapshot,
  expenseCategoryLabel,
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
} from "@/lib/engine/finance-engine";

const fmt = (n: number) => n.toLocaleString("en-US");

async function addExpense(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "expenses")) redirect("/auth/signin");

  const category = (formData.get("category") as string)?.trim();
  const amount = Math.round(Number(formData.get("amount")));
  const method = (formData.get("method") as string)?.trim() || "CASH";
  const vendor = (formData.get("vendor") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;
  const status = formData.get("needsApproval") === "on" ? "pending" : "paid";
  const incurred = (formData.get("incurredAt") as string)?.trim();

  if (!category || !Number.isFinite(amount) || amount <= 0) return;

  await db.expense.create({
    data: {
      category,
      amount,
      method,
      vendor,
      note,
      status,
      incurredAt: incurred ? new Date(incurred) : new Date(),
      recordedById: session.user.id,
      recordedByName: session.user.name ?? "Admin",
    },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Recorded expense",
    `category=${category} amount=${amount} method=${method} status=${status}`
  );
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/dashboard");
}

async function approveExpense(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "expenses")) redirect("/auth/signin");
  const id = formData.get("id") as string;
  if (!id) return;

  await db.expense.update({ where: { id }, data: { status: "paid" } });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Approved expense",
    `expenseId=${id}`
  );
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/dashboard");
}

async function deleteExpense(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || !can(session.user.role, "expenses")) redirect("/auth/signin");
  const id = formData.get("id") as string;
  if (!id) return;

  const row = await db.expense.findUnique({ where: { id }, select: { category: true, amount: true } });
  await db.expense.delete({ where: { id } });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Deleted expense",
    `category=${row?.category ?? "?"} amount=${row?.amount ?? "?"}`
  );
  revalidatePath("/admin/expenses");
  revalidatePath("/admin/dashboard");
}

export default async function AdminExpensesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (!can(session.user.role, "expenses")) {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
  }

  const snapshot = await getProfitSnapshot();
  // Defensive: the table may not exist yet on a not-yet-migrated environment.
  const recent = await db.expense
    .findMany({ orderBy: { incurredAt: "desc" }, take: 60 })
    .catch(() => [] as Awaited<ReturnType<typeof db.expense.findMany>>);

  const pending = recent.filter((e) => e.status === "draft" || e.status === "pending");
  const maxTrend = Math.max(1, ...snapshot.trend.map((t) => Math.max(t.revenue, t.expenses)));

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={TrendingDown}
          iconClassName="text-averna-pink"
          title={<span className="neon-text">Xarajatlar va foyda</span>}
          subtitle="Xarajatlarni qayd eting — foyda avtomatik hisoblanadi."
        />

        {/* P&L summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="glass border-averna-cyan/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1 text-averna-cyan">
                <Wallet className="h-4 w-4" /> Oylik daromad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-averna-cyan">{fmt(snapshot.month.revenue)}</p>
              <p className="text-[11px] text-gray-500">
                {snapshot.revenueGrowthPct == null
                  ? "UZS"
                  : `${snapshot.revenueGrowthPct > 0 ? "+" : ""}${snapshot.revenueGrowthPct}% oʻtgan oyga`}
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-averna-pink/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1 text-averna-pink">
                <TrendingDown className="h-4 w-4" /> Oylik xarajat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-averna-pink">{fmt(snapshot.month.expenses)}</p>
              <p className="text-[11px] text-gray-500">
                {snapshot.expenseGrowthPct == null
                  ? "UZS"
                  : `${snapshot.expenseGrowthPct > 0 ? "+" : ""}${snapshot.expenseGrowthPct}% oʻtgan oyga`}
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-averna-neon/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1 text-averna-neon">
                <PieChart className="h-4 w-4" /> Sof foyda
              </CardTitle>
            </CardHeader>
            <CardContent>
              {snapshot.hasExpenseData ? (
                <>
                  <p
                    className={`text-2xl font-bold ${
                      snapshot.month.grossProfit >= 0 ? "text-averna-neon" : "text-red-400"
                    }`}
                  >
                    {fmt(snapshot.month.grossProfit)}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Marja: {snapshot.month.margin == null ? "—" : `${snapshot.month.margin}%`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-500">—</p>
                  <p className="text-[11px] text-gray-500">Xarajat maʼlumoti yoʻq</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-amber-400/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-1 text-amber-400">
                <Clock className="h-4 w-4" /> Tasdiq kutilmoqda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-400">{snapshot.pendingApproval.count}</p>
              <p className="text-[11px] text-gray-500">{fmt(snapshot.pendingApproval.amount)} UZS</p>
            </CardContent>
          </Card>
        </div>

        {/* 6-month trend */}
        <Card className="glass border-white/10 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-base">6 oylik dinamika</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-3 h-40">
              {snapshot.trend.map((t) => (
                <div key={t.label} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      className="w-1/3 rounded-t bg-averna-cyan/70"
                      style={{ height: `${(t.revenue / maxTrend) * 100}%` }}
                      title={`Daromad: ${fmt(t.revenue)}`}
                    />
                    <div
                      className="w-1/3 rounded-t bg-averna-pink/70"
                      style={{ height: `${(t.expenses / maxTrend) * 100}%` }}
                      title={`Xarajat: ${fmt(t.expenses)}`}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{t.label}</span>
                  <span
                    className={`text-[10px] font-semibold ${
                      t.profit >= 0 ? "text-averna-neon" : "text-red-400"
                    }`}
                  >
                    {t.profit >= 0 ? "+" : ""}
                    {fmt(t.profit)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded bg-averna-cyan/70" /> Daromad
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-3 rounded bg-averna-pink/70" /> Xarajat
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Add expense */}
        <Card className="glass border-averna-pink/30 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-pink">
              <Receipt className="h-5 w-5" /> Xarajat qoʻshish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addExpense} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400">Turkum</label>
                <select
                  name="category"
                  required
                  defaultValue=""
                  className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                >
                  <option value="" disabled className="bg-averna-dark">— Tanlang —</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key} className="bg-averna-dark">{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Summa (UZS)</label>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="1000"
                  required
                  placeholder="masalan, 1500000"
                  className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Toʻlov usuli</label>
                <select
                  name="method"
                  defaultValue="CASH"
                  className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                >
                  {EXPENSE_METHODS.map((m) => (
                    <option key={m.key} value={m.key} className="bg-averna-dark">{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Yetkazib beruvchi (ixtiyoriy)</label>
                <input
                  name="vendor"
                  className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Sana</label>
                <input
                  name="incurredAt"
                  type="date"
                  className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Izoh (ixtiyoriy)</label>
                <input
                  name="note"
                  className="w-full mt-1 rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-300 sm:col-span-2">
                <input name="needsApproval" type="checkbox" className="accent-averna-pink" />
                Tasdiqlash kerak (foydaga hisoblanmaydi, keyin tasdiqlanadi)
              </label>
              <div className="flex items-end">
                <Button type="submit" className="neon-button bg-averna-primary hover:bg-averna-light w-full">
                  Qoʻshish
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        {snapshot.byCategory.length > 0 && (
          <Card className="glass border-averna-purple/30 mb-6">
            <CardHeader>
              <CardTitle className="text-averna-purple text-base">Bu oy turkumlar boʻyicha</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {snapshot.byCategory.map((c) => (
                  <div key={c.key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-300">{c.label}</span>
                      <span className="text-white font-medium">
                        {fmt(c.amount)} <span className="text-gray-500">· {c.share}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-averna-purple/70" style={{ width: `${c.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending approvals */}
        {pending.length > 0 && (
          <Card className="glass border-amber-400/30 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-400 text-base">
                <Clock className="h-4 w-4" /> Tasdiq kutayotgan xarajatlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pending.map((e) => (
                  <form
                    key={e.id}
                    action={approveExpense}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">
                        {expenseCategoryLabel(e.category)} · {fmt(e.amount)} UZS
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {formatDate(e.incurredAt)}
                        {e.vendor ? ` · ${e.vendor}` : ""}
                        {e.recordedByName ? ` · ${e.recordedByName}` : ""}
                      </p>
                    </div>
                    <Button type="submit" size="sm" className="neon-button bg-averna-primary shrink-0">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Tasdiqlash
                    </Button>
                  </form>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ledger */}
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white text-base">
              <Receipt className="h-4 w-4" /> Soʻnggi xarajatlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Hozircha xarajat qayd etilmagan. Yuqoridagi shakl orqali qoʻshing — sof foyda avtomatik hisoblanadi.
              </p>
            ) : (
              <div className="space-y-2">
                {recent.map((e) => (
                  <form
                    key={e.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">
                        {expenseCategoryLabel(e.category)}
                        {e.status !== "paid" && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300">
                            {e.status}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {formatDate(e.incurredAt)}
                        {e.vendor ? ` · ${e.vendor}` : ""}
                        {e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-averna-pink font-semibold whitespace-nowrap">−{fmt(e.amount)}</span>
                      <ConfirmButton
                        formAction={deleteExpense}
                        message={`${expenseCategoryLabel(e.category)} — ${fmt(e.amount)} UZS xarajatini oʻchirasizmi?`}
                        title="Oʻchirish"
                        className="h-8 w-8 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      >
                        ×
                      </ConfirmButton>
                    </div>
                  </form>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
