import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, CheckCircle2, Circle, Snowflake } from "lucide-react";
import { db } from "@/lib/db";

interface Props {
  studentId: string;
  streakFreezes: number;
}

/**
 * Daily quests are derived from today's ActivityLog entries — no extra tables.
 * Completing all of them is its own reward (visual), and each underlying
 * action already grants points via its own endpoint.
 */
export async function DailyQuests({ studentId, streakFreezes }: Props) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  let logs: { action: string; details: any }[] = [];
  try {
    logs = await db.activityLog.findMany({
      where: { studentId, createdAt: { gte: dayStart } },
      select: { action: true, details: true },
    });
  } catch {
    logs = [];
  }

  const has = (action: string) => logs.some((l) => l.action === action);
  const moduleDone = (mod: string) =>
    logs.some((l) => l.action === "IELTS_TEST_COMPLETED" && (l.details as any)?.module === mod);

  const quests = [
    { label: "Complete the Daily Challenge", done: has("DAILY_CHALLENGE"), icon: "⚡" },
    { label: "Finish one Writing or Reading task", done: moduleDone("WRITING") || moduleDone("READING"), icon: "✍️" },
    { label: "Do a Listening or Speaking activity", done: moduleDone("LISTENING") || has("SPEAKING_SESSION_COMPLETED"), icon: "🎧" },
  ];

  const completed = quests.filter((q) => q.done).length;
  const allDone = completed === quests.length;

  return (
    <Card className="glass border-averna-cyan/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-averna-cyan">
            <Target className="h-5 w-5" /> Daily Quests
          </span>
          <span className="text-sm font-normal text-gray-400">{completed}/{quests.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {quests.map((q) => (
          <div
            key={q.label}
            className={`flex items-center gap-3 p-2.5 rounded-lg border ${
              q.done ? "bg-averna-neon/10 border-averna-neon/30" : "bg-white/5 border-white/10"
            }`}
          >
            {q.done ? (
              <CheckCircle2 className="h-5 w-5 text-averna-neon shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-gray-500 shrink-0" />
            )}
            <span className="text-lg">{q.icon}</span>
            <span className={`text-sm ${q.done ? "text-averna-neon line-through" : "text-gray-200"}`}>
              {q.label}
            </span>
          </div>
        ))}

        {allDone && (
          <p className="text-center text-sm text-averna-neon font-semibold pt-1">
            🎉 All quests done today — amazing!
          </p>
        )}

        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10 text-sm">
          <span className="flex items-center gap-1.5 text-averna-cyan">
            <Snowflake className="h-4 w-4" /> Streak freezes
          </span>
          <span className="text-white font-semibold">{streakFreezes} available</span>
        </div>
        <p className="text-[11px] text-gray-500">
          A streak freeze protects your streak for one missed day — automatically.
        </p>
      </CardContent>
    </Card>
  );
}
