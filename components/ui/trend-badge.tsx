import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * A small up/down/flat trend pill with a tooltip. Used to give KPIs and group
 * metrics meaningful context ("vs the previous period").
 */
export function TrendBadge({
  value,
  suffix = "%",
  title = "vs previous period",
  flatThreshold = 0,
}: {
  value: number | null;
  suffix?: string;
  title?: string;
  flatThreshold?: number;
}) {
  if (value === null || Number.isNaN(value)) {
    return <span className="text-[11px] text-gray-500">no data yet</span>;
  }

  const isFlat = Math.abs(value) <= flatThreshold;
  const up = value >= 0;
  const Icon = isFlat ? Minus : up ? TrendingUp : TrendingDown;
  const color = isFlat ? "text-gray-400" : up ? "text-averna-neon" : "text-red-400";

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {!isFlat && (up ? "+" : "")}
      {value}
      {suffix}
    </span>
  );
}
