export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock, GraduationCap, ClipboardCheck, CheckCircle2, XCircle, Clock, BookOpenCheck } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { AddToGoogleCalendar } from "@/components/add-to-google-calendar";
import { PageHeader } from "@/components/ui/page-header";

function statusStyle(status: string) {
  switch (status) {
    case "PRESENT":
      return { color: "text-averna-neon", icon: <CheckCircle2 className="h-4 w-4" />, label: "Present" };
    case "LATE":
      return { color: "text-yellow-400", icon: <Clock className="h-4 w-4" />, label: "Late" };
    case "EXCUSED":
      return { color: "text-averna-cyan", icon: <Clock className="h-4 w-4" />, label: "Excused" };
    default:
      return { color: "text-red-400", icon: <XCircle className="h-4 w-4" />, label: "Absent" };
  }
}

export default async function StudentSchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      group: { include: { teacher: { include: { user: { select: { name: true } } } } } },
      attendances: { orderBy: { date: "desc" }, take: 30 },
      grades: { orderBy: { date: "desc" }, take: 20 },
    },
  });

  if (!student) {
    return (
      <AccountNotice
        title="No student profile found"
        message="Sign in with a student account to view your schedule."
      />
    );
  }

  const total = student.attendances.length;
  const present = student.attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const rate = total > 0 ? Math.round((present / total) * 100) : null;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={CalendarClock}
          iconClassName="text-averna-cyan"
          title={<>My <span className="neon-text-cyan">Schedule</span></>}
        />

        {/* Group / schedule */}
        <Card className="glass border-averna-neon/30 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-neon">
              <GraduationCap className="h-5 w-5" /> My Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.group ? (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400">Group</p>
                  <p className="text-white font-medium">{student.group.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Level</p>
                  <p className="text-white font-medium">{student.level || student.group.level || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Teacher</p>
                  <p className="text-white font-medium">{student.group.teacher.user.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" /> Lessons
                  </p>
                  <p className="text-white font-medium">{student.group.schedule || "TBA"}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                ⏳ You haven&apos;t been assigned to a group yet. An administrator will enroll you soon.
              </p>
            )}
            {student.group && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <AddToGoogleCalendar
                  title={`Averna: ${student.group.name}`}
                  details={`${student.group.level ?? ""} lesson with ${student.group.teacher.user.name ?? "your teacher"}`}
                  scheduleText={student.group.schedule}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-averna-cyan">
                <ClipboardCheck className="h-5 w-5" /> My Attendance
              </span>
              {rate !== null && (
                <span className="text-sm font-normal">
                  <span className={rate >= 80 ? "text-averna-neon" : rate >= 50 ? "text-yellow-400" : "text-red-400"}>
                    {rate}%
                  </span>{" "}
                  <span className="text-gray-400">({present}/{total})</span>
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="text-sm text-gray-400">No attendance records yet.</p>
            ) : (
              <div className="space-y-2">
                {student.attendances.map((a) => {
                  const st = statusStyle(a.status);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                    >
                      <span className="text-gray-200 text-sm">
                        {new Date(a.date).toLocaleDateString("en-GB", {
                          timeZone: "Asia/Tashkent",
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className={`flex items-center gap-1 text-sm font-medium ${st.color}`}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grades */}
        <Card className="glass border-averna-purple/30 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-purple">
              <BookOpenCheck className="h-5 w-5" /> My Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.grades.length === 0 ? (
              <p className="text-sm text-gray-400">No grades yet. Your teacher will post them here.</p>
            ) : (
              <div className="space-y-2">
                {student.grades.map((g) => {
                  const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
                  const color = pct >= 80 ? "text-averna-neon" : pct >= 50 ? "text-yellow-400" : "text-red-400";
                  return (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{g.title}</p>
                        {g.comment && <p className="text-xs text-gray-400 truncate">{g.comment}</p>}
                        <p className="text-[11px] text-gray-500">
                          {new Date(g.date).toLocaleDateString("en-GB", { timeZone: "Asia/Tashkent" })}
                        </p>
                      </div>
                      <span className={`font-bold whitespace-nowrap ${color}`}>
                        {g.score}/{g.maxScore}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
