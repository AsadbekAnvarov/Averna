"use client";

import { useEffect, useState } from "react";
import { getLevelInfo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

const STORAGE_KEY = "averna_seen_level";

// Pre-computed confetti pieces (module scope → stable across renders).
const CONFETTI_COLORS = ["#00ff94", "#00e5ff", "#b14eff", "#ff3dbb", "#ffd23d"];
const CONFETTI = Array.from({ length: 44 }, (_, i) => ({
  left: Math.round(Math.random() * 100),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: +(Math.random() * 0.6).toFixed(2),
  dur: +(2.4 + Math.random() * 1.8).toFixed(2),
}));

/** A short, pleasant rising arpeggio synthesised with the Web Audio API
 *  (no audio asset needed). Best-effort — silently no-ops if blocked. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.34);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    /* audio unavailable — ignore */
  }
}

/**
 * Shows a one-time celebration whenever the learner's level increases since
 * they last saw it. Purely client-side: compares the current level (derived
 * from points) against a value persisted in localStorage. New/first-time
 * visitors just get a silent baseline so we never celebrate spuriously.
 */
export function LevelUpCelebration({ points }: { points: number }) {
  const info = getLevelInfo(points);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const seen = raw == null ? null : parseInt(raw, 10);
      if (seen == null || Number.isNaN(seen)) {
        // First time tracking on this device — set baseline, don't celebrate.
        localStorage.setItem(STORAGE_KEY, String(info.level));
        return;
      }
      if (info.level > seen) setShow(true);
    } catch {
      /* localStorage unavailable — silently skip */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Celebrate with a gentle chime + haptic tap when the modal appears.
  useEffect(() => {
    if (!show) return;
    try {
      navigator.vibrate?.([35, 55, 110]);
    } catch {
      /* haptics unsupported */
    }
    playChime();
  }, [show]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(info.level));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Level up"
      onClick={dismiss}
    >
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${c.left}%`,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
            }}
          />
        ))}
      </div>

      <div
        className="glass-vibrant relative rounded-3xl px-8 py-10 max-w-sm w-full text-center animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-xs uppercase tracking-[0.25em] text-averna-neon mb-3">Level Up!</p>

        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full glow-ring bg-averna-primary/20 animate-float">
          <span className="text-4xl font-extrabold text-gradient">{info.level}</span>
        </div>

        <h2 className="text-2xl font-bold text-white leading-tight">
          You reached <span className="text-gradient">{info.title}</span>
        </h2>
        <p className="text-sm text-gray-400 mt-2">
          {info.isMax
            ? "You've hit the very top — legendary! 🏆"
            : `Keep going — Level ${info.level + 1} awaits.`}
        </p>

        <Button onClick={dismiss} className="neon-button bg-averna-primary hover:bg-averna-light mt-6 w-full">
          <Sparkles className="mr-2 h-4 w-4" /> Continue
        </Button>
      </div>
    </div>
  );
}
