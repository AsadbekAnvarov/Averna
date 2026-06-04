export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, CheckSquare, BarChart, ClipboardCheck, CalendarClock, Megaphone, MessageSquare, CalendarDays } from "lucide-react";
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

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <h1 className="text-4xl font-bold text-white mb-8">Teacher Dashboard</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="glass border-blue-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Users className="h-5 w-5" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-400">{totalStudents}</p>
            </CardContent>
          </Card>

          <Card className="glass border-purple-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <BookOpen className="h-5 w-5" />
                Total Homework
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-purple-400">{totalHomework}</p>
            </CardContent>
          </Card>

          <Card className="glass border-yellow-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <CheckSquare className="h-5 w-5" />
                Pending Grading
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-yellow-400">{pendingGrading}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="glass border-averna-primary/30">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/teacher/homework/create">
                <Button className="w-full neon-button bg-purple-500">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Create Homework
                </Button>
              </Link>
              <Link href="/teacher/homework">
                <Button className="w-full" variant="outline">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Grade Submissions
                </Button>
              </Link>
              <Link href="/teacher/students">
                <Button className="w-full" variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  View Students
                </Button>
              </Link>
              <Link href="/teacher/tutoring">
                <Button className="w-full neon-button bg-averna-pink/80 hover:bg-averna-pink">
                  <Users className="mr-2 h-4 w-4" />
                  1-on-1 Tutoring Slots
                </Button>
              </Link>
              <Link href="/teacher/attendance">
                <Button className="w-full neon-button bg-averna-cyan/80 hover:bg-averna-cyan text-black">
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Take Attendance
                </Button>
              </Link>
              <Link href="/teacher/gradebook">
                <Button className="w-full neon-button bg-averna-purple/80 hover:bg-averna-purple">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Gradebook
                </Button>
              </Link>
              <Link href="/teacher/lessons">
                <Button className="w-full" variant="outline">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Lesson Log
                </Button>
              </Link>
              <Link href="/teacher/announcements">
                <Button className="w-full" variant="outline">
                  <Megaphone className="mr-2 h-4 w-4" />
                  Announcements
                </Button>
              </Link>
              <Link href="/teacher/calendar">
                <Button className="w-full" variant="outline">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Calendar
                </Button>
              </Link>
              <Link href="/messages">
                <Button className="w-full" variant="outline">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Messages
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="glass border-averna-primary/30">
            <CardHeader>
              <CardTitle>My Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {teacher.groups.map(group => (
                  <div key={group.id} className="p-3 bg-averna-dark/30 rounded-lg border border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-white">{group.name}</p>
                      {group.level && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-averna-purple/20 text-averna-purple border border-averna-purple/30 whitespace-nowrap">
                          {group.level}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-averna-cyan mt-1 flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {group.schedule ?? "Schedule TBA"}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{group.students.length} students</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Risk radar — students who need attention */}
        <div className="mt-6">
          <RiskRadar teacherId={teacher.id} />
        </div>
      </div>
    </div>
  );
}
