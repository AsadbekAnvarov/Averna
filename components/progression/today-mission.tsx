import Link from "next/link";
import { CheckCircle2, Circle, Clock, Target, ArrowRight, PartyPopper } from "lucide-react";
import type { DailyMission } from "@/lib/engine/progression/missions";
import { Meter, SkillIcon, XpChip } from "./ui";
import { cn } from "@/lib/utils";

/**
 * TODAY'S MISSION — the hero of the student dashboard. Answers "what should I
 * do today, how long will it take, what do I get, and where am I?" at a glance.
 */
export function TodayMission({ mission, firstName, isNew }: { mission: DailyMission; firstName: string; isNew: boolean }) {
  const next = mission.nextStep;
  const started = mission.completed > 0;
  const cta = mission.allDone ? null : started ? "Continue Today's Mission" : "Start Today's Mission";

  return (
    <section aria-labelledby="mission-title" className="av-panel av-panel-hero relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-averna-neon/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        {/* Left: headline + progress + CTA */}
        <div className="lg:w-[38%] lg:shrink-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-averna-neon">
            <Target className="h-3.5 w-3.5" aria-hidden /> Today&apos;s Mission
          </p>
          <h2 id="mission-title" className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">
            {mission.allDone
              ? `Mission complete, ${firstName}.`
              : isNew
                ? `Let's find your level, ${firstName}.`
                : started
                  ? `${mission.total - mission.completed} step${mission.total - mission.completed === 1 ? "" : "s"} to go, ${firstName}.`
                  : `Your plan for today, ${firstName}.`}
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            {mission.allDone
              ? `You earned the +${mission.completionBonus} XP mission bonus. Extra practice still counts toward your challenges.`
              : `Built around your weakest skill. Finish every step for a +${mission.completionBonus} XP bonus.`}
          </p>

          <div className="mt-5">
            <div className="mb-1.5 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-white">
                {mission.completed}/{mission.total} complete
              </span>
              <span className="text-gray-400">{mission.percent}%</span>
            </div>
            <Meter value={mission.percent} label="Mission progress" />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {mission.allDone ? `${mission.estMinutes} min planned` : `About ${mission.remainingMinutes} min left`}
              </span>
              <span>Up to +{mission.potentialXp} XP</span>
            </div>
          </div>

          {cta && next ? (
            <Link
              href={next.href}
              className="glow-cta mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition hover:bg-averna-light sm:w-auto"
            >
              {cta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <p className="mt-6 inline-flex items-center gap-2 rounded-xl border border-averna-neon/30 bg-averna-neon/10 px-4 py-3 text-sm text-averna-neon">
              <PartyPopper className="h-4 w-4" aria-hidden /> Come back tomorrow for a new mission.
            </p>
          )}
        </div>

        {/* Right: the steps, in session order */}
        <ol className="flex-1 space-y-2.5" aria-label="Mission steps">
          {mission.steps.map((step, i) => {
            const isNext = !step.done && next?.id === step.id;
            return (
              <li key={step.id}>
                <Link
                  href={step.href}
                  aria-label={`${step.roleLabel}: ${step.title}${step.done ? " (done)" : ""}`}
                  className={cn(
                    "group flex min-h-[64px] items-center gap-3 rounded-2xl border p-3 transition sm:p-3.5",
                    step.done
                      ? "border-averna-neon/20 bg-averna-neon/[0.04]"
                      : isNext
                        ? "glow-hover border-averna-neon/40 bg-white/[0.04]"
                        : "glow-hover border-white/10 bg-white/[0.02]"
                  )}
                >
                  <span className="sr-only">Step {i + 1}.</span>
                  <SkillIcon skill={step.skill} homework={step.kind === "homework"} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      {step.roleLabel} · {step.estMinutes} min
                    </p>
                    <p className={cn("truncate text-sm font-semibold", step.done ? "text-gray-400 line-through decoration-averna-neon/40" : "text-white")}>
                      {step.title}
                    </p>
                    <p className="truncate text-xs text-gray-400">{step.why}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-averna-neon" aria-hidden />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-500 group-hover:text-averna-neon" aria-hidden />
                    )}
                    {!step.done && <XpChip xp={step.xp} className="hidden sm:inline-flex" />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
