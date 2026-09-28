"use client";

/**
 * The dashboard's calm "find your level" card. "Not now" hides it for
 * PROMPT_DISMISS_DAYS on this device (localStorage). Renders nothing until it
 * has read that preference, so a dismissed card never flashes on load.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import {
  PLACEMENT_HUB_HREF,
  PROMPT_DISMISS_DAYS,
  PROMPT_DISMISS_KEY,
  TOTAL_MINUTES_CORE,
  placementRunHref,
} from "@/lib/placement/config";

export function PlacementPromptCard({ activeAttemptId }: { activeAttemptId: string | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hidden = false;
    try {
      const until = Number(window.localStorage.getItem(PROMPT_DISMISS_KEY));
      hidden = Number.isFinite(until) && until > Date.now();
    } catch {
      /* storage unavailable — show the card */
    }
    setVisible(!hidden);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(PROMPT_DISMISS_KEY, String(Date.now() + PROMPT_DISMISS_DAYS * 86_400_000));
    } catch {
      /* ignore — it just hides for this visit */
    }
    setVisible(false);
  };

  const resume = !!activeAttemptId;
  const href = activeAttemptId ? placementRunHref(activeAttemptId) : PLACEMENT_HUB_HREF;

  return (
    <section
      aria-labelledby="placement-prompt-title"
      className="av-panel relative overflow-hidden rounded-2xl border border-averna-neon/20 px-4 py-4 sm:px-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-averna-neon/10 text-averna-neon">
            <Compass className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="placement-prompt-title" className="text-sm font-semibold text-white sm:text-base">
              {resume ? "Finish your placement test" : "Find your level"}
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-300">
              {resume
                ? "You've started the placement test — pick up where you left off. Each section's clock only starts when you press Start."
                : `A ${TOTAL_MINUTES_CORE}-minute placement test shows your English level and the course that fits you best. There's no pass or fail.`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none"
          >
            Not now
          </button>
          <Link
            href={href}
            className="glow-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none"
          >
            {resume ? "Continue the test" : "Take the placement test"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default PlacementPromptCard;
