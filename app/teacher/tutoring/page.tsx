export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Plus, Trash2, UserCheck } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";

async function createSlot(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return;

  const day = (formData.get("day") as string)?.trim();
  const startTime = (formData.get("startTime") as string)?.trim();
  const endTime = (formData.get("endTime") as string)?.trim();
  const topic = (formData.get("topic") as string)?.trim();

  if (!day || !startTime || !endTime) return;

  await db.tutorSlot.create({
    data: { teacherId: teacher.id, day, startTime, endTime, topic: topic || null },
  });
  // Ensure this teacher is discoverable as a second teacher
  if (!teacher.isSecondTeacher) {
    await db.teacher.update({ where: { id: teacher.id }, data: { isSecondTeacher: true } });
  }
  revalidatePath("/teacher/tutoring");
}

async function deleteSlot(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const teacher = await db.teacher.findUnique({ where: { userId: session.user.id } });
  if (!teacher) return;
  const slotId = formData.get("slotId") as string;
  await db.tutorSlot.deleteMany({ where: { id: slotId, teacherId: teacher.id } });
  revalidatePath("/teacher/tutoring");
}

export default async function TeacherTutoringPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/tutoring");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true } },
      tutorSlots: {
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: [{ startTime: "asc" }],
      },
    },
  });

  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="Sign in with a teacher account to manage tutoring slots."
      />
    );
  }

  const booked = teacher.tutorSlots.filter((s) => s.studentId);
  const open = teacher.tutorSlots.filter((s) => !s.studentId);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <TeacherHeader user={{ name: teacher.user.name ?? "Teacher", email: teacher.user.email }} />

        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <UserCheck className="h-9 w-9 text-averna-pink" />
          1-on-1 <span className="neon-text-purple">Tutoring</span>
        </h1>
        <p className="text-gray-400 mb-8">
          Offer free time slots for students to book personal practice sessions.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="glass border-averna-cyan/30">
            <CardHeader><CardTitle className="text-sm text-averna-cyan">Open Slots</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-averna-cyan">{open.length}</p></CardContent>
          </Card>
          <Card className="glass border-averna-neon/30">
            <CardHeader><CardTitle className="text-sm text-averna-neon">Booked</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-averna-neon">{booked.length}</p></CardContent>
          </Card>
          <Card className="glass border-averna-purple/30">
            <CardHeader><CardTitle className="text-sm text-averna-purple">Total</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold text-averna-purple">{teacher.tutorSlots.length}</p></CardContent>
          </Card>
        </div>

        {/* Add slot */}
        <Card className="glass border-averna-pink/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-pink">
              <Plus className="h-5 w-5" /> Add a Time Slot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createSlot} className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="day">Day</Label>
                <select
                  id="day"
                  name="day"
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-averna-pink"
                  required
                >
                  {days.map((d) => (
                    <option key={d} value={d} className="bg-averna-dark">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic (optional)</Label>
                <Input id="topic" name="topic" placeholder="e.g., Speaking practice" className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start time</Label>
                <Input id="startTime" name="startTime" type="time" defaultValue="17:00" className="bg-background/50" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End time</Label>
                <Input id="endTime" name="endTime" type="time" defaultValue="17:30" className="bg-background/50" required />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full neon-button bg-averna-primary hover:bg-averna-light">
                  <Plus className="mr-2 h-4 w-4" /> Add Slot
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Existing slots */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-cyan">
              <CalendarClock className="h-5 w-5" /> My Slots
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacher.tutorSlots.length === 0 ? (
              <p className="text-gray-400 text-sm">No slots yet. Add your first one above.</p>
            ) : (
              <div className="space-y-2">
                {teacher.tutorSlots.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      s.studentId
                        ? "bg-averna-neon/10 border-averna-neon/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div>
                      <p className="text-white font-medium">
                        {s.day} · {s.startTime}–{s.endTime}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.topic ?? "1-on-1 session"}
                        {s.studentId && s.student ? (
                          <span className="text-averna-neon"> · booked by {s.student.user.name}</span>
                        ) : (
                          <span className="text-averna-cyan"> · open</span>
                        )}
                      </p>
                    </div>
                    <form action={deleteSlot}>
                      <input type="hidden" name="slotId" value={s.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
