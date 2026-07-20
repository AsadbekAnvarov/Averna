export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, UserCheck, Sparkles, X } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { notifyUser } from "@/lib/notifications";
import { PageHeader } from "@/components/ui/page-header";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function bookSlot(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const slotId = formData.get("slotId") as string;

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return;

  // Atomic: only book if still free
  await db.tutorSlot.updateMany({
    where: { id: slotId, studentId: null },
    data: { studentId: student.id },
  });

  // Notify the teacher about the booking
  const slot = await db.tutorSlot.findUnique({
    where: { id: slotId },
    include: { teacher: { select: { userId: true } } },
  });
  if (slot?.studentId === student.id && slot.teacher) {
    await notifyUser(slot.teacher.userId, {
      type: "booking",
      title: "New 1-on-1 booking",
      message: `A student booked your slot on ${slot.day} at ${slot.startTime}.`,
      link: "/teacher/tutoring",
    });
  }
  revalidatePath("/tutoring");
}

async function cancelBooking(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const slotId = formData.get("slotId") as string;

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) return;

  await db.tutorSlot.updateMany({
    where: { id: slotId, studentId: student.id },
    data: { studentId: null },
  });
  revalidatePath("/tutoring");
}

export default async function TutoringPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  // Teachers manage slots elsewhere
  if (session.user.role === "TEACHER" || session.user.role === "ADMIN") {
    redirect("/teacher/tutoring");
  }

  const student = await db.student.findUnique({ where: { userId: session.user.id } });
  if (!student) {
    return (
      <AccountNotice
        title="No student profile found"
        message="Sign in with a student account to book 1-on-1 sessions."
      />
    );
  }

  const secondTeachers = await db.teacher.findMany({
    where: { isSecondTeacher: true },
    include: {
      user: { select: { name: true, image: true } },
      tutorSlots: { orderBy: [{ startTime: "asc" }] },
    },
  });

  const myBookings = await db.tutorSlot.findMany({
    where: { studentId: student.id },
    include: { teacher: { include: { user: { select: { name: true } } } } },
  });
  myBookings.sort(
    (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime)
  );

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={UserCheck}
          iconClassName="text-averna-pink"
          title={<>Book a <span className="neon-text-purple">Second Teacher</span></>}
          subtitle="Reserve a free 1-on-1 slot with an extra teacher for focused speaking practice. 🎙️"
        />

        {/* My booked sessions */}
        <Card className="glass border-averna-neon/30 mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-averna-neon">
              <Sparkles className="h-5 w-5" /> My Booked Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myBookings.length === 0 ? (
              <p className="text-gray-400 text-sm">
                You haven&apos;t booked any sessions yet. Pick an open slot below 👇
              </p>
            ) : (
              <div className="space-y-2">
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-averna-neon/10 border border-averna-neon/30"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {b.day} · {b.startTime}–{b.endTime}
                      </p>
                      <p className="text-xs text-averna-cyan">
                        {b.topic ?? "1-on-1 session"} · with {b.teacher.user.name}
                      </p>
                    </div>
                    <form action={cancelBooking}>
                      <input type="hidden" name="slotId" value={b.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                      >
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available teachers & slots */}
        {secondTeachers.length === 0 && (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-8 text-center text-gray-300">
              No second teachers are available yet. Please check back soon!
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {secondTeachers.map((t) => {
            const openSlots = t.tutorSlots.filter((s) => !s.studentId);
            return (
              <Card key={t.id} className="glass border-averna-purple/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-full bg-averna-purple/30 flex items-center justify-center text-white font-bold">
                      {(t.user.name ?? "T").charAt(0)}
                    </span>
                    <div>
                      <p className="text-white">{t.user.name}</p>
                      <p className="text-xs text-averna-cyan font-normal">
                        {t.specialty ?? "Speaking Coach"}
                      </p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {t.bio && <p className="text-sm text-gray-300 mb-4">{t.bio}</p>}
                  {openSlots.length === 0 ? (
                    <p className="text-sm text-gray-400">All slots are currently booked.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {openSlots.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-lg bg-white/5 border border-white/10"
                        >
                          <p className="text-white font-medium flex items-center gap-1">
                            <CalendarClock className="h-4 w-4 text-averna-cyan" />
                            {s.day} · {s.startTime}–{s.endTime}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{s.topic ?? "1-on-1 session"}</p>
                          <form action={bookSlot} className="mt-2">
                            <input type="hidden" name="slotId" value={s.id} />
                            <Button
                              type="submit"
                              size="sm"
                              className="w-full neon-button bg-averna-primary hover:bg-averna-light"
                            >
                              Book this slot
                            </Button>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
