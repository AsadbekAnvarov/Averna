import { cn } from "@/lib/utils";
import { SKILL_TONE, SkillIcon } from "@/components/progression/ui";
import {
  formatBand,
  formatDelta,
  type CriteriaBlock,
  type DistributionBin,
  type SectionAverage,
  type TrendPoint,
} from "@/lib/teacher/mock-analytics-core";

/**
 * The visual parts of /teacher/mock: section averages, Writing / Speaking
 * criteria, the band distribution and the monthly trend. Plain CSS / SVG, no
 * chart library. Every chart is aria-hidden and paired with a visually
 * hidden data table (or visible text) carrying the same numbers.
 * Server components, no hooks.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Text colour of a band against the target: reached / within half a band / further below. */
export function targetTone(delta: number | null | undefined): string {
  if (typeof delta !== "number") return "text-gray-400";
  if (delta >= 0) return "text-averna-neon";
  if (delta >= -0.5) return "text-amber-300";
  return "text-averna-pink";
}

/** A 0–9 band bar with an optional target marker. Decorative: the value is always printed next to it. */
export function BandBar({
  value,
  target = null,
  barClassName,
  className,
}: {
  value: number | null;
  target?: number | null;
  barClassName: string;
  className?: string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / 9) * 100));
  return (
    <span aria-hidden className={cn("relative block h-2 w-full rounded-full bg-white/10", className)}>
      <span className={cn("block h-full rounded-full", barClassName)} style={{ width: `${pct}%` }} />
      {target !== null && (
        // bg-current + text-white: white on dark, near-black in the light theme.
        <span
          className="absolute -bottom-1 -top-1 w-0.5 rounded-full bg-current text-white opacity-80"
          style={{ left: `calc(${Math.max(0, Math.min(100, (target / 9) * 100))}% - 1px)` }}
        />
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Section averages
// ---------------------------------------------------------------------------

export function SectionAverages({ sections, target }: { sections: SectionAverage[]; target: number | null }) {
  return (
    <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {sections.map((s) => {
        const delta = formatDelta(s.vsTarget);
        return (
          <li key={s.section} className="glass rounded-2xl border border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <SkillIcon skill={s.section} className="h-9 w-9" />
                <h3 className={cn("truncate font-semibold", SKILL_TONE[s.section].text)}>{s.label}</h3>
              </div>
              <p className="shrink-0 text-2xl font-bold tabular-nums text-white">
                <span className="sr-only">Average band </span>
                {formatBand(s.average)}
              </p>
            </div>
            <BandBar value={s.average} target={target} barClassName={SKILL_TONE[s.section].bar} className="mt-3" />
            <p className="mt-2 text-xs text-gray-400">
              {s.students ? `${plural(s.students, "student")}` : "No results yet"}
              {delta && (
                <>
                  {" · "}
                  <span className={cn("font-semibold", targetTone(s.vsTarget))}>{delta}</span> vs own targets
                </>
              )}
              {s.blank > 0 && ` · ${s.blank} blank left out`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Writing / Speaking criteria
// ---------------------------------------------------------------------------

export function CriteriaCard({ skill, block }: { skill: "WRITING" | "SPEAKING"; block: CriteriaBlock }) {
  const titleId = `mock-criteria-${skill.toLowerCase()}`;
  // "Lowest" only marks a clear minimum (pronunciation is teacher-rated only, so it isn't compared).
  const rated = block.criteria.filter((c): c is typeof c & { average: number } => c.average !== null && c.key !== "pronunciation");
  const min = rated.length > 1 ? Math.min(...rated.map((c) => c.average)) : null;
  const atMin = min === null ? [] : rated.filter((c) => Math.abs(c.average - min) < 0.05);
  const lowest = atMin.length === 1 ? atMin[0] : null;
  return (
    <section aria-labelledby={titleId} className="glass rounded-2xl border border-white/10 p-5">
      <div className="flex items-center gap-2.5">
        <SkillIcon skill={skill} className="h-9 w-9" />
        <div className="min-w-0">
          <h3 id={titleId} className="font-semibold text-white">
            {skill === "WRITING" ? "Writing criteria" : "Speaking criteria"}
          </h3>
          <p className="text-xs text-gray-400">
            {block.sections
              ? `${plural(block.sections, "latest mock")} · ${block.reviewed} reviewed by a teacher`
              : "No results yet"}
          </p>
        </div>
      </div>
      {block.sections > 0 && (
        <ul role="list" className="mt-4 space-y-3.5">
          {block.criteria.map((c) => (
            <li key={c.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-sm text-gray-200">
                  {c.label}
                  {lowest?.key === c.key && (
                    <span className="ml-2 inline-block rounded-full bg-averna-pink/15 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-averna-pink">
                      Lowest
                    </span>
                  )}
                </p>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-white">{formatBand(c.average)}</p>
              </div>
              <BandBar value={c.average} barClassName={SKILL_TONE[skill].bar} className="mt-1.5" />
              {c.note && (
                <p className="mt-1 text-[11px] text-gray-500">
                  {c.note}
                  {c.students > 0 ? ` · ${plural(c.students, "rating")}` : " · not rated yet"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Band distribution
// ---------------------------------------------------------------------------

const DIST_BAR_PX = 120;

export function BandDistribution({ bins, total }: { bins: DistributionBin[]; total: number }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  const target = bins.find((b) => b.isTarget);
  return (
    <figure>
      <div aria-hidden className="flex items-end gap-1 sm:gap-2" style={{ height: DIST_BAR_PX + 22 }}>
        {bins.map((b) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold tabular-nums text-gray-200">{b.count > 0 ? b.count : ""}</span>
            <span
              className={cn(
                "w-full max-w-[2.75rem] rounded-t-md",
                b.isTarget ? "bg-averna-neon/80" : "bg-averna-cyan/55",
                b.count === 0 && "bg-white/[0.06]"
              )}
              style={{ height: b.count > 0 ? Math.max(6, Math.round((b.count / max) * DIST_BAR_PX)) : 3 }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-1 border-t border-white/10 pt-1.5 sm:gap-2">
        {bins.map((b) => (
          <span
            key={b.label}
            className={cn(
              "min-w-0 flex-1 text-center text-[10px] tabular-nums sm:text-xs",
              b.isTarget ? "font-semibold text-averna-neon" : "text-gray-400"
            )}
          >
            {b.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-xs text-gray-400">
        Latest overall band of {plural(total, "student")}
        {target ? (
          <>
            {" · "}
            <span className="font-semibold text-averna-neon">{target.label}</span> holds the group target
          </>
        ) : null}
      </figcaption>
      <table className="sr-only">
        <caption>Students by latest overall band</caption>
        <thead>
          <tr>
            <th scope="col">Overall band</th>
            <th scope="col">Students</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((b) => (
            <tr key={b.label}>
              <th scope="row">
                {b.label}
                {b.isTarget ? " (group target)" : ""}
              </th>
              <td>{b.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Monthly trend
// ---------------------------------------------------------------------------

/** y-axis range: whole bands around the data and the target, at least two bands tall. */
function yRange(values: number[]): { lo: number; hi: number } {
  let lo = Math.max(0, Math.floor(Math.min(...values) - 0.5));
  let hi = Math.min(9, Math.ceil(Math.max(...values) + 0.5));
  while (hi - lo < 2) {
    if (hi < 9) hi += 1;
    else lo = Math.max(0, lo - 1);
    if (lo === 0 && hi === 9) break;
  }
  return { lo, hi };
}

export function TrendChart({ points, change, target }: { points: TrendPoint[]; change: number | null; target: number | null }) {
  const values = points.map((p) => p.average).filter((v): v is number => v !== null);
  if (!values.length) return null;
  const { lo, hi } = yRange(target !== null ? [...values, target] : values);
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (v: number) => ((hi - v) / (hi - lo)) * 100;
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  // Line segments between consecutive months that both have mocks.
  const segments: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (p.average === null) {
      if (run.length > 1) segments.push(run.join(" "));
      run = [];
      return;
    }
    run.push(`${x(i).toFixed(2)},${y(p.average).toFixed(2)}`);
  });
  if (run.length > 1) segments.push(run.join(" "));

  const first = points.find((p) => p.average !== null);
  const size = change === null ? "" : Math.abs(change).toFixed(1);
  const crowded = points.length > 7;

  return (
    <figure>
      <p className="mb-4 text-sm text-gray-300">
        {change === null || !first ? (
          "The trend line appears once mocks have been taken in two different months."
        ) : (
          <>
            <span className={cn("font-semibold", change > 0.04 ? "text-averna-neon" : change < -0.04 ? "text-averna-pink" : "text-gray-200")}>
              {change > 0.04 ? `Up ${size}` : change < -0.04 ? `Down ${size}` : "Level"}
            </span>{" "}
            since {first.long}
          </>
        )}
      </p>
      <div aria-hidden className="relative h-48 pb-7 pl-8 pr-3 pt-5 sm:h-56">
        <div className="relative h-full w-full">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -left-8 w-6 -translate-y-1/2 text-right text-[10px] tabular-nums text-gray-500"
              style={{ top: `${y(t)}%` }}
            >
              {t}
            </span>
          ))}
          {/* currentColor throughout, so the light theme's colour overrides apply */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible text-white">
            {ticks.map((t) => (
              <line key={t} x1="0" x2="100" y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {target !== null && (
              <line
                x1="0"
                x2="100"
                y1={y(target)}
                y2={y(target)}
                stroke="currentColor"
                strokeOpacity="0.6"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <g className="text-averna-neon">
              {segments.map((pts) => (
                <polyline
                  key={pts}
                  points={pts}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          </svg>
          {points.map((p, i) =>
            p.average === null ? null : (
              <span key={p.key}>
                <span
                  className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-averna-dark bg-averna-neon shadow-[0_0_12px_rgba(0,255,148,0.6)]"
                  style={{ left: `${x(i)}%`, top: `${y(p.average)}%` }}
                />
                <span
                  className={cn(
                    "absolute -translate-x-1/2 text-[10px] font-semibold tabular-nums text-white sm:text-[11px]",
                    crowded && i !== points.length - 1 && "hidden sm:block"
                  )}
                  style={{ left: `${x(i)}%`, top: `calc(${y(p.average)}% - 1.35rem)` }}
                >
                  {formatBand(p.average)}
                </span>
              </span>
            )
          )}
          {points.map((p, i) => (
            <span
              key={p.key}
              className={cn(
                "absolute top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400",
                crowded && i % 2 === 1 && i !== points.length - 1 && "hidden sm:inline"
              )}
              style={{ left: `${x(i)}%` }}
            >
              {p.label}
              {(i === 0 || p.label === "Jan") && <span className="text-gray-500"> {String(p.year).slice(2)}</span>}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-gray-400">
        Average of each student&apos;s last mock of the month (Tashkent time)
        {target !== null ? ` · dashed line: group target ${formatBand(target)}` : ""}
      </figcaption>
      <table className="sr-only">
        <caption>Average overall band by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Average overall</th>
            <th scope="col">Students</th>
            <th scope="col">Mocks finished</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <th scope="row">{p.long}</th>
              <td>{p.average === null ? "No mocks" : formatBand(p.average)}</td>
              <td>{p.students}</td>
              <td>{p.mocks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
