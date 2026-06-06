export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, AlertTriangle, Receipt } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PaymentReminderButton } from "@/components/admin/payment-reminder-button";
import { formatDate } from "@/lib/utils";

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default async function AdminFinancePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const [payments, students] = await Promise.all([
    db.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { student: { include: { user: { select: { name: true } } } } },
    }),
    db.student.findMany({
      include: { user: { select: { name: true } }, group: { select: { name: true } } },
    }),
  ]);

  const topupTotal = payments.filter((p) => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const courseTotal = payments.filter((p) => p.type === "COURSE").reduce((s, p) => s + Math.abs(p.amount), 0);

  const debtors = students
    .filter((s) => s.groupId && s.balance <= 0)
    .sort((a, b) => a.balance - b.balance);

  const recent = payments.slice(0, 15);

  // Monthly income (last 6 months) — positive payments count as income
  const months: { label: string; key: string; total: number }[] = [];
  const base = new Date();
  base.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(base.getFullYear(), base.getMonth() - i, 1);
    months.push({ label: m.toLocaleDateString("en-US", { month: "short" }), key: `${m.getFullYear()}-${m.getMonth()}`, total: 0 });
  }
  for (const p of payments) {
    if (p.amount <= 0) continue;
    const c = new Date(p.createdAt);
    const bucket = months.find((mm) => mm.key === `${c.getFullYear()}-${c.getMonth()}`);
    if (bucket) bucket.total += p.amount;
  }
  const maxIncome = Math.max(1, ...months.map((m) => m.total));

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <Link href="/admin/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Admin Panel</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Wallet className="h-8 w-8 text-averna-neon" /> <span className="neon-text">Finance</span>
        </h1>
        <p className="text-gray-400 mb-6">Revenue overview, recent transactions and students who may owe payment.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass border-averna-neon/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1 text-averna-neon"><TrendingUp className="h-4 w-4" /> Course revenue</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-neon">{fmt(courseTotal)}</p><p className="text-[11px] text-gray-500">UZS</p></CardContent>
          </Card>
          <Card className="glass border-averna-cyan/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1 text-averna-cyan"><Wallet className="h-4 w-4" /> Total top-ups</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-cyan">{fmt(topupTotal)}</p><p className="text-[11px] text-gray-500">UZS</p></CardContent>
          </Card>
          <Card className="glass border-averna-pink/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1 text-averna-pink"><AlertTriangle className="h-4 w-4" /> Possible debtors</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-pink">{debtors.length}</p></CardContent>
          </Card>
        </div>

        {/* Monthly income chart */}
        <Card className="glass border-averna-neon/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-neon"><TrendingUp className="h-5 w-5" /> Income (last 6 months)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {months.map((m) => {
                const h = Math.round((m.total / maxIncome) * 100);
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] text-averna-neon font-semibold mb-1">{m.total > 0 ? fmt(Math.round(m.total / 1000)) + "k" : "0"}</span>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-averna-neon/40 to-averna-cyan/70" style={{ height: `${Math.max(4, h)}%` }} />
                    <span className="text-[11px] text-gray-400 mt-1">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-averna-pink/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-pink"><AlertTriangle className="h-5 w-5" /> Students with zero balance</CardTitle></CardHeader>
          <CardContent>
            {debtors.length === 0 ? (
              <p className="text-gray-400 text-sm">🎉 No enrolled students with zero balance.</p>
            ) : (
              <div className="space-y-2">
                {debtors.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{s.user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.group?.name ?? "No group"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PaymentReminderButton name={s.user.name ?? "the student"} balance={s.balance} />
                      <span className="text-red-300 font-semibold whitespace-nowrap">{fmt(s.balance)} UZS</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Receipt className="h-5 w-5" /> Recent Transactions</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-gray-400 text-sm">No transactions yet.</p>
            ) : (
              <div className="space-y-2">
                {recent.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{p.student.user.name} · {p.description ?? p.type}</p>
                      <p className="text-[11px] text-gray-500">{formatDate(p.createdAt)} · {p.status}</p>
                    </div>
                    <span className={`font-semibold whitespace-nowrap ${p.amount >= 0 ? "text-averna-neon" : "text-red-300"}`}>
                      {p.amount >= 0 ? "+" : ""}{fmt(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
