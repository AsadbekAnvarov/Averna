import { formatBand, formatDay, type SkillForecast } from "@/lib/forecast/band-forecast";

const DAY = 86_400_000;
const W = 96;
const H = 32;
const PAD = 3;

/** Text equivalent of the sparkline (also its accessible name). */
export function sparklineSummary(s: SkillForecast, target: number, todayKey: string): string {
  if (!s.points.length) return `${s.label}: no recent results.`;
  const bands = s.points.map((p) => p.band);
  const low = Math.min(...bands);
  const high = Math.max(...bands);
  const span = low === high ? `all ${formatBand(low)}` : `from ${formatBand(low)} to ${formatBand(high)}`;
  const base = `${s.label}: ${s.n} result${s.n === 1 ? "" : "s"}, ${span}`;
  if (s.path) return `${base}; the dashed line projects ${formatBand(target)} by ${formatDay(s.path.date, todayKey)}.`;
  if (s.status === "rising") return `${base}; rising slowly.`;
  if (s.status === "flat") return `${base}; no upward trend.`;
  return `${base}.`;
}

/**
 * Past results (dots + line) and, for a rising skill, a dashed projection from
 * today toward the target. Colours come from text tokens (currentColor).
 */
export function ForecastSparkline({ s, target, now, todayKey }: { s: SkillForecast; target: number; now: number; todayKey: string }) {
  const label = sparklineSummary(s, target, todayKey);
  if (!s.points.length) return null;

  const first = s.points[0].at;
  const projDays = s.status === "rising" ? Math.min(120, Math.max(14, s.path?.days ?? 60)) : 0;
  const end = now + Math.max(projDays, 3) * DAY;
  const start = Math.min(first, now - 7 * DAY);
  const endBand =
    s.status === "rising" && s.now != null
      ? Math.min(9, Math.min(Math.max(target, s.now), s.now + ((s.effectiveSlope30 ?? 0) / 30) * projDays))
      : null;
  const values = [...s.points.map((p) => p.band), target, ...(s.now != null ? [s.now] : []), ...(endBand != null ? [endBand] : [])];
  const lo = Math.max(0, Math.min(...values) - 0.5);
  const hi = Math.min(9, Math.max(...values) + 0.5);
  const x = (t: number) => PAD + ((t - start) / (end - start || 1)) * (W - 2 * PAD);
  const y = (b: number) => H - PAD - ((b - lo) / (hi - lo || 1)) * (H - 2 * PAD);
  const line = s.points.map((p) => `${x(p.at).toFixed(1)},${y(p.band).toFixed(1)}`).join(" ");

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="h-8 w-24 shrink-0 overflow-visible text-study-ink">
      <title>{label}</title>
      {/* Target band */}
      <line x1={PAD} x2={W - PAD} y1={y(target)} y2={y(target)} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="1 3" />
      {s.points.length > 1 && <polyline points={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />}
      {s.points.map((p, i) => (
        <circle key={i} cx={x(p.at)} cy={y(p.band)} r={1.8} fill="currentColor" />
      ))}
      {s.now != null && endBand != null && (
        <line
          x1={x(now)}
          y1={y(s.now)}
          x2={x(end)}
          y2={y(endBand)}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          className="text-averna-pink"
        />
      )}
    </svg>
  );
}
