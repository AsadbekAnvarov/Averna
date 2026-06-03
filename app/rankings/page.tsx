export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getGlobalRankings, getGroupRankings } from "@/lib/db-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Crown, Medal } from "lucide-react";
import Link from "next/link";

export default async function RankingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const student = await session.user;
  const studentData = await (await import("@/lib/db")).db.student.findUnique({
    where: { userId: student.id },
    include: { user: true },
  });

  const globalRankings = await getGlobalRankings(50);
  const groupRankings = studentData?.groupId ? await getGroupRankings(studentData.groupId) : [];

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Link href="/dashboard" className="text-averna-neon hover:underline text-sm mb-4 block">
          ← Back to Dashboard
        </Link>
        <h1 className="text-4xl font-bold text-white mb-8 flex items-center gap-3">
          <Trophy className="h-10 w-10 text-yellow-400" />
          Leaderboards
        </h1>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Global Rankings */}
          <Card className="glass border-yellow-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <Crown className="h-5 w-5" />
                Global Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {globalRankings.slice(0, 20).map((s, index) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      s.userId === student.id ? "bg-averna-neon/20 border border-averna-neon" : "bg-averna-dark/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-bold ${
                        index === 0 ? "text-yellow-400" :
                        index === 1 ? "text-gray-300" :
                        index === 2 ? "text-orange-400" :
                        "text-gray-500"
                      }`}>
                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{s.user.name}</p>
                        <p className="text-xs text-gray-400">{s.group?.name || "No group"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-averna-neon">{s.totalPoints}</p>
                      <p className="text-xs text-gray-400">points</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Group Rankings */}
          <Card className="glass border-blue-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Users className="h-5 w-5" />
                Group Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {groupRankings.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No group assigned</p>
              ) : (
                <div className="space-y-2">
                  {groupRankings.map((s, index) => (
                    <div
                      key={s.id}
                      className={`p-3 rounded-lg flex items-center justify-between ${
                        s.userId === student.id ? "bg-averna-neon/20 border border-averna-neon" : "bg-averna-dark/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-xl font-bold ${
                          index === 0 ? "text-yellow-400" :
                          index === 1 ? "text-gray-300" :
                          index === 2 ? "text-orange-400" :
                          "text-gray-500"
                        }`}>
                          #{index + 1}
                        </div>
                        <p className="font-semibold text-white">{s.user.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-400">{s.totalPoints}</p>
                        <p className="text-xs text-gray-400">points</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
