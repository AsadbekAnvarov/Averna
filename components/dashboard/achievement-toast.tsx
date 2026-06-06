"use client";

import { useState, useEffect } from "react";
import { Confetti } from "@/components/confetti";
import { X, Award } from "lucide-react";

interface AchievementItem {
  id: string;
  name: string;
  icon: string;
  points: number;
}

const KEY = "averna_celebrated_achievements";

export function AchievementToast({ achievements }: { achievements: AchievementItem[] }) {
  const [item, setItem] = useState<AchievementItem | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (achievements.length === 0) return;

    let seen: string[] = [];
    let firstRun = false;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) firstRun = true;
      else seen = JSON.parse(raw);
    } catch {}

    const currentIds = achievements.map((a) => a.id);

    // First time ever: set a baseline so existing badges don't all pop.
    if (firstRun) {
      try {
        localStorage.setItem(KEY, JSON.stringify(currentIds));
      } catch {}
      return;
    }

    // achievements are newest-first → first unseen is the newest new unlock
    const fresh = achievements.find((a) => !seen.includes(a.id));
    if (fresh) {
      setItem(fresh);
      setShow(true);
      try {
        localStorage.setItem(KEY, JSON.stringify(Array.from(new Set([...seen, ...currentIds]))));
      } catch {}
      const t = setTimeout(() => setShow(false), 7000);
      return () => clearTimeout(t);
    }
  }, [achievements]);

  if (!show || !item) return null;

  return (
    <>
      <Confetti />
      <div className="fixed inset-x-0 top-4 z-[60] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto relative max-w-md w-full rounded-2xl glass-strong border border-averna-purple/40 shadow-[0_0_30px_rgba(168,85,247,0.4)] p-4 animate-fade-in">
          <button
            onClick={() => setShow(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-averna-purple via-averna-pink to-averna-cyan flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                {item.icon || <Award className="h-6 w-6 text-white" />}
              </div>
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-averna-purple animate-ping" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase font-bold tracking-wide text-averna-purple">Achievement unlocked!</p>
              <p className="text-lg font-bold text-white truncate">{item.name}</p>
              {item.points > 0 && <p className="text-sm text-averna-neon">+{item.points} points</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
