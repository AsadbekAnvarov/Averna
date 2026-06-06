export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Award, ClipboardCheck, BookMarked, Flame, Target, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { WeeklyReportButton } from "@/components/teacher/weekly-report-button";

function attLabel(status: string) {
  if (status === "PRESENT") return { t: "Present", c: "text-averna-neon", I: CheckCircle2 };
  if (status === "LATE") return { t: "Late", c: "text-yellow-400", I: Clock };
  if (status === "EXCUSED") return { t: "Excused", c: "text-averna-cyan", I: Clock };
  return { t: "Absent", c: "text-red-400", I: XCircle };
}

export default async function ParentReportPage({ params }: { params: { studentId: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  // Verify the teacher owns this student (or is admin)
  const student = await db.student.findUnique({
    where: { id: params.studentId },
    include: {
      user: { select: { name: true, email: true } },
      group: { include: { teacher: { include: { user: { select: { name: true, id: true } } } } } },
      grades: { orderBy: { date: "desc" }, take: 10 },
      attendances: { orderBy: { date: "desc" }, take: 12 },
      homeworkSubmissions: { include: { homework: { select: { title: true } } }, orderBy: { submittedAt: "desc" }, take: 6 },
    },
  });

  if (!student) {
    return <AccountNotice title="Student not found" message="This student does not exist." />;
  }

  if (session.user.role === "TEACHER") {
    const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher || student.group?.teacherId !== teacher.id) {
      return <AccountNotice title="Not your student" message="You can only view reports for students in your groups." />;
    }
  }

  const att = student.attendances;
  const present = att.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const rate = att.length > 0 ? Math.round((present / att.length) * 100) : null;
  const avgGrade =
    student.grades.length > 0
      ? Math.round((student.grades.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / student.grades.length))
      : null;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl pb-12">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <Link href="/teacher/students" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Students</Link>

        {/* Report header */}
        <Card className="glass border-averna-neon/40 mb-6">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-averna-neon text-xs font-semibold uppercase mb-2">
              <Users className="h-4 w-4" /> Parent Progress Report
            </div>
            <h1 className="text-2xl font-bold text-white">{student.user.name}</h1>
            <p className="text-sm text-gray-400">
              {student.group?.name ?? "No group"} · {student.level ?? "Level N/A"} · Teacher: {student.group?.teacher.user.name ?? "—"}
            </p>
            {student.blacklisted && (
              <p className="mt-2 text-sm text-red-300">⚠️ On blacklist: {student.blacklistReason}</p>
            )}
            <div className="mt-4">
              <WeeklyReportButton
                name={student.user.name ?? "Student"}
                group={student.group?.name ?? "No group"}
                level={student.level ?? "N/A"}
                points={student.totalPoints}
                streak={student.currentStreak}
                attendanceRate={rate}
                avgGrade={avgGrade}
                homework={student.homeworkSubmissions.map((h) => ({ title: h.homework.title, status: h.status }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat icon={<Award className="h-4 w-4" />} label="Points" value={`${student.totalPoints}`} color="text-averna-neon" />
          <Stat icon={<Flame className="h-4 w-4" />} label="Streak" value={`${student.currentStreak}🔥`} color="text-orange-400" />
          <Stat icon={<ClipboardCheck className="h-4 w-4" />} label="Attendance" value={rate === null ? "—" : `${rate}%`} color="text-averna-cyan" />
          <Stat icon={<Target className="h-4 w-4" />} label="Avg grade" value={avgGrade === null ? "—" : `${avgGrade}%`} color="text-averna-purple" />
        </div>

        {/* Grades */}
        <Card className="glass border-averna-purple/30 mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><Award className="h-5 w-5" /> Recent Grades</CardTitle></CardHeader>
          <CardContent>
            {student.grades.length === 0 ? <p className="text-sm text-gray-400">No grades yet.</p> : (
              <div className="space-y-2">
                {student.grades.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-white text-sm truncate">{g.title}</span>
                    <span className="text-averna-neon font-semibold">{g.score}/{g.maxScore}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card className="glass border-averna-cyan/30 mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><ClipboardCheck className="h-5 w-5" /> Recent Attendance</CardTitle></CardHeader>
          <CardContent>
            {att.length === 0 ? <p className="text-sm text-gray-400">No records yet.</p> : (
              <div className="space-y-2">
                {att.map((a) => {
                  const l = attLabel(a.status);
                  return (
                    <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-gray-300 text-sm">{new Date(a.date).toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent", weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className={`flex items-center gap-1 text-sm ${l.c}`}><l.I className="h-4 w-4" /> {l.t}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Homework */}
        <Card className="glass border-white/10">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><BookMarked className="h-5 w-5" /> Recent Homework</CardTitle></CardHeader>
          <CardContent>
            {student.homeworkSubmissions.length === 0 ? <p className="text-sm text-gray-400">No submissions yet.</p> : (
              <div className="space-y-2">
                {student.homeworkSubmissions.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-white text-sm truncate">{h.homework.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${h.status === "GRADED" ? "text-averna-neon" : "text-yellow-400"}`}>{h.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          Share this page link with parents to keep them updated. 👨‍👩‍👧
        </p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card className="glass border-white/10">
      <CardContent className="py-4 text-center">
        <div className={`flex items-center justify-center gap-1 text-xs ${color} mb-1`}>{icon}{label}</div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
