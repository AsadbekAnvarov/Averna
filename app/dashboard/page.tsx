export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGlobalRank } from "@/lib/db-helpers";
import { BUDGETED_ACTIONS } from "@/lib/engine/xp-engine";
import { tashkentDayStart } from "@/lib/utils";
import { Dumbbell, Gamepad2, Newspaper } from "lucide-react";
// Shell
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { DashboardPreferences } from "@/components/dashboard/dashboard-preferences";
import { StudentAttentionBar } from "@/components/dashboard/student-attention-bar";
import { DaypartAmbiance } from "@/components/dashboard/daypart-ambiance";
import { SeasonalDecor } from "@/components/dashboard/seasonal-decor";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { SectionHeader } from "@/components/ui/section-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { AccountNotice } from "@/components/account-notice";
import { OnboardingTour } from "@/components/onboarding-tour";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { LevelUpCelebration } from "@/components/dashboard/level-up-celebration";
// Today
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { HabitNudge } from "@/components/dashboard/habit-nudge";
import { PlacementPrompt } from "@/components/placement/placement-prompt";
import { ProgressionHome, ProgressionLevel } from "@/components/progression/progression-home";
import { ProgressionSkeleton } from "@/components/progression/progression-skeleton";
import { UpcomingHomework } from "@/components/dashboard/upcoming-homework";
import { ExamCountdown } from "@/components/dashboard/exam-countdown";
// Learn
import { AvernaAiSection } from "@/components/dashboard/averna-ai-section";
import { LivingCampusSection } from "@/components/dashboard/living-campus-section";
import { StudioShelf } from "@/components/studio/studio-shelf";
import { DailyArticle } from "@/components/dashboard/daily-article";
import { WordOfTheDay } from "@/components/dashboard/word-of-the-day";
// Progress
import { BandProgress } from "@/components/dashboard/band-progress";
import { SkillRadar } from "@/components/dashboard/skill-radar";
import { WeeklyGoal } from "@/components/dashboard/weekly-goal";
import { LearningDnaCard } from "@/components/dashboard/learning-dna-card";
import { AchievementsProgress } from "@/components/dashboard/achievements-progress";
import { StreakHeatmap } from "@/components/dashboard/streak-heatmap";
import { ProgressLinks } from "@/components/progress/progress-links";
// Class
import { TeacherCard } from "@/components/dashboard/teacher-card";
import { MessagePreview } from "@/components/dashboard/message-preview";
import { StudySquad } from "@/components/dashboard/study-squad";
import { LeaderboardWidget } from "@/components/dashboard/leaderboard-widget";
import { GroupFeed } from "@/components/dashboard/group-feed";
import { CommunityChallenge } from "@/components/dashboard/community-challenge";
// Play
import { MoodCheckin } from "@/components/dashboard/mood-checkin";
import { DailySpin } from "@/components/dashboard/daily-spin";
import { DailyQuests } from "@/components/dashboard/daily-quests";
import { MysteryBox } from "@/components/dashboard/mystery-box";
import { StudyPet } from "@/components/dashboard/study-pet";
import { StudentOfTheWeek } from "@/components/student-of-the-week";

