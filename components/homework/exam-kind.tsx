import { BarChart3, BookOpen, FileText, Headphones, Mic, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EXAM_KIND_INFO,
  examScopeLabel,
  isLibraryKind,
  type ExamHomeworkKind,
  type HomeworkSkill,
} from "@/lib/homework/library-shared";

/**
 * Exam-homework kind visuals shared by the teacher and student pages and the
 * teacher's picker. Hook-free: works in server and client components.
 */

export const KIND_ICON: Record<ExamHomeworkKind, typeof BookOpen> = {
  READING: BookOpen,
  LISTENING: Headphones,
  WRITING_TASK1: BarChart3,
  WRITING_TASK2: PenLine,
  WRITING_EXAM: FileText,
  SPEAKING: Mic,
};

/** Skill colours (same tokens as the progression surfaces). */
export const SKILL_TONES: Record<HomeworkSkill, { text: string; bg: string; border: string; ring: string }> = {
  READING: { text: "text-averna-cyan", bg: "bg-averna-cyan/10", border: "border-averna-cyan/30", ring: "border-averna-cyan/60" },
  LISTENING: { text: "text-averna-purple", bg: "bg-averna-purple/10", border: "border-averna-purple/30", ring: "border-averna-purple/60" },
  WRITING: { text: "text-averna-pink", bg: "bg-averna-pink/10", border: "border-averna-pink/30", ring: "border-averna-pink/60" },
  SPEAKING: { text: "text-amber-300", bg: "bg-amber-400/10", border: "border-amber-300/30", ring: "border-amber-300/60" },
};

export function toneOf(kind: ExamHomeworkKind) {
  return SKILL_TONES[EXAM_KIND_INFO[kind].skill];
}

export function KindIcon({ kind, className }: { kind: ExamHomeworkKind; className?: string }) {
  const Icon = KIND_ICON[kind];
  const tone = toneOf(kind);
  return (
    <span aria-hidden className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.bg, tone.text, className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

/** "Reading · Passage 2" pill; renders nothing for classic homework. */
export function ExamKindBadge({ kind, part, className }: { kind: string | null | undefined; part?: number | null; className?: string }) {
  if (!isLibraryKind(kind)) return null;
  const Icon = KIND_ICON[kind];
  const tone = toneOf(kind);
  const scope = examScopeLabel(kind, part ?? null);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", tone.text, tone.bg, tone.border, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {EXAM_KIND_INFO[kind].label}
      {scope && <span className="opacity-80">· {scope}</span>}
    </span>
  );
}

const MODULE_TONE: Record<string, string> = {
  WRITING: "text-averna-pink bg-averna-pink/10 border-averna-pink/30",
  READING: "text-averna-cyan bg-averna-cyan/10 border-averna-cyan/30",
  LISTENING: "text-averna-purple bg-averna-purple/10 border-averna-purple/30",
  SPEAKING: "text-amber-300 bg-amber-400/10 border-amber-300/30",
};

const MODULE_LABEL: Record<string, string> = { WRITING: "Writing", READING: "Reading", LISTENING: "Listening", SPEAKING: "Speaking" };

/** Classic homework: the module pill ("Writing · free text"). */
export function ModuleBadge({ module, className }: { module: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        MODULE_TONE[module] ?? "text-gray-300 bg-white/5 border-white/10",
        className
      )}
    >
      {MODULE_LABEL[module] ?? module}
      <span className="ml-1 opacity-70">· free text</span>
    </span>
  );
}
