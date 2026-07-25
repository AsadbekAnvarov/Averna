import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
import { db } from "@/lib/db";
import { buildAchievementSnapshot, achievementProgress } from "@/lib/engine/achievement-engine";

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

  // Show the closest-to-completion locked achievements first. Thresholds come
  // from the shared rule table, so these numbers always match what awards them.
  const rows = achievements
    .map((a) => {
      const done = unlockedIds.has(a.id);
      const { current: raw, target, percent: pct } = achievementProgress(a.type, snapshot);
      const current = Math.min(raw, target);
      return { a, done, current, target, pct };
    })
    .sort((x, y) => (x.done === y.done ? y.pct - x.pct : x.done ? 1 : -1))
    .slice(0, 5);

  const unlockedCount = unlockedIds.size;

  return (
    <Card className="glass border-amber-400/30" data-gamified>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <Award className="h-5 w-5" /> Achievements
          </span>
          <span className="text-sm font-normal text-gray-400">{unlockedCount}/{achievements.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rows.map(({ a, done, current, target, pct }) => (
            <div key={a.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`text-lg ${done ? "" : "grayscale opacity-70"}`}>{a.icon}</span>
                  <span className={`text-sm truncate ${done ? "text-amber-400 font-semibold" : "text-white"}`}>{a.name}</span>
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  {done ? "✓ Unlocked" : `${current}/${target}`}
                </span>
              </div>
              {!done && (
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-averna-pink" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
