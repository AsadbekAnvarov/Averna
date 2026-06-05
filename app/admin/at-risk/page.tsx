export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminHeader } from "@/components/admin/admin-header";
import { AccountNotice } from "@/components/account-notice";
import { AlertTriangle, ArrowLeft, UserX, CalendarOff, Ban, Activity } from "lucide-react";

type Severity = "high" | "medium";
interface RiskRow {
  id: string;
  name: string;
  email: string;
  group: string;
  teacher: string;
  reasons: string[];
  severity: Severity;
  inactiveDays: number | null;
}

export default async function AdminAtRiskPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role !== "ADMIN") {
    return <AccountNotice title="Admins only" message="This area is reserved for administrators." />;
  }

  const students = await db.student.findMany({
    include: {
      user: { select: { name: true, email: true } },
      group: {
        select: { name: true, teacher: { select: { user: { select: { name: true } } } } },
      },
      attendances: { orderBy: { date: "desc" }, take: 10, select: { status: true } },
      activityLogs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
    },
  });

  const now = Date.now();
  const rows: RiskRow[] = [];

  for (const s of students) {
    const reasons: string[] = [];

    // Inactivity (use the more recent of last activity / lastActiveDate)
    const lastActivity = s.activityLogs[0]?.createdAt;
    const lastSeen = Math.max(
      lastActivity ? new Date(lastActivity).getTime() : 0,
      new Date(s.lastActiveDate).getTime()
    );
    const inactiveDays = lastSeen > 0 ? Math.floor((now - lastSeen) / 86400000) : null;
    if (inactiveDays !== null && inactiveDays >= 4) {
      reasons.push(`Inactive ${inactiveDays} days`);
    }

    // Attendance
    if (s.attendances.length >= 3) {
      const present = s.attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
      const rate = Math.round((present / s.attendances.length) * 100);
      if (rate < 60) reasons.push(`Low attendance (${rate}%)`);
    }

    // Blacklist
    if (s.blacklisted) reasons.push("Blacklisted");

    // Never active at all
    if (!lastActivity && reasons.indexOf("Blacklisted") === -1 && (inactiveDays === null || inactiveDays < 4)) {
      // they have a lastActiveDate default but no real activity logs
      reasons.push("No learning activity yet");
    }

    if (reasons.length === 0) continue;

    const high =
      s.blacklisted || (inactiveDays !== null && inactiveDays >= 7) || reasons.length >= 2;

    rows.push({
      id: s.id,
      name: s.user.name ?? "Unnamed",
      email: s.user.email,
      group: s.group?.name ?? "Unassigned",
      teacher: s.group?.teacher?.user?.name ?? "—",
      reasons,
      severity: high ? "high" : "medium",
      inactiveDays,
    });
  }

  rows.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return b.reasons.length - a.reasons.length;
  });

  const totalStudents = students.length;
  const highCount = rows.filter((r) => r.severity === "high").length;
  const inactiveCount = rows.filter((r) => r.reasons.some((x) => x.startsWith("Inactive"))).length;
  const attendanceCount = rows.filter((r) => r.reasons.some((x) => x.startsWith("Low attendance"))).length;
  const blacklistedCount = rows.filter((r) => r.reasons.includes("Blacklisted")).length;
  const healthyPct = totalStudents ? Math.round(((totalStudents - rows.length) / totalStudents) * 100) : 100;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />

        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin Panel
        </Link>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-yellow-400" />
          At-Risk <span className="text-yellow-400">Radar</span>
        </h1>
        <p className="text-gray-400 mb-6">
          Students who may need attention — catch disengagement early before they drop off.
        </p>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard icon={<UserX className="h-4 w-4" />} label="At risk" value={rows.length} color="text-rose-300 border-rose-500/30" />
          <SummaryCard icon={<Activity className="h-4 w-4" />} label="Inactive 4d+" value={inactiveCount} color="text-orange-300 border-orange-500/30" />
          <SummaryCard icon={<CalendarOff className="h-4 w-4" />} label="Low attendance" value={attendanceCount} color="text-yellow-300 border-yellow-500/30" />
          <SummaryCard icon={<Ban className="h-4 w-4" />} label="Blacklisted" value={blacklistedCount} color="text-red-300 border-red-500/30" />
        </div>

        {rows.length === 0 ? (
          <Card className="glass border-averna-neon/30">
            <CardContent className="py-12 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-averna-neon font-semibold">Everyone is on track!</p>
              <p className="text-gray-400 text-sm mt-1">No students are showing risk signals right now.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass border-yellow-500/40">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-yellow-400">
                  <AlertTriangle className="h-5 w-5" /> Needs Attention
                </span>
                <span className="text-sm font-normal text-gray-400">
                  {healthyPct}% of students healthy
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border-l-4 bg-white/5 ${
                      r.severity === "high"
                        ? "border-l-rose-500 border-y border-r border-rose-500/20"
                        : "border-l-yellow-500 border-y border-r border-yellow-500/20"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{r.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {r.group} · Teacher: {r.teacher}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {r.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-200 border border-yellow-500/20"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        r.severity === "high"
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {r.severity}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
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
