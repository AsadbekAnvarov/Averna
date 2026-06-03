export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";

const DOW: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function weekdaysFromText(text: string | null | undefined): Set<number> {
  const set = new Set<number>();
  if (!text) return set;
  const t = text.toLowerCase();
  for (const [abbr, num] of Object.entries(DOW)) {
    if (t.includes(abbr)) set.add(num);
  }
  return set;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      group: true,
      tutorBookings: true,
    },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to view your calendar." />;
  }

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (searchParams.m && /^\d{4}-\d{1,2}$/.test(searchParams.m)) {
    const [y, m] = searchParams.m.split("-");
    year = parseInt(y);
    month = parseInt(m) - 1;
  }

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const startOffset = (monthStart.getDay() + 6) % 7; // Monday-first

  // Homework deadlines in this month
  const homework = student.groupId
    ? await db.homework.findMany({
        where: { groupId: student.groupId, dueDate: { gte: monthStart, lte: new Date(year, month + 1, 0, 23, 59) } },
      })
    : [];
  const hwByDay: Record<number, string[]> = {};
  homework.forEach((h) => {
    const d = new Date(h.dueDate).getDate();
    (hwByDay[d] ??= []).push(h.title);
  });

  const lessonDays = weekdaysFromText(student.group?.schedule);
  const tutoringDays = new Set(student.tutorBookings.map((b) => DOW[b.day.slice(0, 3).toLowerCase()]));

  const prev = month === 0 ? `${year - 1}-12` : `${year}-${month}`;
  const next = month === 11 ? `${year + 1}-1` : `${year}-${month + 2}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayDay =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-averna-cyan" />
          My <span className="neon-text-cyan">Calendar</span>
        </h1>

        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <Link href={`/calendar?m=${prev}`}>
                <Button size="icon" variant="ghost" className="text-gray-300"><ChevronLeft className="h-5 w-5" /></Button>
              </Link>
              <span className="text-white">{MONTHS[month]} {year}</span>
              <Link href={`/calendar?m=${next}`}>
                <Button size="icon" variant="ghost" className="text-gray-300"><ChevronRight className="h-5 w-5" /></Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={i} />;
                const weekday = new Date(year, month, day).getDay();
                const isLesson = lessonDays.has(weekday);
                const isTutoring = tutoringDays.has(weekday);
                const hw = hwByDay[day];
                const isToday = day === todayDay;
                return (
                  <div
                    key={i}
                    className={`min-h-[60px] rounded-lg border p-1 text-left ${
                      isToday ? "border-averna-neon bg-averna-neon/10" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className={`text-xs font-medium ${isToday ? "text-averna-neon" : "text-gray-300"}`}>{day}</div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {isLesson && <span className="text-[9px] px-1 rounded bg-averna-primary/40 text-averna-neon truncate">Lesson</span>}
                      {isTutoring && <span className="text-[9px] px-1 rounded bg-averna-pink/30 text-averna-pink truncate">1-on-1</span>}
                      {hw && <span className="text-[9px] px-1 rounded bg-averna-purple/30 text-averna-purple truncate" title={hw.join(", ")}>HW due</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-averna-primary/40" /> Lesson</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-averna-pink/30" /> 1-on-1 tutoring</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-averna-purple/30" /> Homework due</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
