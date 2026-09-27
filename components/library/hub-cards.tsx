import Link from "next/link";
import { ArrowRight, Shuffle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/motion/spotlight-card";
import { SKILL_ICON, SKILL_TONE, SkillIcon } from "@/components/progression/ui";
import { Chips } from "./badges";

export type LibrarySkill = "READING" | "LISTENING" | "WRITING" | "SPEAKING";

export interface SkillCardData {
  skill: LibrarySkill;
  title: string;
  /** Live library count, e.g. "12 full Reading tests · 3 short practice". */
  count: string;
  /** Exam format, e.g. "3 passages · 40 questions · 60 min". */
  format: string;
  /** What's inside — question / task types. */
  inside: string[];
  href: string;
}

/**
 * One skill in the Learning Center hub. The whole card is clickable (stretched
 * "Start" link), so the tap target is the full card on mobile.
 * Render as a direct child of a `<RevealGroup as="ul" role="list">`.
 */
export function SkillLibraryCard({ data }: { data: SkillCardData }) {
  const tone = SKILL_TONE[data.skill];
  return (
    <SpotlightCard as="li" className="av-panel glow-hover flex h-full flex-col rounded-2xl p-5 focus-within:border-averna-neon/40 sm:p-6">
      <div className="flex items-center gap-3">
        <SkillIcon skill={data.skill} className="h-11 w-11" />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight text-white">{data.title}</h3>
          <p className={cn("mt-0.5 text-xs font-medium", tone.text)}>{data.format}</p>
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-gray-200">{data.count}</p>
      <Chips items={data.inside} max={4} label={`${data.title} — what's inside`} className="mt-3" />
      <div className="mt-auto pt-5">
        <Link
          href={data.href}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-averna-neon/30 bg-averna-neon/[0.06] px-4 text-sm font-semibold text-averna-neon transition-colors after:absolute after:inset-0 after:rounded-2xl hover:bg-averna-neon/10"
        >
          Start {data.title}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </SpotlightCard>
  );
}

const MOCK_SECTIONS: { skill: LibrarySkill; label: string }[] = [
  { skill: "LISTENING", label: "Listening · ~30 min" },
  { skill: "READING", label: "Reading · 60 min" },
  { skill: "WRITING", label: "Writing · 60 min" },
  { skill: "SPEAKING", label: "Speaking · 11–14 min" },
];

/** The prominent full-mock call to action on the hub. */
export function MockExamCard({ href = "/learning/mock-exam" }: { href?: string }) {
  return (
    <SpotlightCard
      as="section"
      aria-labelledby="mock-exam-title"
      className="av-panel av-panel-hero glow-hover rounded-3xl p-5 sm:p-8"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-averna-neon/10 text-averna-neon" aria-hidden>
              <Trophy className="h-5 w-5" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Mock exam</p>
          </div>
          <h2 id="mock-exam-title" className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Full IELTS mock
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-gray-300 sm:text-base">
            <span>About 2 h 45 min</span>
            <span aria-hidden className="text-gray-500">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Shuffle className="h-3.5 w-3.5 text-averna-neon" aria-hidden />
              new random papers every time
            </span>
          </p>
          <ul role="list" aria-label="Sections" className="mt-4 flex flex-wrap gap-2">
            {MOCK_SECTIONS.map((s) => {
              const Icon = SKILL_ICON[s.skill];
              return (
                <li key={s.skill} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                  <Icon className={cn("h-3.5 w-3.5", SKILL_TONE[s.skill].text)} aria-hidden />
                  {s.label}
                </li>
              );
            })}
          </ul>
        </div>
        <Link
          href={href}
          className="glow-cta inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-averna-primary px-6 text-base font-semibold text-white transition-colors hover:bg-averna-light"
        >
          Start a mock exam
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </SpotlightCard>
  );
}
