import { BookOpen, Headphones, PenLine, Mic, Sparkles, ClipboardList, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared primitives for the progression surfaces. One visual language:
 * dark surfaces, a single controlled green accent, and colour used only to
 * tell the four skills apart.
 */

export type SkillLike = "READING" | "LISTENING" | "WRITING" | "SPEAKING" | "GENERAL";

export const SKILL_ICON: Record<SkillLike, LucideIcon> = {
  READING: BookOpen,
  LISTENING: Headphones,
  WRITING: PenLine,
  SPEAKING: Mic,
  GENERAL: Sparkles,
};

/** Text + soft background tints per skill (safelisted averna-* tokens). */
export const SKILL_TONE: Record<SkillLike, { text: string; bg: string; bar: string }> = {
  READING: { text: "text-averna-cyan", bg: "bg-averna-cyan/10", bar: "bg-averna-cyan" },
  LISTENING: { text: "text-averna-purple", bg: "bg-averna-purple/10", bar: "bg-averna-purple" },
  WRITING: { text: "text-averna-pink", bg: "bg-averna-pink/10", bar: "bg-averna-pink" },
  SPEAKING: { text: "text-amber-300", bg: "bg-amber-400/10", bar: "bg-amber-300" },
  GENERAL: { text: "text-averna-neon", bg: "bg-averna-neon/10", bar: "bg-averna-neon" },
};

export function SkillIcon({ skill, className, homework }: { skill: SkillLike; className?: string; homework?: boolean }) {
  const Icon = homework ? ClipboardList : SKILL_ICON[skill] ?? Sparkles;
  const tone = SKILL_TONE[skill] ?? SKILL_TONE.GENERAL;
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.bg, tone.text, className)} aria-hidden>
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** Accessible progress bar. `value` 0-100. */
export function Meter({
  value,
  label,
  className,
  barClassName = "bg-averna-neon",
  size = "md",
}: {
  value: number;
  label: string;
  className?: string;
  barClassName?: string;
  size?: "sm" | "md";
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("w-full overflow-hidden rounded-full bg-white/10", size === "sm" ? "h-1.5" : "h-2.5", className)}
    >
      <div className={cn("h-full rounded-full meter-fill", barClassName)} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Small "+45 XP" chip. */
export function XpChip({ xp, className }: { xp: number; className?: string }) {
  if (xp <= 0) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full border border-averna-neon/30 bg-averna-neon/10 px-2 py-0.5 text-xs font-semibold text-averna-neon", className)}>
      +{xp} XP
    </span>
  );
}

/** The standard progression surface. */
export function Panel({ children, className, as: Tag = "section", labelledBy }: { children: React.ReactNode; className?: string; as?: "section" | "div"; labelledBy?: string }) {
  return (
    <Tag aria-labelledby={labelledBy} className={cn("av-panel rounded-2xl p-5 sm:p-6", className)}>
      {children}
    </Tag>
  );
}

export function PanelTitle({ id, icon: Icon, title, hint, action }: { id?: string; icon?: LucideIcon; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-white">
          {Icon && <Icon className="h-4 w-4 text-averna-neon" aria-hidden />}
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
