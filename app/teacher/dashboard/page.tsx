export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Users,
  CheckSquare,
  ClipboardCheck,
  CalendarClock,
  Megaphone,
  MessageSquare,
  CalendarDays,
  GraduationCap,
  NotebookPen,
  PlusCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { RiskRadar } from "@/components/teacher/risk-radar";

export default async function TeacherDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  // Students belong on the student dashboard (one-way, prevents loops)
  if (session.user.role === "STUDENT") redirect("/dashboard");
  // Admins have their own panel
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      groups: { include: { students: true, homework: true } },
      homework: { include: { submissions: true } },
    },
  });

  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="This account is signed in, but it doesn't have a teacher profile. If you're an admin, use the admin tools, or sign in with a teacher account."
      />
    );
  }

  const totalStudents = teacher.groups.reduce((sum, g) => sum + g.students.length, 0);
  const totalHomework = teacher.homework.length;
  const pendingGrading = teacher.homework.reduce(
    (sum, hw) => sum + hw.submissions.filter(s => s.status === "SUBMITTED").length,
    0
  );

  const firstName = (session.user.name ?? "Teacher").split(" ")[0];

  const stats = [
    {
      label: "Total Students",
      value: totalStudents,
      icon: Users,
      accent: "text-averna-cyan",
      ring: "ring-averna-cyan/30",
      glow: "from-averna-cyan/20",
      iconBg: "bg-averna-cyan/15 text-averna-cyan",
    },
    {
      label: "Total Homework",
      value: totalHomework,
      icon: BookOpen,
      accent: "text-averna-purple",
      ring: "ring-averna-purple/30",
      glow: "from-averna-purple/20",
      iconBg: "bg-averna-purple/15 text-averna-purple",
    },
    {
      label: "Pending Grading",
      value: pendingGrading,
      icon: CheckSquare,
      accent: "text-amber-400",
      ring: "ring-amber-400/30",
      glow: "from-amber-400/20",
      iconBg: "bg-amber-400/15 text-amber-400",
    },
  ];

  const actions = [
    {
      href: "/teacher/homework/create",
      label: "Create Homework",
      desc: "Assign new tasks",
      icon: PlusCircle,
      iconBg: "bg-averna-purple/15 text-averna-purple",
      hover: "hover:border-averna-purple/40",
    },
    {
      href: "/teacher/homework",
      label: "Grade Submissions",
      desc: "Review & score work",
      icon: CheckSquare,
      iconBg: "bg-amber-400/15 text-amber-400",
      hover: "hover:border-amber-400/40",
    },
    {
      href: "/teacher/students",
      label: "View Students",
      desc: "Manage your learners",
      icon: GraduationCap,
      iconBg: "bg-averna-cyan/15 text-averna-cyan",
      hover: "hover:border-averna-cyan/40",
    },
    {
      href: "/teacher/tutoring",
      label: "1-on-1 Tutoring",
      desc: "Open booking slots",
      icon: Users,
      iconBg: "bg-averna-pink/15 text-averna-pink",
      hover: "hover:border-averna-pink/40",
    },
    {
      href: "/teacher/attendance",
      label: "Take Attendance",
      desc: "Mark today's class",
      icon: ClipboardCheck,
      iconBg: "bg-emerald-400/15 text-emerald-400",
      hover: "hover:border-emerald-400/40",
    },
    {
      href: "/teacher/gradebook",
      label: "Gradebook",
      desc: "Track all grades",
      icon: NotebookPen,
      iconBg: "bg-averna-purple/15 text-averna-purple",
      hover: "hover:border-averna-purple/40",
    },
    {
      href: "/teacher/lessons",
      label: "Lesson Log",
      desc: "Record lessons",
      icon: BookOpen,
      iconBg: "bg-averna-blue/15 text-averna-blue",
      hover: "hover:border-averna-blue/40",
    },
    {
      href: "/teacher/announcements",
      label: "Announcements",
      desc: "Post updates",
      icon: Megaphone,
      iconBg: "bg-orange-400/15 text-orange-400",
      hover: "hover:border-orange-400/40",
    },
    {
      href: "/teacher/calendar",
      label: "Calendar",
      desc: "Plan your schedule",
      icon: CalendarDays,
      iconBg: "bg-averna-cyan/15 text-averna-cyan",
      hover: "hover:border-averna-cyan/40",
    },
    {
      href: "/messages",
      label: "Messages",
      desc: "Chat with students",
      icon: MessageSquare,
      iconBg: "bg-averna-neon/15 text-averna-neon",
      hover: "hover:border-averna-neon/40",
    },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />

        {/* Welcome banner */}
        <div className="mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-averna-neon/10 border border-averna-neon/20 text-averna-neon text-xs font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Teacher Workspace
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Welcome back, <span className="neon-text">{firstName}</span>
          </h1>
          <p className="text-gray-400 mt-1">Here&apos;s what&apos;s happening across your classes today.</p>
        </div>

        {/* Stat cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className={`glass relative overflow-hidden ring-1 ${stat.ring} border-transparent transition-transform duration-300 hover:-translate-y-1`}
              >
                <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${stat.glow} to-transparent blur-2xl`} />
                <CardContent className="p-6 relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
                      <p className={`text-4xl font-bold mt-2 ${stat.accent}`}>{stat.value}</p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.iconBg}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick actions */}
        <Card className="glass border-averna-primary/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-averna-neon" />
              Quick Actions
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

        {/* My groups */}
        <Card className="glass border-averna-primary/30 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-averna-cyan" />
              My Groups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacher.groups.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No groups assigned yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {teacher.groups.map(group => (
                  <div
                    key={group.id}
                    className="p-4 bg-averna-dark/30 rounded-xl border border-white/5 transition-all duration-300 hover:border-averna-cyan/30 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-averna-cyan/15 text-averna-cyan">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <p className="font-semibold text-white truncate">{group.name}</p>
                      </div>
                      {group.level && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/30 whitespace-nowrap">
                          {group.level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-averna-cyan flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {group.schedule ?? "Schedule TBA"}
                      </span>
                      <span className="text-gray-400 flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {group.students.length}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Risk radar — students who need attention */}
        <div>
          <RiskRadar teacherId={teacher.id} />
        </div>
      </div>
    </div>
  );
}
