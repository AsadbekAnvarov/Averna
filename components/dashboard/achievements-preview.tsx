import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, ChevronRight, Lock } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface AchievementsPreviewProps {
  achievements: Array<{
    id: string;
    unlockedAt: Date;
    achievement: {
      name: string;
      description: string;
      icon: string;
      points: number;
    };
  }>;
}

export function AchievementsPreview({ achievements }: AchievementsPreviewProps) {
  // All possible achievements (for locked ones)
  const allAchievements = [
    { name: "Homework Master", icon: "📚", description: "Complete 50 homework" },
    { name: "Speaking Champion", icon: "🗣️", description: "50 speaking sessions" },
    { name: "Reading Expert", icon: "📖", description: "100 reading tests" },
    { name: "Writing Guru", icon: "✍️", description: "Score 7.5+ on 20 tasks" },
    { name: "Listening Master", icon: "🎧", description: "100 listening tests" },
    { name: "Top Performer", icon: "🏆", description: "Reach Top 10 globally" },
    { name: "Streak Warrior", icon: "🔥", description: "30-day streak" },
    { name: "Early Bird", icon: "🐦", description: "Submit homework first 10x" },
  ];

  const unlockedNames = achievements.map(a => a.achievement.name);
  const lockedAchievements = allAchievements.filter(
    a => !unlockedNames.includes(a.name)
  ).slice(0, 3);

  return (
    <Card className="glass border-averna-primary/30 animate-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-400" />
              Achievements
            </CardTitle>
            <CardDescription>
              {achievements.length} unlocked
            </CardDescription>
          </div>
          <Link href="/achievements">
            <Button variant="ghost" size="sm" className="text-averna-neon hover:bg-averna-primary/20">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Recently Unlocked */}
          {achievements.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                Recently Unlocked
              </h4>
              <div className="space-y-2">
                {achievements.slice(0, 3).map((achievement) => (
                  <div
                    key={achievement.id}
                    className="p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/30 hover:border-yellow-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{achievement.achievement.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm">
                          {achievement.achievement.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {achievement.achievement.description}
                        </p>
                        <p className="text-xs text-yellow-400 mt-1">
                          +{achievement.achievement.points} points
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locked Achievements */}
          {lockedAchievements.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase">
                Coming Next
              </h4>
              <div className="space-y-2">
                {lockedAchievements.map((achievement, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-gray-500/5 border border-gray-500/20 opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl opacity-50">{achievement.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-400 text-sm flex items-center gap-2">
                          <Lock className="h-3 w-3" />
                          {achievement.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {achievement.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Achievements Yet */}
          {achievements.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              <Award className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No achievements yet</p>
              <p className="text-xs mt-1">Keep learning to unlock badges!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
