import { ClipboardList, Dumbbell, GraduationCap, Mic, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, type ReviewSource } from "@/lib/review/filters";
import type { ReviewSkill } from "@/lib/review/scoring";

/** Small presentational pieces shared by the review queue, the review page and the dashboard card. */

const SOURCE_STYLE: Record<ReviewSource, { className: string; Icon: typeof ClipboardList }> = {
  homework: { className: "border-averna-purple/40 bg-averna-purple/10 text-averna-purple", Icon: ClipboardList },
  mock: { className: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan", Icon: GraduationCap },
  practice: { className: "border-white/15 bg-white/[0.04] text-gray-300", Icon: Dumbbell },
};

export function SourceBadge({ source, title, className }: { source: ReviewSource; title?: string | null; className?: string }) {
  const s = SOURCE_STYLE[source];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        s.className,
        className
      )}
      title={title ? `${SOURCE_LABEL[source]}: ${title}` : undefined}
    >
      <s.Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{SOURCE_LABEL[source]}</span>
    </span>
  );
}

const SKILL_STYLE: Record<ReviewSkill, { className: string; Icon: typeof PenTool; label: string }> = {
  WRITING: { className: "bg-averna-pink/15 text-averna-pink", Icon: PenTool, label: "Writing" },
  SPEAKING: { className: "bg-amber-400/15 text-amber-300", Icon: Mic, label: "Speaking" },
};

export function SkillIconBox({ skill, className }: { skill: ReviewSkill; className?: string }) {
  const s = SKILL_STYLE[skill];
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", s.className, className)} aria-hidden>
      <s.Icon className="h-4 w-4" />
    </span>
  );
}
