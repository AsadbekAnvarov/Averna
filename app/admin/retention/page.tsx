export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHeader } from "@/components/admin/admin-header";
import { AccountNotice } from "@/components/account-notice";
import { LineChart, ArrowLeft, Activity, UserPlus, Users, AlertTriangle } from "lucide-react";

const DAY = 86400000;

export default async function AdminRetentionPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const students = await db.student.findMany({
    select: { id: true, createdAt: true, enrolledAt: true, lastActiveDate: true, groupId: true },
  });

  const now = Date.now();
  const total = students.length;
  const enrolled = students.filter((s) => s.groupId).length;

  // Engagement buckets by last-active
  let activeToday = 0,
    activeWeek = 0,
    activeMonth = 0,
    dormant = 0;
  for (const s of students) {
    const days = (now - new Date(s.lastActiveDate).getTime()) / DAY;
    if (days < 1) activeToday++;
    else if (days < 7) activeWeek++;
    else if (days < 30) activeMonth++;
    else dormant++;
  }
  // "Active in last 7 days" = today + this week
  const weeklyActive = activeToday + activeWeek;
  const weeklyActivePct = total ? Math.round((weeklyActive / total) * 100) : 0;
  const churnRisk = dormant;

  // Signups per month (last 6 months)
  const months: { label: string; key: string; count: number }[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push({
      label: m.toLocaleDateString("en-US", { month: "short" }),
      key: `${m.getFullYear()}-${m.getMonth()}`,
      count: 0,
    });
  }
  for (const s of students) {
    const c = new Date(s.createdAt);
    const key = `${c.getFullYear()}-${c.getMonth()}`;
    const bucket = months.find((mm) => mm.key === key);
    if (bucket) bucket.count++;
  }
  const maxSignups = Math.max(1, ...months.map((m) => m.count));

  const buckets = [
    { label: "Active today", value: activeToday, color: "text-averna-neon", bar: "bg-averna-neon" },
    { label: "This week", value: activeWeek, color: "text-averna-cyan", bar: "bg-averna-cyan" },
    { label: "This month", value: activeMonth, color: "text-yellow-400", bar: "bg-yellow-400" },
    { label: "Dormant (30d+)", value: dormant, color: "text-rose-300", bar: "bg-rose-400" },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Panel
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <LineChart className="h-8 w-8 text-averna-cyan" />
          Retention &amp; <span className="neon-text-cyan">Engagement</span>
        </h1>
        <p className="text-gray-400 mb-6">How many students keep coming back, growth over time, and who&apos;s slipping away.</p>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Kpi icon={<Users className="h-4 w-4" />} label="Total students" value={total} color="text-averna-purple border-averna-purple/30" />
          <Kpi icon={<UserPlus className="h-4 w-4" />} label="Enrolled" value={enrolled} color="text-averna-cyan border-averna-cyan/30" />
          <Kpi icon={<Activity className="h-4 w-4" />} label="Weekly active" value={`${weeklyActivePct}%`} color="text-averna-neon border-averna-neon/30" />
          <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Churn risk" value={churnRisk} color="text-rose-300 border-rose-500/30" />
        </div>

        {/* Engagement breakdown */}
        <Card className="glass border-averna-cyan/30 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-averna-cyan" /> Engagement breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {buckets.map((b) => {
              const pct = total ? Math.round((b.value / total) * 100) : 0;
              return (
                <div key={b.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">{b.label}</span>
                    <span className={b.color}>
                      {b.value} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div className={`h-full rounded-full ${b.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Signups chart */}
        <Card className="glass border-averna-purple/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-5 w-5 text-averna-purple" /> New signups (last 6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-40">
              {months.map((m) => {
                const h = Math.round((m.count / maxSignups) * 100);
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-xs text-averna-purple font-semibold mb-1">{m.count}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-averna-purple/40 to-averna-cyan/70 transition-all"
                      style={{ height: `${Math.max(4, h)}%` }}
                    />
                    <span className="text-[11px] text-gray-400 mt-1">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 mt-3">
              Weekly-active rate is the share of all students seen in the last 7 days. Aim to keep it above 50%.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <Card className={`glass ${color.split(" ").slice(1).join(" ")}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-xs flex items-center gap-1.5 ${color.split(" ")[0]}`}>
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${color.split(" ")[0]}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
