import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small labelled number in a game's HUD (moves, time, score …). */
export function GameStat({ label, value, icon: Icon, className }: { label: string; value: React.ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-center", className)}>
      <p className="flex items-center justify-center gap-1 truncate text-xs text-gray-400">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        {label}
      </p>
      <p className="truncate font-mono text-base font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

/** The quiet footer every practice game carries: it never awards XP. */
export function GameFooter({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-1 text-center text-xs text-gray-500">
      {children}
      <span>Practice game · no points</span>
    </p>
  );
}

/** Milliseconds as a whole-second "m:ss" clock. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Shared focus ring for game controls (visible in light and dark themes). */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";
