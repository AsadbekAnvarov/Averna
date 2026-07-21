export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Swords, Crown } from "lucide-react";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { startOfWeek, seasonLabel } from "@/lib/leagues";

export default async function TeamChallengePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  // Determine the viewer's group (students) — teachers see all their groups
  let myGroupId: string | null = null;
  if (session.user.role === "STUDENT") {
    const s = await db.student.findUnique({ where: { userId: session.user.id }, select: { groupId: true } });
    if (!s) return <AccountNotice title="No student profile found" message="Sign in with a student account." />;
    myGroupId = s.groupId;
  }

  const weekStart = startOfWeek();

  // Weekly points per student
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
  const ptsByStudent = new Map(weekly.map((w) => [w.studentId, w.points]));

  // All groups with their students
  const groups = await db.group.findMany({
    include: { students: { select: { id: true } } },
    orderBy: { name: "asc" },
  });

  const board = groups
    .map((g) => {
      const total = g.students.reduce((sum, s) => sum + (ptsByStudent.get(s.id) ?? 0), 0);
      const size = g.students.length || 1;
      return {
        id: g.id,
        name: g.name,
        total,
        avg: Math.round(total / size),
        members: g.students.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const maxTotal = Math.max(1, ...board.map((b) => b.total));

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Swords}
          iconClassName="text-averna-pink"
          title={<>Team <span className="neon-text-purple">Challenge</span></>}
          subtitle={<>{seasonLabel()} · groups compete for the most points 🏁</>}
        />

        {board.length === 0 ? (
          <Card className="glass border-averna-primary/30">
            <CardContent className="py-10 text-center text-gray-400">No groups yet.</CardContent>
          </Card>
        ) : (
          <Card className="glass border-averna-pink/30">
            <CardHeader><CardTitle className="text-averna-pink">Group Standings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {board.map((g, i) => {
                const mine = g.id === myGroupId;
                return (
                  <div key={g.id} className={`p-3 rounded-lg border ${mine ? "bg-averna-neon/10 border-averna-neon/40" : "bg-white/5 border-white/10"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-white font-semibold min-w-0">
                        <span className="w-6 text-center">{i === 0 ? "👑" : i + 1}</span>
                        <Users className="h-4 w-4 text-averna-cyan shrink-0" />
                        <span className="truncate">{g.name}{mine && " (your group)"}</span>
                      </span>
                      <span className="text-averna-cyan font-bold whitespace-nowrap">{g.total} pts</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-averna-pink to-averna-purple"
                        style={{ width: `${(g.total / maxTotal) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{g.members} members · avg {g.avg} pts/student</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-gray-500 mt-4">
          Every point you earn this week helps your group win. Resets Monday. 💪
        </p>
      </div>
    </div>
  );
}
