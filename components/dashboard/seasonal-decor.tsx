"use client";

import { useEffect, useState } from "react";

/** Pick a gentle seasonal emoji set from the current month. */
function seasonEmojis(month: number): string[] {
  if (month === 11 || month <= 1) return ["❄️", "❅", "❆"]; // winter
  if (month >= 2 && month <= 4) return ["🌸", "🌷", "✿"]; // spring
  if (month >= 5 && month <= 7) return ["☀️", "🌿", "✨"]; // summer
  return ["🍂", "🍁", "🌰"]; // autumn
}

/**
 * Subtle seasonal decoration — a few softly falling emojis themed to the time
 * of year. Purely cosmetic, click-through, respects reduced-motion, and can be
 * switched off in the comfort settings.
 */
export function SeasonalDecor() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const compute = () => {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const pref = localStorage.getItem("averna_seasonal");
      setOn(!reduce && pref !== "0");
    };
    compute();
    window.addEventListener("averna-seasonal", compute);
    return () => window.removeEventListener("averna-seasonal", compute);
  }, []);

  if (!on) return null;

  const emojis = seasonEmojis(new Date().getMonth());
  const flakes = Array.from({ length: 14 });

  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" aria-hidden>
      {flakes.map((_, i) => {
        const left = Math.round((i / flakes.length) * 100 + (Math.random() * 6 - 3));
        const duration = 9 + Math.random() * 8;
        const delay = Math.random() * 10;
        const size = 12 + Math.random() * 14;
        const emoji = emojis[i % emojis.length];
        return (
          <span
            key={i}
            className="seasonal-flake"
            style={{
              left: `${left}%`,
              fontSize: `${size}px`,
              animationDuration: `${duration}s`,
              animationDelay: `-${delay}s`,
              opacity: 0.5,
            }}
          >
            {emoji}
          </span>
        );
      })}
    </div>
  );
}
