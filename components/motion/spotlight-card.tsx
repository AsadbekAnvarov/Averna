"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { motionDisabled } from "./gfx-tier";

type SpotlightTag = "div" | "article" | "section" | "li";

export interface SpotlightCardProps {
  as?: SpotlightTag;
  /** Put the card surface classes here (e.g. "av-panel glow-hover rounded-2xl p-5"). */
  className?: string;
  id?: string;
  role?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: React.ReactNode;
}

/**
 * Card wrapper with a gentle green glow that follows the mouse.
 *
 * Desktop fine pointers only: no listeners are attached on touch / coarse
 * pointers, and the glow is hidden under html[data-gfx="lite"] and
 * prefers-reduced-motion. The glow is a single composited layer moved with
 * transform (rAF-throttled) and faded with opacity; it sits at z-index -1 in
 * the card's own stacking context (isolation: isolate), so it lights the
 * surface without covering text, and never takes pointer events.
 */
export function SpotlightCard({ as = "div", className, children, ...attrs }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const glow = glowRef.current;
    if (!el || !glow || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let raf = 0;
    let x = 0;
    let y = 0;
    const place = () => {
      raf = 0;
      glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const track = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || motionDisabled()) return;
      track(e);
      place();
      el.setAttribute("data-spot", "");
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !el.hasAttribute("data-spot")) return;
      track(e);
      if (!raf) raf = window.requestAnimationFrame(place);
    };
    const onLeave = () => {
      el.removeAttribute("data-spot");
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const Tag = as as "div";
  return (
    <Tag ref={ref} className={cn("av-spotlight", className)} {...attrs}>
      {children}
      {/* Last child, so the card's own first-child / space-y rules are unaffected. */}
      <span ref={glowRef} aria-hidden="true" className="av-spotlight__glow" />
    </Tag>
  );
}
