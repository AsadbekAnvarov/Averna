import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { db } from "@/lib/db";
import { BUDGETED_ACTIONS } from "@/lib/engine/xp-engine";
import { buildHeatmap, heatmapCellTitle, heatmapRange, heatmapSummary, type HeatmapCell } from "@/lib/dashboard/heatmap";

// Class names stay in this file: lib/ is outside Tailwind's content scan.
const LEVEL_CLASS = ["bg-white/5", "bg-averna-neon/30", "bg-averna-neon/60", "bg-averna-neon"] as const;
// Rows are Mon..Sun; only every other weekday is labelled to keep the column narrow.
const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function cellClass(c: HeatmapCell): string {
  const fill = c.future ? "bg-transparent" : LEVEL_CLASS[c.level];
  return `aspect-square rounded-[3px] ${fill}${c.today ? " ring-1 ring-averna-cyan/70" : ""}`;
}

/** Study activity per Tashkent day for the last 12 Monday–Sunday weeks. */
export async function StreakHeatmap({ studentId }: { studentId: string }) {
  const now = new Date();
  const { from } = heatmapRange(now);

  let logs: { createdAt: Date }[] = [];
  try {
    // Real study only — the same filter the rest of the dashboard counts.
    logs = await db.activityLog.findMany({
      where: { studentId, createdAt: { gte: from }, action: { in: BUDGETED_ACTIONS }, points: { gt: 0 } },
      select: { createdAt: true },
    });
  } catch {
    logs = [];
  }

  const { weeks, activeDays, total } = buildHeatmap(
    logs.map((l) => new Date(l.createdAt)),
    now,
  );

  return (
    <Card className="glass border-averna-neon/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-averna-neon">
            <Flame className="h-5 w-5" /> Study activity (last 12 weeks)
          </span>
          <span className="shrink-0 text-sm font-normal text-gray-400">
            {activeDays} active {activeDays === 1 ? "day" : "days"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Grid + legend share one centred, capped column: full width on phones,
            compact and centred on wide cards (legend stays aligned to the grid's left edge). */}
        <div className="mx-auto w-full max-w-[34rem]">
          <div
            role="img"
            aria-label={heatmapSummary(activeDays, total)}
            className="grid w-full grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1"
          >
            {ROW_LABELS.map((label, row) => [
              <span
                key={`label-${row}`}
                aria-hidden="true"
                className="flex items-center pr-1 text-[10px] leading-none text-gray-500"
              >
                {label}
              </span>,
              ...weeks.map((week) => {
                const c = week[row];
                return (
                  <div
                    key={c.key}
                    aria-hidden="true"
                    title={c.future ? undefined : heatmapCellTitle(c)}
                    className={cellClass(c)}
                  />
                );
              }),
            ])}
          </div>
          <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-500">
            <span>Less</span>
            <span className="h-3 w-3 rounded-sm bg-white/5" />
            <span className="h-3 w-3 rounded-sm bg-averna-neon/30" />
            <span className="h-3 w-3 rounded-sm bg-averna-neon/60" />
            <span className="h-3 w-3 rounded-sm bg-averna-neon" />
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
