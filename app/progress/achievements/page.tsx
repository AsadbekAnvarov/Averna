export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { Award, Lock, CheckCircle2, Medal, Star, Percent } from "lucide-react";
import { db } from "@/lib/db";
import { getGlobalRank } from "@/lib/db-helpers";
import { getPageStudent } from "@/lib/student-page";
import { buildAchievementSnapshot, achievementProgress } from "@/lib/engine/achievement-engine";
import { AccountNotice } from "@/components/account-notice";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/ui/section-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { BadgeGrid } from "@/components/progression/badge-grid";
import { FutureSelfSection } from "@/components/dashboard/future-self-section";
import { GraduationSection } from "@/components/dashboard/graduation-section";

export const metadata = { title: "Achievements · My Progress" };

/**
 * Progress → Achievements (formerly /achievements): evidence-based learning
 * milestones, the signature badges with live progress, and the road to your
 * target band.
 */
export default async function ProgressAchievementsPage() {
  const { student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to see your achievements." />;
  }

  const [globalRank, allAchievements, unlocked] = await Promise.all([
    getGlobalRank(student.totalPoints),
    db.achievement.findMany({ orderBy: { points: "desc" } }),
    db.studentAchievement.findMany({
      where: { studentId: student.id },
      select: { achievementId: true, achievement: { select: { points: true } } },
    }),
  ]);

  const unlockedIds = new Set(unlocked.map((a) => a.achievementId));
  // Progress comes from the shared achievement rule table, so these numbers are
  // guaranteed to match the thresholds that actually award each badge.
  const snapshot = await buildAchievementSnapshot(student.id, {
    longestStreak: student.longestStreak,
    globalRank,
  });

  const items = allAchievements
    .map((a) => {
      const isUnlocked = unlockedIds.has(a.id);
      const { current, target, percent } = achievementProgress(a.type, snapshot);
      return { ...a, isUnlocked, current, total: target, progress: Math.min(percent, 100) };
    })
    // Unlocked first, then the ones you're closest to.
    .sort((x, y) => Number(y.isUnlocked) - Number(x.isUnlocked) || y.progress - x.progress);

  const unlockedCount = items.filter((a) => a.isUnlocked).length;
  const badgePoints = unlocked.reduce((sum, a) => sum + a.achievement.points, 0);
  const completion = allAchievements.length ? Math.round((unlockedCount / allAchievements.length) * 100) : 0;
  const firstName = (student.user.name ?? "there").split(" ")[0];

  const summary = [
    { label: "Unlocked", value: `${unlockedCount} / ${allAchievements.length}`, icon: Award, tone: "text-amber-400 bg-amber-400/15" },
    { label: "Points from badges", value: badgePoints, icon: Star, tone: "text-averna-neon bg-averna-neon/15" },
    { label: "Completion", value: `${completion}%`, icon: Percent, tone: "text-averna-cyan bg-averna-cyan/15" },
  ];

  return (
    <div className="space-y-8">
      {/* Summary + certificate */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summary.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="glass flex items-center gap-3 rounded-2xl border border-white/10 p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-xl font-bold text-white tabular-nums">{value}</p>
              <p className="truncate text-xs text-gray-400">{label}</p>
            </div>
          </div>
        ))}
        <Link
          href="/certificate"
          className="group flex items-center gap-3 rounded-2xl border border-averna-neon/30 bg-averna-neon/10 p-4 transition-colors hover:border-averna-neon/60"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-averna-neon/20 text-averna-neon">
            <Medal className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold text-white">My certificate</p>
            <p className="truncate text-xs text-gray-400">View · print · save as PDF</p>
          </div>
        </Link>
      </div>

      {/* Evidence-based learning milestones (Progression Engine) */}
      <section aria-labelledby="milestones-title">
        <SectionHeader icon={CheckCircle2} title="Learning milestones" subtitle="Earned from real results — every badge shows exactly what it takes" accent="text-averna-neon" />
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <BadgeGrid studentId={student.id} />
        </Suspense>
      </section>

      {/* Signature achievements */}
      <section>
        <SectionHeader icon={Award} title="Signature achievements" subtitle="Unlocked first, then the ones you're closest to" accent="text-amber-400" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((a) => (
            <Card
              key={a.id}
              className={`glass transition-colors ${a.isUnlocked ? "border-amber-400/40 bg-gradient-to-br from-amber-400/10 to-transparent" : "border-white/10"}`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/5 text-2xl ${a.isUnlocked ? "" : "grayscale opacity-60"}`} aria-hidden>
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-white">{a.name}</p>
                    {a.isUnlocked ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-label="Unlocked" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-label="Locked" />
                    )}
                    <span className="ml-auto shrink-0 text-sm font-bold text-amber-400">+{a.points}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{a.description}</p>
                  {!a.isUnlocked && (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={a.progress} className="h-1.5 flex-1" />
                      <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                        {a.current} / {a.total}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* The road to the target band */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <FutureSelfSection
            studentId={student.id}
            targetBand={student.targetBand}
            points={student.totalPoints}
            streak={student.currentStreak}
          />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <GraduationSection studentId={student.id} targetBand={student.targetBand} firstName={firstName} />
        </Suspense>
      </div>
    </div>
  );
}
