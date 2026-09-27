"use client";

import { useEffect, useState } from "react";

/**
 * Subtle XP count-up + level-bar fill. Purposeful motion only: a single 900ms
 * ease, skipped entirely for users who prefer reduced motion.
 */
export function XpGain({
  xp,
  fromPercent,
  toPercent,
  levelUp,
  levelLabel,
}: {
  xp: number;
  fromPercent: number;
  toPercent: number;
  levelUp: boolean;
  levelLabel: string;
}) {
  const [shown, setShown] = useState(0);
  const [bar, setBar] = useState(levelUp ? 0 : fromPercent);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || xp <= 0) {
      setShown(xp);
      setBar(toPercent);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(xp * e));
      setBar((levelUp ? 0 : fromPercent) + (toPercent - (levelUp ? 0 : fromPercent)) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [xp, fromPercent, toPercent, levelUp]);

  return (
    <div>
      <p className="text-3xl font-bold text-averna-neon" aria-live="polite">
        +{shown} <span className="text-base font-semibold">XP</span>
      </p>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-gray-400">
          <span>{levelUp ? `Level up — ${levelLabel}` : levelLabel}</span>
          <span>{Math.round(toPercent)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progress to next level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(toPercent)}
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div className="h-full rounded-full bg-averna-neon" style={{ width: `${bar}%` }} />
        </div>
      </div>
    </div>
  );
}
