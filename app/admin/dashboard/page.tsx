export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  GraduationCap,
  Layers,
  UserPlus,
  BarChart3,
  Gift,
  Megaphone,
  Activity,
  Wallet,
  ScrollText,
  ShieldCheck,
  Trophy,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { AdminHeader } from "@/components/admin/admin-header";
import { TopPerformers } from "@/components/top-performers";
import { AdminKpis } from "@/components/admin/kpi-cards";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { EnrollmentFunnel } from "@/components/admin/enrollment-funnel";
import { TeacherWorkload } from "@/components/admin/teacher-workload";
import { FinanceSummary } from "@/components/admin/finance-summary";
import { PanelCommandPalette } from "@/components/panel-command-palette";
import { recordAudit } from "@/lib/audit";

const LEVELS = [
  "Beginner (A2)",
  "Intermediate (B1)",
  "Upper-Intermediate (B2)",
  "Advanced (C1)",
  "IELTS Standard (6.0–6.5)",
  "IELTS Advanced (7.5+)",
];

async function enrollStudent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/auth/signin");

  const studentId = formData.get("studentId") as string;
  const level = (formData.get("level") as string)?.trim();
  const groupId = (formData.get("groupId") as string)?.trim();

  await db.student.update({
    where: { id: studentId },
    data: {
      level: level || null,
      groupId: groupId || null,
      enrolledAt: new Date(),
    },
  });
  await recordAudit(
    { id: session.user.id, name: session.user.name, role: session.user.role },
    "Enrolled student",
    `studentId=${studentId} level=${level || "-"} group=${groupId || "-"}`
  );
  revalidatePath("/admin/dashboard");
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");

  // Only ADMINs continue
  if (session.user.role !== "ADMIN") {
    return (
      <AccountNotice
        title="Admins only"
        message="This area is reserved for administrators."
      />
    );
  }

  const [students, groups] = await Promise.all([
    db.student.findMany({
      include: {
        user: { select: { name: true, email: true } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.group.findMany({
      include: { teacher: { include: { user: { select: { name: true } } } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const pending = students.filter((s) => !s.groupId);
  const firstName = (session.user.name ?? "Admin").split(" ")[0];

  const actions = [
    { href: "/admin/analytics", label: "Analytics", desc: "Platform insights", icon: BarChart3, iconBg: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
    { href: "/admin/groups", label: "Manage Groups", desc: "Classes & schedules", icon: Layers, iconBg: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
    { href: "/admin/teachers", label: "Manage Teachers", desc: "Staff accounts", icon: GraduationCap, iconBg: "bg-averna-blue/15 text-averna-blue", hover: "hover:border-averna-blue/40" },
    { href: "/admin/rewards", label: "Rewards & Requests", desc: "Approve redemptions", icon: Gift, iconBg: "bg-averna-pink/15 text-averna-pink", hover: "hover:border-averna-pink/40" },
    { href: "/admin/announcements", label: "Announcements", desc: "Broadcast updates", icon: Megaphone, iconBg: "bg-orange-400/15 text-orange-400", hover: "hover:border-orange-400/40" },
    { href: "/admin/content", label: "Manage Content", desc: "Lessons & materials", icon: Layers, iconBg: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
    { href: "/admin/finance", label: "Finance", desc: "Payments & billing", icon: Wallet, iconBg: "bg-emerald-400/15 text-emerald-400", hover: "hover:border-emerald-400/40" },
    { href: "/admin/system", label: "System Health", desc: "Monitor status", icon: Activity, iconBg: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
    { href: "/admin/logs", label: "Audit Log", desc: "Track all actions", icon: ScrollText, iconBg: "bg-gray-400/15 text-gray-300", hover: "hover:border-white/30" },
  ];

  const StudentForm = ({ s }: { s: (typeof students)[number] }) => (
    <form action={enrollStudent} className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 transition-colors hover:border-averna-cyan/30">
      <input type="hidden" name="studentId" value={s.id} />
      <div className="md:w-56 min-w-0">
        <p className="text-white font-medium truncate">{s.user.name ?? "Unnamed"}</p>
        <p className="text-xs text-gray-400 truncate">{s.user.email}</p>
      </div>
      <select
        name="level"
        defaultValue={s.level ?? ""}
        className="rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple md:flex-1"
      >
        <option value="" className="bg-averna-dark">— Level —</option>
        {LEVELS.map((l) => (
          <option key={l} value={l} className="bg-averna-dark">{l}</option>
        ))}
      </select>
      <select
        name="groupId"
        defaultValue={s.groupId ?? ""}
        className="rounded-md border border-input bg-background/60 px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan md:flex-1"
      >
        <option value="" className="bg-averna-dark">— Unassigned —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id} className="bg-averna-dark">
            {g.name} · {g.teacher.user.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="neon-button bg-averna-primary hover:bg-averna-light">
        Save
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <AdminHeader user={{ name: session.user.name ?? "Admin", email: session.user.email ?? "" }} />

        {/* Welcome banner */}
        <div className="mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-averna-purple/10 border border-averna-purple/20 text-averna-purple text-xs font-medium mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin Control Center
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Welcome back, <span className="neon-text">{firstName}</span>
          </h1>
          <p className="text-gray-400 mt-1">Manage students, staff and the whole platform from here.</p>
        </div>

        {/* KPI trends */}
        <div className="mb-8">
          <AdminKpis />
        </div>

        {/* Quick actions */}
        <Card className="glass border-averna-primary/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-averna-purple" />
              Management Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href} className="group">
                    <div
                      className={`flex items-center gap-4 p-4 rounded-xl bg-averna-dark/30 border border-white/5 transition-all duration-300 hover:bg-averna-dark/50 hover:-translate-y-0.5 ${action.hover}`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${action.iconBg}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate">{action.label}</p>
                        <p className="text-xs text-gray-400 truncate">{action.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Live activity + finance */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <ActivityFeed />
          <FinanceSummary />
        </div>

        {/* Enrollment funnel + teacher workload */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <EnrollmentFunnel />
          <TeacherWorkload />
        </div>

        {/* Pending enrollment */}
        <Card className="glass border-averna-pink/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-pink">
              <UserPlus className="h-5 w-5" />
              Enroll New Students ({pending.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-400 mb-4">
              Set each new student&apos;s level and assign them to a group (and its teacher).
            </p>
            {pending.length === 0 ? (
              <p className="text-gray-400 text-sm">🎉 No students waiting for enrollment.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((s) => (
                  <StudentForm key={s.id} s={s} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All students */}
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-cyan">
              <Users className="h-5 w-5" />
              All Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-gray-400 text-sm">No students yet.</p>
            ) : (
              <div className="space-y-2">
                {students.map((s) => (
                  <StudentForm key={s.id} s={s} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hall of Fame */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Trophy className="h-6 w-6 text-amber-400" />
          Hall of Fame
        </h2>
        <TopPerformers />
      </div>

      <PanelCommandPalette role="ADMIN" />
    </div>
  );
}
