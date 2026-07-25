export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGlobalRank } from "@/lib/db-helpers";
import { buildAchievementSnapshot, achievementProgress } from "@/lib/engine/achievement-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Award, Lock, Trophy, CheckCircle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      achievements: {
        include: {
          achievement: true,
        },
      },
    },
  });

  if (!student) redirect("/auth/signin");

  // Rank computed on read (indexed count), not from a maintained column.
  const globalRank = await getGlobalRank(student.totalPoints);

  // All available achievements
  const allAchievements = await db.achievement.findMany({
    orderBy: { points: "desc" },
  });

  const unlockedIds = student.achievements.map((a) => a.achievementId);

  // Progress comes from the shared achievement rule table, so these numbers are
  // guaranteed to match the thresholds that actually award each badge.
  const snapshot = await buildAchievementSnapshot(student.id, {
    longestStreak: student.longestStreak,
    globalRank,
  });

  const achievementsWithProgress = allAchievements.map((achievement) => {
    const isUnlocked = unlockedIds.includes(achievement.id);
    const { current, target: total, percent: progress } = achievementProgress(achievement.type, snapshot);

    return {
      ...achievement,
      isUnlocked,
      progress: Math.min(progress, 100),
      current,
      total,
    };
  });

  const unlockedCount = achievementsWithProgress.filter((a) => a.isUnlocked).length;
  const totalPoints = student.achievements.reduce((sum, a) => sum + a.achievement.points, 0);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader
          className="mb-4"
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Award}
          iconClassName="text-yellow-400"
          title="Achievements"
          subtitle="Unlock badges by completing challenges and earning points!"
        />
        <div className="mb-8">
          <Link href="/certificate">
            <Button className="neon-button bg-averna-primary hover:bg-averna-light">
              <Award className="mr-2 h-4 w-4" /> View my certificate
            </Button>
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="glass border-yellow-500/30">
            <CardHeader>
              <CardTitle className="text-sm text-yellow-400">Unlocked</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-yellow-400">
                {unlockedCount} / {allAchievements.length}
              </p>
            </CardContent>
          </Card>

          <Card className="glass border-averna-neon/30">
            <CardHeader>
              <CardTitle className="text-sm text-averna-neon">Total Points from Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-averna-neon">{totalPoints}</p>
            </CardContent>
          </Card>

          <Card className="glass border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-sm text-blue-400">Completion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-400">
                {Math.round((unlockedCount / allAchievements.length) * 100)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Achievements Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {achievementsWithProgress.map((achievement) => (
            <Card
              key={achievement.id}
              className={`glass transition-all duration-300 ${
                achievement.isUnlocked
                  ? "border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-transparent"
                  : "border-gray-500/30 opacity-75"
              }`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{achievement.icon}</div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {achievement.name}
                        {achievement.isUnlocked && (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        )}
                        {!achievement.isUnlocked && (
                          <Lock className="h-4 w-4 text-gray-500" />
                        )}
                      </CardTitle>
                      <p className="text-sm text-gray-400 mt-1">
                        {achievement.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-400">
                      +{achievement.points}
                    </p>
                    <p className="text-xs text-gray-400">points</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {achievement.isUnlocked ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                    <Trophy className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-green-400 font-semibold">Unlocked!</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Achievement completed
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Progress</span>
                      <span className="text-white font-semibold">
                        {achievement.current} / {achievement.total}
                      </span>
                    </div>
                    <Progress value={achievement.progress} className="h-2" />
                    {achievement.progress > 0 && (
                      <p className="text-xs text-averna-neon text-center mt-2">
                        {achievement.progress >= 80
                          ? "🔥 Almost there!"
                          : achievement.progress >= 50
                          ? "💪 Keep going!"
                          : "🌱 Just started!"}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
