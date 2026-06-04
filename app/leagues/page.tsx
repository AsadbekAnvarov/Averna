export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Crown } from "lucide-react";
import Link from "next/link";
import { AccountNotice } from "@/components/account-notice";
import { leagueForWeeklyPoints, nextLeague, startOfWeek, seasonLabel, LEAGUES } from "@/lib/leagues";

export default async function LeaguesPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const me = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { name: true } } },
  });
  if (!me) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to join the league." />;
  }

  const weekStart = startOfWeek();

  // Weekly points per student from activity logs
  let weekly: { studentId: string; points: number }[] = [];
  try {
    const grouped = await db.activityLog.groupBy({
      by: ["studentId"],
      where: { createdAt: { gte: weekStart }, points: { gt: 0 } },
      _sum: { points: true },
    });
    weekly = grouped.map((g) => ({ studentId: g.studentId, points: g._sum.points ?? 0 }));
  } catch {
    weekly = [];
  }

  const pointsById = new Map(weekly.map((w) => [w.studentId, w.points]));

  // Bring in names for everyone who scored this week
  const students = await db.student.findMany({
    where: { id: { in: weekly.map((w) => w.studentId) } },
    include: { user: { select: { name: true } } },
  });
  const nameById = new Map(students.map((s) => [s.id, s.user.name ?? "Student"]));

  const myPoints = pointsById.get(me.id) ?? 0;
  const myLeague = leagueForWeeklyPoints(myPoints);
  const promo = nextLeague(myPoints);

  // Build ranked board
  const board = weekly
    .map((w) => ({ id: w.studentId, name: nameById.get(w.studentId) ?? "Student", points: w.points }))
    .sort((a, b) => b.points - a.points);
  // Ensure I'm visible even with 0 points
  if (!board.find((b) => b.id === me.id)) {
    board.push({ id: me.id, name: me.user.name ?? "You", points: 0 });
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 lg:pb-8">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">← Back to Dashboard</Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-400" />
          <span className="neon-text">Leagues</span>
        </h1>
        <p className="text-gray-400 mb-6">{seasonLabel()} · resets every Monday 🔁</p>

        {/* My league card */}
        <Card className="glass border-averna-neon/40 mb-6">
          <CardContent className="py-6 text-center">
            <div className="text-5xl mb-2">{myLeague.emoji}</div>
            <p className="text-2xl font-bold text-white">{myLeague.name} League</p>
            <p className="text-averna-cyan font-semibold mt-1">{myPoints} pts this week</p>
            {promo ? (
              <p className="text-sm text-gray-400 mt-2">
                {promo.needed} more pts to reach {promo.league.emoji} {promo.league.name}
              </p>
            ) : (
              <p className="text-sm text-averna-neon mt-2">👑 You&apos;re in the top league!</p>
            )}
          </CardContent>
        </Card>

        {/* League tiers legend */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {LEAGUES.slice().reverse().map((l) => (
            <span key={l.name} className="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5" style={{ color: l.color }}>
              {l.emoji} {l.name} · {l.min}+
            </span>
          ))}
        </div>

        {/* Weekly leaderboard */}
        <Card className="glass border-averna-cyan/30">
          <CardHeader><CardTitle className="text-averna-cyan">This Week&apos;s Leaderboard</CardTitle></CardHeader>
          <CardContent>
            {board.length === 0 ? (
              <p className="text-gray-400 text-sm">No activity yet this week. Be the first to earn points! 💪</p>
            ) : (
              <div className="space-y-2">
                {board.slice(0, 30).map((row, i) => {
                  const lg = leagueForWeeklyPoints(row.points);
                  const mine = row.id === me.id;
                  return (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        mine ? "bg-averna-neon/10 border-averna-neon/40" : "bg-white/5 border-white/10"
                      }`}
                    >
                      <span className="w-7 text-center font-bold text-gray-400">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </span>
                      <span className="text-lg">{lg.emoji}</span>
                      <span className="flex-1 min-w-0 truncate text-white font-medium">
                        {row.name}{mine && " (you)"}
                      </span>
                      <span className="text-averna-cyan font-bold">{row.points} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
