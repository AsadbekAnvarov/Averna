import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { libraryHref, practiceHref, scopeLabel, type ObjectiveSkill } from "./attempt";

/**
 * What to do after a result: try the same passage / part (or paper) again,
 * move on to the next one, take the full test, or go back to the library.
 *
 * The links that START an attempt are plain <a> elements on purpose: a full
 * request always reaches the practice page, which issues a fresh attempt id.
 * A client-side navigation could replay a cached redirect to an earlier (already
 * submitted) attempt, whose idempotent submission would return the old result.
 */

export const PRIMARY_BTN =
  "glow-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none";
export const SECONDARY_BTN =
  "glow-hover inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";
const GHOST_BTN =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none";

export function ResultActions({
  skill,
  examId,
  part,
  partsCount,
  className,
}: {
  skill: ObjectiveSkill;
  examId: string;
  /** Practised part, or null for the whole paper. */
  part: number | null;
  /** Parts in the paper; null when the paper can't be loaded any more. */
  partsCount: number | null;
  className?: string;
}) {
  const available = partsCount != null && partsCount > 0;
  const next = available && part != null && part + 1 < partsCount ? part + 1 : null;
  const noun = skill === "READING" ? "passage" : "part";

  return (
    <nav aria-label="What to do next" className={cn("flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center print:hidden", className)}>
      {available && (
        <a href={practiceHref(skill, examId, part)} className={PRIMARY_BTN}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
          <span className="sr-only">: {part == null ? "the full test" : scopeLabel(skill, part)}</span>
        </a>
      )}
      {next != null && (
        <a href={practiceHref(skill, examId, next)} className={SECONDARY_BTN}>
          Next {noun}
          <span className="font-normal text-gray-400">· {scopeLabel(skill, next)}</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      )}
      {available && part != null && partsCount > 1 && (
        <a href={practiceHref(skill, examId, null)} className={SECONDARY_BTN}>
          <Timer className="h-4 w-4" aria-hidden />
          Full test
        </a>
      )}
      <Link href={libraryHref(skill)} className={cn(GHOST_BTN, "sm:ml-auto")}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to library
      </Link>
    </nav>
  );
}
