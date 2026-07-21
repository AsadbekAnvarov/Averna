"use client";

import { useEffect } from "react";
import { fireConfetti } from "@/lib/confetti";

/**
 * Fires a one-shot confetti burst when a test result is shown, reinforcing the
 * finish → reward loop. The burst is bigger when the student hits their target
 * band or scores well. fireConfetti() already respects prefers-reduced-motion.
 */
export function ResultCelebration({ score, target }: { score: number; target?: number | null }) {
  useEffect(() => {
    const strong = (typeof target === "number" && score >= target) || score >= 7;
    fireConfetti({ particles: strong ? 170 : 90, duration: strong ? 2600 : 1900 });
    // Fire exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
