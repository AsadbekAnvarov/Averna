export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Plus, CalendarClock } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { formatDate } from "@/lib/utils";

async function addLesson(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: { groups: { select: { id: true } } },
  });
  if (!teacher) return;

  const groupId = formData.get("groupId") as string;
  const topic = (formData.get("topic") as string)?.trim();
  const notes = (formData.get("notes") as string)?.trim();
  const dateStr = formData.get("date") as string;

  if (!groupId || !topic) return;
  if (!teacher.groups.some((g) => g.id === groupId)) return;

  await db.lessonLog.create({
    data: {
      teacherId: teacher.id,
      groupId,
      topic,
      notes: notes || null,
      date: dateStr ? new Date(dateStr) : new Date(),
    },
  });
  revalidatePath("/teacher/lessons");
  redirect(`/teacher/lessons?group=${groupId}&saved=1`);
}

export default async function LessonLogPage({
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
    include: { groups: { orderBy: { name: "asc" } } },
  });
  if (!teacher) {
    return <AccountNotice title="No teacher profile found" message="Sign in with a teacher account to log lessons." />;
  }

  const groups = teacher.groups;
  const selected = groups.find((g) => g.id === searchParams.group) ?? groups[0];

  const lessons = selected
    ? await db.lessonLog.findMany({
        where: { groupId: selected.id },
        orderBy: { date: "desc" },
        take: 30,
      })
    : [];

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <Link href="/teacher/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-averna-cyan" />
          Lesson <span className="neon-text-cyan">Log</span>
        </h1>
        <p className="text-gray-400 mb-6">Record what you covered each lesson — handy for revision and parents.</p>

        {searchParams.saved && (
          <div className="mb-6 p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30 text-averna-neon">✓ Lesson saved!</div>
        )}

        {groups.length === 0 ? (
          <Card className="glass border-averna-primary/30"><CardContent className="py-8 text-center text-gray-300">No groups yet.</CardContent></Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {groups.map((g) => (
                <Link key={g.id} href={`/teacher/lessons?group=${g.id}`}>
                  <Button size="sm" variant={selected?.id === g.id ? "default" : "outline"}
                    className={selected?.id === g.id ? "neon-button bg-averna-primary" : "border-averna-cyan/40 text-averna-cyan"}>
                    {g.name}
                  </Button>
                </Link>
              ))}
            </div>

            <Card className="glass border-averna-cyan/30 mb-8">
              <CardHeader><CardTitle className="flex items-center gap-2 text-averna-cyan"><Plus className="h-5 w-5" /> Add Lesson Entry</CardTitle></CardHeader>
              <CardContent>
                <form action={addLesson} className="space-y-4">
                  <input type="hidden" name="groupId" value={selected?.id} />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="topic">Topic *</Label>
                      <Input id="topic" name="topic" placeholder="e.g., Writing Task 2 — opinion essays" className="bg-background/50" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" name="date" type="date" defaultValue={today} className="bg-background/50" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes / materials (optional)</Label>
                    <textarea id="notes" name="notes" rows={3} placeholder="What you covered, homework set, useful links..."
                      className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-averna-cyan" />
                  </div>
                  <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">Save Lesson</Button>
                </form>
              </CardContent>
            </Card>

            <Card className="glass border-averna-purple/30">
              <CardHeader><CardTitle className="text-averna-purple">History — {selected?.name}</CardTitle></CardHeader>
              <CardContent>
                {lessons.length === 0 ? (
                  <p className="text-gray-400 text-sm">No lessons logged yet.</p>
                ) : (
                  <div className="space-y-3">
                    {lessons.map((l) => (
                      <div key={l.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white font-medium">{l.topic}</p>
                          <span className="text-xs text-averna-cyan flex items-center gap-1 whitespace-nowrap">
                            <CalendarClock className="h-3 w-3" /> {formatDate(l.date)}
                          </span>
                        </div>
                        {l.notes && <p className="text-sm text-gray-400 mt-1 whitespace-pre-line">{l.notes}</p>}
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
