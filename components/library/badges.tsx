import { BadgeCheck, Sparkles, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL } from "@/lib/ielts/format";
import type { ExamDifficulty, ExamSource, GroupKind } from "@/lib/ielts/types";

/** Small, calm badges shared by the exam-library cards. Server-safe (no hooks). */

const DIFFICULTY: Record<ExamDifficulty, { level: number; tone: string; bar: string }> = {
  Easy: { level: 1, tone: "text-averna-neon border-averna-neon/25 bg-averna-neon/[0.07]", bar: "bg-averna-neon" },
  Medium: { level: 2, tone: "text-averna-cyan border-averna-cyan/25 bg-averna-cyan/[0.07]", bar: "bg-averna-cyan" },
  Hard: { level: 3, tone: "text-averna-pink border-averna-pink/25 bg-averna-pink/[0.07]", bar: "bg-averna-pink" },
};

const BAR_HEIGHT = ["h-1.5", "h-2", "h-2.5"];

export function DifficultyBadge({ difficulty, className }: { difficulty: ExamDifficulty; className?: string }) {
  const d = DIFFICULTY[difficulty] ?? DIFFICULTY.Medium;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", d.tone, className)}>
      <span aria-hidden className="flex items-end gap-[2px]">
        {BAR_HEIGHT.map((h, i) => (
          <span key={h} className={cn("w-[3px] rounded-full", h, i < d.level ? d.bar : "bg-white/10")} />
        ))}
      </span>
      <span>
        <span className="sr-only">Difficulty: </span>
        {difficulty}
      </span>
    </span>
  );
}

export const SOURCE_LABEL: Record<ExamSource, string> = {
  averna: "Averna original",
  generated: "AI-generated",
  legacy: "Short practice",
  cdi: "CDI practice",
};

const SOURCE: Record<ExamSource, { icon: typeof BadgeCheck; tone: string }> = {
  averna: { icon: BadgeCheck, tone: "text-averna-light border-averna-primary/40 bg-averna-primary/10" },
  generated: { icon: Sparkles, tone: "text-averna-purple border-averna-purple/25 bg-averna-purple/[0.07]" },
  legacy: { icon: Timer, tone: "text-gray-300 border-white/10 bg-white/5" },
  cdi: { icon: BadgeCheck, tone: "text-averna-cyan border-averna-cyan/25 bg-averna-cyan/[0.07]" },
};

export function SourceBadge({ source, className }: { source: ExamSource; className?: string }) {
  const s = SOURCE[source] ?? SOURCE.legacy;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", s.tone, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {SOURCE_LABEL[source] ?? SOURCE_LABEL.legacy}
    </span>
  );
}

/** Unique, human labels for a test's question types (KIND_LABEL). */
export function kindLabels(kinds: GroupKind[]): string[] {
  return Array.from(new Set(kinds.map((k) => KIND_LABEL[k]).filter(Boolean)));
}

/** Neutral chips — used for question types, topics and task types. */
export function Chips({ items, max = 5, label, className }: { items: string[]; max?: number; label: string; className?: string }) {
  if (!items.length) return null;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <ul role="list" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((item) => (
        <li key={item} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] leading-5 text-gray-300">
          {item}
        </li>
      ))}
      {rest > 0 && (
        <li className="rounded-md px-1.5 py-0.5 text-[11px] leading-5 text-gray-400">+{rest} more</li>
      )}
    </ul>
  );
}

export function KindChips({ kinds, max = 5, className }: { kinds: GroupKind[]; max?: number; className?: string }) {
  return <Chips items={kindLabels(kinds)} max={max} label="Question types" className={className} />;
}
