import { Gem } from "lucide-react";
import type { LevelInfo } from "@/lib/engine/progression/levels";
import { LEVEL_TIERS } from "@/lib/engine/progression/config";
import { Meter, Panel, PanelTitle } from "./ui";

/** What the current level MEANS, and how far the next one is. */
export function LevelCard({ level, todayXp }: { level: LevelInfo; todayXp: number }) {
  return (
    <Panel labelledBy="level-title">
      <PanelTitle id="level-title" icon={Gem} title={`Level ${level.level} · ${level.title}`} hint={level.tier.meaning} />
      <div className="mb-1.5 flex justify-between text-xs text-gray-400">
        <span>{level.isMax ? "Top level reached" : `${level.toNext.toLocaleString()} XP to Level ${level.level + 1}`}</span>
        {todayXp > 0 && <span className="text-averna-neon">+{todayXp} XP today</span>}
      </div>
      <Meter value={level.into} label="Progress to next level" />
      <ol className="mt-4 flex gap-1" aria-label="Tiers">
        {LEVEL_TIERS.map((t, i) => (
          <li
            key={t.id}
            title={t.name}
            className={`h-1.5 flex-1 rounded-full ${i + 1 < level.tierIndex ? "bg-averna-neon/60" : i + 1 === level.tierIndex ? "bg-averna-neon" : "bg-white/10"}`}
          >
            <span className="sr-only">
              {t.name}
              {i + 1 === level.tierIndex ? " (current)" : ""}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-gray-400">
        <span className="text-gray-200">Focus now:</span> {level.tier.focus}
        {level.nextTier && level.nextTierLevel && <> · Next tier: {level.nextTier.name} at Level {level.nextTierLevel}</>}
      </p>
    </Panel>
  );
}
