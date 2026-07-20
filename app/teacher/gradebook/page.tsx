export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpenCheck, Plus } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { PageHeader } from "@/components/ui/page-header";
import { notifyUser } from "@/lib/notifications";

async function addGrade(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return;

  const groupId = formData.get("groupId") as string;
  const studentId = formData.get("studentId") as string;
  const title = (formData.get("title") as string)?.trim();
  const score = parseFloat(formData.get("score") as string);
  const maxScore = parseFloat(formData.get("maxScore") as string) || 100;
  const comment = (formData.get("comment") as string)?.trim();

  if (!studentId || !title || isNaN(score)) return;

  // Validate the student is in one of the teacher's groups
  const group = await db.group.findFirst({
    where: { id: groupId, teacherId: teacher.id },
    include: { students: { select: { id: true, userId: true } } },
  });
  const target = group?.students.find((s) => s.id === studentId);
  if (!group || !target) return;

  await db.grade.create({
    data: {
      studentId,
      teacherId: teacher.id,
      groupId: group.id,
      title,
      score,
      maxScore,
      comment: comment || null,
    },
  });

  await notifyUser(target.userId, {
    type: "grade",
    title: "New grade posted",
    message: `${title}: ${score}/${maxScore}`,
    link: "/schedule",
  });

  revalidatePath("/teacher/gradebook");
  redirect(`/teacher/gradebook?group=${group.id}&saved=1`);
}

export default async function GradebookPage({
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
        include: { students: { include: { user: { select: { name: true } } } } },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!teacher) {
    return <AccountNotice title="No teacher profile found" message="Sign in with a teacher account to use the gradebook." />;
  }

  const groups = teacher.groups;
  const selected = groups.find((g) => g.id === searchParams.group) ?? groups[0];

  const recentGrades = selected
    ? await db.grade.findMany({
        where: { groupId: selected.id },
        orderBy: { date: "desc" },
        take: 15,
        include: { student: { include: { user: { select: { name: true } } } } },
      })
    : [];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />

        <PageHeader
          back={{ href: "/teacher/dashboard", label: "Back to Dashboard" }}
          icon={BookOpenCheck}
          iconClassName="text-averna-purple"
          title={<span className="neon-text-purple">Gradebook</span>}
          subtitle="Record grades for your students — they get notified instantly."
        />

        {searchParams.saved && (
          <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">
            ✓ Grade saved and student notified!
          </div>
        )}

        {groups.length === 0 ? (
          <Card className="glass border-averna-primary/30"><CardContent className="py-8 text-center text-gray-300">You have no groups yet.</CardContent></Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {groups.map((g) => (
                <Link key={g.id} href={`/teacher/gradebook?group=${g.id}`}>
                  <Button size="sm" variant={selected?.id === g.id ? "default" : "outline"}
                    className={selected?.id === g.id ? "neon-button bg-averna-primary" : "border-averna-purple/40 text-averna-purple"}>
                    {g.name}
                  </Button>
                </Link>
              ))}
            </div>

            {/* Add grade */}
            <Card className="glass border-averna-purple/30 mb-8">
              <CardHeader><CardTitle className="flex items-center gap-2 text-averna-purple"><Plus className="h-5 w-5" /> Add Grade</CardTitle></CardHeader>
              <CardContent>
                <form action={addGrade} className="grid sm:grid-cols-2 gap-4">
                  <input type="hidden" name="groupId" value={selected?.id} />
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="studentId">Student</Label>
                    <select id="studentId" name="studentId" required
                      className="w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-purple">
                      {selected?.students.map((s) => (
                        <option key={s.id} value={s.id} className="bg-averna-dark">{s.user.name ?? "Student"}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" placeholder="e.g., Writing Task 2 — Lesson 5" className="bg-background/50" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="score">Score</Label>
                    <Input id="score" name="score" type="number" step="0.5" placeholder="8" className="bg-background/50" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxScore">Max score</Label>
                    <Input id="maxScore" name="maxScore" type="number" step="0.5" defaultValue="9" className="bg-background/50" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="comment">Comment (optional)</Label>
                    <Input id="comment" name="comment" placeholder="Good structure, work on linking words" className="bg-background/50" />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Save Grade</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Recent grades */}
            <Card className="glass border-averna-cyan/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-averna-cyan">Recent Grades — {selected?.name}</CardTitle>
                  <div className="flex gap-2">
                    <a href={`/api/teacher/export?group=${selected?.id}&type=grades`}>
                      <Button size="sm" variant="outline" className="border-averna-cyan/40 text-averna-cyan">
                        Export grades
                      </Button>
                    </a>
                    <a href={`/api/teacher/export?group=${selected?.id}&type=attendance`}>
                      <Button size="sm" variant="outline" className="border-averna-neon/40 text-averna-neon">
                        Export attendance
                      </Button>
                    </a>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recentGrades.length === 0 ? (
                  <p className="text-gray-400 text-sm">No grades recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentGrades.map((g) => (
                      <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">{g.student.user.name} — {g.title}</p>
                          {g.comment && <p className="text-xs text-gray-400 truncate">{g.comment}</p>}
                        </div>
                        <span className="text-averna-neon font-bold whitespace-nowrap">{g.score}/{g.maxScore}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
