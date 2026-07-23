import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, Flame, Crown } from "lucide-react";

const PER_MEMBER_GOAL = 10; // activities per member per week

const AVATAR_COLORS = [
  "bg-averna-purple/30 text-averna-purple",
  "bg-averna-cyan/30 text-averna-cyan",
  "bg-averna-pink/30 text-averna-pink",
  "bg-amber-500/30 text-amber-400",
  "bg-averna-neon/30 text-averna-neon",
  "bg-indigo-500/30 text-indigo-300",
];

function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/**
 * Study Squad — reframes the student's class group as a shared weekly mission.
 * Everyone's study activity this week counts toward one combined squad goal,
 * with a live contribution board. Social accountability (the group is counting
 * on you) is one of the strongest retention forces. Read-only server component:
 * aggregates existing group members + activity logs; no schema change.
 */
export async function StudySquad({ groupId, studentId }: { groupId: string | null; studentId: string }) {
  if (!groupId) {
    return (
      <Card className="glass border-averna-blue/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-averna-blue">
            <Users className="h-5 w-5" /> Study Squad
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 text-sm text-gray-400">
          Join a group to unlock your Study Squad — a shared weekly goal with your classmates.
        </CardContent>
      </Card>
    );
  }

  const group = await db.group.findUnique({
    where: { id: groupId },
    select: {
      name: true,
      students: {
        select: {
          id: true,
          totalPoints: true,
          currentStreak: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  const members = group?.students ?? [];
  const memberIds = members.map((m) => m.id);

  const weekStart = new Date(Date.now() - 7 * 86_400_000);
  const logs = memberIds.length
    ? await db.activityLog.findMany({
        where: { studentId: { in: memberIds }, createdAt: { gte: weekStart } },
        select: { studentId: true },
      })
    : [];

  const weekly = new Map<string, number>();
  for (const l of logs) weekly.set(l.studentId, (weekly.get(l.studentId) ?? 0) + 1);

  const total = logs.length;
  const goal = Math.max(1, members.length) * PER_MEMBER_GOAL;
  const pct = Math.min(100, Math.round((total / goal) * 100));
  const remaining = Math.max(0, goal - total);

  const ranked = [...members]
    .map((m) => ({
      id: m.id,
      name: m.user?.name || "Student",
      count: weekly.get(m.id) ?? 0,
      streak: m.currentStreak,
      points: m.totalPoints,
      isYou: m.id === studentId,
    }))
    .sort((a, b) => b.count - a.count || b.points - a.points)
    .slice(0, 6);

  return (
    <Card className="glass border-averna-blue/30 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-12 -left-12 h-44 w-44 rounded-full bg-averna-blue/10 blur-3xl" />
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-averna-blue">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Study Squad
          </span>
          <span className="text-xs font-normal text-gray-400 truncate max-w-[45%]">
            {group?.name} · {members.length} member{members.length === 1 ? "" : "s"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shared weekly goal */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="flex items-center gap-1.5 text-averna-blue font-semibold">
              <Target className="h-4 w-4" /> This week&apos;s squad goal
            </span>
            <span className="text-gray-300 font-mono">
              {total}/{goal}
            </span>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-averna-blue via-averna-cyan to-averna-neon transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {remaining === 0
              ? "Goal smashed — the whole squad delivered this week! 🎉"
              : `${remaining} more activities to hit the goal together — every session counts.`}
          </p>
        </div>

        {/* Contribution board */}
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Squad contributions this week</p>
          {ranked.map((m, i) => {
            const share = total > 0 ? Math.round((m.count / total) * 100) : 0;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-1.5 ${m.isYou ? "bg-averna-blue/10 border border-averna-blue/30" : ""}`}
              >
                <div className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${colorFor(m.id)}`}>
                  {i === 0 && m.count > 0 ? <Crown className="h-3.5 w-3.5" /> : m.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white truncate">
                      {m.name}
                      {m.isYou && <span className="text-averna-blue text-[11px]"> (you)</span>}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 flex items-center gap-2">
                      {m.streak > 0 && (
                        <span className="flex items-center gap-0.5 text-orange-400">
                          <Flame className="h-3 w-3" />
                          {m.streak}
                        </span>
                      )}
                      <span>{m.count}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-averna-blue to-averna-cyan"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
