import {
  Brain,
  Clock,
  Fingerprint,
  Flame,
  Gauge,
  Rocket,
  Scale,
  Sunrise,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningDnaProfile } from "@/lib/engine/learning-dna";
// Imported from config rather than the barrel: labels are pure data, so this keeps
// the database-touching engine modules out of the component's import graph.
import { CHANNEL_LABEL, STYLE_HINT } from "@/lib/engine/learning-dna/config";
import { ConfidenceBadge, DnaBars, DnaMetricCard, DnaPanel, DnaScoreCard } from "./dna-primitives";

/**
 * The headline of the Learning DNA page: a maturity ring that says how well the
 * engine knows this learner, then the nine cards that answer the questions the
 * system exists to answer.
 *
 * Cards are ordered by how *actionable* they are rather than by how impressive
 * they look — style, focus and best time change what a student does tonight;
 * balance and speed are context.
 */

function hh(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** Circular maturity gauge, drawn with a stroke-dasharray arc (no chart library). */
function MaturityRing({ value, confidence }: { value: number; confidence: string }) {
  const size = 132;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, value));
  const dash = (progress / 100) * circumference;

  const tone =
    progress >= 70 ? "#00FF94" : progress >= 45 ? "#00E5FF" : progress >= 25 ? "#B14EFF" : "#94a3b8";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white leading-none">{progress}</span>
        <span className="text-[10px] uppercase tracking-wider text-gray-400 mt-1">maturity</span>
        <span className="text-[10px] text-gray-500">{confidence}</span>
      </div>
    </div>
  );
}

