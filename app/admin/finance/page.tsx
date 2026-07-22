export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, AlertTriangle, Receipt } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default async function AdminFinancePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Faqat adminlar uchun" message="Bu boʻlim faqat administratorlar uchun." />;
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

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/admin/dashboard", label: "Admin paneliga qaytish" }}
          icon={Wallet}
          iconClassName="text-averna-neon"
          title={<span className="neon-text">Moliya</span>}
          subtitle="Daromad koʻrinishi, soʻnggi tranzaksiyalar va toʻlov qarzi boʻlishi mumkin boʻlgan oʻquvchilar."
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass border-averna-neon/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1 text-averna-neon"><TrendingUp className="h-4 w-4" /> Kurs daromadi</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-neon">{fmt(courseTotal)}</p><p className="text-[11px] text-gray-500">UZS</p></CardContent>
          </Card>
          <Card className="glass border-averna-cyan/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1 text-averna-cyan"><Wallet className="h-4 w-4" /> Jami toʻldirishlar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-cyan">{fmt(topupTotal)}</p><p className="text-[11px] text-gray-500">UZS</p></CardContent>
          </Card>
          <Card className="glass border-averna-pink/30">
            <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-1 text-averna-pink"><AlertTriangle className="h-4 w-4" /> Mumkin boʻlgan qarzdorlar</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-averna-pink">{debtors.length}</p></CardContent>
          </Card>
        </div>

        <Card className="glass border-averna-pink/30 mb-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-pink"><AlertTriangle className="h-5 w-5" /> Balansi nol boʻlgan oʻquvchilar</CardTitle></CardHeader>
          <CardContent>
            {debtors.length === 0 ? (
              <p className="text-gray-400 text-sm">🎉 Balansi nol boʻlgan oʻquvchilar yoʻq.</p>
            ) : (
              <div className="space-y-2">
                {debtors.slice(0, 20).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{s.user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.group?.name ?? "Guruhsiz"}</p>
                    </div>
                    <span className="text-red-300 font-semibold whitespace-nowrap">{fmt(s.balance)} UZS</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Receipt className="h-5 w-5" /> Soʻnggi tranzaksiyalar</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-gray-400 text-sm">Hozircha tranzaksiyalar yoʻq.</p>
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
