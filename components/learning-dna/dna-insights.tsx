import {
  AlertTriangle,
  Compass,
  Lightbulb,
  Microscope,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DnaChange, DnaInsight, LearningDnaProfile } from "@/lib/engine/learning-dna";
import { ConfidenceBadge, DnaPanel } from "./dna-primitives";

/**
 * AI insights, and — when there aren't any yet — an honest account of why.
 *
 * Each insight exposes its supporting numbers behind a native `<details>`
 * disclosure. That's the whole contract of this feature made visible: the student
 * can always audit the claim, which is what separates a behavioural observation
 * from a horoscope. Using `<details>` keeps it a server component with zero
 * JavaScript.
 */

const TONE: Record<DnaInsight["tone"], { border: string; icon: string; badge: string }> = {
  positive: { border: "border-averna-neon/30", icon: "text-averna-neon", badge: "bg-averna-neon/10" },
  neutral: { border: "border-averna-cyan/30", icon: "text-averna-cyan", badge: "bg-averna-cyan/10" },
  warning: { border: "border-amber-400/30", icon: "text-amber-300", badge: "bg-amber-400/10" },
};

function InsightCard({ insight }: { insight: DnaInsight }) {
  const tone = TONE[insight.tone];
  const Icon = insight.tone === "warning" ? AlertTriangle : insight.tone === "positive" ? Sparkles : Lightbulb;

  return (
    <div className={cn("rounded-xl border bg-averna-dark/30 p-4", tone.border)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", tone.badge, tone.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-white leading-snug">{insight.title}</h3>
            <ConfidenceBadge confidence={insight.confidence} compact />
          </div>
          <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{insight.text}</p>

          <details className="mt-2.5 group">
            <summary className="cursor-pointer text-[11px] text-gray-500 hover:text-averna-cyan transition-colors inline-flex items-center gap-1 list-none">
              <Microscope className="h-3 w-3" />
              Show the evidence ({insight.evidence.length})
            </summary>
            <ul className="mt-2 space-y-1 border-l border-white/10 pl-3">
              {insight.evidence.map((line, i) => (
                <li key={i} className="text-[11px] text-gray-400 leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}

export function DnaInsights({ profile }: { profile: LearningDnaProfile }) {
  const { insights, nextDataNeeded } = profile;

  return (
    <DnaPanel
      icon={Lightbulb}
      title="What your behaviour reveals"
      subtitle={
        insights.length > 0
          ? "Every observation below is measured from your own study data"
          : "Observations appear here once there's enough evidence to support them"
      }
      accent="text-averna-neon"
      border="border-averna-neon/30"
    >
      {insights.length > 0 ? (
        <div className="space-y-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-averna-dark/30 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-400 shrink-0">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Not enough evidence for a personal insight yet
              </h3>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                We could fill this space with generic study tips, but they wouldn&apos;t be about you. Instead,
                here is exactly what we still need to observe — every item below unlocks a real insight.
              </p>
            </div>
          </div>
        </div>
      )}

      {nextDataNeeded.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
            To sharpen your profile
          </p>
          <ul className="space-y-1.5">
            {nextDataNeeded.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-300 leading-relaxed">
                <span className="text-averna-cyan mt-0.5 shrink-0">→</span>
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DnaPanel>
  );
}

// ---------------------------------------------------------------------------
// Recent changes
// ---------------------------------------------------------------------------

function ChangeList({ changes, direction }: { changes: DnaChange[]; direction: "up" | "down" }) {
  const positive = direction === "up";
  const Icon = positive ? TrendingUp : TrendingDown;

  if (changes.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-2">
        {positive
          ? "No measured improvements yet — they'll appear as your numbers move."
          : "Nothing needs attention right now."}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {changes.map((change) => (
        <li key={change.id}>
          <a
            href={change.href}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border bg-averna-dark/30 p-3 transition-colors",
              positive
                ? "border-averna-neon/20 hover:border-averna-neon/40"
                : "border-amber-400/20 hover:border-amber-400/40"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", positive ? "text-averna-neon" : "text-amber-300")} />
            <div className="min-w-0">
              <p className="text-sm text-white font-medium leading-snug">{change.label}</p>
              <p className="text-[11px] text-gray-400 leading-relaxed mt-0.5">{change.detail}</p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Recent improvements" and "Areas requiring attention" are rendered from the
 * same measured change set, so the two lists can never tell contradictory
 * stories about the same metric.
 */
export function DnaChanges({ profile }: { profile: LearningDnaProfile }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <DnaPanel
        icon={TrendingUp}
        title="Recent improvements"
        subtitle="What has measurably moved forward"
        accent="text-averna-neon"
        border="border-averna-neon/25"
      >
        <ChangeList changes={profile.improvements} direction="up" />
      </DnaPanel>

      <DnaPanel
        icon={AlertTriangle}
        title="Areas requiring attention"
        subtitle="Where the data says to look now"
        accent="text-amber-300"
        border="border-amber-400/25"
      >
        <ChangeList changes={profile.attention} direction="down" />
      </DnaPanel>
    </div>
  );
}
