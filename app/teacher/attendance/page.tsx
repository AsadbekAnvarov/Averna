export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { QrCheckin } from "@/components/qr-checkin";

const STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

async function saveAttendance(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return;

  const groupId = formData.get("groupId") as string;
  const dateStr = (formData.get("date") as string) || new Date().toISOString().slice(0, 10);

  const group = await db.group.findFirst({
    where: { id: groupId, teacherId: teacher.id },
    include: { students: true },
  });
  if (!group) return;

  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59`);

  // Re-saving the same day overwrites the previous roll call
  await db.attendance.deleteMany({
    where: { groupId, date: { gte: dayStart, lte: dayEnd } },
  });

  for (const s of group.students) {
    const status = (formData.get(`status_${s.id}`) as string) || "PRESENT";
    await db.attendance.create({
      data: { studentId: s.id, groupId, teacherId: teacher.id, date: dayStart, status },
    });
  }

  revalidatePath("/teacher/attendance");
  redirect(`/teacher/attendance?group=${groupId}&saved=1`);
}

async function markAllPresent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return;

  const groupId = formData.get("groupId") as string;
  const dateStr = (formData.get("date") as string) || new Date().toISOString().slice(0, 10);

  const group = await db.group.findFirst({
    where: { id: groupId, teacherId: teacher.id },
    include: { students: true },
  });
  if (!group) return;

  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59`);
  await db.attendance.deleteMany({ where: { groupId, date: { gte: dayStart, lte: dayEnd } } });
  for (const s of group.students) {
    await db.attendance.create({
      data: { studentId: s.id, groupId, teacherId: teacher.id, date: dayStart, status: "PRESENT" },
    });
  }
  revalidatePath("/teacher/attendance");
  redirect(`/teacher/attendance?group=${groupId}&saved=1`);
}

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: { group?: string; saved?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      groups: {
        include: {
          students: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="Sign in with a teacher account to take attendance."
      />
    );
  }

  const groups = teacher.groups;
  const selected = groups.find((g) => g.id === searchParams.group) ?? groups[0];
  const today = new Date().toISOString().slice(0, 10);

  // Prefill with today's existing roll call (if any)
  let todayStatus: Record<string, string> = {};
  if (selected) {
    const dayStart = new Date(`${today}T00:00:00`);
    const dayEnd = new Date(`${today}T23:59:59`);
    const existing = await db.attendance.findMany({
      where: { groupId: selected.id, date: { gte: dayStart, lte: dayEnd } },
    });
    todayStatus = Object.fromEntries(existing.map((a) => [a.studentId, a.status]));
  }

  // Attendance rate per student (all-time) for the selected group
  let rates: Record<string, { present: number; total: number }> = {};
  if (selected) {
    const all = await db.attendance.findMany({ where: { groupId: selected.id } });
    for (const a of all) {
      const r = (rates[a.studentId] ??= { present: 0, total: 0 });
      r.total += 1;
      if (a.status === "PRESENT" || a.status === "LATE") r.present += 1;
    }
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-averna-cyan" />
          Attendance <span className="neon-text-cyan">Journal</span>
        </h1>
        <p className="text-gray-400 mb-6">Take the roll call for each lesson and track attendance.</p>

        {searchParams.saved && (
          <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">
            <CheckCircle2 className="h-5 w-5" /> Attendance saved!
          </div>
        )}

        {groups.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-8 text-center text-gray-300">
              You have no groups yet.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Group selector */}
            <div className="flex flex-wrap gap-2 mb-6">
              {groups.map((g) => (
                <Link key={g.id} href={`/teacher/attendance?group=${g.id}`}>
                  <Button
                    size="sm"
                    variant={selected?.id === g.id ? "default" : "outline"}
                    className={
                      selected?.id === g.id
                        ? "neon-button bg-averna-primary"
                        : "border-averna-cyan/40 text-averna-cyan"
                    }
                  >
                    {g.name}
                  </Button>
                </Link>
              ))}
            </div>

            {/* QR self check-in */}
            {selected && (
              <div className="mb-6">
                <QrCheckin groupId={selected.id} groupName={selected.name} />
              </div>
            )}

            {/* Roll call form */}
            <Card className="glass border-averna-cyan/30">
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span>{selected?.name} — Roll Call</span>
                  <span className="text-sm font-normal text-gray-400">
                    {selected?.students.length} students
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selected && selected.students.length > 0 ? (
                  <>
                  {/* Quick: mark everyone present for today */}
                  <form action={markAllPresent} className="mb-3">
                    <input type="hidden" name="groupId" value={selected.id} />
                    <input type="hidden" name="date" value={today} />
                    <Button type="submit" variant="outline" className="border-averna-neon/50 text-averna-neon w-full sm:w-auto">
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Mark everyone present (today)
                    </Button>
                  </form>

                  <form action={saveAttendance} className="space-y-4">
                    <input type="hidden" name="groupId" value={selected.id} />
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-sm text-gray-300">Lesson date:</label>
                      <input
                        type="date"
                        name="date"
                        defaultValue={today}
                        className="rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-cyan"
                      />
                    </div>

                    <div className="space-y-2">
                      {selected.students.map((s, i) => {
                        const rate = rates[s.id];
                        const pct = rate && rate.total > 0 ? Math.round((rate.present / rate.total) * 100) : null;
                        const cur = todayStatus[s.id] ?? "PRESENT";
                        return (
                          <div
                            key={s.id}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10"
                          >
                            <div className="sm:w-56 min-w-0">
                              <p className="text-white font-medium truncate">
                                {i + 1}. {s.user.name ?? "Student"}
                              </p>
                              {pct !== null && (
                                <p className="text-xs text-gray-400">Attendance: {pct}%</p>
                              )}
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              {STATUSES.map((st) => (
                                <label
                                  key={st}
                                  className="cursor-pointer text-xs px-3 py-1.5 rounded-full border border-white/15 bg-white/5 text-gray-300 has-[:checked]:bg-averna-primary has-[:checked]:text-white has-[:checked]:border-averna-neon transition-colors"
                                >
                                  <input
                                    type="radio"
                                    name={`status_${s.id}`}
                                    value={st}
                                    defaultChecked={cur === st}
                                    className="sr-only"
                                  />
                                  {st.charAt(0) + st.slice(1).toLowerCase()}
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      type="submit"
                      className="w-full neon-button bg-averna-primary hover:bg-averna-light"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Save Attendance
                    </Button>
                  </form>
                  </>
                ) : (
                  <p className="text-gray-400 text-sm">No students in this group yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
