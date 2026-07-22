export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getGlobalRankings, getGroupRankings } from "@/lib/db-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Trophy, Users, Crown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { initialsOf } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
function Podium({ top, currentUserId }: { top: any[]; currentUserId: string }) {
  if (!top || top.length === 0) return null;
  const [first, second, third] = top;
  const slots = [
    { s: second, place: 2, h: "h-16 sm:h-20", ring: "ring-gray-300", grad: "from-gray-300/25", medal: "🥈", accent: "text-gray-200" },
    { s: first, place: 1, h: "h-24 sm:h-28", ring: "ring-yellow-400", grad: "from-yellow-400/30", medal: "🥇", accent: "text-yellow-400", crown: true },
    { s: third, place: 3, h: "h-12 sm:h-16", ring: "ring-orange-400", grad: "from-orange-400/25", medal: "🥉", accent: "text-orange-400" },
  ].filter((x) => x.s);

  return (
    <Card className="glass border-yellow-500/30 mb-6 overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-end justify-center gap-2 sm:gap-5">
          {slots.map((slot) => {
            const isMe = slot.s.userId === currentUserId;
            return (
              <div key={slot.place} className="flex flex-col items-center flex-1 max-w-[150px]">
                {slot.crown && <Crown className="h-5 w-5 text-yellow-400 mb-1 animate-float" />}
                <div
                  className={`relative h-14 w-14 sm:h-16 sm:w-16 rounded-full grid place-items-center bg-averna-dark ring-2 ${slot.ring} ${
                    isMe ? "shadow-[0_0_20px_-4px_rgba(0,255,148,0.7)]" : ""
                  }`}
                >
                  <span className="text-white font-bold text-base sm:text-lg">{initialsOf(slot.s.user?.name)}</span>
                  <span className="absolute -bottom-1.5 -right-1.5 text-lg">{slot.medal}</span>
                </div>
                <p className={`mt-2 text-xs sm:text-sm font-semibold truncate w-full text-center ${isMe ? "text-averna-neon" : "text-white"}`}>
                  {slot.s.user?.name}
                </p>
                <p className={`text-[11px] sm:text-xs font-bold ${slot.accent}`}>{slot.s.totalPoints} pts</p>
                <div
                  className={`mt-2 w-full ${slot.h} rounded-t-xl bg-gradient-to-t ${slot.grad} to-transparent border-x border-t border-white/10 flex items-start justify-center pt-2`}
                >
                  <span className={`text-2xl font-black ${slot.accent}`}>{slot.place}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

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
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Trophy}
          iconClassName="text-yellow-400"
          title="Leaderboards"
        />

        <Podium top={globalRankings.slice(0, 3)} currentUserId={student.id} />

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
                <EmptyState
                  icon={Users}
                  title="No group yet"
                  description="You'll appear on the group leaderboard once your teacher adds you to a group."
                  accent="text-blue-400"
                  compact
                />
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
