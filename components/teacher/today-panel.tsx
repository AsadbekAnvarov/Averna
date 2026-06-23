import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock, Users, ClipboardCheck, BookOpen, ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { parseSchedule, tashkentWeekday, tashkentHour, WEEKDAY_NAMES } from "@/lib/utils";

/**
 * "Today" panel — surfaces the teacher's next lesson based on each group's
 * schedule string, with one-tap actions to take attendance or log the lesson.
 */
export async function TodayPanel({ teacherId }: { teacherId: string }) {
  const groups = await db.group.findMany({
    where: { teacherId },
    include: { students: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  const todayIdx = tashkentWeekday();
  const nowHour = tashkentHour();

  type Lesson = {
    groupId: string;
    name: string;
    time: string | null;
    students: number;
    dayOffset: number; // 0 = today, 1 = tomorrow, ...
    hour: number;
  };

  const lessons: Lesson[] = [];
  for (const g of groups) {
    const { days, time } = parseSchedule(g.schedule);
    if (days.length === 0) continue;
    const hour = time ? parseInt(time.split(":")[0], 10) : 0;
    // Find the soonest upcoming occurrence within the next 7 days
    let bestOffset = Infinity;
    for (const d of days) {
      let offset = (d - todayIdx + 7) % 7;
      // If it's today but the lesson hour already passed, push to next week
      if (offset === 0 && time && hour < nowHour) offset = 7;
      if (offset < bestOffset) bestOffset = offset;
    }
    if (bestOffset === Infinity) continue;
    lessons.push({
      groupId: g.id,
      name: g.name,
      time,
      students: g.students.length,
      dayOffset: bestOffset,
      hour,
    });
  }

  lessons.sort((a, b) => a.dayOffset - b.dayOffset || a.hour - b.hour);

  const todayLessons = lessons.filter((l) => l.dayOffset === 0);
  const next = lessons[0];

  const whenLabel = (l: Lesson) => {
    if (l.dayOffset === 0) return l.time ? `Today · ${l.time}` : "Today";
    if (l.dayOffset === 1) return l.time ? `Tomorrow · ${l.time}` : "Tomorrow";
    const wd = WEEKDAY_NAMES[(todayIdx + l.dayOffset) % 7];
    return l.time ? `${wd} · ${l.time}` : wd;
  };

  return (
    <Card className="glass relative overflow-hidden border-averna-cyan/30">
      <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-averna-cyan/15 to-transparent blur-3xl" />
      <CardContent className="p-6 relative">
        <div className="flex items-center gap-2 text-averna-cyan mb-4">
          <CalendarClock className="h-5 w-5" />
          <h3 className="font-semibold">Up Next</h3>
        </div>

        {!next ? (
          <div className="flex items-center gap-3 text-gray-400">
            <CalendarDays className="h-5 w-5" />
            <p className="text-sm">No scheduled lessons yet. Add a schedule to your groups to see them here.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-2xl font-bold text-white truncate">{next.name}</p>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="text-averna-cyan font-medium">{whenLabel(next)}</span>
                  <span className="text-gray-400 flex items-center gap-1">
                    <Users className="h-4 w-4" /> {next.students} students
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/teacher/attendance?group=${next.groupId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium transition-colors"
                >
                  <ClipboardCheck className="h-4 w-4" /> Attendance
                </Link>
                <Link
                  href="/teacher/lessons"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-averna-dark/50 border border-white/10 hover:border-averna-cyan/40 text-gray-200 text-sm font-medium transition-colors"
                >
                  <BookOpen className="h-4 w-4" /> Log
                </Link>
              </div>
            </div>

            {todayLessons.length > 1 && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-400 mb-2">Also today</p>
                <div className="flex flex-wrap gap-2">
                  {todayLessons.slice(1).map((l) => (
                    <Link
                      key={l.groupId}
                      href={`/teacher/attendance?group=${l.groupId}`}
                      className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-averna-cyan/40 text-sm text-gray-200 transition-colors"
                    >
                      <span className="truncate max-w-[140px]">{l.name}</span>
                      {l.time && <span className="text-averna-cyan text-xs">{l.time}</span>}
                      <ArrowRight className="h-3.5 w-3.5 text-gray-500 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
