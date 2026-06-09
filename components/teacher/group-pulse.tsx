import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { db } from "@/lib/db";
import { Sparkline } from "@/components/ui/sparkline";

/**
 * Per-group "pulse": a 7-session attendance sparkline, the average grade and a
 * simple improving/declining trend. Helps a teacher spot a struggling group.
 */
export async function GroupPulse({ teacherId }: { teacherId: string }) {
  const groups = await db.group.findMany({
    where: { teacherId },
    include: {
      students: { select: { id: true } },
      attendances: { orderBy: { date: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  // Average grades per group (percentage of maxScore)
  const grades = await db.grade.findMany({
    where: { groupId: { in: groups.map((g) => g.id) } },
    orderBy: { date: "asc" },
    select: { groupId: true, score: true, maxScore: true, date: true },
  });

  const dayKey = (d: Date) => new Date(d).toISOString().slice(0, 10);

  const cards = groups.map((g) => {
    // Attendance rate per session day (last 7)
    const byDay = new Map<string, { present: number; total: number }>();
    for (const a of g.attendances) {
      const k = dayKey(a.date);
      const rec = byDay.get(k) ?? { present: 0, total: 0 };
      rec.total += 1;
      if (a.status === "PRESENT" || a.status === "LATE") rec.present += 1;
      byDay.set(k, rec);
    }
    const series = Array.from(byDay.values())
      .map((r) => (r.total > 0 ? Math.round((r.present / r.total) * 100) : 0))
      .slice(-7);
    const avgAttendance =
      series.length > 0 ? Math.round(series.reduce((a, b) => a + b, 0) / series.length) : null;

    // Average grade %
    const gg = grades.filter((x) => x.groupId === g.id);
    const gradePcts = gg.map((x) => (x.maxScore > 0 ? (x.score / x.maxScore) * 100 : 0));
    const avgGrade =
      gradePcts.length > 0 ? Math.round(gradePcts.reduce((a, b) => a + b, 0) / gradePcts.length) : null;

    // Trend: first half vs second half of grade percentages
    let trend: "up" | "down" | "flat" = "flat";
    if (gradePcts.length >= 4) {
      const half = Math.floor(gradePcts.length / 2);
      const early = gradePcts.slice(0, half);
      const late = gradePcts.slice(half);
      const ea = early.reduce((a, b) => a + b, 0) / early.length;
      const la = late.reduce((a, b) => a + b, 0) / late.length;
      if (la - ea > 3) trend = "up";
      else if (la - ea < -3) trend = "down";
    }

    return { id: g.id, name: g.name, students: g.students.length, series, avgAttendance, avgGrade, trend };
  });

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-averna-cyan">
          <Activity className="h-5 w-5" /> Group Pulse
        </CardTitle>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <p className="text-sm text-gray-400 py-2 text-center">No groups yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {cards.map((c) => {
              const TrendIcon = c.trend === "up" ? TrendingUp : c.trend === "down" ? TrendingDown : Minus;
              const trendColor =
                c.trend === "up" ? "text-averna-neon" : c.trend === "down" ? "text-red-400" : "text-gray-400";
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-averna-dark/30 border border-white/5 hover:border-averna-cyan/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-semibold text-white truncate">{c.name}</p>
                    <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                      <Users className="h-3.5 w-3.5" /> {c.students}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div className="space-y-1">
                      <div>
                        <p className="text-[11px] text-gray-400">Attendance</p>
                        <p className="text-lg font-bold text-averna-cyan leading-none">
                          {c.avgAttendance !== null ? `${c.avgAttendance}%` : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400">Avg grade</span>
                        <span className="text-sm font-semibold text-white">
                          {c.avgGrade !== null ? `${c.avgGrade}%` : "—"}
                        </span>
                        <span className={`flex items-center ${trendColor}`}>
                          <TrendIcon className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                    <Sparkline
                      data={c.series.length > 0 ? c.series : [0]}
                      width={96}
                      height={40}
                      stroke="#00e5ff"
                      fill="rgba(0,229,255,0.12)"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
