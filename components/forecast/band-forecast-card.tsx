"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, LineChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DASH_CARD, DashRow } from "@/components/ui/dash-row";
import { cn } from "@/lib/utils";
import {
  bandForecast,
  describeWhatIf,
  examLine,
  FORECAST,
  formatBand,
  formatDay,
  overallLine,
  type BandForecast,
  type ForecastInput,
  type SkillForecast,
} from "@/lib/forecast/band-forecast";
import { ForecastSparkline } from "./forecast-sparkline";
import { useExamDate } from "./use-exam-date";

const range = (r: [number, number] | null) => (r ? `${formatBand(r[0])}–${formatBand(r[1])}` : "");

function TrendArrow({ trend }: { trend: SkillForecast["trend"] }) {
  if (!trend) return null;
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : ArrowRight;
  const word = trend === "up" ? "rising" : trend === "down" ? "falling" : "steady";
  return (
    <span className={cn("inline-flex", trend === "up" ? "text-averna-neon" : trend === "down" ? "text-amber-400" : "text-gray-400")}>
      <Icon className="h-4 w-4" aria-hidden />
      <span className="sr-only">{word}</span>
    </span>
  );
}

function SkillRow({ s, f, now }: { s: SkillForecast; f: BandForecast; now: number }) {
  const needsPractice = s.status === "need-data" || s.status === "too-early";
  const between =
    s.path && (s.path.earliest !== s.path.date || s.path.latest !== s.path.date)
      ? `Between ${formatDay(s.path.earliest, f.todayKey)} and ${s.path.latest ? formatDay(s.path.latest, f.todayKey) : "later"}.`
      : null;
  return (
    <li className="flex min-h-[44px] items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3" data-testid={`forecast-${s.skill}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">{s.label}</h4>
          <span className="flex items-center gap-1 text-base font-bold tabular-nums text-white">
            {s.nowBand != null ? `≈ ${formatBand(s.nowBand)}` : "—"}
            <TrendArrow trend={s.trend} />
          </span>
        </div>
        {s.range && (
          <p className="text-xs text-gray-400">
            Range {range(s.range)} · {s.n} result{s.n === 1 ? "" : "s"}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-300">{s.message}</p>
        {between && <p className="text-xs text-gray-400">{between}</p>}
        {needsPractice && (
          <Link
            href={s.href}
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-study-ink hover:underline focus-visible:outline focus-visible:outline-2"
          >
            Practise {s.label} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
      <ForecastSparkline s={s} target={f.targetBand} now={now} todayKey={f.todayKey} />
    </li>
  );
}

/**
 * The Progress hero: "Now ≈ 6.0 (5.5–6.5) · at this pace 7.0 by 15 December",
 * four skill rows (sparkline, now/range, trend, path date or what to practise)
 * and a what-if pace control. Model and rules: lib/forecast/band-forecast.ts.
 */
export function BandForecastCard({ input }: { input: ForecastInput }) {
  const [examDate] = useExamDate();
  const [extra, setExtra] = useState(0);
  const base = useMemo(() => bandForecast(input, { examDate }), [input, examDate]);
  const f = useMemo(() => (extra ? bandForecast(input, { examDate, extraPerWeek: extra }) : base), [input, examDate, extra, base]);
  const target = formatBand(f.targetBand);
  const exam = examLine(f);
  const pathWindow =
    f.overall?.path && f.overall.path.earliest !== f.overall.path.latest
      ? `Likely between ${formatDay(f.overall.path.earliest, f.todayKey)} and ${f.overall.path.latest ? formatDay(f.overall.path.latest, f.todayKey) : "later"}.`
      : null;

  return (
    <Card id="forecast" aria-labelledby="forecast-title" className={cn(DASH_CARD, "glass scroll-mt-24 border-averna-cyan/30")}>
      <CardHeader>
        <CardTitle id="forecast-title" className="flex items-center gap-2 text-white">
          <LineChart className="h-5 w-5 shrink-0 text-study-ink" aria-hidden />
          Band forecast
        </CardTitle>
        <p className="text-sm text-gray-300">Where you are now, and when you could reach Band {target}.</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <DashRow>
          <div className="flex flex-col gap-4">
            <section aria-label="Overall" className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-gray-300">Overall now</p>
              {f.overall ? (
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                  <span className="text-3xl font-bold text-white">≈ {formatBand(f.overall.now)}</span>
                  <span className="text-sm text-gray-300">range {range(f.overall.range)}</span>
                </p>
              ) : (
                <p className="mt-1 text-xl font-semibold text-white">Not enough results yet</p>
              )}
              <p className="mt-2 text-sm text-gray-300">
                Target <span className="font-semibold text-white">{target}</span> · <span>{overallLine(f)}</span>
              </p>
              {pathWindow && <p className="mt-1 text-xs text-gray-400">{pathWindow}</p>}
              {exam && <p className="mt-1 text-sm text-gray-300">{exam}</p>}
            </section>

            <section aria-labelledby="whatif-title" className="rounded-xl border border-white/10 p-4">
              <h4 id="whatif-title" className="text-sm font-semibold text-white">
                Extra practice per week
              </h4>
              <div role="radiogroup" aria-labelledby="whatif-title" className="mt-2 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
                {FORECAST.whatIf.options.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={extra === n}
                    aria-label={n === 0 ? "No extra sessions" : `${n} extra session${n === 1 ? "" : "s"} per skill`}
                    onClick={() => setExtra(n)}
                    className={cn(
                      "min-h-11 min-w-[3.25rem] rounded-lg px-3 text-sm font-medium tabular-nums transition-colors",
                      extra === n ? "bg-averna-neon/15 text-averna-neon" : "text-gray-400 hover:text-white"
                    )}
                  >
                    {n === 0 ? "0" : `+${n}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Sessions per skill on top of your {f.pace} a week (a mock test counts as one of each). More practice helps, with diminishing returns.
              </p>
              <p aria-live="polite" data-testid="whatif-summary" className="mt-2 text-sm text-gray-200">
                {describeWhatIf(f, base)}
              </p>
            </section>
          </div>

          <ul aria-label="Forecast by skill" className="flex flex-col gap-2">
            {f.skills.map((s) => (
              <SkillRow key={s.skill} s={s} f={f} now={input.now} />
            ))}
          </ul>
        </DashRow>
        <p className="text-xs text-gray-400">
          Estimates from {f.totalResults} result{f.totalResults === 1 ? "" : "s"}. Real exam conditions vary.
        </p>
      </CardContent>
    </Card>
  );
}
