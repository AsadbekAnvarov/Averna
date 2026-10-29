"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ListeningPracticeScopeProps {
  testId: string;
  partCount: number;
  /** Zero-based part; undefined means the full paper. */
  partIndex?: number;
  /** An uncut recording has no verified independently playable parts. */
  wholeRecording?: boolean;
  disabled?: boolean;
  /** Flush the current draft before leaving; false keeps the attempt open. */
  beforeSwitch?: () => boolean;
}

/** Changes practice scope by starting a fresh attempt, never by reusing its ID. */
export function ListeningPracticeScope({ testId, partCount, partIndex, wholeRecording, disabled, beforeSwitch }: ListeningPracticeScopeProps) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current, active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active) nav.scrollLeft = Math.max(0, active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
  }, [partIndex, partCount, wholeRecording]);
  if (!Number.isInteger(partCount) || partCount < 2) return null;
  if (wholeRecording) return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm" aria-label="Listening practice scope">
      <span className="font-semibold text-gray-200">Full Listening</span>
      <span className="text-gray-400">One complete recording. Separate-part practice requires verified audio boundaries.</span>
    </div>
  );
  const base = `/learning/listening/${encodeURIComponent(testId)}`;
  const choices = [
    { label: "Full Listening", href: base, current: partIndex == null },
    ...Array.from({ length: partCount }, (_, i) => ({ label: `Part ${i + 1}`, href: `${base}?part=${i}`, current: partIndex === i })),
  ];
  return (
    <nav ref={navRef} className="flex items-center gap-2 overflow-x-auto px-4 py-1 text-sm" aria-label="Listening practice scope">
      <span className="shrink-0 text-gray-400">Practise:</span>
      {choices.map(choice => (
        <Link key={choice.label} href={choice.href} aria-current={choice.current ? "page" : undefined}
          aria-disabled={disabled || undefined}
          className={cn("inline-flex min-h-[44px] shrink-0 items-center rounded-lg border px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60", choice.current ? "border-averna-neon/50 bg-averna-neon/10 text-averna-neon" : "border-white/15 text-gray-300", disabled && "cursor-not-allowed opacity-50")}
          onClick={event => {
            // Modifier-clicks still run the draft flush, and never carry the old attempt ID.
            if (choice.current || disabled || !window.confirm(`Start a new ${choice.label} practice attempt? Your current attempt will stay saved in this browser.`)) {
              event.preventDefault();
              return;
            }
            if (beforeSwitch && !beforeSwitch()) event.preventDefault();
          }}>
          {choice.label}
        </Link>
      ))}
    </nav>
  );
}
