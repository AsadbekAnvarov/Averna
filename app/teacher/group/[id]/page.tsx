export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users, ClipboardCheck, NotebookPen, BookOpen, CalendarClock, ArrowRight,
  GraduationCap, AlertTriangle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function TeacherGroupPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) {
    return <AccountNotice title="No teacher profile found" message="Sign in with a teacher account." />;
  }

  const group = await db.group.findFirst({
    where: { id: params.id, teacherId: teacher.id },
    include: {
      students: { include: { user: { select: { name: true } } }, orderBy: { totalPoints: "desc" } },
      homework: { orderBy: { dueDate: "desc" }, take: 5, include: { submissions: { select: { id: true } } } },
      lessonLogs: { orderBy: { date: "desc" }, take: 5 },
      attendances: { select: { studentId: true, status: true } },
    },
  });
  if (!group) {
    return <AccountNotice title="Group not found" message="This group doesn't exist or isn't assigned to you." />;
  }

  // Attendance rate per student
  const rate = new Map<string, { present: number; total: number }>();
  for (const a of group.attendances) {
    const r = rate.get(a.studentId) ?? { present: 0, total: 0 };
    r.total += 1;
    if (a.status === "PRESENT" || a.status === "LATE") r.present += 1;
    rate.set(a.studentId, r);
  }

  const actions = [
    { href: `/teacher/attendance?group=${group.id}`, label: "Attendance", desc: "Take the roll call", icon: ClipboardCheck, color: "bg-emerald-400/15 text-emerald-400", hover: "hover:border-emerald-400/40" },
    { href: "/teacher/gradebook", label: "Gradebook", desc: "Track grades", icon: NotebookPen, color: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
    { href: "/teacher/homework/create", label: "Set Homework", desc: "Assign a task", icon: BookOpen, color: "bg-amber-400/15 text-amber-400", hover: "hover:border-amber-400/40" },
    { href: "/teacher/lessons", label: "Lesson Log", desc: "Record lessons", icon: BookOpen, color: "bg-averna-blue/15 text-averna-blue", hover: "hover:border-averna-blue/40" },
  ];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl pb-24 lg:pb-8">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />

        <Link href="/teacher/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>

        {/* Group header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-averna-cyan/15 text-averna-cyan">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{group.name}</h1>
              <p className="text-sm text-gray-400 flex items-center gap-3">
                {group.level && <span>{group.level}</span>}
                <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {group.schedule ?? "Schedule TBA"}</span>
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {group.students.length}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions for this group */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} href={a.href} className="group">
                <div className={`flex items-center gap-3 p-4 rounded-xl bg-averna-dark/30 border border-white/5 transition-all hover:bg-averna-dark/50 hover:-translate-y-0.5 ${a.hover}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${a.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{a.label}</p>
                    <p className="text-xs text-gray-400 truncate">{a.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Students */}
        <SectionHeader icon={Users} title={`Students (${group.students.length})`} subtitle="Ranked by points · attendance shown" accent="text-averna-cyan" />
        <Card className="glass border-averna-cyan/30 mb-8">
          <CardContent className="pt-6">
            {group.students.length === 0 ? (
              <EmptyState icon={Users} title="No students yet" description="Students assigned to this group will appear here." accent="text-averna-cyan" compact />
            ) : (
              <div className="space-y-2">
                {group.students.map((s, i) => {
                  const r = rate.get(s.id);
                  const pct = r && r.total > 0 ? Math.round((r.present / r.total) * 100) : null;
                  const lowAttendance = pct !== null && pct < 70;
                  return (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-sm font-semibold text-gray-400 w-6 shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium truncate">{s.user.name ?? "Student"}</p>
                        <p className="text-xs text-gray-400">{s.totalPoints.toLocaleString()} pts</p>
                      </div>
                      {pct !== null && (
                        <span className={`text-xs flex items-center gap-1 shrink-0 ${lowAttendance ? "text-amber-400" : "text-gray-400"}`}>
                          {lowAttendance && <AlertTriangle className="h-3.5 w-3.5" />}
                          {pct}% att.
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent homework + lessons */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <SectionHeader icon={BookOpen} title="Recent Homework" accent="text-amber-400" action={{ label: "All", href: "/teacher/homework" }} />
            <Card className="glass border-amber-400/30">
              <CardContent className="pt-6">
                {group.homework.length === 0 ? (
                  <EmptyState icon={BookOpen} title="No homework yet" action={{ label: "Create homework", href: "/teacher/homework/create" }} accent="text-amber-400" compact />
                ) : (
                  <ul className="space-y-2">
                    {group.homework.map((hw) => (
                      <li key={hw.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{hw.title}</p>
                          <p className="text-xs text-gray-400">Due {formatDate(hw.dueDate)}</p>
                        </div>
                        <span className="text-xs text-averna-cyan shrink-0">{hw.submissions.length} submitted</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <SectionHeader icon={NotebookPen} title="Recent Lessons" accent="text-averna-blue" action={{ label: "All", href: "/teacher/lessons" }} />
            <Card className="glass border-averna-blue/30">
              <CardContent className="pt-6">
                {group.lessonLogs.length === 0 ? (
                  <EmptyState icon={NotebookPen} title="No lessons logged" description="Record what you covered to keep a history." accent="text-averna-blue" compact />
                ) : (
                  <ul className="space-y-2">
                    {group.lessonLogs.map((l) => (
                      <li key={l.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-white text-sm font-medium truncate">{l.topic}</p>
                        <p className="text-xs text-gray-400">{formatDate(l.date)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
