import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Medal } from "lucide-react";

interface MilestonesProps {
  points: number;
  currentStreak: number;
  longestStreak: number;
  testsCompleted: number;
}

interface Milestone {
  emoji: string;
  name: string;
  description: string;
  current: number;
  target: number;
}

export function Milestones({
  points,
  currentStreak,
  longestStreak,
  testsCompleted,
}: MilestonesProps) {
  const milestones: Milestone[] = [
    { emoji: "🌱", name: "First Steps", description: "Earn your first 10 points", current: points, target: 10 },
    { emoji: "💯", name: "Century Club", description: "Reach 100 points", current: points, target: 100 },
    { emoji: "🚀", name: "Point Hunter", description: "Reach 500 points", current: points, target: 500 },
    { emoji: "👑", name: "Halfway Hero", description: "Reach 1000 points", current: points, target: 1000 },
    { emoji: "🔥", name: "Streak Starter", description: "Keep a 3-day streak", current: longestStreak, target: 3 },
    { emoji: "⚡", name: "On Fire", description: "Reach a 7-day streak", current: longestStreak, target: 7 },
    { emoji: "🏆", name: "Unstoppable", description: "Reach a 30-day streak", current: longestStreak, target: 30 },
    { emoji: "📚", name: "Test Taker", description: "Complete 5 tests", current: testsCompleted, target: 5 },
  ];

  const earned = milestones.filter((m) => m.current >= m.target).length;

  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-purple">
            <Medal className="h-5 w-5" />
            Milestones
          </span>
          <span className="text-sm text-gray-400">
            {earned}/{milestones.length} unlocked
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-3">
          {milestones.map((m) => {
            const done = m.current >= m.target;
            const pct = Math.min(100, Math.round((m.current / m.target) * 100));
            return (
              <div
                key={m.name}
                className={`p-3 rounded-lg border transition-all ${
                  done
                    ? "border-averna-neon/50 bg-averna-neon/10 shadow-neon-green"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-2xl ${done ? "" : "grayscale opacity-60"}`}>
                    {m.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${done ? "text-averna-neon" : "text-white"}`}>
                      {m.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.description}</p>
                  </div>
                </div>
                {!done && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-cyan"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {Math.min(m.current, m.target)} / {m.target}
                    </p>
                  </div>
                )}
                {done && (
                  <p className="text-[10px] text-averna-neon mt-2 font-medium">✓ Unlocked!</p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
