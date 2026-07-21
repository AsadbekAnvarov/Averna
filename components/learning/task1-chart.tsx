import type { Task1ChartData } from "@/lib/writing-data";

/**
 * Dependency-free SVG chart renderer for IELTS Writing Task 1 visuals.
 * Renders original bar / line / pie charts from structured data — no image
 * files and no copyrighted exam scans. Theme-aware (labels use currentColor,
 * so they adapt to light/dark via the container's text colour).
 */

const PALETTE = ["#0fa06f", "#00b4d8", "#8b5cf6", "#f59e0b", "#ec4899", "#3b82f6"];

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [sx, sy] = polar(cx, cy, r, a0);
  const [ex, ey] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${cx},${cy} L${sx},${sy} A${r},${r} 0 ${large} 1 ${ex},${ey} Z`;
}

function SeriesLegend({ series }: { series: { name: string }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {series.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function BarChart({ data }: { data: Extract<Task1ChartData, { kind: "bar" }> }) {
  const W = 460, H = 250, padL = 44, padB = 30, padT = 12, padR = 10;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const allVals = data.series.flatMap((s) => s.values);
  const max = niceMax(Math.max(1, ...allVals));
  const perGroup = plotW / Math.max(1, data.groups.length);
  const gap = 4;
  const barW = Math.max(3, (perGroup - gap * (data.series.length + 1)) / data.series.length);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-gray-400" role="img" aria-label="Bar chart">
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const val = (max / ticks) * i;
        const yy = y(val);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="currentColor" strokeOpacity="0.15" />
            <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="currentColor">
              {Math.round(val)}
            </text>
          </g>
        );
      })}
      {data.groups.map((g, gi) => {
        const gx = padL + gi * perGroup;
        return (
          <g key={gi}>
            {data.series.map((s, si) => {
              const v = s.values[gi] ?? 0;
              const bx = gx + gap + si * (barW + gap);
              const by = y(v);
              return <rect key={si} x={bx} y={by} width={barW} height={padT + plotH - by} rx="2" fill={PALETTE[si % PALETTE.length]} />;
            })}
            <text x={gx + perGroup / 2} y={H - padB + 14} textAnchor="middle" fontSize="10" fill="currentColor">
              {g}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data }: { data: Extract<Task1ChartData, { kind: "line" }> }) {
  const W = 460, H = 250, padL = 44, padB = 30, padT = 12, padR = 10;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const allVals = data.series.flatMap((s) => s.values);
  const max = niceMax(Math.max(1, ...allVals));
  const rawMin = Math.min(0, ...allVals);
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0;
  const n = data.xLabels.length;
  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - ((v - min) / (max - min || 1)) * plotH;
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto text-gray-400" role="img" aria-label="Line graph">
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const val = min + ((max - min) / ticks) * i;
        const yy = y(val);
        return (
          <g key={i}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="currentColor" strokeOpacity="0.15" />
            <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="9" fill="currentColor">{Math.round(val)}</text>
          </g>
        );
      })}
      {data.xLabels.map((lbl, i) =>
        i % 2 === 0 ? (
          <text key={i} x={x(i)} y={H - padB + 14} textAnchor="middle" fontSize="8" fill="currentColor">{lbl}</text>
        ) : null
      )}
      {data.series.map((s, si) => {
        const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={PALETTE[si % PALETTE.length]} strokeWidth="2" strokeLinejoin="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="2.2" fill={PALETTE[si % PALETTE.length]} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ data }: { data: Extract<Task1ChartData, { kind: "pie" }> }) {
  const size = 170, cx = size / 2, cy = size / 2, r = size / 2 - 3;
  const total = data.slices.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  return (
    <div className="flex flex-col items-center">
      {data.title && <p className="text-xs font-semibold text-gray-300 mb-1">{data.title}</p>}
      <svg viewBox={`0 0 ${size} ${size}`} className="w-36 h-36" role="img" aria-label="Pie chart">
        {data.slices.map((s, i) => {
          const a0 = (acc / total) * 360;
          acc += s.value;
          const a1 = (acc / total) * 360;
          const full = a1 - a0 >= 359.999;
          return full ? (
            <circle key={i} cx={cx} cy={cy} r={r} fill={PALETTE[i % PALETTE.length]} />
          ) : (
            <path key={i} d={arc(cx, cy, r, a0, a1)} fill={PALETTE[i % PALETTE.length]} stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
          );
        })}
      </svg>
      <div className="mt-2 flex flex-col gap-0.5">
        {data.slices.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
            {s.label} — {Math.round((s.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function Task1Chart({ charts }: { charts: Task1ChartData[] }) {
  if (!charts || charts.length === 0) return null;
  const allPies = charts.every((c) => c.kind === "pie");
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-4">
      <div className={allPies && charts.length > 1 ? "grid grid-cols-2 gap-3" : "space-y-4"}>
        {charts.map((c, i) => (
          <div key={i}>
            {c.kind === "bar" && (
              <>
                <BarChart data={c} />
                <SeriesLegend series={c.series} />
                {c.unit && <p className="text-center text-[10px] text-gray-500 mt-1">Figures in {c.unit}</p>}
              </>
            )}
            {c.kind === "line" && (
              <>
                <LineChart data={c} />
                <SeriesLegend series={c.series} />
                {c.unit && <p className="text-center text-[10px] text-gray-500 mt-1">Figures in {c.unit}</p>}
              </>
            )}
            {c.kind === "pie" && <PieChart data={c} />}
          </div>
        ))}
      </div>
    </div>
  );
}
