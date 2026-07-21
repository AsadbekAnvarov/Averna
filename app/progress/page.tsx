export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountNotice } from "@/components/account-notice";
import { SectionHeader } from "@/components/ui/section-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { BandProgress } from "@/components/dashboard/band-progress";
import { PersonalBests } from "@/components/dashboard/personal-bests";
import { LeaderboardWidget } from "@/components/dashboard/leaderboard-widget";
import { AchievementsProgress } from "@/components/dashboard/achievements-progress";
import { FirstRunGuide } from "@/components/learning/first-run-guide";
import { PageHeader } from "@/components/ui/page-header";
import { TrendingUp, Trophy, Crown, Award, Medal, Swords, ArrowRight } from "lucide-react";

const LINKS = [
  { href: "/rankings", label: "Rankings", desc: "Global & group boards", icon: Trophy, color: "bg-yellow-500/15 text-yellow-400", hover: "hover:border-yellow-400/40" },
  { href: "/leagues", label: "Leagues", desc: "Weekly season league", icon: Crown, color: "bg-averna-cyan/15 text-averna-cyan", hover: "hover:border-averna-cyan/40" },
  { href: "/achievements", label: "Achievements", desc: "Badges you've unlocked", icon: Award, color: "bg-averna-purple/15 text-averna-purple", hover: "hover:border-averna-purple/40" },
  { href: "/team-challenge", label: "Team Challenge", desc: "Group vs group race", icon: Swords, color: "bg-averna-pink/15 text-averna-pink", hover: "hover:border-averna-pink/40" },
  { href: "/certificate", label: "Certificate", desc: "Download your award", icon: Medal, color: "bg-emerald-400/15 text-emerald-400", hover: "hover:border-emerald-400/40" },
];

export default async function ProgressCenterPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, targetBand: true, groupId: true, longestStreak: true, globalRank: true },
  });
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to see your progress." />;
  }

  const testsCount = await db.iELTSTest.count({ where: { studentId: student.id } });
  const isNewStudent = testsCount === 0;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-5xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={TrendingUp}
          title={<>My <span className="neon-text-cyan">Progress</span></>}
          subtitle="Your band journey, personal bests, ranks and rewards — all together. 🏆"
        />

        {isNewStudent ? (
          <FirstRunGuide name={session.user.name} />
        ) : (
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <BandProgress studentId={student.id} targetBand={student.targetBand} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <PersonalBests studentId={student.id} />
            </Suspense>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Suspense fallback={<WidgetSkeleton rows={4} />}>
            <LeaderboardWidget studentId={student.id} groupId={student.groupId} />
          </Suspense>
          <Suspense fallback={<WidgetSkeleton rows={4} />}>
            <AchievementsProgress studentId={student.id} longestStreak={student.longestStreak} globalRank={student.globalRank} />
          </Suspense>
        </div>

        <SectionHeader icon={Trophy} title="Compete & Celebrate" subtitle="Rankings, leagues and rewards" accent="text-amber-400" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group">
                <div className={`flex items-center gap-4 p-4 rounded-xl bg-averna-dark/30 border border-white/5 transition-all duration-300 hover:bg-averna-dark/50 hover:-translate-y-0.5 ${item.hover}`}>
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm truncate">{item.label}</p>
                    <p className="text-xs text-gray-400 truncate">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
