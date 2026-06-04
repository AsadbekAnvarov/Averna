export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Ban, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { notifyUser } from "@/lib/notifications";

async function blacklistStudent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: { groups: { include: { students: { select: { id: true, userId: true } } } } },
  });
  if (!teacher) return;

  const studentId = formData.get("studentId") as string;
  const reason = (formData.get("reason") as string)?.trim() || "Repeatedly missing homework";
  const owns = teacher.groups.some((g) => g.students.some((s) => s.id === studentId));
  if (!owns) return;

  await db.student.update({ where: { id: studentId }, data: { blacklisted: true, blacklistReason: reason } });

  const target = teacher.groups.flatMap((g) => g.students).find((s) => s.id === studentId);
  if (target) {
    await notifyUser(target.userId, {
      type: "system",
      title: "⚠️ You were added to the blacklist",
      message: `Reason: ${reason}. Please speak to your teacher.`,
      link: "/dashboard",
    });
  }
  revalidatePath("/teacher/students");
}

async function unblacklistStudent(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: { groups: { include: { students: { select: { id: true } } } } },
  });
  if (!teacher) return;
  const studentId = formData.get("studentId") as string;
  const owns = teacher.groups.some((g) => g.students.some((s) => s.id === studentId));
  if (!owns) return;
  await db.student.update({ where: { id: studentId }, data: { blacklisted: false, blacklistReason: null } });
  revalidatePath("/teacher/students");
}

export default async function TeacherStudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      groups: {
        include: {
          students: {
            include: { user: { select: { name: true, email: true } } },
            orderBy: { totalPoints: "desc" },
          },
        },
      },
    },
  });

  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="This account doesn't have a teacher profile. Sign in with a teacher account to view students."
      />
    );
  }

  const blacklistedAll = teacher.groups.flatMap((g) => g.students).filter((s) => s.blacklisted);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <Link href="/teacher/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <Users className="h-8 w-8 text-averna-cyan" />
          My Students
        </h1>

        {/* Blacklist summary */}
        {blacklistedAll.length > 0 && (
          <Card className="glass border-red-500/40 mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-400">
                <Ban className="h-5 w-5" /> Blacklist ({blacklistedAll.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-gray-400 mb-2">Students flagged for not doing homework or dishonest behaviour.</p>
              {blacklistedAll.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div>
                    <p className="text-white font-medium">{s.user.name ?? "Unnamed"}</p>
                    <p className="text-xs text-red-300">{s.blacklistReason}</p>
                  </div>
                  <form action={unblacklistStudent}>
                    <input type="hidden" name="studentId" value={s.id} />
                    <Button type="submit" size="sm" variant="outline" className="border-averna-neon/50 text-averna-neon">
                      <ShieldCheck className="h-4 w-4 mr-1" /> Remove
                    </Button>
                  </form>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {teacher.groups.length === 0 && (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-10 text-center text-gray-300">No groups assigned yet.</CardContent>
          </Card>
        )}

        <div className="space-y-8">
          {teacher.groups.map((group) => (
            <Card key={group.id} className="glass border-averna-cyan/30">
              <CardHeader>
                <CardTitle className="text-averna-cyan">
                  {group.name} <span className="text-sm text-gray-400">({group.students.length} students)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {group.students.length === 0 ? (
                  <p className="text-gray-400 text-sm">No students in this group yet.</p>
                ) : (
                  <div className="space-y-3">
                    {group.students.map((student, idx) => (
                      <div
                        key={student.id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${
                          student.blacklisted ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:w-64 min-w-0">
                          <span className="text-gray-400 text-sm">{idx + 1}.</span>
                          <div className="min-w-0">
                            <p className="text-white font-medium truncate flex items-center gap-2">
                              {student.user.name ?? "Unnamed"}
                              {student.blacklisted && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-300 border border-red-500/40">
                                  blacklisted
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{student.user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-averna-neon font-semibold">{student.totalPoints} pts</span>
                          <span className="text-averna-pink">{student.currentStreak}🔥</span>
                        </div>
                        <div className="sm:ml-auto">
                          {student.blacklisted ? (
                            <form action={unblacklistStudent}>
                              <input type="hidden" name="studentId" value={student.id} />
                              <Button type="submit" size="sm" variant="outline" className="border-averna-neon/50 text-averna-neon">
                                Remove from blacklist
                              </Button>
                            </form>
                          ) : (
                            <form action={blacklistStudent} className="flex gap-2">
                              <input type="hidden" name="studentId" value={student.id} />
                              <Input name="reason" placeholder="Reason (optional)" className="bg-background/50 h-9 text-xs w-40" />
                              <Button type="submit" size="sm" variant="outline" className="border-red-500/50 text-red-300">
                                <Ban className="h-4 w-4 mr-1" /> Blacklist
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
