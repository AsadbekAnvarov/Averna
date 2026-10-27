"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Who = "none" | "me" | "ai";

const SPEAKING = 0.12;

/**
 * The calm audio-reactive ring in the middle of a live call. It reads the mic and
 * partner levels in an animation frame and moves only `transform` (no re-render per
 * frame). With reduced motion it stays still and only the label changes.
 */
export function LiveOrb({ levels, active, muted }: { levels: () => { local: number; remote: number }; active: boolean; muted: boolean }) {
  const ring = useRef<HTMLDivElement>(null);
  const [who, setWho] = useState<Who>("none");

  useEffect(() => {
    if (!active) {
      setWho("none");
      return;
    }
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let shown: Who = "none";
    let smooth = 0;
    let lastLabel = 0;
    const loop = (t: number) => {
      const { local, remote } = levels();
      const level = Math.max(local, remote);
      smooth = smooth * 0.8 + level * 0.2;
      if (!reduce && ring.current) ring.current.style.transform = `scale(${(1 + Math.min(1, smooth) * 0.22).toFixed(3)})`;
      // The label changes at most ~3 times a second.
      if (t - lastLabel > 300) {
        lastLabel = t;
        const next: Who = remote >= SPEAKING && remote >= local ? "ai" : local >= SPEAKING ? "me" : "none";
        if (next !== shown) {
          shown = next;
          setWho(next);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, levels]);

  const label = !active ? "Connecting…" : muted ? "You're muted" : who === "ai" ? "Your partner is speaking" : who === "me" ? "Listening to you" : "Your turn — take your time";

  return (
    <div className="flex flex-col items-center gap-4" aria-hidden="true">
      <div className="relative grid h-44 w-44 place-items-center sm:h-56 sm:w-56">
        <div
          ref={ring}
          className={cn(
            "absolute inset-0 rounded-full border-2 transition-colors duration-500 will-change-transform motion-reduce:transition-none",
            who === "ai" ? "border-averna-cyan/70 bg-averna-cyan/10" : who === "me" ? "border-averna-neon/70 bg-averna-neon/10" : "border-white/20 bg-white/5",
          )}
        />
        <div
          className={cn(
            "h-24 w-24 rounded-full transition-colors duration-500 motion-reduce:transition-none sm:h-32 sm:w-32",
            who === "ai" ? "bg-averna-cyan/30" : who === "me" ? "bg-averna-neon/30" : "bg-averna-primary/25",
          )}
        />
      </div>
      <p className="text-center text-sm font-medium text-gray-300">{label}</p>
    </div>
  );
}
