import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import type { SkillSnapshot } from "@/lib/engine/progression/skills";
import { Meter, Panel, PanelTitle, SkillIcon, SKILL_TONE } from "./ui";

/**
 * The four IELTS skills as progress toward the student's target band, with the
 * weakest skill called out — multi-dimensional progress instead of one XP number.
 */
export function SkillProgress({
  profile,
  targetBand,
  insight,
  weakestSkill,
}: {
  profile: SkillSnapshot[];
  targetBand: number;
  insight: string;
  weakestSkill: string | null;
}) {
  return (
    <Panel labelledBy="skills-title">
      <PanelTitle
        id="skills-title"
        icon={BarChart3}
        title="Your four skills"
        hint={`Progress toward your target band ${targetBand.toFixed(1)}`}
        action={
          <Link href="/progress" className="text-xs font-medium text-averna-neon hover:underline">
            See my progress
          </Link>
        }
      />
      <ul className="space-y-4">
        {profile.map((s) => {
          const tone = SKILL_TONE[s.skill];
          const TrendIcon = s.trend === "up" ? TrendingUp : s.trend === "down" ? TrendingDown : Minus;
          const weakest = weakestSkill === s.skill && profile.filter((p) => p.sessions > 0).length > 1;
          return (
            <li key={s.skill} className="flex items-center gap-3">
              <SkillIcon skill={s.skill} className="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-white">
                    {s.label}
                    {weakest && (
                      <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Focus
                      </span>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-400">
                    {s.sessions === 0 ? (
                      "Not started"
                    ) : (
                      <>
                        {s.trend && <TrendIcon className={`h-3.5 w-3.5 ${s.trend === "up" ? "text-averna-neon" : s.trend === "down" ? "text-red-400" : "text-gray-500"}`} aria-label={`Trend ${s.trend}`} />}
                        <span className="font-semibold text-gray-200">{s.recentAvg.toFixed(1)}</span>
                        <span>· {s.progress}%</span>
                      </>
                    )}
                  </p>
                </div>
                <Meter value={s.progress} label={`${s.label} progress`} barClassName={tone.bar} size="sm" />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 border-t border-white/10 pt-4 text-sm text-gray-300">{insight}</p>
    </Panel>
  );
}
