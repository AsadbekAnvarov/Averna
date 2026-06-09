"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

const MOODS = [
  { emoji: "😄", label: "Great", msg: "Love that energy — let's make today count! 🚀" },
  { emoji: "🙂", label: "Good", msg: "Nice! A steady session will keep the momentum going." },
  { emoji: "😐", label: "Okay", msg: "That's fine — start with one small task and build up." },
  { emoji: "😟", label: "Tired", msg: "Take it easy. Even 10 focused minutes is a win today." },
  { emoji: "😣", label: "Stressed", msg: "Breathe. Try a short Brain Break, then one tiny step." },
];

function todayKey() {
  return `averna_mood_${new Date().toISOString().slice(0, 10)}`;
}

/**
 * A gentle daily mood check-in. Stores the choice per day (locally) and shows
 * an encouraging, mood-tailored message — a small touch of care.
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
          <div className="flex items-center gap-3">
            <span className="text-3xl">{MOODS[picked].emoji}</span>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">{MOODS[picked].msg}</p>
              <button onClick={() => { localStorage.removeItem(todayKey()); setPicked(null); }} className="text-[11px] text-averna-purple hover:underline mt-0.5">
                Change
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
