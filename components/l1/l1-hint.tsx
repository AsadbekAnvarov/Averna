"use client";

import { kindHint, l1Hint, L1_HINT_LABEL } from "@/lib/l1/hints";
import { cn } from "@/lib/utils";
import { useL1Lang } from "./use-l1";

/**
 * A quiet secondary line under English instruction text: the curated Uzbek or
 * Russian hint (lib/l1/hints.ts) with a small "UZ" / "RU" tag. Renders nothing
 * when hints are off, for staff, before the prefs load (no layout shift for
 * anyone with hints off) and when the text has no known translation.
 *
 *   <L1Hint text={group.instructions} />          an instruction
 *   <L1Hint kind="tfng" part="tip" />             a question type's name or tip
 *   fit="em" follows the exam's own text size (A−/A+) instead of the UI size.
 */
export function L1Hint({
  text,
  kind,
  part = "name",
  fit = "ui",
  className,
}: {
  text?: string | null;
  kind?: string | null;
  part?: "name" | "tip";
  fit?: "ui" | "em";
  className?: string;
}) {
  const lang = useL1Lang();
  if (!lang) return null;
  const hint = text != null ? l1Hint(text, lang) : kind ? (kindHint(kind, lang)?.[part] ?? null) : null;
  if (!hint) return null;
  return (
    <span
      role="note"
      aria-label={L1_HINT_LABEL[lang]}
      data-l1-hint={lang}
      className={cn(
        "l1-hint mt-1 flex items-start gap-1.5 font-normal normal-case leading-snug tracking-normal text-gray-400",
        fit === "em" ? "text-[length:max(13px,0.875em)]" : "text-[13px] sm:text-sm",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="l1-hint__tag mt-[0.1em] shrink-0 rounded border border-white/15 px-1 text-[11px] font-semibold leading-[1.45] text-gray-400"
      >
        {lang.toUpperCase()}
      </span>
      <span lang={lang} className="min-w-0">
        {hint}
      </span>
    </span>
  );
}
