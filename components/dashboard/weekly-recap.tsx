import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { CalendarCheck, Star, BookOpen, Flame } from "lucide-react";

const DAY = 86400000;

export async function WeeklyRecap({ studentId, streak }: { studentId: string; streak: number }) {
  const weekStart = new Date(Date.now() - 6 * DAY);
  weekStart.setHours(0, 0, 0, 0);

  const [logs, testsThisWeek] = await Promise.all([
    db.activityLog.findMany({
      where: { studentId, createdAt: { gte: weekStart } },
      select: { points: true, createdAt: true },
    }),
    db.iELTSTest.count({ where: { studentId, completedAt: { gte: weekStart } } }),
  ]);

  const xpThisWeek = logs.reduce((s, l) => s + (l.points ?? 0), 0);

  // Build 7 day buckets (oldest -> today)
  const buckets: { label: string; xp: number; key: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    buckets.push({
      label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
      xp: 0,
    });
  }
  for (const l of logs) {
    const d = new Date(l.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const b = buckets.find((x) => x.key === key);
    if (b) b.xp += l.points ?? 0;
  }
  const maxXp = Math.max(1, ...buckets.map((b) => b.xp));
  const activeDays = buckets.filter((b) => b.xp > 0).length;

  return (
    <Card className="glass border-averna-cyan/30 animate-fade-in">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-averna-cyan/15 border border-averna-cyan/30">
            <CalendarCheck className="h-4 w-4 text-averna-cyan" />
          </span>
          Your Last 7 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stat tiles */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
            <Star className="h-4 w-4 text-averna-neon mx-auto mb-1" />
            <p className="text-xl font-bold text-averna-neon">{xpThisWeek}</p>
            <p className="text-[10px] text-gray-400">XP earned</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
            <BookOpen className="h-4 w-4 text-averna-cyan mx-auto mb-1" />
            <p className="text-xl font-bold text-averna-cyan">{testsThisWeek}</p>
            <p className="text-[10px] text-gray-400">tests done</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
            <Flame className="h-4 w-4 text-orange-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-orange-400">{activeDays}/7</p>
            <p className="text-[10px] text-gray-400">active days</p>
          </div>
        </div>

        {/* Mini per-day XP bars */}
        <div>
          <div className="flex items-end justify-between gap-1.5 h-20">
            {buckets.map((b, i) => {
              const h = Math.round((b.xp / maxXp) * 100);
              const isToday = i === buckets.length - 1;
              return (
                <div key={b.key} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className={`w-full rounded-t ${
                      b.xp > 0
                        ? "bg-gradient-to-t from-averna-cyan/50 to-averna-neon"
                        : "bg-white/10"
                    } ${isToday ? "ring-1 ring-averna-neon/50" : ""}`}
                    style={{ height: `${Math.max(6, h)}%` }}
                    title={`${b.xp} XP`}
                  />
                  <span className={`text-[10px] mt-1 ${isToday ? "text-averna-neon font-bold" : "text-gray-500"}`}>
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-gray-500">
          {activeDays >= 5
            ? "🔥 Amazing week — you showed up almost every day!"
            : activeDays >= 3
            ? "Nice rhythm. Try to add one or two more active days."
            : "A little every day adds up fast — aim for 3+ active days this week."}{" "}
          Current streak: {streak} day{streak === 1 ? "" : "s"}.
        </p>
      </CardContent>
    </Card>
  );
}
