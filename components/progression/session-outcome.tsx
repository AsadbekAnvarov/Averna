import { ArrowRight, Flame, Target, Trophy, TrendingUp, Info } from "lucide-react";
import type { SessionOutcome } from "@/lib/engine/progression/service";
import { NextActivity } from "./next-activity";
import { XpGain } from "./xp-gain";

/**
 * "One more thing" — shown after every finished activity. Tells the student
 * exactly what improved, what they earned (and why), where they stand, and the
 * single best next step. Works in server pages and client runners alike.
 */
export function SessionOutcomeCard({ outcome }: { outcome: SessionOutcome }) {
  const o = outcome;
  const useAccuracy = o.accuracy != null && o.afterAccuracy != null;
  const beforeVal = useAccuracy ? o.beforeAccuracy : o.before;
  const afterVal = useAccuracy ? o.afterAccuracy! : o.after;
  const fmt = (v: number) => (useAccuracy ? `${Math.round(v)}%` : v.toFixed(1));
  const delta = beforeVal != null ? afterVal - beforeVal : null;
  const levelUp = o.levelAfter.level > o.levelBefore.level;

  return (
    <section aria-labelledby="outcome-title" className="av-panel av-panel-hero rounded-3xl p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-averna-neon">Session complete</p>
      <h2 id="outcome-title" className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
        {o.headline}
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {/* What improved */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden /> {o.skillLabel} {useAccuracy ? "accuracy" : "band"} (recent average)
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {beforeVal != null ? (
              <>
                <span className="text-gray-400">{fmt(beforeVal)}</span>
                <ArrowRight className="mx-1.5 inline h-5 w-5 text-gray-500" aria-label="to" />
                {fmt(afterVal)}
              </>
            ) : (
              fmt(afterVal)
            )}
          </p>
          <p className={`mt-1 text-sm ${delta != null && delta > 0 ? "text-averna-neon" : "text-gray-400"}`}>
            {delta == null
              ? "Baseline set — your next attempt will show your progress."
              : delta > 0
                ? `You improved by +${useAccuracy ? `${Math.round(delta)}%` : delta.toFixed(1)}.`
                : delta < 0
                  ? "A little below your recent average — review the mistakes below."
                  : "Holding steady at your recent level."}
          </p>
          {o.personalBest && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
              <Trophy className="h-3.5 w-3.5" aria-hidden /> Personal best · band {o.band.toFixed(1)}
              {o.previousBest != null && <span className="font-normal text-amber-200/80">(was {o.previousBest.toFixed(1)})</span>}
            </p>
          )}
        </div>

        {/* What was earned */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {o.xp != null ? (
            <XpGain
              xp={o.xp}
              fromPercent={o.levelBefore.into}
              toPercent={o.levelAfter.into}
              levelUp={levelUp}
              levelLabel={`Level ${o.levelAfter.level} · ${o.levelAfter.title}`}
            />
          ) : (
            <p className="text-sm text-gray-400">XP details aren&apos;t available for this older result.</p>
          )}
          {o.xpLines.length > 0 && (
            <details className="mt-3 text-xs text-gray-400">
              <summary className="cursor-pointer select-none text-gray-300 hover:text-white">Why this XP?</summary>
              <ul className="mt-2 space-y-1">
                {o.xpLines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{l.label}</span>
                    <span className="text-gray-200">{l.amount != null ? `+${l.amount}` : `×${l.factor}`}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {o.xpNotes.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-averna-cyan/20 bg-averna-cyan/5 p-3 text-sm text-gray-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
          {o.xpNotes[0]}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-300">
        <span className="inline-flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-orange-400" aria-hidden /> {o.streak}-day streak
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Target className="h-4 w-4 text-averna-neon" aria-hidden />
          {o.mission.allDone ? "Today's mission complete" : `Mission ${o.mission.completed}/${o.mission.total}`}
        </span>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Recommended next</p>
        <NextActivity rec={o.next} compact />
      </div>
    </section>
  );
}
