import {
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  Clock,
  Fingerprint,
  Gauge,
  HeartPulse,
  Repeat,
  Sunrise,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getDnaTeacherView, type Confidence, type DnaTeacherView } from "@/lib/engine/learning-dna";

/**
 * Teacher-facing Learning DNA briefing.
 *
 * Designed to be readable in about thirty seconds before a lesson: how this
 * student learns, where they are right now, and what to actually do about it.
 *
 * Two deliberate choices:
 *  - Any measurement the engine hasn't established reads "Not established yet"
 *    rather than a plausible default. A teacher acting on an invented preference
 *    is worse off than one who knows the system doesn't know.
 *  - It contains no student-authored content — only measurements and the strategy
 *    they imply — so it's safe to have open in a shared staff room.
 */

const CONFIDENCE_NOTE: Record<Confidence, string> = {
  high: "Well evidenced — safe to plan around.",
  medium: "Reasonably evidenced — treat as a likely pattern.",
  low: "Limited data — treat as a hint, not a conclusion.",
  insufficient: "Not enough data yet — please don't plan around this.",
};

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon",
  medium: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan",
  low: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  insufficient: "border-white/15 bg-white/5 text-gray-400",
};

function Fact({
  icon: Icon,
  label,
  value,
  accent = "text-averna-cyan",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: string;
}) {
  const established = value !== "Not established yet";
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", accent)} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
          {label}
        </span>
      </div>
      <p className={cn("text-sm font-semibold leading-snug", established ? "text-white" : "text-gray-500")}>
        {value}
      </p>
    </div>
  );
}

function ScorePill({
  icon: Icon,
  label,
  value,
  score,
  trendArrow,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  score: number | null;
  trendArrow?: string;
}) {
  const tone =
    score == null
      ? "text-gray-500"
      : score >= 70
        ? "text-averna-neon"
        : score >= 45
          ? "text-averna-cyan"
          : "text-amber-300";

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 truncate">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-sm font-semibold", tone)}>
          {value}
          {trendArrow && <span className="ml-1">{trendArrow}</span>}
        </span>
        {score != null && <span className="text-[10px] text-gray-500 tabular-nums">{score}/100</span>}
      </div>
    </div>
  );
}

const TREND_ARROW: Record<DnaTeacherView["motivation"]["trend"], string> = {
  rising: "↑",
  steady: "→",
  falling: "↓",
};

export async function LearningDnaPanel({ studentId }: { studentId: string }) {
  let view: DnaTeacherView;
  try {
    view = await getDnaTeacherView(studentId);
  } catch {
    return null; // A briefing that can't load must never break the page around it.
  }

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-averna-purple">
            <Brain className="h-5 w-5" /> Learning DNA
          </span>
          <span
            title={CONFIDENCE_NOTE[view.dataConfidence]}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              CONFIDENCE_STYLE[view.dataConfidence]
            )}
          >
            {view.dataConfidence === "insufficient" ? "Forming" : `${view.dataConfidence} confidence`}
          </span>
        </CardTitle>
        <p className="text-xs text-gray-400">
          Learner maturity {view.maturity}/100 · {CONFIDENCE_NOTE[view.dataConfidence]}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ---- How they learn ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Fact icon={Fingerprint} label="Learns best by" value={view.learnsBestBy} accent="text-averna-purple" />
          <Fact icon={Sunrise} label="Best time of day" value={view.bestTime} accent="text-amber-300" />
          <Fact icon={Clock} label="Attention span" value={view.attentionSpan} accent="text-averna-cyan" />
        </div>

        {/* ---- Where they are now ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <ScorePill
            icon={HeartPulse}
            label="Motivation"
            value={view.motivation.label}
            score={view.motivation.score}
            trendArrow={TREND_ARROW[view.motivation.trend]}
          />
          <ScorePill
            icon={Repeat}
            label="Learning efficiency"
            value={view.efficiency.label}
            score={view.efficiency.score}
          />
          <ScorePill icon={Gauge} label="Confidence" value={view.confidence.label} score={view.confidence.score} />
        </div>

        {/* ---- Habits ---- */}
        {(view.strongHabits.length > 0 || view.weakHabits.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-averna-neon mb-2">
                Strong habits
              </p>
              {view.strongHabits.length === 0 ? (
                <p className="text-xs text-gray-500">None established yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {view.strongHabits.map((habit, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300 leading-relaxed">
                      <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon shrink-0 mt-0.5" />
                      <span>{habit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300 mb-2">
                Habits to work on
              </p>
              {view.weakHabits.length === 0 ? (
                <p className="text-xs text-gray-500">Nothing flagged.</p>
              ) : (
                <ul className="space-y-1.5">
                  {view.weakHabits.map((habit, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300 leading-relaxed">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" />
                      <span>{habit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ---- Suggested teaching strategy ---- */}
        <div className="rounded-xl border border-averna-cyan/25 bg-averna-cyan/5 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-averna-cyan mb-2.5">
            <ClipboardList className="h-3.5 w-3.5" /> Suggested teaching strategy
          </p>
          <ul className="space-y-2">
            {view.strategy.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-200 leading-relaxed">
                <span className="text-averna-cyan shrink-0">{i + 1}.</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- Recent behavioural changes ---- */}
        {view.recentChanges.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Recent behavioural changes
            </p>
            <ul className="space-y-1.5">
              {view.recentChanges.map((change) => (
                <li key={change.id} className="flex items-start gap-1.5 text-xs leading-relaxed">
                  {change.direction === "up" ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-averna-neon shrink-0 mt-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-amber-300 shrink-0 mt-0.5" />
                  )}
                  <span className="text-gray-300">
                    <span className="text-white font-medium">{change.label}</span>
                    <span className="text-gray-500"> — {change.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-gray-500">
          Derived automatically from {view.name.split(" ")[0]}&apos;s study behaviour. Nothing here is
          self-reported by the student except confidence check-ins.
        </p>
      </CardContent>
    </Card>
  );
}
