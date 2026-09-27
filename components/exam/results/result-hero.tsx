import Link from "next/link";
import { ArrowLeft, ArrowRight, Flag, Timer } from "lucide-react";
import { Aurora } from "@/components/motion/aurora";
import { SkillIcon } from "@/components/progression/ui";
import { formatDateTime } from "@/lib/utils";
import { BandCountUp } from "./band-count-up";
import { formatDuration, plural, skillWord, type ObjectiveSkill } from "./attempt";

/**
 * Result hero for an exam-v2 Reading / Listening attempt: the band (with an
 * accuracy ring), the raw score, answered count, time, XP and the attempt's
 * badges. Server component; `children` renders under the stats (next band …).
 */

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">{value}</dd>
      {note && <dd className="text-xs text-gray-400">{note}</dd>}
    </div>
  );
}

export function ResultHero({
  skill,
  title,
  scope,
  scopeDetail,
  band,
  correct,
  total,
  answered,
  timeSpent,
  timeLimitMinutes,
  completedAt,
  xp,
  mock,
  mockHref,
  auto,
  backHref,
  backLabel,
  children,
}: {
  skill: ObjectiveSkill;
  title: string;
  /** "Passage 2" / "Part 3" / "Full test". */
  scope: string;
  /** e.g. the passage title when one passage was practised. */
  scopeDetail?: string | null;
  band: number;
  correct: number;
  total: number;
  answered: number;
  timeSpent: number;
  timeLimitMinutes?: number | null;
  completedAt: Date;
  /** XP paid for this attempt (null when the ledger is unavailable). */
  xp: number | null;
  mock: boolean;
  /** Link to the whole mock exam result, when known. */
  mockHref?: string | null;
  auto: boolean;
  backHref: string;
  backLabel: string;
  children?: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const blanks = Math.max(0, total - answered);
  const estimated = total !== 40;
  const word = skillWord(skill);

  return (
    <section
      aria-labelledby="result-title"
      className="av-panel av-panel-hero relative isolate overflow-hidden rounded-3xl px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-5"
    >
      <Aurora intensity="soft" />
      <Link
        href={backHref}
        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {backLabel}
      </Link>

      <div className="mt-2 flex items-start gap-4">
        <SkillIcon skill={skill} className="h-12 w-12 rounded-2xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">
            {mock ? `Mock exam · ${word}` : `${word} results`} · {scope}
          </p>
          <h1 id="result-title" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          {scopeDetail && <p className="mt-1 text-sm text-gray-300">{scopeDetail}</p>}
          <p className="mt-1 text-xs text-gray-500">Submitted {formatDateTime(completedAt)}</p>
        </div>
      </div>

      {(mock || auto) && (
        <ul role="list" aria-label="About this attempt" className="mt-4 flex flex-wrap gap-2">
          {mock && (
            <li>
              {mockHref ? (
                <Link
                  href={mockHref}
                  className="glow-hover inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/[0.07] px-3 text-xs font-semibold text-averna-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  Mock exam section
                  <span className="font-normal text-gray-300">· See the full mock result</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              ) : (
                <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/[0.07] px-3 text-xs font-semibold text-averna-neon">
                  <Flag className="h-3.5 w-3.5" aria-hidden />
                  Mock exam section
                </span>
              )}
            </li>
          )}
          {auto && (
            <li className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-xs font-medium text-amber-100">
              <Timer className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              Submitted automatically when time ran out
            </li>
          )}
        </ul>
      )}

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div className="relative mx-auto h-36 w-36 shrink-0 sm:mx-0">
          <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
            <circle cx="60" cy="60" r={RING_R} fill="none" strokeWidth="8" className="stroke-white/10" />
            <circle
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              stroke="currentColor"
              className="text-averna-neon"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - Math.max(0, Math.min(1, pct / 100)))}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <BandCountUp value={band} className="text-5xl font-bold tabular-nums tracking-tight text-white" />
            <span aria-hidden="true" className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              {estimated ? "Est. band" : "Band"}
            </span>
          </div>
          <p className="sr-only">
            {estimated ? "Estimated band" : "Band"} {band.toFixed(1)}. {correct} of {total} correct, {pct} percent.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2.5">
          <Stat label="Correct" value={`${correct} / ${total}`} note={`${pct}% accuracy`} />
          <Stat label="Answered" value={`${answered} / ${total}`} note={blanks > 0 ? `${blanks} left blank` : "Nothing left blank"} />
          <Stat
            label="Time"
            value={formatDuration(timeSpent)}
            note={timeLimitMinutes ? `of ${timeLimitMinutes} min` : null}
          />
          <Stat
            label="XP earned"
            value={xp == null ? "—" : xp > 0 ? `+${xp} XP` : "0 XP"}
            note={xp === 0 && correct === 0 ? "Get an answer right to earn XP" : null}
          />
        </dl>
      </div>

      {children && <div className="mt-6 space-y-3">{children}</div>}

      {blanks === total && total > 0 && (
        <p className="mt-4 text-sm text-gray-400">No answers were recorded for this attempt — {plural(total, "question")} counted as blank.</p>
      )}
    </section>
  );
}
