"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A slow, dark-green aurora for hero areas — decorative only.
 *
 * - CSS keyframes on transform/opacity only; soft radial gradients (no blur
 *   filter), so it runs on the compositor.
 * - pointer-events: none and aria-hidden — never blocks reading or clicks.
 * - Static under prefers-reduced-motion and html[data-gfx="lite"]; paused while
 *   the tab is hidden or the hero is scrolled off screen.
 *
 * Usage: place as the first child of a `relative isolate overflow-hidden`
 * container (e.g. an .av-panel-hero). It sits at z-index -1 inside that
 * stacking context — above the container's background, below its content.
 */
export function Aurora({ className, intensity = "normal" }: { className?: string; intensity?: "soft" | "normal" }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let onScreen = true;
    const sync = () => {
      if (document.hidden || !onScreen) el.setAttribute("data-paused", "");
      else el.removeAttribute("data-paused");
    };
    document.addEventListener("visibilitychange", sync);
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((records) => {
        const last = records[records.length - 1];
        if (last) onScreen = last.isIntersecting;
        sync();
      });
      io.observe(el);
    }
    sync();
    return () => {
      document.removeEventListener("visibilitychange", sync);
      io?.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-intensity={intensity}
      className={cn("av-aurora", className)}
    >
      <span className="av-aurora__blob av-aurora__blob--a" />
      <span className="av-aurora__blob av-aurora__blob--b" />
      <span className="av-aurora__blob av-aurora__blob--c" />
    </div>
  );
}
