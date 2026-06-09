"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";

/** Light, cosmetic daily rewards — a fun once-a-day pick-me-up. */
const REWARDS = [
  { emoji: "🍀", text: "Lucky day! Trust your first instinct in tests." },
  { emoji: "🔥", text: "You're on fire — keep that streak alive!" },
  { emoji: "⭐", text: "Star energy: aim for one new word today." },
  { emoji: "🎯", text: "Laser focus unlocked — try a 25-min sprint." },
  { emoji: "📚", text: "Bookworm bonus: read today's article!" },
  { emoji: "🚀", text: "Lift-off! Tackle your hardest skill first." },
  { emoji: "🎁", text: "Surprise: do a Brain Break game for fun." },
  { emoji: "💎", text: "Rare gem: review your past mistakes today." },
];

function todayKey() {
  return `averna_spin_${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Daily Spin — a playful "wheel of the day". One spin per day (stored locally)
 * reveals a fun motivational boost with a confetti celebration.
 */
export function DailySpin() {
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(todayKey());
    if (saved !== null) {
      const idx = parseInt(saved, 10);
      setResult(idx);
      setRotation(-(idx * (360 / REWARDS.length)));
    }
    setLoaded(true);
  }, []);

  const spin = () => {
    if (spinning || result !== null) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * REWARDS.length);
    const seg = 360 / REWARDS.length;
    const target = 360 * 5 - idx * seg; // several full turns then land on idx
    setRotation(target);
    setTimeout(() => {
      setResult(idx);
      setSpinning(false);
      localStorage.setItem(todayKey(), String(idx));
      fireConfetti();
    }, 3200);
  };

  if (!loaded) return null;

  const seg = 360 / REWARDS.length;

  return (
    <Card className="glass border-averna-neon/30">
      <CardContent className="p-5 text-center">
        <p className="text-sm font-semibold text-white flex items-center justify-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-averna-neon" /> Daily Spin
        </p>

        <div className="relative mx-auto h-40 w-40">
          {/* pointer */}
          <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 text-averna-neon text-xl">▼</div>
          <div
            className="h-40 w-40 rounded-full border-4 border-white/10"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 3.1s cubic-bezier(0.17,0.67,0.17,0.98)" : "none",
              background: `conic-gradient(${REWARDS.map((_, i) => {
                const c = ["#0B8F6A33", "#00e5ff33", "#b14eff33", "#ff3dbb33"][i % 4];
                return `${c} ${i * seg}deg ${(i + 1) * seg}deg`;
              }).join(",")})`,
            }}
          >
            {REWARDS.map((r, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 text-lg"
                style={{ transform: `rotate(${i * seg + seg / 2}deg) translateY(-58px) translateX(-50%)` }}
              >
                {r.emoji}
              </span>
            ))}
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-averna-dark border-2 border-averna-neon/40 flex items-center justify-center text-averna-neon text-xs font-bold">
            {REWARDS.length}x
          </div>
        </div>

        {result !== null ? (
          <div className="mt-4">
            <p className="text-2xl">{REWARDS[result].emoji}</p>
            <p className="text-sm text-white mt-1">{REWARDS[result].text}</p>
            <p className="text-[11px] text-gray-500 mt-2">Come back tomorrow for another spin!</p>
          </div>
        ) : (
          <button
            onClick={spin}
            disabled={spinning}
            className="mt-4 px-5 py-2 rounded-lg bg-averna-primary/80 hover:bg-averna-primary text-white text-sm font-medium disabled:opacity-60"
          >
            {spinning ? "Spinning…" : "Spin!"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
