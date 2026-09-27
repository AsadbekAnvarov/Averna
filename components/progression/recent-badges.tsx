import Link from "next/link";
import { Award, Lock } from "lucide-react";
import type { BadgeState } from "@/lib/engine/progression/badges";
import { Meter, Panel, PanelTitle, SkillIcon } from "./ui";
import { cn } from "@/lib/utils";

const TIER_RING: Record<BadgeState["def"]["tier"], string> = {
  bronze: "ring-amber-700/50",
  silver: "ring-gray-300/40",
  gold: "ring-amber-300/60",
};

/** Recently unlocked milestones + the closest next ones. */
export function RecentBadges({ badges, recent }: { badges: BadgeState[]; recent: BadgeState[] }) {
  const upcoming = badges
    .filter((b) => !b.earned)
    .sort((a, b) => b.percent - a.percent)
    .slice(0, recent.length ? 2 : 3);
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <Panel labelledBy="badges-title">
      <PanelTitle
        id="badges-title"
        icon={Award}
        title="Achievements"
        hint={`${earnedCount} of ${badges.length} milestones`}
        action={
          <Link href="/achievements" className="text-xs font-medium text-averna-neon hover:underline">
            View all
          </Link>
        }
      />
      {recent.length === 0 ? (
        <p className="mb-4 rounded-xl border border-dashed border-white/15 p-3 text-sm text-gray-400">
          No achievements yet. Complete your first activity to unlock one.
        </p>
      ) : (
        <ul className="mb-4 grid grid-cols-2 gap-2.5">
          {recent.map((b) => (
            <li key={b.def.id} className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] p-2.5">
              <SkillIcon skill={b.def.skill} className={cn("h-9 w-9 ring-1", TIER_RING[b.def.tier])} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{b.def.name}</p>
                <p className="truncate text-[11px] text-gray-400">{b.def.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Up next</p>
          {upcoming.map((b) => (
            <div key={b.def.id} className="flex items-center gap-3">
              <Lock className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="truncate text-gray-200">{b.def.name}</span>
                  <span className="shrink-0 text-gray-400">
                    {b.current}/{b.target}
                  </span>
                </div>
                <Meter value={b.percent} label={`${b.def.name} progress`} size="sm" barClassName="bg-amber-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
