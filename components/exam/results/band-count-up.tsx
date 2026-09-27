"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motionDisabled } from "@/components/motion/gfx-tier";

/**
 * The band number on the result hero, counting up once (≈0.9 s, ease-out).
 *
 * - Server HTML / hydration: the final value is already on screen, so it is
 *   never animated away (no flash of "0.0").
 * - Client-side arrival (the runner's router.push): starts at 0 before the
 *   first paint and counts up.
 * - prefers-reduced-motion / lite graphics tier: shows the final value.
 *
 * Decorative only (aria-hidden) — pair it with a text label for screen readers.
 */

const DURATION_MS = 900;
const subscribe = () => () => {};

export function BandCountUp({ value, className }: { value: number; className?: string }) {
  // true only while hydrating server-rendered HTML
  const hydrating: boolean = useSyncExternalStore(subscribe, () => false, () => true);
  const animate = useRef<boolean | null>(null);
  if (animate.current === null) animate.current = !hydrating && !motionDisabled();

  const [shown, setShown] = useState<number>(() => (animate.current ? 0 : value));

  useEffect(() => {
    if (!animate.current) {
      setShown(value);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p >= 1 ? value : value * eased);
      if (p < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span aria-hidden="true" className={className}>
      {(Math.round(shown * 10) / 10).toFixed(1)}
    </span>
  );
}
