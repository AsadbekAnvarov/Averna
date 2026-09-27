import type { PlacementBadgeInfo } from "@/lib/placement/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * A small level chip from a student's latest finished placement test, e.g.
 * "B1 · 5.0". No hooks — for server pages (teachers' student lists).
 */
export function PlacementLevelBadge({ info, className }: { info: PlacementBadgeInfo | null | undefined; className?: string }) {
  if (!info) return null;
  const band = typeof info.band === "number" && Number.isFinite(info.band) ? info.band.toFixed(1) : null;
  const label = `Placement test ${formatDate(info.finishedAt)}: ${info.cefr}${band ? `, IELTS about ${band}` : ""}`;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-averna-neon/35 bg-averna-neon/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-averna-neon",
        className
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden>
        {info.cefr}
        {band ? ` · ${band}` : ""}
      </span>
    </span>
  );
}

export default PlacementLevelBadge;
