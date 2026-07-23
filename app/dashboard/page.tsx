export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingHomework } from "@/components/dashboard/upcoming-homework";
import { WordOfTheDay } from "@/components/dashboard/word-of-the-day";
import { Milestones } from "@/components/dashboard/milestones";
import { StreakHeatmap } from "@/components/dashboard/streak-heatmap";
import { StudentOfTheWeek } from "@/components/student-of-the-week";
import { DailyQuests } from "@/components/dashboard/daily-quests";
import { DailyArticle } from "@/components/dashboard/daily-article";
import { StudyPet } from "@/components/dashboard/study-pet";
import { OnboardingTour } from "@/components/onboarding-tour";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { AccountNotice } from "@/components/account-notice";
import { StudentAttentionBar } from "@/components/dashboard/student-attention-bar";
import { BandProgress } from "@/components/dashboard/band-progress";
import { SkillRadar } from "@/components/dashboard/skill-radar";
import { LevelProgress } from "@/components/dashboard/level-progress";
import { WeeklyGoal } from "@/components/dashboard/weekly-goal";
import { RecommendedToday } from "@/components/dashboard/recommended-today";
import { TeacherCard } from "@/components/dashboard/teacher-card";
import { LeaderboardWidget } from "@/components/dashboard/leaderboard-widget";
import { MessagePreview } from "@/components/dashboard/message-preview";
import { PomodoroTimer } from "@/components/dashboard/pomodoro-timer";
import { GroupFeed } from "@/components/dashboard/group-feed";
import { AchievementsProgress } from "@/components/dashboard/achievements-progress";
import { PersonalBests } from "@/components/dashboard/personal-bests";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { DashboardPreferences } from "@/components/dashboard/dashboard-preferences";
import { ExamCountdown } from "@/components/dashboard/exam-countdown";
import { TestHistory } from "@/components/dashboard/test-history";
import { MentorCard } from "@/components/dashboard/mentor-card";
import { MoodCheckin } from "@/components/dashboard/mood-checkin";
import { DailySpin } from "@/components/dashboard/daily-spin";
import { SeasonalDecor } from "@/components/dashboard/seasonal-decor";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { LevelUpCelebration } from "@/components/dashboard/level-up-celebration";
import { CommitmentCard } from "@/components/dashboard/commitment-card";
import { VoiceJournal } from "@/components/dashboard/voice-journal";
import { ExplainCoach } from "@/components/learning/explain-coach";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { SectionHeader } from "@/components/ui/section-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { Sparkles, LayoutGrid, BookOpen, Mic, Lightbulb } from "lucide-react";
import { Suspense } from "react";
import { updateStudentStreak } from "@/lib/db-helpers";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Route non-students to their own area (one-way, prevents redirect loops)
  if (session.user.role === "ADMIN") {
    redirect("/admin/dashboard");
  }
  if (session.user.role === "TEACHER") {
    redirect("/teacher/dashboard");
  }

  // Get comprehensive student data
  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      group: {
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      achievements: {
        include: {
          achievement: true,
        },
        orderBy: {
          unlockedAt: "desc",
        },
        take: 5,
      },
      homeworkSubmissions: {
        include: {
          homework: true,
        },
        orderBy: {
          submittedAt: "desc",
        },
        take: 5,
      },
      activityLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!student) {
    return (
      <AccountNotice
        title="No student profile found"
        message="This account doesn't have a student profile yet. If you just signed up, please sign in again, or contact your teacher."
      />
    );
  }

  // Update student streak on dashboard visit
  await updateStudentStreak(student.id);

  // Count completed tests (for milestones)
  const testsCompleted = await db.iELTSTest.count({
    where: { studentId: student.id },
  });

  // Get upcoming homework
  const upcomingHomework = await db.homework.findMany({
    where: {
      groupId: student.groupId || "",
      dueDate: {
        gte: new Date(),
      },
      submissions: {
        none: {
          studentId: student.id,
        },
      },
    },
    orderBy: {
      dueDate: "asc",
    },
    take: 5,
    include: {
      teacher: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Get today's quote
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyQuote = await db.dailyQuote.findFirst({
    where: {
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  // Study activity completed in the last 7 days (for the weekly goal ring)
  const weeklyCompleted = await db.activityLog.count({
    where: { studentId: student.id, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
  });

  return (
    <div className="min-h-screen premium-gradient dashboard-anim">
      <SeasonalDecor />
      <div className="container relative z-10 mx-auto px-4 py-6 max-w-7xl pb-24 lg:pb-6">
        <DashboardHeader user={student.user} />

        {/* Focus + controls (always visible above the tabs) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Suspense fallback={<div className="h-8" />}>
            <StudentAttentionBar
              userId={session.user.id}
              homeworkDue={upcomingHomework.length}
              streak={student.currentStreak}
            />
          </Suspense>
          <div className="flex items-center gap-4">
            <DashboardPreferences />
            <LiveRefresh />
          </div>
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
                globalRank={student.globalRank}
                goal={student.personalGoal}
                quote={dailyQuote}
              />
              <StatsGrid student={student} />

              {/* Bento grid — modern, asymmetric overview of the day */}
              <div className="tab-stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-start">
                {/* Personalised plan — full-width banner */}
                <div className="md:col-span-2 lg:col-span-4">
                  <Suspense fallback={<WidgetSkeleton rows={2} />}>
                    <RecommendedToday studentId={student.id} groupId={student.groupId} />
                  </Suspense>
                </div>

                {/* What's due + a little vocabulary */}
                <div className="md:col-span-2 lg:col-span-2">
                  <UpcomingHomework homework={upcomingHomework} />
                </div>
                <div className="md:col-span-2 lg:col-span-2">
                  <WordOfTheDay />
                </div>

                {/* Goal + level + countdown */}
                <div className="md:col-span-2 lg:col-span-2">
                  <WeeklyGoal completed={weeklyCompleted} />
                </div>
                <div className="md:col-span-1 lg:col-span-1">
                  <LevelProgress points={student.totalPoints} />
                </div>
                <div className="md:col-span-1 lg:col-span-1">
                  <ExamCountdown />
                </div>

                {/* Streak Insurance — stake points on a weekly study goal */}
                <div className="md:col-span-2 lg:col-span-2">
                  <Suspense fallback={<WidgetSkeleton rows={3} />}>
                    <CommitmentCard studentId={student.id} />
                  </Suspense>
                </div>
              </div>
            </>
          }
          learn={
            <>
              <div>
                <SectionHeader icon={LayoutGrid} title="Explore" subtitle="Jump into any module or tool" accent="text-averna-purple" action={{ label: "Learning Center", href: "/learning" }} />
                <QuickActions />
              </div>
              <div>
                <SectionHeader icon={Sparkles} title="Coach & Focus" subtitle="Get help and study in focused sprints" accent="text-averna-neon" />
                <div className="grid lg:grid-cols-2 gap-6">
                  <MentorCard />
                  <PomodoroTimer />
                </div>
              </div>
              <div>
                <SectionHeader icon={Mic} title="Speak Daily" subtitle="A 60-second spoken diary that tracks your fluency over time" accent="text-averna-pink" />
                <VoiceJournal />
              </div>
              <div>
                <SectionHeader icon={Lightbulb} title="Teach to Learn" subtitle="Explain a concept to the AI coach — the fastest way to master it" accent="text-averna-purple" />
                <ExplainCoach />
              </div>
              <div>
                <SectionHeader icon={BookOpen} title="Keep Learning" subtitle="A little reading goes a long way" accent="text-averna-cyan" />
                <div className="grid lg:grid-cols-2 gap-6">
                  <DailyArticle />
                  <WordOfTheDay />
                </div>
              </div>
            </>
          }
          progress={
            <>
              <div className="grid lg:grid-cols-2 gap-6">
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <BandProgress studentId={student.id} targetBand={student.targetBand} />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <SkillRadar studentId={student.id} />
                </Suspense>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <LevelProgress points={student.totalPoints} />
                <WeeklyGoal completed={weeklyCompleted} />
                <ExamCountdown />
              </div>
              <StreakHeatmap studentId={student.id} />
              <div className="grid lg:grid-cols-2 gap-6">
                <Milestones
                  points={student.totalPoints}
                  currentStreak={student.currentStreak}
                  longestStreak={student.longestStreak}
                  testsCompleted={testsCompleted}
                />
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <TestHistory studentId={student.id} />
                </Suspense>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <AchievementsProgress
                    studentId={student.id}
                    longestStreak={student.longestStreak}
                    globalRank={student.globalRank}
                  />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <PersonalBests studentId={student.id} />
                </Suspense>
              </div>
            </>
          }
          classroom={
            <>
              <div className="grid lg:grid-cols-2 gap-6">
                <Suspense fallback={<WidgetSkeleton rows={2} />}>
                  <TeacherCard groupId={student.groupId} />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <LeaderboardWidget studentId={student.id} groupId={student.groupId} />
                </Suspense>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <Suspense fallback={<WidgetSkeleton rows={3} />}>
                  <MessagePreview userId={session.user.id} />
                </Suspense>
                <Suspense fallback={<WidgetSkeleton rows={4} />}>
                  <GroupFeed studentId={student.id} groupId={student.groupId} />
                </Suspense>
              </div>
              <RecentActivity activities={student.activityLogs} />
            </>
          }
          fun={
            <>
              <div className="grid lg:grid-cols-2 gap-6">
                <MoodCheckin />
                <div data-gamified>
                  <DailySpin />
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-6">
                <div data-gamified>
                  <StudyPet streak={student.currentStreak} points={student.totalPoints} />
                </div>
                <div data-gamified>
                  <DailyQuests studentId={student.id} streakFreezes={(student as any).streakFreezes ?? 0} />
                </div>
              </div>
              <div data-gamified>
                <StudentOfTheWeek />
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