export function DnaOverview({ profile }: { profile: LearningDnaProfile }) {
  const { style, focus, timing, coverage } = profile;

  const preferredChannels =
    style.preferred != null
      ? (style.scores.find((s) => s.style === style.preferred)?.channels ?? [])
          .map((c) => CHANNEL_LABEL[c])
          .join(" & ")
      : null;

  return (
    <div className="space-y-5">
      {/* ---------- Hero ---------- */}
      <div className="glass-strong rounded-2xl border border-averna-purple/30 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <MaturityRing value={profile.maturity.value ?? 0} confidence={profile.confidence} />

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
              <h2 className="text-xl font-bold text-white">
                {style.label ?? "Your Learning DNA is forming"}
              </h2>
              <ConfidenceBadge confidence={profile.confidence} sampleSize={profile.dataPoints} />
            </div>

            <p className="text-sm text-gray-300 leading-relaxed">
              {style.preferred != null
                ? STYLE_HINT[style.preferred]
                : "Every learner is different. As you practise, this profile learns how you learn — and everything Averna recommends adapts with it."}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1.5 mt-3 text-xs text-gray-400">
              <span>
                <strong className="text-white">{profile.dataPoints}</strong> observations
              </span>
              <span>
                <strong className="text-white">{coverage.activeDays}</strong> active days
              </span>
              <span>
                <strong className="text-white">{coverage.historySpanDays}</strong> days of history
              </span>
              <span>
                <strong className="text-white">{coverage.skillsTouched}</strong> skills practised
              </span>
            </div>

            {/* How complete the picture is — the engine's own honesty meter. */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                <span>Profile completeness</span>
                <span className="tabular-nums">{coverage.completeness}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon transition-all duration-1000"
                  style={{ width: `${coverage.completeness}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Metric cards ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DnaMetricCard
          icon={Fingerprint}
          label="Learning style"
          value={style.label}
          caption={preferredChannels ? `Strongest through ${preferredChannels}.` : undefined}
          confidence={style.confidence}
          sampleSize={style.scores.reduce((s, x) => s + x.events, 0)}
          basis={style.basis}
          accent="text-averna-purple"
          pending="Practise through a few different channels — reading, audio, speaking, flashcards — so we can compare your results across them."
        />

        <DnaMetricCard
          icon={Timer}
          label="Focus duration"
          value={focus.idealLessonMin}
          unit="min"
          caption={
            focus.fatiguePointMin != null
              ? `Accuracy drops about ${focus.declinePoints} points beyond ${focus.fatiguePointMin} minutes.`
              : focus.medianSessionMin != null
                ? `Your typical session is ${focus.medianSessionMin} minutes.`
                : undefined
          }
          confidence={focus.confidence}
          sampleSize={focus.sampleSize}
          basis={focus.basis}
          accent="text-averna-cyan"
          pending="Use the focus timer while you study so we can measure how long your concentration actually holds."
        />

        <DnaMetricCard
          icon={Sunrise}
          label="Best study time"
          value={
            timing.optimalHourStart != null && timing.optimalHourEnd != null
              ? `${hh(timing.optimalHourStart)}–${hh(timing.optimalHourEnd)}`
              : null
          }
          caption={
            timing.advantagePoints != null
              ? `${timing.advantagePoints} accuracy points better than your other hours.`
              : undefined
          }
          confidence={timing.confidence}
          sampleSize={timing.sampleSize}
          basis={timing.basis}
          accent="text-amber-300"
          pending="Study at different times of day — that's the only way to find the hours where you perform best."
        />

        <DnaScoreCard
          icon={Brain}
          label="Retention"
          score={profile.retention}
          accent="text-emerald-400"
          caption={
            profile.memoryHalfLifeDays != null
              ? `Recall halves after about ${Math.round(profile.memoryHalfLifeDays)} days without review.`
              : undefined
          }
          pending="Review some vocabulary or mistakes — recall after a delay is the only honest measure of memory."
        />

        <DnaScoreCard
          icon={Gauge}
          label="Confidence"
          score={profile.learnerConfidence}
          accent="text-averna-pink"
          pending="Log a confidence check-in after a session, and keep practising speaking — the activity confidence shows up in most."
        />

        <DnaScoreCard
          icon={Flame}
          label="Consistency"
          score={profile.consistency}
          accent="text-orange-400"
          pending="Study on a few separate days so we can tell a habit from a burst."
        />

        <DnaMetricCard
          icon={Rocket}
          label="Learning speed"
          value={profile.learningSpeed.bandsPerTenActiveDays}
          unit="band / 10 study days"
          caption={
            profile.learningSpeed.label != null
              ? `${profile.learningSpeed.label.charAt(0).toUpperCase()}${profile.learningSpeed.label.slice(1)} progress${
                  profile.learningSpeed.totalBandGain != null
                    ? ` — ${profile.learningSpeed.totalBandGain >= 0 ? "+" : ""}${profile.learningSpeed.totalBandGain} band so far.`
                    : "."
                }`
              : undefined
          }
          confidence={profile.learningSpeed.score.confidence}
          sampleSize={profile.learningSpeed.score.sampleSize}
          basis={profile.learningSpeed.score.basis}
          accent="text-averna-neon"
          pending="Take a few more graded tests so we can measure your rate of improvement, not just your level."
        />

        <DnaScoreCard
          icon={Scale}
          label="Skill balance"
          score={profile.skillBalance}
          accent="text-averna-blue"
          pending="Practise at least two skills — balance is only meaningful once there's something to compare."
        />

        <DnaScoreCard
          icon={Clock}
          label="Revision efficiency"
          score={profile.revisionEfficiency}
          accent="text-teal-300"
          pending="Start reviewing items so we can see how much lasting memory each review buys you."
        />
      </div>

      {/* ---------- The distributions behind the claims ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <DnaPanel
          icon={Fingerprint}
          title="How you learn"
          subtitle="Accuracy and engagement per channel"
          accent="text-averna-purple"
          border="border-averna-purple/25"
        >
          <DnaBars
            // A style score blends performance with engagement — it's a 0-100
            // score, not a percentage, so it carries no "%".
            suffix=""
            rows={style.scores.map((s) => ({
              label: s.label,
              value: s.score,
              meta: s.events > 0 ? `${s.events} sessions` : undefined,
              highlight: s.style === style.preferred,
            }))}
            emptyLabel="No channel data yet."
          />
          {style.margin != null && style.preferred == null && (
            <p className="text-[11px] text-gray-500 mt-3">
              Your top two channels are only {style.margin} points apart — too close to call a preference yet.
            </p>
          )}
        </DnaPanel>

        <DnaPanel
          icon={Sunrise}
          title="When you perform"
          subtitle="Average accuracy by time of day"
          accent="text-amber-300"
          border="border-amber-400/25"
        >
          <DnaBars
            rows={timing.dayparts.map((d) => ({
              label: `${d.label} (${hh(d.fromHour)}–${hh(d.toHour)})`,
              value: d.accuracy,
              meta: d.sessions > 0 ? `${d.sessions} sessions` : undefined,
              highlight: d.daypart === timing.optimalDaypart,
              color: d.daypart === timing.optimalDaypart ? "#fbbf24" : undefined,
            }))}
            emptyLabel="No scored sessions yet."
          />
        </DnaPanel>

        <DnaPanel
          icon={Timer}
          title="How long you stay sharp"
          subtitle="Average accuracy by session length"
          accent="text-averna-cyan"
          border="border-averna-cyan/25"
        >
          <DnaBars
            rows={focus.bands.map((b) => ({
              label: b.label,
              value: b.accuracy,
              meta: b.sessions > 0 ? `${b.sessions} sessions` : undefined,
              highlight:
                focus.focusMinutes != null &&
                b.fromMin <= focus.focusMinutes &&
                (b.toMin == null || b.toMin > focus.focusMinutes),
              color:
                focus.fatiguePointMin != null && b.fromMin >= focus.fatiguePointMin ? "#f87171" : undefined,
            }))}
            emptyLabel="No timed sessions yet."
          />
          {focus.fatiguePointMin != null && (
            <p className={cn("text-[11px] mt-3 text-red-300/80")}>
              Bars in red are past your measured fatigue point ({focus.fatiguePointMin} min).
            </p>
          )}
        </DnaPanel>
      </div>
    </div>
  );
}
