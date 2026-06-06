"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, Flame, Star } from "lucide-react";
import { getLevelInfo } from "@/lib/utils";
import Link from "next/link";

const QUOTES = [
  "Success is the sum of small efforts repeated every day.",
  "Your future IELTS score depends on today's effort.",
  "Every word you learn is a step closer to your dream.",
  "Don't study hard — study smart, and study daily.",
  "Fluency is built one sentence at a time.",
  "Mistakes are proof that you are trying. Keep going!",
  "The expert in anything was once a beginner.",
  "A little progress each day adds up to big results.",
  "Believe you can, and you're halfway there.",
  "Push yourself, because no one else is going to do it for you.",
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface MotivationBannerProps {
  name: string | null;
  points: number;
  streak: number;
}

export function MotivationBanner({ name, points, streak }: MotivationBannerProps) {
  const [visible, setVisible] = useState(true);
  const [quote, setQuote] = useState(QUOTES[0]);
  const { level, title, next, into } = getLevelInfo(points);

  useEffect(() => {
    // Pick a fresh motivational quote each time the dashboard loads
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl glass-strong border border-averna-neon/30 p-6 animate-fade-in">
      {/* glow accents */}
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-averna-cyan/20 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-averna-purple/20 blur-3xl" />

      <button
        onClick={() => setVisible(false)}
        className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative">
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          {greeting()},{" "}
          <span className="neon-text-cyan">{name ?? "learner"}</span>! 👋
        </h2>

        <p className="mt-2 text-gray-200 italic flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-averna-pink shrink-0 mt-0.5" />
          &ldquo;{quote}&rdquo;
        </p>

        {/* Level + streak row */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/levels"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-averna-purple/20 border border-averna-purple/40 text-averna-purple text-sm font-semibold hover:bg-averna-purple/30 transition-colors"
            >
              <Star className="h-4 w-4" />
              Level {level} · {title}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-300 text-sm font-semibold">
              <Flame className="h-4 w-4" />
              {streak}-day streak
            </span>
          </div>
        </div>

        {/* Level progress */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{points} pts</span>
            <span>{Math.max(0, next - points)} pts to Level {level + 1}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-averna-neon via-averna-cyan to-averna-purple transition-all duration-700"
              style={{ width: `${into}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
