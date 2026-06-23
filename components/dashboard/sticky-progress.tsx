"use client";

import { useEffect, useState } from "react";
import { Target } from "lucide-react";

/**
 * A slim progress bar that slides in from the top once the user scrolls down,
 * keeping their band goal in view at all times. Purely informational, hidden
 * at the top of the page so it never crowds the header.
 */
export function StickyProgress({ current, target }: { current: number; target: number | null }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 380);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!target || current <= 0) return null;

  const pct = Math.min(100, Math.round((current / target) * 100));
  const reached = current >= target;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-40 transition-transform duration-300 ${show ? "translate-y-0" : "-translate-y-full"}`}
    >
      <div className="glass-strong border-b border-averna-cyan/20">
        <div className="container mx-auto max-w-7xl px-4 py-2 flex items-center gap-3">
          <span className="text-xs text-gray-300 flex items-center gap-1.5 shrink-0">
            <Target className="h-3.5 w-3.5 text-averna-cyan" />
            Band <span className="font-bold text-white">{current.toFixed(1)}</span>
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-averna-cyan to-averna-neon"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs shrink-0 text-gray-300">
            {reached ? "🎉 goal reached" : <>goal <span className="font-bold text-averna-neon">{target.toFixed(1)}</span></>}
          </span>
        </div>
      </div>
    </div>
  );
}
