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
import { Suspense } from "react";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { StudentRadar } from "@/components/teacher/student-radar";
import { TeachingAssistant } from "@/components/teacher/teaching-assistant";
import { TeachingDNA } from "@/components/teacher/teaching-dna";
import { AchievementStudio } from "@/components/teacher/achievement-studio";
import { TodayPanel } from "@/components/teacher/today-panel";
import { GradingInbox } from "@/components/teacher/grading-inbox";
import { GroupPulse } from "@/components/teacher/group-pulse";
import { GroupBroadcast } from "@/components/teacher/group-broadcast";
import { TeacherAttentionBar } from "@/components/teacher/attention-bar";
import { PanelTabs } from "@/components/panel-tabs";
import { SectionHeader } from "@/components/ui/section-header";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { CalendarClock as CalendarClockIcon, LayoutGrid, Zap } from "lucide-react";

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

  const groupOptions = teacher.groups.map((g) => ({
    id: g.id,
    name: g.name,
    count: g.students.length,
  }));

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

  const tabs = [
    { key: "overview", label: "Overview", icon: "overview", active: "bg-averna-neon/15 text-averna-neon ring-1 ring-averna-neon/40" },
    { key: "teaching", label: "Teaching", icon: "teaching", active: "bg-averna-purple/15 text-averna-purple ring-1 ring-averna-purple/40" },
    { key: "insights", label: "Insights", icon: "insights", active: "bg-averna-cyan/15 text-averna-cyan ring-1 ring-averna-cyan/40" },
  ];

  const statCards = (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
  );

  const myGroups = (
    <Card className="glass border-averna-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Users className="h-5 w-5 text-averna-cyan" /> My Groups
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teacher.groups.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No groups assigned yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {teacher.groups.map((group) => (
              <Link
                key={group.id}
                href={`/teacher/group/${group.id}`}
                className="block p-4 bg-averna-dark/30 rounded-xl border border-white/5 transition-all duration-300 hover:border-averna-cyan/30 hover:-translate-y-0.5"
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
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const quickActions = (
    <Card className="glass border-averna-primary/30">
      <CardContent className="pt-6">
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
  );

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />

        {/* Welcome banner */}
        <div className="mb-5 animate-fade-in">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-averna-neon/10 border border-averna-neon/20 text-averna-neon text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              Teacher Workspace
            </div>
            <LiveRefresh />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Welcome back, <span className="neon-text">{firstName}</span>
          </h1>
          <p className="text-gray-400 mt-1">Here&apos;s what&apos;s happening across your classes today.</p>
        </div>

        {/* What needs attention today */}
        <div className="mb-4">
          <Suspense fallback={<div className="h-10" />}>
            <TeacherAttentionBar teacherId={teacher.id} userId={session.user.id} />
          </Suspense>
        </div>

        <PanelTabs
          tabs={tabs}
          storageKey="averna_teacher_tab"
          content={{
            overview: (
              <>
                <div>
                  <SectionHeader icon={CalendarClockIcon} title="Today" subtitle="Your next lesson and what's on" accent="text-averna-cyan" />
                  <Suspense fallback={<WidgetSkeleton rows={2} />}>
                    <TodayPanel teacherId={teacher.id} />
                  </Suspense>
                </div>
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <TeachingAssistant teacherId={teacher.id} />
                </Suspense>
                {statCards}
                <div>
                  <SectionHeader icon={CheckSquare} title="Needs Action" subtitle="Grade work and keep your groups in the loop" accent="text-amber-400" />
                  <div className="grid lg:grid-cols-2 gap-6">
                    <Suspense fallback={<WidgetSkeleton rows={4} />}>
                      <GradingInbox teacherId={teacher.id} />
                    </Suspense>
                    <GroupBroadcast groups={groupOptions} />
                  </div>
                </div>
              </>
            ),
            teaching: (
              <>
                <div>
                  <SectionHeader icon={Zap} title="Quick Actions" subtitle="Jump straight into your daily tasks" accent="text-averna-neon" />
                  {quickActions}
                </div>
                <div>
                  <SectionHeader icon={Users} title="My Groups" subtitle="Your classes at a glance" accent="text-averna-cyan" />
                  {myGroups}
                </div>
              </>
            ),
            insights: (
              <>
                <div>
                  <SectionHeader icon={LayoutGrid} title="Class Insights" subtitle="Attendance, grades and trends" accent="text-averna-purple" />
                  <Suspense fallback={<WidgetSkeleton rows={2} />}>
                    <GroupPulse teacherId={teacher.id} />
                  </Suspense>
                </div>
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <StudentRadar teacherId={teacher.id} />
                </Suspense>
                <div className="grid lg:grid-cols-2 gap-6">
                  <Suspense fallback={<WidgetSkeleton rows={4} />}>
                    <TeachingDNA teacherId={teacher.id} />
                  </Suspense>
                  <Suspense fallback={<WidgetSkeleton rows={4} />}>
                    <AchievementStudio teacherId={teacher.id} />
                  </Suspense>
                </div>
              </>
            ),
          }}
        />
      </div>
    </div>
  );
}
