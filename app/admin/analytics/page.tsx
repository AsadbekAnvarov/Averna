export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, ClipboardCheck, Layers } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { PageHeader } from "@/components/ui/page-header";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function AdminAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const [students, groups, attendance, totalPoints] = await Promise.all([
    db.student.findMany({ select: { createdAt: true, level: true } }),
    db.group.findMany({ include: { students: { select: { id: true } }, attendances: { select: { status: true } } } }),
    db.attendance.count(),
    db.student.aggregate({ _sum: { totalPoints: true } }),
  ]);

  // --- Growth: students enrolled per month (last 6 months) ---
  const now = new Date();
  const growth: { label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = students.filter((s) => s.createdAt >= d && s.createdAt < next).length;
    growth.push({ label: `${MONTHS[d.getMonth()]}`, count });
  }
  const maxGrowth = Math.max(1, ...growth.map((g) => g.count));

  // --- Level distribution ---
  const levelMap: Record<string, number> = {};
  students.forEach((s) => {
    const key = s.level || "Not set";
    levelMap[key] = (levelMap[key] ?? 0) + 1;
  });
  const levels = Object.entries(levelMap).sort((a, b) => b[1] - a[1]);
  const maxLevel = Math.max(1, ...levels.map(([, n]) => n));

  // --- Attendance rate per group ---
  const groupRates = groups.map((g) => {
    const total = g.attendances.length;
    const present = g.attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    return { name: g.name, students: g.students.length, rate: total > 0 ? Math.round((present / total) * 100) : null, total };
  });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />

        <PageHeader
          back={{ href: "/admin/dashboard", label: "Back to Admin Panel" }}
          icon={BarChart3}
          iconClassName="text-averna-cyan"
          title={<>Centre <span className="neon-text-cyan">Analytics</span></>}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat icon={<Users className="h-4 w-4" />} label="Students" value={students.length} color="text-averna-cyan" border="border-averna-cyan/30" />
          <Stat icon={<Layers className="h-4 w-4" />} label="Groups" value={groups.length} color="text-averna-neon" border="border-averna-neon/30" />
          <Stat icon={<ClipboardCheck className="h-4 w-4" />} label="Attendance logs" value={attendance} color="text-averna-purple" border="border-averna-purple/30" />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Total points" value={totalPoints._sum.totalPoints ?? 0} color="text-averna-pink" border="border-averna-pink/30" />
        </div>

        {/* Growth chart */}
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-cyan">
              <TrendingUp className="h-5 w-5" /> New Students (last 6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 h-44">
              {growth.map((g) => (
                <div key={g.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <span className="text-xs text-averna-neon font-semibold">{g.count}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-averna-primary to-averna-cyan"
                    style={{ height: `${(g.count / maxGrowth) * 100}%`, minHeight: g.count > 0 ? "8px" : "2px" }}
                  />
                  <span className="text-xs text-gray-400">{g.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Level distribution */}
          <Card className="glass border-averna-purple/30">
            <CardHeader><CardTitle className="text-averna-purple">Students by Level</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {levels.length === 0 ? (
                <p className="text-sm text-gray-400">No data yet.</p>
              ) : (
                levels.map(([name, n]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 truncate">{name}</span>
                      <span className="text-averna-purple font-semibold">{n}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-cyan" style={{ width: `${(n / maxLevel) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Attendance by group */}
          <Card className="glass border-averna-neon/30">
            <CardHeader><CardTitle className="text-averna-neon">Attendance Rate by Group</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {groupRates.length === 0 ? (
                <p className="text-sm text-gray-400">No groups yet.</p>
              ) : (
                groupRates.map((g) => (
                  <div key={g.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300 truncate">{g.name}</span>
                      <span className={g.rate === null ? "text-gray-500" : g.rate >= 80 ? "text-averna-neon" : g.rate >= 50 ? "text-yellow-400" : "text-red-400"}>
                        {g.rate === null ? "No data" : `${g.rate}%`}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-averna-neon to-averna-cyan" style={{ width: `${g.rate ?? 0}%` }} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color, border }: { icon: React.ReactNode; label: string; value: number; color: string; border: string }) {
  return (
    <Card className={`glass ${border}`}>
      <CardHeader className="pb-2"><CardTitle className={`text-xs flex items-center gap-1 ${color}`}>{icon} {label}</CardTitle></CardHeader>
      <CardContent><p className={`text-2xl font-bold ${color}`}>{value}</p></CardContent>
    </Card>
  );
}
