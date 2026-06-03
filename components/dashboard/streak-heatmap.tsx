import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { db } from "@/lib/db";

const DAYS = 84; // 12 weeks

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function colorFor(count: number): string {
  if (count <= 0) return "bg-white/5";
  if (count === 1) return "bg-averna-neon/30";
  if (count <= 3) return "bg-averna-neon/60";
  return "bg-averna-neon";
}

export async function StreakHeatmap({ studentId }: { studentId: string }) {
  const since = new Date();
  since.setDate(since.getDate() - (DAYS - 1));
  since.setHours(0, 0, 0, 0);

  let logs: { createdAt: Date }[] = [];
  try {
    logs = await db.activityLog.findMany({
      where: { studentId, createdAt: { gte: since } },
      select: { createdAt: true },
    });
  } catch {
    logs = [];
  }

  const counts: Record<string, number> = {};
  for (const l of logs) {
    const k = dateKey(new Date(l.createdAt));
    counts[k] = (counts[k] ?? 0) + 1;
  }

  // Build last 84 days, oldest -> newest, chunked into weeks (columns)
  const cells: { key: string; count: number; label: string }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dateKey(d);
    cells.push({ key: k, count: counts[k] ?? 0, label: d.toLocaleDateString("en-GB") });
  }
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const activeDays = Object.keys(counts).length;

  return (
    <Card className="glass border-averna-neon/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-neon">
            <Flame className="h-5 w-5" /> Activity (last 12 weeks)
          </span>
          <span className="text-sm font-normal text-gray-400">{activeDays} active days</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((c) => (
                <div
                  key={c.key}
                  title={`${c.label}: ${c.count} ${c.count === 1 ? "activity" : "activities"}`}
                  className={`h-3.5 w-3.5 rounded-sm ${colorFor(c.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-500">
          <span>Less</span>
          <span className="h-3 w-3 rounded-sm bg-white/5" />
          <span className="h-3 w-3 rounded-sm bg-averna-neon/30" />
          <span className="h-3 w-3 rounded-sm bg-averna-neon/60" />
          <span className="h-3 w-3 rounded-sm bg-averna-neon" />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}
