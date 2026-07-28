import Link from "next/link";
import { Activity, BookOpen, Headphones, Layers, Mic, PenTool, ScanLine, SpellCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DnaSkillMetric, LearningDnaProfile, SkillKey, SkillStatus } from "@/lib/engine/learning-dna";
import { SKILL_HREF } from "@/lib/engine/learning-dna/config";
import { DnaPanel } from "./dna-primitives";

/**
 * Skill balance and the growth dimensions.
 *
 * Mastery is shown alongside retention on purpose: a skill can be mastered and
 * fading at the same time, and that combination is the single most common reason a
 * student's band stalls. Two bars per skill make it visible at a glance.
 */

const SKILL_ICON: Record<SkillKey, LucideIcon> = {
  READING: BookOpen,
  LISTENING: Headphones,
  WRITING: PenTool,
  SPEAKING: Mic,
  GRAMMAR: SpellCheck,
  VOCABULARY: Layers,
};

const STATUS_STYLE: Record<SkillStatus, { label: string; className: string; bar: string }> = {
  strength: {
    label: "Strength",
    className: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon",
    bar: "#00FF94",
  },
  growing: {
    label: "Growing",
    className: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan",
    bar: "#00E5FF",
  },
  needs_reinforcement: {
    label: "Needs work",
    className: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    bar: "#fbbf24",
  },
  untouched: {
    label: "Not started",
    className: "border-white/15 bg-white/5 text-gray-400",
    bar: "rgba(255,255,255,0.2)",
  },
};

function SkillRow({ skill }: { skill: DnaSkillMetric }) {
  const Icon = SKILL_ICON[skill.key];
  const status = STATUS_STYLE[skill.status];

  return (
    <Link
      href={SKILL_HREF[skill.key]}
      className="block rounded-xl border border-white/10 bg-averna-dark/30 p-3.5 hover:border-white/25 transition-colors"
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <Icon className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="text-sm font-semibold text-white">{skill.label}</span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
            status.className
          )}
        >
          {status.label}
        </span>
        <span className="ml-auto text-xs text-gray-400 shrink-0 tabular-nums">
          {skill.band != null ? `Band ${skill.band}` : skill.accuracy != null ? `${skill.accuracy}%` : "—"}
        </span>
      </div>

      {/* Mastery */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-16 text-[10px] uppercase tracking-wider text-gray-500 shrink-0">Mastery</span>
        <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${skill.mastery}%`, background: status.bar }}
          />
        </div>
        <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums shrink-0">{skill.mastery}</span>
      </div>

      {/* Retention — the half of the picture a mastery bar alone hides */}
      <div className="flex items-center gap-2">
        <span className="w-16 text-[10px] uppercase tracking-wider text-gray-500 shrink-0">Retention</span>
        <div className="h-2 flex-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-averna-purple/70 transition-all duration-700"
            style={{ width: `${skill.retention}%` }}
          />
        </div>
        <span className="w-8 text-right text-[10px] text-gray-400 tabular-nums shrink-0">{skill.retention}</span>
      </div>

      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{skill.reason}</p>
    </Link>
  );
}

export function DnaSkills({ profile }: { profile: LearningDnaProfile }) {
  return (
    <DnaPanel
      icon={Activity}
      title="Skill balance"
      subtitle="Mastery and retention side by side — a skill can be strong and fading at once"
      accent="text-averna-blue"
      border="border-averna-blue/25"
      action={{ label: "Progress centre", href: "/progress" }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {profile.skills.map((skill) => (
          <SkillRow key={skill.key} skill={skill} />
        ))}
      </div>
    </DnaPanel>
  );
}

// ---------------------------------------------------------------------------
// Growth dimensions
// ---------------------------------------------------------------------------

export function DnaGrowth({ profile }: { profile: LearningDnaProfile }) {
  const { growth } = profile;

  const rows: { label: string; icon: LucideIcon; value: string | null; basis: string; hint: string }[] = [
    {
      label: "Vocabulary growth",
      icon: Layers,
      value: growth.vocabulary.value != null ? `${growth.vocabulary.value}/100` : null,
      basis: growth.vocabulary.basis,
      hint: "New words learned and how many reached long-term memory.",
    },
    {
      label: "Grammar growth",
      icon: SpellCheck,
      value: growth.grammar.value != null ? `${growth.grammar.value}/100` : null,
      basis: growth.grammar.basis,
      hint: "Accuracy and volume of grammar work.",
    },
    {
      label: "Speaking confidence",
      icon: Mic,
      value: growth.speakingConfidence.value != null ? `${growth.speakingConfidence.value}/100` : null,
      basis: growth.speakingConfidence.basis,
      hint: "How often and how long you choose to speak.",
    },
    {
      label: "Writing complexity",
      icon: PenTool,
      value: growth.writingComplexity.value != null ? `${growth.writingComplexity.value}/100` : null,
      basis: growth.writingComplexity.basis,
      hint: "Length and lexical range of what you produce.",
    },
    {
      label: "Reading speed",
      icon: ScanLine,
      value: growth.readingSpeedWpm.value != null ? `${growth.readingSpeedWpm.value} wpm` : null,
      basis: growth.readingSpeedWpm.basis,
      hint: "IELTS Academic Reading needs roughly 250 wpm.",
    },
    {
      label: "Listening accuracy",
      icon: Headphones,
      value: growth.listeningAccuracy.value != null ? `${growth.listeningAccuracy.value}%` : null,
      basis: growth.listeningAccuracy.basis,
      hint: "Average correctness across listening work.",
    },
  ];

  return (
    <DnaPanel
      icon={ScanLine}
      title="Growth dimensions"
      subtitle="The finer-grained measures behind your bands"
      accent="text-emerald-400"
      border="border-emerald-400/25"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className="rounded-xl border border-white/10 bg-averna-dark/30 p-3.5"
              title={row.basis}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 truncate">
                  {row.label}
                </span>
              </div>
              {row.value != null ? (
                <>
                  <p className="text-xl font-bold text-white leading-none">{row.value}</p>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed line-clamp-2">{row.basis}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-500 leading-none">Not measured yet</p>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">{row.hint}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </DnaPanel>
  );
}
