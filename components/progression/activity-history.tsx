import Link from "next/link";
import { History } from "lucide-react";
import { getActivityHistory } from "@/lib/engine/progression/service";
import { Panel, PanelTitle } from "./ui";

/** Recent meaningful activity, grouped by day, with the XP each earned. */
export async function ActivityHistory({ studentId, days = 7 }: { studentId: string; days?: number }) {
  const history = await getActivityHistory(studentId, days).catch(() => []);
  const shown = history.slice(0, 3);
  return (
    <Panel labelledBy="history-title">
      <PanelTitle id="history-title" icon={History} title="Recent activity" hint={`Last ${days} days`} />
      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-gray-400">
          Nothing here yet.{" "}
          <Link href="/learning" className="font-medium text-averna-neon hover:underline">
            Start your first activity
          </Link>{" "}
          and your results will appear here.
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((day) => (
            <div key={day.dayKey}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{day.label}</p>
                {day.xp > 0 && <p className="text-xs text-averna-neon">+{day.xp} XP</p>}
              </div>
              <ul className="divide-y divide-white/5 rounded-xl bg-white/[0.02]">
                {day.items.slice(0, 5).map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{it.title}</p>
                      {it.detail && <p className="text-xs text-gray-400">{it.detail}</p>}
                    </div>
                    <span className={`shrink-0 text-sm font-semibold ${it.xp > 0 ? "text-averna-neon" : it.xp < 0 ? "text-gray-400" : "text-gray-500"}`}>
                      {it.xp > 0 ? `+${it.xp}` : it.xp < 0 ? it.xp : "0"} XP
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
