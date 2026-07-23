"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Flame, Star, GraduationCap } from "lucide-react";

const START_BAND = 4.0;

const STAGES = [
  { name: "Beginner", emoji: "🌱", aura: "from-slate-500/20 to-slate-500/5", ring: "#94a3b8" },
  { name: "Rising", emoji: "🙂", aura: "from-averna-cyan/20 to-averna-cyan/5", ring: "#22d3ee" },
  { name: "Confident", emoji: "😎", aura: "from-averna-purple/25 to-averna-purple/5", ring: "#a78bfa" },
  { name: "Advanced", emoji: "🚀", aura: "from-averna-pink/25 to-averna-pink/5", ring: "#f472b6" },
  { name: "Goal reached", emoji: "🎓", aura: "from-averna-neon/30 to-averna-neon/5", ring: "#00ff94" },
];

/**
 * F7 — Future Self. An evolving self that grows more confident as the student's
 * band climbs toward their target. The avatar, aura and stage change with real
 * progress; at the goal a certificate appears. Client component (mount
 * animation); current band computed server-side.
 */
export function FutureSelf({
  current,
  target,
  points,
  streak,
}: {
  current: number | null;
  target: number | null;
  points: number;
  streak: number;
}) {
  const goal = target ?? 7.0;
  const cur = current ?? START_BAND;
  const rawProgress = Math.max(0, Math.min(1, (cur - START_BAND) / Math.max(0.5, goal - START_BAND)));
  const reached = current != null && cur >= goal;
  const stageIndex = reached ? 4 : Math.min(3, Math.floor(rawProgress * 4));
  const stage = STAGES[stageIndex];

  const [fill, setFill] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setFill(rawProgress), 120);
    return () => clearTimeout(t);
  }, [rawProgress]);

  // progress ring geometry
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <Card className="glass border-averna-purple/30 relative overflow-hidden">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${stage.aura} transition-all duration-1000`} />
      <CardContent className="py-6 relative">
        <div className="flex items-center gap-5">
          {/* Evolving avatar + ring */}
          <div className="relative shrink-0">
            <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
              <circle cx="56" cy="56" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle
                cx="56"
                cy="56"
                r={R}
                fill="none"
                stroke={stage.ring}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - fill)}
                style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-4xl select-none"
              style={{ filter: `drop-shadow(0 0 12px ${stage.ring}66)` }}
            >
              {stage.emoji}
            </span>
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-averna-purple flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Your Future Self
            </p>
            <p className="text-xl font-bold text-white mt-0.5">{stage.name}</p>

            <p className="text-sm text-gray-300 mt-1">
              {current == null ? (
                <>Take a test to reveal your future self on the road to Band {goal.toFixed(1)}.</>
              ) : reached ? (
                <>You reached your dream Band {goal.toFixed(1)}. This is the future you built. 🎉</>
              ) : (
                <>
                  Now at Band <span className="text-white font-semibold">{cur.toFixed(1)}</span> · dream Band{" "}
                  <span className="text-averna-neon font-semibold">{goal.toFixed(1)}</span> —{" "}
                  {(goal - cur).toFixed(1)} to go.
                </>
              )}
            </p>

            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-400" /> {points.toLocaleString()} XP
              </span>
              <span className="flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-orange-400" /> {streak}-day streak
              </span>
            </div>
          </div>
        </div>

        {/* Stage track */}
        <div className="mt-4 flex items-center justify-between">
          {STAGES.map((s, i) => (
            <div key={s.name} className="flex flex-col items-center gap-1 flex-1">
              <span
                className={`text-lg transition-all ${i <= stageIndex ? "opacity-100" : "opacity-30 grayscale"}`}
                style={i === stageIndex ? { filter: `drop-shadow(0 0 8px ${s.ring})` } : undefined}
              >
                {s.emoji}
              </span>
              <span className={`text-[9px] ${i <= stageIndex ? "text-gray-300" : "text-gray-600"}`}>{s.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>

        {/* Certificate at goal */}
        {reached && (
          <div className="mt-4 rounded-xl border border-averna-neon/40 bg-averna-neon/5 p-3 flex items-center gap-3">
            <GraduationCap className="h-6 w-6 text-averna-neon shrink-0" />
            <div>
              <p className="text-sm font-semibold text-averna-neon">Certificate unlocked</p>
              <p className="text-[11px] text-gray-400">IELTS Band {goal.toFixed(1)} — dream achieved. Keep it shining!</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
