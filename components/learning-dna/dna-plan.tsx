import Link from "next/link";
import { ArrowRight, CalendarClock, ListChecks, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningDnaProfile, RecommendationKind } from "@/lib/engine/learning-dna";
import { ConfidenceBadge, DnaPanel } from "./dna-primitives";

/**
 * Today's adaptive plan plus the ranked recommendations behind it.
 *
 * Each plan block shows its `why` — the measurement that put it there and put it
 * in that position. A plan a student understands is a plan they follow, and it
 * also means a wrong recommendation is visibly wrong rather than mysteriously so.
 */

const KIND_LABEL: Record<RecommendationKind, string> = {
  study_plan: "Study plan",
  lesson_order: "Lesson order",
  review_timing: "Review timing",
  difficulty: "Difficulty",
  homework: "Practice",
  revision: "Revision",
  mentor: "AI Mentor",
  motivation: "Motivation",
  weak_skill: "Weak skill",
  exam_prep: "Exam prep",
};

function hh(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function DnaPlan({ profile }: { profile: LearningDnaProfile }) {
  const { plan } = profile;

  return (
    <DnaPanel
      icon={ListChecks}
      title="Your plan for today"
      subtitle={`${plan.totalMinutes} minutes, ordered the way you learn best`}
      accent="text-averna-cyan"
      border="border-averna-cyan/30"
      action={{ label: "Open schedule", href: "/schedule" }}
    >
      {plan.window && (
        <div className="flex items-center gap-2 mb-4 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2">
          <CalendarClock className="h-4 w-4 text-amber-300 shrink-0" />
          <p className="text-xs text-amber-100/90">
            Best window: <strong>{hh(plan.window.startHour)}–{hh(plan.window.endHour)}</strong>{" "}
            <span className="text-amber-200/60">({plan.window.label.toLowerCase()})</span>
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {plan.blocks.map((block) => (
          <li key={block.order}>
            <Link
              href={block.href}
              className="group flex items-start gap-3 rounded-xl border border-white/10 bg-averna-dark/30 p-4 hover:border-averna-cyan/40 hover-lift transition-all"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-averna-cyan/10 text-averna-cyan text-sm font-bold shrink-0">
                {block.order}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{block.label}</h3>
                  <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-gray-300">
                    {block.minutes} min
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500">{block.purpose}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{block.why}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-averna-cyan group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </Link>
          </li>
        ))}
      </ol>

      <p className="text-[11px] text-gray-500 mt-3 flex items-center gap-2">
        <ConfidenceBadge confidence={plan.confidence} compact />
        <span>{plan.basis}</span>
      </p>
    </DnaPanel>
  );
}

export function DnaRecommendations({ profile }: { profile: LearningDnaProfile }) {
  const { recommendations } = profile;

  return (
    <DnaPanel
      icon={Target}
      title="What to do next"
      subtitle="Ranked by how much each one is worth to you right now"
      accent="text-averna-pink"
      border="border-averna-pink/30"
    >
      {recommendations.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">
          Once your profile has a little more evidence, specific actions will appear here — we&apos;d rather
          say nothing than guess.
        </p>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Link
              key={rec.id}
              href={rec.href}
              className="group flex items-start gap-3 rounded-xl border border-white/10 bg-averna-dark/30 p-4 hover:border-averna-pink/40 hover-lift transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-averna-pink/10 border border-averna-pink/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-averna-pink">
                    {KIND_LABEL[rec.kind]}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{rec.title}</h3>
                  <ConfidenceBadge confidence={rec.confidence} compact />
                </div>
                <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{rec.detail}</p>
                <p className={cn("text-[10px] text-gray-500 mt-1.5")} title={rec.basis}>
                  Based on: {rec.basis}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-averna-pink group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </Link>
          ))}
        </div>
      )}
    </DnaPanel>
  );
}
