import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
import { db } from "@/lib/db";
import { buildAchievementSnapshot, achievementProgress } from "@/lib/engine/achievement-engine";
import { rankAchievementRows } from "@/lib/dashboard/achievements";

/**
 * Achievements progress — instead of only showing unlocked badges, this shows
 * how close the student is to the next ones ("12/50 toward Homework Master"),
 * which is far more motivating.
 */
export async function AchievementsProgress({
  studentId,
  longestStreak,
  globalRank,
}: {
  studentId: string;
  longestStreak: number;
  globalRank: number;
}) {
  const [achievements, unlocked, snapshot] = await Promise.all([
    db.achievement.findMany(),
    db.studentAchievement.findMany({ where: { studentId }, select: { achievementId: true } }),
    buildAchievementSnapshot(studentId, { longestStreak, globalRank }),
  ]);

  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  // Closest-to-completion locked achievements first (complete-but-not-yet-awarded
  // ones at the top). Thresholds come from the shared rule table, so these
  // numbers always match what awards them.
  const rows = rankAchievementRows(achievements, unlockedIds, (type) => achievementProgress(type, snapshot));

  const unlockedCount = unlockedIds.size;

  return (
    <Card className="glass border-amber-400/30" data-gamified>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <Award className="h-5 w-5" /> Achievements
          </span>
          <span className="text-sm font-normal text-gray-400">
            {unlockedCount}/{achievements.length} unlocked
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul aria-label="Closest achievements" className="space-y-3">
          {rows.map(({ a, done, ready, current, target, pct }) => (
            <li key={a.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`text-lg ${done ? "" : "grayscale opacity-70"}`}>{a.icon}</span>
                  <span className={`text-sm truncate ${done ? "text-amber-400 font-semibold" : "text-white"}`}>{a.name}</span>
                </span>
                {ready ? (
                  <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 text-[11px] text-emerald-300">
                    Ready
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 shrink-0">
                    {done ? "✓ Unlocked" : `${current}/${target}`}
                  </span>
                )}
              </div>
              {!done && (
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-averna-pink" style={{ width: `${pct}%` }} />
                </div>
              )}
              {ready && <p className="mt-1 text-[11px] text-gray-400">Unlocks with your next activity</p>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