/**
 * Student dashboard — five calm tabs, each with a handful of blocks and no
 * repeats:
 *   Today    · who I am, today's mission, what's due, skills, streak, challenges
 *   Learn    · AI tutor, the skill map, Practice Studio shelf, daily reading
 *   Progress · bands & skills, level & weekly goal, DNA & achievements, heatmap
 *   Class    · teacher & messages, squad goal, rivals & class feed, community
 *   Play     · mood, daily rewards, word games, study buddy
 * Deep-dives live on their own pages: /progress/*, /rankings/*, /studio/*.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  // Route non-students to their own area (one-way, prevents redirect loops)
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: { user: true },
  });

  if (!student) {
    return (
      <AccountNotice
        title="No student profile found"
        message="This account doesn't have a student profile yet. If you just signed up, please sign in again, or contact your teacher."
      />
    );
  }

  // The streak is advanced by VERIFIED learning (see updateStudentPoints), not
  // by opening the dashboard. Independent reads run in parallel; rank is
  // computed on read (cheap indexed count).
  const today = tashkentDayStart();
  const [globalRank, upcomingHomework, dailyQuote, weeklyCompleted] = await Promise.all([
    getGlobalRank(student.totalPoints),
    db.homework.findMany({
      where: {
        groupId: student.groupId || "",
        dueDate: { gte: new Date() },
        submissions: { none: { studentId: student.id } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { teacher: { include: { user: { select: { name: true } } } } },
    }),
    db.dailyQuote.findFirst({
      where: { date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } },
    }),
    // Real study sessions in the last 7 days (not reward spends or logins).
    db.activityLog.count({
      where: {
        studentId: student.id,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
        action: { in: BUDGETED_ACTIONS },
        points: { gt: 0 },
      },
    }),
  ]);

  const firstName = (student.user.name ?? "there").split(" ")[0];

  return (
    <div className="min-h-screen premium-gradient dashboard-anim">
      <DaypartAmbiance />
      <SeasonalDecor />
      <div className="container relative z-10 mx-auto px-4 py-4 sm:py-6 max-w-7xl pb-8 lg:pb-6">
        <DashboardHeader
          user={student.user}
          tools={
            <>
              <DashboardPreferences />
              <LiveRefresh />
            </>
          }
        />

        {/* What needs you today (swipes sideways on phones) */}
        <div className="mb-4">
          <Suspense fallback={<div className="h-8" />}>
            <StudentAttentionBar userId={session.user.id} homeworkDue={upcomingHomework.length} />
          </Suspense>
        </div>

        {student.blacklisted && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-red-300">You are on the blacklist</p>
              <p className="text-sm">
                {student.blacklistReason || "Please complete your homework."} Talk to your teacher and catch up to be removed.
              </p>
            </div>
          </div>
        )}

        <DashboardTabs
          home={
            <>
              <DashboardHero
                name={student.user.name}
                image={student.user.image}
                points={student.totalPoints}
                streak={student.currentStreak}
                globalRank={globalRank}
                goal={student.personalGoal}
                quote={dailyQuote}
                featuredCosmetic={student.featuredCosmetic}
              />
              <Suspense fallback={null}>
                <HabitNudge studentId={student.id} streak={student.currentStreak} />
              </Suspense>
              {/* New students: find your level (hidden once a placement test is finished). */}
              <Suspense fallback={null}>
                <PlacementPrompt studentId={student.id} />
              </Suspense>
              <Suspense fallback={<ProgressionSkeleton rows={3} />}>
                <ProgressionHome
                  studentId={student.id}
                  homework={<UpcomingHomework homework={upcomingHomework} />}
                  aside={<ExamCountdown />}
                />
              </Suspense>
            </>
          }
          learn={
            <>
              <Suspense fallback={<WidgetSkeleton rows={3} />}>
                <AvernaAiSection studentId={student.id} firstName={firstName} />
              </Suspense>
              <Suspense fallback={<WidgetSkeleton rows={4} />}>
                <LivingCampusSection studentId={student.id} />
              </Suspense>
              <section>
                <SectionHeader
                  icon={Dumbbell}
                  title="Practice Studio"
                  subtitle="Quick tools — each opens on its own page"
                  accent="text-averna-purple"
                  action={{ label: "All tools", href: "/studio" }}
                />
                <StudioShelf group="practice" />
              </section>
              <section>
                <SectionHeader icon={Newspaper} title="Daily reading" subtitle="A little input every day goes a long way" accent="text-averna-cyan" />
                <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2">
                  <DailyArticle />
                  <WordOfTheDay />
                </div>
              </section>
            </>
          }
          progress={
            <>
              <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <BandProgress studentId={student.id} targetBand={student.targetBand} />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <SkillRadar studentId={student.id} />
                </Suspense>
              </div>
              <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <ProgressionLevel studentId={student.id} />
                </Suspense>
                <WeeklyGoal completed={weeklyCompleted} />
              </div>
              <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <LearningDnaCard studentId={student.id} />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <AchievementsProgress studentId={student.id} longestStreak={student.longestStreak} globalRank={globalRank} />
                </Suspense>
              </div>
              <Suspense fallback={<WidgetSkeleton rows={4} />}>
                <StreakHeatmap studentId={student.id} />
              </Suspense>
              <ProgressLinks />
            </>
          }
          classroom={
            <>
              <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
                <Suspense fallback={<WidgetSkeleton rows={2} />}>
                  <TeacherCard groupId={student.groupId} />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <MessagePreview userId={session.user.id} />
                </Suspense>
              </div>
              <Suspense fallback={<WidgetSkeleton rows={4} />}>
                <StudySquad groupId={student.groupId} studentId={student.id} />
              </Suspense>
              <div className="grid grid-cols-1 items-start gap-4 md:gap-6 lg:grid-cols-2">
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <LeaderboardWidget studentId={student.id} groupId={student.groupId} />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <GroupFeed studentId={student.id} groupId={student.groupId} />
                </Suspense>
              </div>
              <Suspense fallback={<WidgetSkeleton rows={4} />}>
                <CommunityChallenge studentId={student.id} />
              </Suspense>
            </>
          }
          fun={
            <>
              <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2">
                <MoodCheckin />
                <div data-gamified>
                  <DailySpin />
                </div>
              </div>
              <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2" data-gamified>
                <DailyQuests studentId={student.id} streakFreezes={student.streakFreezes} />
                <MysteryBox />
              </div>
              <section data-gamified>
                <SectionHeader
                  icon={Gamepad2}
                  title="Word games"
                  subtitle="Beat your own best — every day"
                  accent="text-averna-pink"
                  action={{ label: "Practice Studio", href: "/studio#games" }}
                />
                <StudioShelf group="games" />
              </section>
              <div className="grid grid-cols-1 items-start gap-4 md:gap-6 md:grid-cols-2" data-gamified>
                <StudyPet streak={student.currentStreak} points={student.totalPoints} />
                <Suspense fallback={<WidgetSkeleton rows={2} />}>
                  <StudentOfTheWeek />
                </Suspense>
              </div>
            </>
          }
        />
      </div>
      <OnboardingWizard />
      <OnboardingTour />
      <LevelUpCelebration points={student.totalPoints} />
    </div>
  );
}
