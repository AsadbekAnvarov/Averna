"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Minus, Plus } from "lucide-react";

const MIN_GOAL = 1;
const MAX_GOAL = 21;

/**
 * Weekly study goal ring. The student sets a personal weekly session target
 * (stored locally); `completed` is how many activities they've done since
 * Monday 00:00 Tashkent (weeks run Monday–Sunday).
 * A clear, achievable goal is one of the most comforting motivators.
 */
export function WeeklyGoal({ completed }: { completed: number }) {
  const [target, setTarget] = useState(5);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem("averna_weekly_goal") ?? "", 10);
    if (!Number.isNaN(saved) && saved > 0) setTarget(Math.max(MIN_GOAL, Math.min(MAX_GOAL, saved)));
    setLoaded(true);
  }, []);

  const setAndSave = (v: number) => {
    const clamped = Math.max(MIN_GOAL, Math.min(MAX_GOAL, v));
    setTarget(clamped);
    localStorage.setItem("averna_weekly_goal", String(clamped));
  };

  // Empty ring until the saved target is known, so it doesn't jump from the default.
  const pct = loaded ? Math.min(100, Math.round((completed / target) * 100)) : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const reached = completed >= target;

  return (
    <Card className="glass border-averna-neon/30">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28 shrink-0">
            <svg width={112} height={112} viewBox="0 0 112 112" className="-rotate-90">
              <circle cx={56} cy={56} r={r} fill="none" className="stroke-white/[0.08]" strokeWidth={9} />
              <circle
                cx={56}
                cy={56}
                r={r}
                fill="none"
                stroke={reached ? "#00ff94" : "#00e5ff"}
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white leading-none">{completed}</span>
              {/* Until the saved target is read, show a dash instead of flashing the default. */}
              <span className="text-[11px] text-gray-400">of {loaded ? target : "–"}</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-averna-neon" aria-hidden /> Weekly study goal
            </p>
            <p className="font-bold text-white mt-0.5" aria-live="polite">
              {!loaded
                ? "\u00a0"
                : reached
                  ? "🎉 Goal smashed!"
                  : `${target - completed} session${target - completed === 1 ? "" : "s"} to go`}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Activities since Monday</p>

            {loaded && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-400">Target</span>
                <button
                  type="button"
                  onClick={() => setAndSave(target - 1)}
                  disabled={target <= MIN_GOAL}
                  className="h-10 w-10 sm:h-8 sm:w-8 rounded-md border border-white/10 bg-white/5 text-gray-300 hover:text-white flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Decrease goal"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <span className="text-sm font-semibold text-white w-5 text-center">{target}</span>
                <button
                  type="button"
                  onClick={() => setAndSave(target + 1)}
                  disabled={target >= MAX_GOAL}
                  className="h-10 w-10 sm:h-8 sm:w-8 rounded-md border border-white/10 bg-white/5 text-gray-300 hover:text-white flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Increase goal"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
