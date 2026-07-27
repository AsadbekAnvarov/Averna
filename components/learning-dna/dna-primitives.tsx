import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Confidence, DnaScore } from "@/lib/engine/learning-dna";

/**
 * Shared building blocks for the Learning DNA surfaces.
 *
 * One principle drives all of them: **a number is never shown without its
 * provenance**. Every metric card renders a confidence badge and carries the
 * engine's `basis` string as a tooltip, and a metric the engine declined to
 * measure renders as an honest "not measured yet" state rather than a zero.
 *
 * That is a design decision, not a nicety. A premium dashboard makes anything it
 * displays look authoritative, so showing "Retention 0%" for a student who has
 * simply never reviewed anything would be actively misleading — and would teach
 * the student to distrust every other number on the page.
 */

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

const CONFIDENCE_STYLE: Record<Confidence, { label: string; className: string }> = {
  high: { label: "High confidence", className: "border-averna-neon/40 bg-averna-neon/10 text-averna-neon" },
  medium: { label: "Medium confidence", className: "border-averna-cyan/40 bg-averna-cyan/10 text-averna-cyan" },
  low: { label: "Low confidence", className: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  insufficient: { label: "Not enough data", className: "border-white/15 bg-white/5 text-gray-400" },
};

export function ConfidenceBadge({
  confidence,
  sampleSize,
  compact = false,
}: {
  confidence: Confidence;
  sampleSize?: number;
  compact?: boolean;
}) {
  const style = CONFIDENCE_STYLE[confidence];
  return (
    <span
      title={
        sampleSize != null
          ? `${style.label} — based on ${sampleSize} observation${sampleSize === 1 ? "" : "s"}`
          : style.label
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
        style.className
      )}
    >
      {compact ? confidence === "insufficient" ? "—" : confidence : style.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

/**
 * The premium metric card used across the Learning DNA page.
 *
 * `value` is what to display when the engine produced one; when it's null the
 * card switches to its unmeasured state and shows `pending` — the concrete
 * behaviour that would let the engine answer.
 */
export function DnaMetricCard({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  confidence,
  sampleSize,
  basis,
  accent = "text-averna-cyan",
  ring,
  pending,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number | null;
  unit?: string;
  caption?: string;
  confidence: Confidence;
  sampleSize?: number;
  basis?: string;
  accent?: string;
  /** 0-100; renders a progress meter under the value. */
  ring?: number | null;
  /** What the student can do so this becomes measurable. */
  pending?: string;
  children?: React.ReactNode;
}) {
  const measured = value != null && confidence !== "insufficient";

  return (
    <div
      className={cn(
        "glass rounded-xl border border-white/10 p-5 flex flex-col gap-3 h-full hover-lift",
        measured && "border-white/15"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 shrink-0", accent)}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 truncate">
            {label}
          </span>
        </div>
        <ConfidenceBadge confidence={confidence} sampleSize={sampleSize} compact />
      </div>

      {measured ? (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold leading-none", accent)}>{value}</span>
            {unit && <span className="text-sm text-gray-400">{unit}</span>}
          </div>
          {ring != null && (
            // `accent` sits on the track so the fill's `bg-current` resolves to
            // the card's accent colour without needing a second colour prop.
            <div className={cn("h-1.5 rounded-full bg-white/10 overflow-hidden", accent)}>
              <div
                className="h-full rounded-full bg-current opacity-80 transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, ring))}%` }}
              />
            </div>
          )}
          {caption && <p className="text-xs text-gray-400 leading-relaxed">{caption}</p>}
        </>
      ) : (
        <>
          <div className="text-xl font-semibold text-gray-500 leading-none">Not measured yet</div>
          {pending && <p className="text-xs text-gray-500 leading-relaxed">{pending}</p>}
        </>
      )}

      {children}

      {basis && measured && (
        <p
          title={basis}
          className="mt-auto flex items-start gap-1 text-[10px] text-gray-500 leading-snug line-clamp-2"
        >
          <HelpCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{basis}</span>
        </p>
      )}
    </div>
  );
}

/** Metric card driven straight from a `DnaScore` (value + confidence + basis). */
export function DnaScoreCard({
  icon,
  label,
  score,
  caption,
  pending,
  accent,
  unit = "/100",
}: {
  icon: LucideIcon;
  label: string;
  score: DnaScore;
  caption?: string;
  pending?: string;
  accent?: string;
  unit?: string;
}) {
  return (
    <DnaMetricCard
      icon={icon}
      label={label}
      value={score.value}
      unit={score.value != null ? unit : undefined}
      ring={score.value}
      caption={caption}
      confidence={score.confidence}
      sampleSize={score.sampleSize}
      basis={score.basis}
      accent={accent}
      pending={pending ?? score.basis}
    />
  );
}

// ---------------------------------------------------------------------------
// Trend line (dependency-free SVG, matches the platform's Sparkline)
// ---------------------------------------------------------------------------

/**
 * A small multi-point trend line with a fixed 0-100 domain.
 *
 * The fixed domain matters: an auto-scaled axis makes a two-point wobble look
 * like a dramatic collapse, which for a motivation chart shown to a student is
 * the opposite of helpful.
 */
export function DnaTrendLine({
  points,
  stroke = "#00E5FF",
  fill = "rgba(0,229,255,0.14)",
  width = 320,
  height = 64,
  className,
}: {
  points: (number | null)[];
  stroke?: string;
  fill?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  const series = points.filter((p): p is number => p != null);
  if (series.length < 2) {
    return (
      <div
        style={{ height }}
        className={cn("flex items-center justify-center text-[11px] text-gray-500", className)}
      >
        Not enough history yet — a point is added each day you study.
      </div>
    );
  }

  const pad = 4;
  const usableH = height - pad * 2;
  const stepX = width / (series.length - 1);
  const coords = series.map((v, i) => {
    const x = i * stepX;
    const y = pad + usableH - (Math.max(0, Math.min(100, v)) / 100) * usableH;
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
    >
      <path d={area} fill={fill} stroke="none" />
      <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={stroke} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Horizontal comparison bars
// ---------------------------------------------------------------------------

/** Labelled 0-100 bars — used for style scores, dayparts and duration bands, so
 *  the student sees the distribution the engine's claim was drawn from. */
export function DnaBars({
  rows,
  emptyLabel = "No data yet",
  suffix = "%",
}: {
  rows: { label: string; value: number | null; meta?: string; highlight?: boolean; color?: string }[];
  emptyLabel?: string;
  /** Unit shown after each value. Pass "" for composite 0-100 scores, which are
   *  not percentages and shouldn't be labelled as if they were. */
  suffix?: string;
}) {
  const withData = rows.filter((r) => r.value != null);
  if (withData.length === 0) {
    return <p className="text-xs text-gray-500 py-2">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between text-xs mb-1 gap-2">
            <span className={cn("truncate", row.highlight ? "text-white font-semibold" : "text-gray-300")}>
              {row.highlight && <span className="text-averna-neon mr-1">●</span>}
              {row.label}
            </span>
            <span className="text-gray-400 shrink-0 tabular-nums">
              {row.value != null ? `${row.value}${suffix}` : "—"}
              {row.meta && <span className="text-gray-600 ml-1.5">{row.meta}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(0, Math.min(100, row.value ?? 0))}%`,
                background: row.color ?? (row.highlight ? "#00FF94" : "rgba(255,255,255,0.28)"),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

export function DnaPanel({
  icon: Icon,
  title,
  subtitle,
  accent = "text-averna-cyan",
  border = "border-averna-cyan/30",
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: string;
  border?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className={cn("glass rounded-2xl border p-5 sm:p-6", border)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 shrink-0", accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <Link href={action.href} className="shrink-0 text-xs text-gray-400 hover:text-white transition-colors">
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
