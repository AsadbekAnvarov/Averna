import { Flame, Snowflake } from "lucide-react";
import type { StreakView } from "@/lib/engine/progression/service";
import { STREAK_CONFIG } from "@/lib/engine/progression/config";
import { Panel, PanelTitle } from "./ui";
import { cn } from "@/lib/utils";

const STATUS_COPY: Record<StreakView["status"], string> = {
  done_today: "Today counts. Your streak is safe.",
  at_risk: "Complete one meaningful activity today to keep your streak.",
  freeze_will_save: "You missed a day — a streak freeze will save it if you study today.",
  broken: "Start a new streak today with one real practice session.",
  none: "Finish any test, essay or speaking practice to start a streak.",
};

/** Current streak, weekly rhythm and the next milestone. */
export function StreakWeek({ streak }: { streak: StreakView }) {
  const next = streak.nextMilestone;
  return (
    <Panel labelledBy="streak-title">
      <PanelTitle
        id="streak-title"
        icon={Flame}
        title="Streak"
        hint={`Kept by real learning — logging in doesn't count`}
      />
      <div className="flex items-end gap-4">
        <div>
          <p className="text-4xl font-bold leading-none text-white">
            {streak.current}
            <span className="ml-1 text-base font-medium text-gray-400">day{streak.current === 1 ? "" : "s"}</span>
          </p>
          <p className="mt-1 text-xs text-gray-400">Longest: {streak.longest} days</p>
        </div>
        {streak.freezes > 0 && (
          <p className="ml-auto inline-flex items-center gap-1 rounded-full border border-averna-cyan/30 bg-averna-cyan/10 px-2.5 py-1 text-xs text-averna-cyan" title="A freeze saves your streak if you miss one day">
            <Snowflake className="h-3.5 w-3.5" aria-hidden /> {streak.freezes} freeze{streak.freezes === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <ul className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Last 7 days">
        {streak.week.map((d) => (
          <li key={d.dayKey} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "flex h-9 w-full max-w-[40px] items-center justify-center rounded-lg border text-xs",
                d.studied
                  ? "border-averna-neon/40 bg-averna-neon/20 text-averna-neon"
                  : "border-white/10 bg-white/[0.03] text-gray-500",
                d.isToday && "ring-1 ring-averna-neon/60"
              )}
              aria-label={`${d.dayKey}${d.isToday ? " (today)" : ""}: ${d.studied ? "studied" : "no study"}`}
            >
              {d.studied ? "✓" : ""}
            </span>
            <span className={cn("text-[10px]", d.isToday ? "text-white" : "text-gray-500")}>{d.label}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-gray-300">{STATUS_COPY[streak.status]}</p>
      {next && (
        <p className="mt-1 text-xs text-gray-400">
          Next milestone: {next} days ({next - streak.current} to go). A new freeze every {STREAK_CONFIG.freezeEvery} days.
        </p>
      )}
    </Panel>
  );
}
