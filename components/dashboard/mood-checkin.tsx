"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Swords, Zap, Ghost, Lock, ArrowRight } from "lucide-react";

type Rec = { tab: "learn" | "fun"; where: string; activity: string; icon: typeof Swords; reason: string };

const MOODS: { emoji: string; label: string; msg: string; rec: Rec }[] = [
  {
    emoji: "😄",
    label: "Great",
    msg: "Love that energy — let's make today count! 🚀",
    rec: { tab: "fun", where: "Rewards", activity: "Boss Battle", icon: Swords, reason: "Channel that energy into a boss fight." },
  },
  {
    emoji: "🙂",
    label: "Good",
    msg: "Nice! A steady session will keep the momentum going.",
    rec: { tab: "fun", where: "Rewards", activity: "Word Duel", icon: Swords, reason: "Grab today's daily win — beat your ghost." },
  },
  {
    emoji: "😐",
    label: "Okay",
    msg: "That's fine — start with one small task and build up.",
    rec: { tab: "learn", where: "Learn", activity: "60-Second Warm-Up", icon: Zap, reason: "Just start small — one tap gets you going." },
  },
  {
    emoji: "😟",
    label: "Tired",
    msg: "Take it easy. Even 10 focused minutes is a win today.",
    rec: { tab: "fun", where: "Rewards", activity: "Ghost Race", icon: Ghost, reason: "Light, fast and fun — very low effort." },
  },
  {
    emoji: "😣",
    label: "Stressed",
    msg: "Breathe. One calm, focused block will settle your mind.",
    rec: { tab: "learn", where: "Learn", activity: "Focus Vault (10 min)", icon: Lock, reason: "A single distraction-free block to reset." },
  },
];

function todayKey() {
  return `averna_mood_${new Date().toISOString().slice(0, 10)}`;
}

/**
 * A gentle daily mood check-in that turns feeling into action: it stores the
 * choice per day (locally), shows an encouraging message, and recommends a
 * concrete activity matched to the mood, with a one-tap jump to the right tab.
 */
export function MoodCheckin() {
  const [picked, setPicked] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(todayKey());
    if (saved !== null) setPicked(parseInt(saved, 10));
    setLoaded(true);
  }, []);

  const choose = (i: number) => {
    setPicked(i);
    localStorage.setItem(todayKey(), String(i));
  };

  const goTo = (tab: string) => {
    window.dispatchEvent(new CustomEvent("averna-goto-tab", { detail: tab }));
  };

  if (!loaded) return null;

  return (
    <Card className="glass border-averna-purple/30">
      <CardContent className="p-5">
        {picked === null ? (
          <>
            <p className="text-sm font-semibold text-white mb-3">How are you feeling today?</p>
            <div className="flex items-center justify-between gap-1">
              {MOODS.map((m, i) => (
                <button
                  key={m.label}
                  onClick={() => choose(i)}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/5 transition-colors flex-1"
                  title={m.label}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-gray-400">{m.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{MOODS[picked].emoji}</span>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium">{MOODS[picked].msg}</p>
                <button
                  onClick={() => {
                    localStorage.removeItem(todayKey());
                    setPicked(null);
                  }}
                  className="text-[11px] text-averna-purple hover:underline mt-0.5"
                >
                  Change
                </button>
              </div>
            </div>

            {(() => {
              const rec = MOODS[picked].rec;
              const RecIcon = rec.icon;
              return (
                <button
                  onClick={() => goTo(rec.tab)}
                  className="w-full flex items-center gap-3 rounded-xl border border-averna-purple/30 bg-averna-purple/10 hover:bg-averna-purple/20 px-3 py-2.5 text-left transition-colors"
                >
                  <RecIcon className="h-5 w-5 text-averna-purple shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      Try: {rec.activity}
                    </p>
                    <p className="text-[11px] text-gray-400">{rec.reason}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-averna-purple shrink-0">
                    {rec.where} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              );
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
