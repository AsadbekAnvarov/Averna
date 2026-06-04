export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";

const DOW: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function weekdaysFromText(text: string | null | undefined): number[] {
  if (!text) return [];
  const t = text.toLowerCase();
  return Object.entries(DOW).filter(([abbr]) => t.includes(abbr)).map(([, n]) => n);
}

export default async function TeacherCalendarPage({ searchParams }: { searchParams: { m?: string } }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const teacher = await db.teacher.findUnique({
    where: { userId: session.user.id },
    include: { groups: true, homework: { include: { group: { select: { name: true } } } } },
  });
  if (!teacher) {
    return <AccountNotice title="No teacher profile found" message="Sign in with a teacher account." />;
  }

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (searchParams.m && /^\d{4}-\d{1,2}$/.test(searchParams.m)) {
    const [y, m] = searchParams.m.split("-");
    year = parseInt(y); month = parseInt(m) - 1;
  }

  const monthStart = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (monthStart.getDay() + 6) % 7; // Monday-first

  // Map: weekday -> group names that have a lesson that day
  const lessonsByWeekday: Record<number, string[]> = {};
  teacher.groups.forEach((g) => {
    weekdaysFromText(g.schedule).forEach((wd) => {
      (lessonsByWeekday[wd] ??= []).push(g.name);
    });
  });

  // Homework deadlines in this month
  const hwByDay: Record<number, string[]> = {};
  teacher.homework.forEach((h) => {
    const d = new Date(h.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      (hwByDay[d.getDate()] ??= []).push(h.title);
    }
  });

  const prev = month === 0 ? `${year - 1}-12` : `${year}-${month}`;
  const next = month === 11 ? `${year + 1}-1` : `${year}-${month + 2}`;
  const todayDay = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <Link href="/teacher/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-averna-cyan" /> Teaching <span className="neon-text-cyan">Calendar</span>
        </h1>

        <Card className="glass border-averna-cyan/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <Link href={`/teacher/calendar?m=${prev}`}><Button size="icon" variant="ghost" className="text-gray-300"><ChevronLeft className="h-5 w-5" /></Button></Link>
              <span className="text-white">{MONTHS[month]} {year}</span>
              <Link href={`/teacher/calendar?m=${next}`}><Button size="icon" variant="ghost" className="text-gray-300"><ChevronRight className="h-5 w-5" /></Button></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={i} />;
                const wd = new Date(year, month, day).getDay();
                const lessons = lessonsByWeekday[wd] ?? [];
                const hw = hwByDay[day];
                const isToday = day === todayDay;
                return (
                  <div key={i} className={`min-h-[64px] rounded-lg border p-1 text-left ${isToday ? "border-averna-neon bg-averna-neon/10" : "border-white/10 bg-white/5"}`}>
                    <div className={`text-xs font-medium ${isToday ? "text-averna-neon" : "text-gray-300"}`}>{day}</div>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {lessons.slice(0, 2).map((n, idx) => (
                        <span key={idx} className="text-[9px] px-1 rounded bg-averna-primary/40 text-averna-neon truncate" title={n}>{n}</span>
                      ))}
                      {hw && <span className="text-[9px] px-1 rounded bg-averna-purple/30 text-averna-purple truncate" title={hw.join(", ")}>HW due</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-averna-primary/40" /> Lesson</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-averna-purple/30" /> Homework due</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
