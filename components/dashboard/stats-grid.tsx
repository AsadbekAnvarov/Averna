import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Target, TrendingUp, Award, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";

interface StatsGridProps {
  student: {
    totalPoints: number;
    globalRank: number;
    groupRank: number;
    currentStreak: number;
    longestStreak: number;
    group: {
      name: string;
    } | null;
  };
}

export function StatsGrid({ student }: StatsGridProps) {
  // Calculate next rank milestone
  const nextMilestone = Math.ceil(student.totalPoints / 100) * 100;
  const progressToNext = ((student.totalPoints % 100) / 100) * 100;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
      {/* Total Points */}
      <Card className="glass border-averna-primary/30 hover:shadow-neon-green transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-5 w-5 text-averna-neon" />
            Total Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-4xl font-bold text-averna-neon">
              <CountUp value={student.totalPoints} />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Next: {nextMilestone}</span>
                <span>{Math.ceil(nextMilestone - student.totalPoints)} pts</span>
              </div>
              <Progress value={progressToNext} className="h-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Streak */}
      <Card className="glass border-orange-500/30 hover:shadow-neon-green transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-5 w-5 text-orange-500" />
            Current Streak
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-orange-500">
            <CountUp value={student.currentStreak} />
            <span className="text-lg text-gray-400 ml-1">days</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            🏆 Best: {student.longestStreak} days
          </p>
          {student.currentStreak >= 7 && (
            <div className="mt-2 text-xs text-orange-400 font-semibold">
              🔥 On fire! Keep it going!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Rank */}
      <Card className="glass border-yellow-500/30 hover:shadow-neon-green transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-yellow-500" />
            Global Rank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-yellow-500">
            {student.globalRank > 0 ? <CountUp value={student.globalRank} prefix="#" /> : "—"}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {student.globalRank > 0 && student.globalRank <= 10 && "⭐ Top 10!"}
            {student.globalRank > 10 && student.globalRank <= 50 && "🌟 Top 50!"}
            {student.globalRank > 50 && "Keep climbing!"}
            {student.globalRank === 0 && "Start learning to rank"}
          </p>
        </CardContent>
      </Card>

      {/* Group Rank */}
      <Card className="glass border-blue-500/30 hover:shadow-neon-green transition-all duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5 text-blue-500" />
            Group Rank
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-blue-500">
            {student.groupRank > 0 ? <CountUp value={student.groupRank} prefix="#" /> : "—"}
          </div>
          <p className="text-xs text-gray-400 mt-2 truncate">
            {student.group?.name || "No group assigned"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
