import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Trophy } from "lucide-react";

interface Milestone {
  day: number;
  emoji: string;
  name: string;
}

const MILESTONES: Milestone[] = [
  { day: 1, emoji: "🌱", name: "First Step" },
  { day: 3, emoji: "🔥", name: "Momentum" },
  { day: 7, emoji: "⭐", name: "One Week" },
  { day: 14, emoji: "🚀", name: "Fortnight" },
  { day: 30, emoji: "👑", name: "Monthly" },
  { day: 60, emoji: "💎", name: "Unstoppable" },
  { day: 100, emoji: "🏆", name: "Legend" },
];

/**
 * Streak Calendar Story — reframes the study streak as a journey through named
 * "chapters" (First Step → Legend). Reached milestones glow, the current
 * chapter pulses, and a progress trail fills toward the next one. Renders purely
 * from props (server component), turning an abstract number into a story worth
 * continuing.
 */
export function StreakStory({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}) {
  const reachedIdx = MILESTONES.reduce((acc, m, i) => (currentStreak >= m.day ? i : acc), -1);
  const current = reachedIdx >= 0 ? MILESTONES[reachedIdx] : null;
  const next = MILESTONES[reachedIdx + 1] ?? null;
  const daysToNext = next ? next.day - currentStreak : 0;

  // Progress (0..1) between the current milestone and the next one.
  const segFrom = current ? current.day : 0;
  const segTo = next ? next.day : segFrom;
  const segPct = next ? Math.min(100, Math.max(0, ((currentStreak - segFrom) / (segTo - segFrom)) * 100)) : 100;

  return (
    <Card className="glass border-orange-500/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-orange-500/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-orange-400">
          <span className="flex items-center gap-2">
            <Flame className="h-5 w-5" /> Streak Story
          </span>
          {longestStreak > 0 && (
            <span className="flex items-center gap-1 text-xs font-normal text-gray-400">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> Best {longestStreak}d
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Narrative */}
        <div className="flex items-end gap-3">
          <span className="text-4xl font-extrabold text-orange-400 leading-none">{currentStreak}</span>
          <div className="pb-0.5">
            <p className="text-sm text-white font-semibold">
              {currentStreak === 0
                ? "Your story begins today"
                : current
                  ? `Chapter ${reachedIdx + 1}: ${current.emoji} ${current.name}`
                  : "Day one"}
            </p>
            <p className="text-xs text-gray-400">
              {next
                ? `${daysToNext} day${daysToNext === 1 ? "" : "s"} to ${next.emoji} ${next.name}`
                : "You've reached Legend — the summit! 🏆"}
            </p>
          </div>
        </div>

        {/* Journey trail */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="flex items-start min-w-[520px]">
            {MILESTONES.map((m, i) => {
              const reached = currentStreak >= m.day;
              const isCurrent = i === reachedIdx;
              const isNext = i === reachedIdx + 1;
              // connector before this node reflects progress into this node
              const connectorFill = reached ? 100 : i === reachedIdx + 1 ? segPct : 0;
              return (
                <Fragment key={m.day}>
                  {i > 0 && (
                    <div className="flex-1 h-1.5 mt-6 rounded-full bg-white/10 overflow-hidden min-w-[24px]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700"
                        style={{ width: `${connectorFill}%` }}
                      />
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-1 shrink-0 w-16">
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center text-xl border-2 transition-all ${
                        reached
                          ? "border-orange-400 bg-orange-500/20 shadow-[0_0_16px_rgba(249,115,22,0.35)]"
                          : isNext
                            ? "border-orange-400/50 bg-white/5"
                            : "border-white/10 bg-white/5 grayscale opacity-50"
                      } ${isCurrent ? "ring-2 ring-orange-400/60 animate-pulse" : ""}`}
                    >
                      {reached ? m.emoji : isNext ? m.emoji : "🔒"}
                    </div>
                    <span className={`text-[11px] font-semibold ${reached ? "text-orange-300" : "text-gray-500"}`}>
                      {m.day}d
                    </span>
                    <span className={`text-[10px] text-center leading-tight ${reached ? "text-gray-300" : "text-gray-600"}`}>
                      {m.name}
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
