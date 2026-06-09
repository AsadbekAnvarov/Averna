import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award } from "lucide-react";
import { db } from "@/lib/db";

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
  const [achievements, unlocked, hwCount, speakingCount, readingCount, listeningCount, writingHigh, earlyBird] =
    await Promise.all([
      db.achievement.findMany(),
      db.studentAchievement.findMany({ where: { studentId }, select: { achievementId: true } }),
      db.homeworkSubmission.count({ where: { studentId } }),
      db.speakingSession.count({ where: { studentId } }),
      db.iELTSTest.count({ where: { studentId, module: "READING" } }),
      db.iELTSTest.count({ where: { studentId, module: "LISTENING" } }),
      db.iELTSTest.count({ where: { studentId, module: "WRITING", score: { gte: 7.5 } } }),
      db.homeworkSubmission.count({ where: { studentId, position: 1 } }),
    ]);

  const unlockedIds = new Set(unlocked.map((u) => u.achievementId));

  const progressFor = (type: string): number => {
    switch (type) {
      case "HOMEWORK_MASTER": return hwCount;
      case "SPEAKING_CHAMPION": return speakingCount;
      case "READING_EXPERT": return readingCount;
      case "LISTENING_MASTER": return listeningCount;
      case "WRITING_GURU": return writingHigh;
      case "STREAK_WARRIOR": return longestStreak;
      case "EARLY_BIRD": return earlyBird;
      case "TOP_PERFORMER": return globalRank > 0 && globalRank <= 10 ? 10 : 0;
      default: return 0;
    }
  };
  const targetFor = (type: string): number => {
    switch (type) {
      case "HOMEWORK_MASTER": return 50;
      case "SPEAKING_CHAMPION": return 50;
      case "READING_EXPERT": return 100;
      case "LISTENING_MASTER": return 100;
      case "WRITING_GURU": return 20;
      case "STREAK_WARRIOR": return 30;
      case "EARLY_BIRD": return 10;
      case "TOP_PERFORMER": return 10;
      default: return 1;
    }
  };

  // Show the closest-to-completion locked achievements first
  const rows = achievements
    .map((a) => {
      const done = unlockedIds.has(a.id);
      const current = Math.min(progressFor(a.type), targetFor(a.type));
      const target = targetFor(a.type);
      const pct = target > 0 ? Math.round((current / target) * 100) : 0;
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
