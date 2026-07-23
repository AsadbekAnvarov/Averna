import { getTeacherAchievements } from "@/lib/teacher-intel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Medal, Lock } from "lucide-react";

/**
 * F8 — AI Achievement Studio. Celebrates teaching quality with real, earned
 * milestones (essays reviewed, speaking mentorship, band-improvement champion,
 * class building). Read-only; progress computed from actual data.
 */
export async function AchievementStudio({ teacherId }: { teacherId: string }) {
  const achievements = await getTeacherAchievements(teacherId);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <Card className="glass border-amber-500/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-14 -right-14 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <Medal className="h-5 w-5" /> Achievement Studio
          </span>
          <span className="text-xs font-normal text-gray-400">{unlocked}/{achievements.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`relative rounded-xl border p-3 transition-all ${
              a.unlocked ? "border-amber-500/40 bg-amber-500/5" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {!a.unlocked && <Lock className="absolute top-2 right-2 h-3.5 w-3.5 text-gray-600" />}
            <div className="flex items-center gap-2">
              <span className={`text-xl ${a.unlocked ? "" : "grayscale opacity-60"}`}>{a.emoji}</span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${a.unlocked ? "text-white" : "text-gray-400"}`}>{a.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{a.desc}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${a.unlocked ? "bg-amber-400" : "bg-gray-600"}`}
                  style={{ width: `${a.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">{a.detail}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
