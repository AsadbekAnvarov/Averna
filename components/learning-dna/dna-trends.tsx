import { AlertOctagon, HeartPulse, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DnaHistoryPoint, LearningDnaProfile, Trend } from "@/lib/engine/learning-dna";
import { DnaPanel, DnaTrendLine } from "./dna-primitives";

/**
 * Motivation trend and repeated mistakes.
 *
 * The trend chart is drawn from the daily profile snapshots, which is the only
 * honest way to show change over time — a single profile can describe today but
 * cannot show a direction. Where there aren't enough snapshots, the chart says so
 * rather than drawing a line through two points.
 */

const TREND_STYLE: Record<Trend, { label: string; className: string; arrow: string }> = {
  rising: { label: "Rising", className: "text-averna-neon", arrow: "↑" },
  steady: { label: "Steady", className: "text-averna-cyan", arrow: "→" },
  falling: { label: "Falling", className: "text-amber-300", arrow: "↓" },
};

export function DnaMotivationTrend({
  profile,
  history,
}: {
  profile: LearningDnaProfile;
  history: DnaHistoryPoint[];
}) {
  const { motivation } = profile;
  const style = TREND_STYLE[motivation.trend];

  return (
    <DnaPanel
      icon={HeartPulse}
      title="Motivation trend"
      subtitle="Measured from how much you actually study, not how you feel about it"
      accent="text-averna-pink"
      border="border-averna-pink/25"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white leading-none">
              {motivation.score.value != null ? motivation.score.value : "—"}
            </span>
            {motivation.score.value != null && <span className="text-sm text-gray-400">/100</span>}
            <span className={cn("text-sm font-semibold", style.className)}>
              {style.arrow} {style.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">{motivation.basis}</p>
        </div>

        <div className="text-right text-[11px] text-gray-400">
          <p>
            <strong className="text-white">{motivation.recentActiveDays}</strong> active days recently
          </p>
          <p>
            <strong className="text-white">{motivation.previousActiveDays}</strong> in the fortnight before
          </p>
          {motivation.daysSinceLastActivity != null && (
            <p className="text-gray-500">
              Last activity{" "}
              {motivation.daysSinceLastActivity === 0
                ? "today"
                : `${motivation.daysSinceLastActivity} day${motivation.daysSinceLastActivity === 1 ? "" : "s"} ago`}
            </p>
          )}
        </div>
      </div>

      <DnaTrendLine
        points={history.map((h) => h.motivation)}
        stroke="#FF3DBb"
        fill="rgba(255,61,187,0.14)"
        height={72}
      />

      {history.length >= 2 && (
        <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
          <span>{history[0].dayKey}</span>
          <span>{history[history.length - 1].dayKey}</span>
        </div>
      )}
    </DnaPanel>
  );
}

// ---------------------------------------------------------------------------
// Repeated mistakes
// ---------------------------------------------------------------------------

export function DnaMistakes({ profile }: { profile: LearningDnaProfile }) {
  const { mistakes } = profile;

  return (
    <DnaPanel
      icon={AlertOctagon}
      title="Mistakes that keep repeating"
      subtitle="Patterns, not one-off slips — each needs a different fix"
      accent="text-red-300"
      border="border-red-500/25"
    >
      {mistakes.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">
          No repeating mistake pattern detected yet. A category appears here only after it has cost you marks
          several times, so an empty list is good news.
        </p>
      ) : (
        <div className="space-y-3">
          {mistakes.map((mistake) => (
            <div key={mistake.tag} className="rounded-xl border border-white/10 bg-averna-dark/30 p-3.5">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-sm font-semibold text-white">{mistake.label}</span>
                <span className="rounded-full bg-red-500/10 border border-red-500/25 px-2 py-0.5 text-[10px] text-red-300">
                  {mistake.occurrences}x · {mistake.share}%
                </span>
                {mistake.trend && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide",
                      mistake.trend === "rising"
                        ? "text-red-300"
                        : mistake.trend === "falling"
                          ? "text-averna-neon"
                          : "text-gray-400"
                    )}
                  >
                    <Repeat className="h-3 w-3" />
                    {mistake.trend === "rising"
                      ? "more often"
                      : mistake.trend === "falling"
                        ? "improving"
                        : "steady"}
                  </span>
                )}
              </div>

              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-red-400/70"
                  style={{ width: `${Math.max(4, Math.min(100, mistake.share))}%` }}
                />
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">{mistake.fix}</p>
              <p className="text-[10px] text-gray-500 mt-1">{mistake.evidence}</p>
            </div>
          ))}
        </div>
      )}
    </DnaPanel>
  );
}
