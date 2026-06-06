export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLevelInfo } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AccountNotice } from "@/components/account-notice";
import { Crown, ArrowLeft, Lock, CheckCircle2 } from "lucide-react";

const LEVELS = [
  { level: 1, min: 0, title: "Rookie", perk: "Daily plan & XP tracking" },
  { level: 2, min: 100, title: "Explorer", perk: "Explorer profile badge" },
  { level: 3, min: 300, title: "Achiever", perk: "Streak-freeze in Rewards" },
  { level: 4, min: 600, title: "Skilled", perk: "Custom profile frame" },
  { level: 5, min: 1000, title: "Advanced", perk: "Advanced learner badge" },
  { level: 6, min: 1500, title: "Expert", perk: "Exclusive Expert flair" },
  { level: 7, min: 2200, title: "Master", perk: "Golden name highlight" },
  { level: 8, min: 3000, title: "Champion", perk: "Champion profile frame" },
  { level: 9, min: 4000, title: "Legend", perk: "Legendary profile aura" },
  { level: 10, min: 5500, title: "IELTS Pro", perk: "Top-tier Pro status" },
];


export default async function LevelsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { user: true },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to view levels." />;
  }

  const points = student.totalPoints;
  const info = getLevelInfo(points);

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-3xl pb-24 lg:pb-6">
        <DashboardHeader user={student.user} />
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 flex items-center gap-3">
          <Crown className="h-8 w-8 text-yellow-400" />
          Levels &amp; <span className="neon-text-purple">Perks</span>
        </h1>
        <p className="text-gray-400 mb-6">Earn XP to climb the ranks and unlock perks along the way. 👑</p>


        {/* Current level summary */}
        <Card className="glass border-yellow-500/30 mb-6">
          <CardContent className="py-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-yellow-400">
                Level {info.level} · {info.title}
              </span>
              <span className="text-sm text-gray-400">{points} XP</span>
            </div>
            <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-averna-neon to-averna-cyan transition-all duration-700"
                style={{ width: `${info.into}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {info.next > points ? `${info.next - points} XP to Level ${info.level + 1}` : "Max level reached! 🏆"}
            </p>
          </CardContent>
        </Card>

        {/* Level ladder */}
        <div className="space-y-2">
          {LEVELS.map((lv) => {
            const unlocked = points >= lv.min;
            const current = info.level === lv.level;
            return (
              <div
                key={lv.level}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  current
                    ? "border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_18px_rgba(250,204,21,0.2)]"
                    : unlocked
                    ? "border-averna-neon/20 bg-averna-neon/5"
                    : "border-white/10 bg-white/[0.02] opacity-70"
                }`}
              >
                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold ${
                  unlocked ? "bg-gradient-to-br from-yellow-400 to-averna-neon text-black" : "bg-white/10 text-gray-500"
                }`}>
                  {lv.level}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${unlocked ? "text-white" : "text-gray-400"}`}>
                    {lv.title}
                    {current && <span className="ml-2 text-[10px] uppercase font-bold text-yellow-400">You are here</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">🎁 {lv.perk}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">{lv.min} XP</p>
                  {unlocked ? (
                    <CheckCircle2 className="h-4 w-4 text-averna-neon ml-auto mt-0.5" />
                  ) : (
                    <Lock className="h-4 w-4 text-gray-500 ml-auto mt-0.5" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
