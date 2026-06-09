/**
 * A tiny dependency-free SVG sparkline. Renders fine inside server components.
 * Pass a series of numbers and it draws a smooth trend line with an optional
 * soft area fill. Used across admin/teacher dashboards for at-a-glance trends.
 */
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke = "#00e5ff",
  fill = "rgba(0,229,255,0.15)",
  strokeWidth = 2,
  className,
}: SparklineProps) {
  if (!data || data.length === 0) {
    return <div style={{ width, height }} className={className} />;
  }

  // A single data point can't form a line — duplicate it so we draw a flat dash.
  const series = data.length === 1 ? [data[0], data[0]] : data;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);
  const pad = strokeWidth + 1;
  const usableH = height - pad * 2;

  const points = series.map((v, i) => {
    const x = i * stepX;
    const y = pad + usableH - ((v - min) / range) * usableH;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <path d={areaPath} fill={fill} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={strokeWidth + 0.5} fill={stroke} />
    </svg>
  );
}
