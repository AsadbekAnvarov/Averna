import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Medal } from "lucide-react";

interface MilestonesProps {
  points: number;
  currentStreak: number;
  longestStreak: number;
  testsCompleted: number;
}

const TIER_NAMES = ["Bronze", "Silver", "Gold"];
const TIER_MEDAL = ["🥉", "🥈", "🥇"];
const TIER_COLOR = ["text-amber-400", "text-gray-300", "text-yellow-300"];
const TIER_BORDER = ["border-amber-400/40", "border-gray-300/40", "border-yellow-400/50"];

export function Milestones({ points, currentStreak, longestStreak, testsCompleted }: MilestonesProps) {
  const badges = [
    { emoji: "⭐", name: "Points Collector", unit: "pts", value: points, tiers: [100, 1000, 5000] },
    { emoji: "🔥", name: "Streak Master", unit: "days", value: longestStreak, tiers: [3, 14, 30] },
    { emoji: "📚", name: "Test Taker", unit: "tests", value: testsCompleted, tiers: [5, 25, 100] },
  ];
  const totalTiers = badges.reduce((s, b) => s + b.tiers.filter((t) => b.value >= t).length, 0);
  const maxTiers = badges.length * 3;


  return (
    <Card className="glass border-averna-purple/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-purple">
            <Medal className="h-5 w-5" /> Achievements
          </span>
          <span className="text-sm text-gray-400">{totalTiers}/{maxTiers} tiers</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {badges.map((b) => {
          const reached = b.tiers.filter((t) => b.value >= t).length; // 0..3
          const nextTarget = reached < 3 ? b.tiers[reached] : b.tiers[2];
          const prevTarget = reached === 0 ? 0 : b.tiers[reached - 1];
          const pct = reached >= 3 ? 100 : Math.round(((b.value - prevTarget) / (nextTarget - prevTarget)) * 100);
          const tierIdx = reached - 1;
          return (
            <div key={b.name} className={`p-3 rounded-lg border bg-white/5 ${reached > 0 ? TIER_BORDER[tierIdx] : "border-white/10"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-2xl ${reached > 0 ? "" : "grayscale opacity-60"}`}>{b.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white flex items-center gap-1.5">
                    {b.name}
                    {reached > 0 && (
                      <span className={`text-xs ${TIER_COLOR[tierIdx]}`}>{TIER_MEDAL[tierIdx]} {TIER_NAMES[tierIdx]}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {reached >= 3 ? "Maxed out! 🏆" : `${b.value} / ${nextTarget} ${b.unit} → ${TIER_NAMES[reached]}`}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-averna-purple to-averna-neon"
                    style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                  />
                </div>
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`text-xs ${i < reached ? TIER_COLOR[i] : "opacity-25 grayscale"}`}>
                      {TIER_MEDAL[i]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
