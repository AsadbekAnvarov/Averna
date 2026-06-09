import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, ArrowRight, Globe, Users } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";

/**
 * A compact leaderboard showing the student's global rank and the few rivals
 * directly above and below them — a friendly nudge to climb without leaving
 * the dashboard.
 */
export async function LeaderboardWidget({ studentId, groupId }: { studentId: string; groupId: string | null }) {
  // Global standings (ordered by points). For a class we'd paginate; for a
  // learning centre the student body is small enough to rank in memory.
  const all = await db.student.findMany({
    orderBy: { totalPoints: "desc" },
    select: { id: true, totalPoints: true, user: { select: { name: true } } },
    take: 500,
  });

  const idx = all.findIndex((s) => s.id === studentId);
  const myRank = idx === -1 ? all.length + 1 : idx + 1;

  // Window of peers around the student (one above, self, one below)
  const start = Math.max(0, idx - 1);
  const window = all.slice(start, start + 3);

  // Group rank
  let groupRank: number | null = null;
  let groupSize = 0;
  if (groupId) {
    const groupStudents = await db.student.findMany({
      where: { groupId },
      orderBy: { totalPoints: "desc" },
      select: { id: true },
    });
    groupSize = groupStudents.length;
    const gIdx = groupStudents.findIndex((s) => s.id === studentId);
    groupRank = gIdx === -1 ? null : gIdx + 1;
  }

  const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`);

  return (
    <Card className="glass border-amber-400/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-amber-400">
            <Trophy className="h-5 w-5" /> Leaderboard
          </span>
          <Link href="/rankings" className="text-xs font-normal text-amber-400 hover:underline flex items-center gap-1">
            Full board <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1"><Globe className="h-3.5 w-3.5" /> Global</p>
            <p className="text-2xl font-bold text-amber-400">{medal(myRank)}</p>
            <p className="text-[11px] text-gray-500">of {all.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1"><Users className="h-3.5 w-3.5" /> Group</p>
            <p className="text-2xl font-bold text-averna-cyan">{groupRank ? medal(groupRank) : "—"}</p>
            <p className="text-[11px] text-gray-500">{groupSize > 0 ? `of ${groupSize}` : "no group"}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {window.map((s) => {
            const rank = all.findIndex((x) => x.id === s.id) + 1;
            const isMe = s.id === studentId;
            return (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                  isMe ? "border-amber-400/40 bg-amber-400/10" : "border-white/5 bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-300 w-7 shrink-0">{medal(rank)}</span>
                  <span className={`text-sm truncate ${isMe ? "text-white font-semibold" : "text-gray-300"}`}>
                    {isMe ? "You" : s.user.name ?? "Student"}
                  </span>
                </span>
                <span className="text-sm font-semibold text-amber-400 shrink-0">{s.totalPoints.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
