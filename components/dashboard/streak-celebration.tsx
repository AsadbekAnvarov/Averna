"use client";

import { useState, useEffect } from "react";
import { Confetti } from "@/components/confetti";
import { Flame, X } from "lucide-react";

const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

const MESSAGES: Record<number, { title: string; sub: string }> = {
  3: { title: "3-day streak!", sub: "A habit is forming — keep it up!" },
  7: { title: "One week streak!", sub: "You're on fire. Seven days strong! 🔥" },
  14: { title: "Two weeks!", sub: "Incredible consistency — your English is growing fast." },
  30: { title: "30-day streak!", sub: "A whole month! You're unstoppable. 🏆" },
  50: { title: "50 days!", sub: "Elite dedication. Most learners never get here." },
  100: { title: "100-day streak!", sub: "Legendary. You've built a life-changing habit. 👑" },
  200: { title: "200 days!", sub: "Phenomenal commitment. Truly inspiring!" },
  365: { title: "One full year!", sub: "365 days. You are an absolute legend. 🌟" },
};

export function StreakCelebration({ currentStreak }: { currentStreak: number }) {
  const [milestone, setMilestone] = useState<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const reached = MILESTONES.filter((m) => currentStreak >= m);
    if (reached.length === 0) return;
    const highest = reached[reached.length - 1];

    let celebrated = 0;
    try {
      celebrated = parseInt(localStorage.getItem("averna_streak_celebrated") || "0", 10) || 0;
    } catch {}

    if (highest > celebrated) {
      setMilestone(highest);
      setShow(true);
      try {
        localStorage.setItem("averna_streak_celebrated", String(highest));
      } catch {}
      const t = setTimeout(() => setShow(false), 7000);
      return () => clearTimeout(t);
    }
  }, [currentStreak]);

  if (!show || milestone === null) return null;

  const msg = MESSAGES[milestone] ?? { title: `${milestone}-day streak!`, sub: "Amazing consistency!" };

  return (
    <>
      <Confetti />
      <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto relative max-w-md w-full rounded-2xl glass-strong border border-orange-500/40 shadow-[0_0_30px_rgba(251,146,60,0.4)] p-4 animate-fade-in">
          <button
            onClick={() => setShow(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 via-amber-400 to-yellow-400 flex items-center justify-center shadow-[0_0_20px_rgba(251,146,60,0.5)]">
                <Flame className="h-6 w-6 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-400 animate-ping" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white">
                🔥 {msg.title}
              </p>
              <p className="text-sm text-gray-300">{msg.sub}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
