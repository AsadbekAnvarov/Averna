import { BookOpen, Headphones, PenLine, SpellCheck } from "lucide-react";
import type { PlacementSection } from "@/lib/placement/types";
import { cn } from "@/lib/utils";

/**
 * Icon tile for a placement section. No hooks and no directive, so both server
 * pages and client components can use it.
 */

export const SECTION_TONE: Record<PlacementSection, { text: string; bg: string; bar: string }> = {
  GRAMMAR: { text: "text-averna-neon", bg: "bg-averna-neon/10", bar: "bg-averna-neon" },
  LISTENING: { text: "text-averna-purple", bg: "bg-averna-purple/10", bar: "bg-averna-purple" },
  READING: { text: "text-averna-cyan", bg: "bg-averna-cyan/10", bar: "bg-averna-cyan" },
  WRITING: { text: "text-averna-pink", bg: "bg-averna-pink/10", bar: "bg-averna-pink" },
};

const ICON = { GRAMMAR: SpellCheck, LISTENING: Headphones, READING: BookOpen, WRITING: PenLine };

export function SectionIcon({ section, className }: { section: PlacementSection; className?: string }) {
  const Icon = ICON[section];
  const tone = SECTION_TONE[section];
  return (
    <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.bg, tone.text, className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** A CEFR level chip (A1 … C1). */
export function CefrChip({ cefr, className }: { cefr: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-averna-neon/40 bg-averna-neon/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-averna-neon",
        className
      )}
    >
      {cefr}
    </span>
  );
}
