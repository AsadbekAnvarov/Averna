export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WelcomeSection } from "@/components/dashboard/welcome-section";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UpcomingHomework } from "@/components/dashboard/upcoming-homework";
import { AchievementsPreview } from "@/components/dashboard/achievements-preview";
import { WordOfTheDay } from "@/components/dashboard/word-of-the-day";
import { MotivationBanner } from "@/components/dashboard/motivation-banner";
import { Milestones } from "@/components/dashboard/milestones";
import { StreakHeatmap } from "@/components/dashboard/streak-heatmap";
import { StudentOfTheWeek } from "@/components/student-of-the-week";
import { DailyQuests } from "@/components/dashboard/daily-quests";
import { DailyArticle } from "@/components/dashboard/daily-article";
import { StudyPet } from "@/components/dashboard/study-pet";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { OnboardingTour } from "@/components/onboarding-tour";
import { AccountNotice } from "@/components/account-notice";
import { LearningPath } from "@/components/dashboard/learning-path";
import { SmartFocus } from "@/components/dashboard/smart-focus";
import { StudyReminder } from "@/components/dashboard/study-reminder";
import { StreakCelebration } from "@/components/dashboard/streak-celebration";
import { WeeklyRecap } from "@/components/dashboard/weekly-recap";
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

  // --- Learning Path progress (today) ---
  // We use the IELTSTest table (module column) + the ActivityLog (single source
  // of truth for actions) + HomeworkSubmission so every step maps to a real,
  // reliably-recorded signal.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayTests, todayActivities, homeworkSubmittedToday] = await Promise.all([
    db.iELTSTest.findMany({
      where: { studentId: student.id, completedAt: { gte: todayStart } },
      select: { module: true, aiAnalysis: true },
    }),
    db.activityLog.findMany({
      where: { studentId: student.id, createdAt: { gte: todayStart } },
      select: { action: true, points: true },
    }),
    db.homeworkSubmission.count({
      where: { studentId: student.id, submittedAt: { gte: todayStart } },
    }),
  ]);

  const hasListeningToday = todayTests.some((t) => t.module === "LISTENING");
  const hasReadingToday = todayTests.some((t) => t.module === "READING");
  const hasWritingToday = todayTests.some((t) => t.module === "WRITING");
  // A mock exam is saved as IELTSTest records tagged with aiAnalysis.type = "mock".
  const hasMockExamToday = todayTests.some((t) => {
    const a = t.aiAnalysis as { type?: string } | null;
    return !!a && typeof a === "object" && a.type === "mock";
  });

  const todayActions = new Set(todayActivities.map((a) => a.action));
  const hasFlashcardsToday = todayActions.has("FLASHCARDS_STUDIED");
  const hasSpeakingToday =
    todayActions.has("SPEAKING_PRACTICE") || todayActions.has("SPEAKING_SESSION_COMPLETED");
  const hasChallengeToday = todayActions.has("DAILY_CHALLENGE");
  const hasPronunciationToday = todayActions.has("PRONUNCIATION_PRACTICE");
  const hasHomeworkToday = homeworkSubmittedToday > 0;

  // Total XP the student has actually earned today (powers the daily goal meter).
  const xpEarnedToday = todayActivities.reduce((sum, a) => sum + (a.points ?? 0), 0);

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

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-7xl pb-24 lg:pb-6">
        <DashboardHeader user={student.user} />
        
        <div className="space-y-6">
          <MotivationBanner
            name={student.user.name}
            points={student.totalPoints}
            streak={student.currentStreak}
          />

          <LearningPath
            studentName={student.user.name}
            currentStreak={student.currentStreak}
            xpEarnedToday={xpEarnedToday}
            hasListening={hasListeningToday}
            hasReading={hasReadingToday}
            hasWriting={hasWritingToday}
            hasSpeaking={hasSpeakingToday}
            hasMockExam={hasMockExamToday}
            hasHomework={hasHomeworkToday}
            hasFlashcards={hasFlashcardsToday}
            hasChallenge={hasChallengeToday}
            hasPronunciation={hasPronunciationToday}
          />

          {student.blacklisted && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-300">You are on the blacklist</p>
                <p className="text-sm">
                  {student.blacklistReason || "Please complete your homework."} Talk to your teacher and catch up to be removed.
                </p>
              </div>
            </div>
          )}

          <WelcomeSection 
            student={student}
            quote={dailyQuote}
          />

          <StatsGrid student={student} />

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <QuickActions />
              <Milestones
                points={student.totalPoints}
                currentStreak={student.currentStreak}
                longestStreak={student.longestStreak}
                testsCompleted={testsCompleted}
              />
              <StreakHeatmap studentId={student.id} />
              <UpcomingHomework homework={upcomingHomework} />
              <RecentActivity activities={student.activityLogs} />
            </div>

            <div className="space-y-6">
              <StudyPet streak={student.currentStreak} points={student.totalPoints} />
              <WeeklyRecap studentId={student.id} streak={student.currentStreak} />
              <SmartFocus studentId={student.id} />
              <StudyReminder xpEarnedToday={xpEarnedToday} />
              <StudentOfTheWeek />
              <DailyQuests studentId={student.id} streakFreezes={(student as any).streakFreezes ?? 0} />
              <DailyArticle />
              <WordOfTheDay />
              <AchievementsPreview achievements={student.achievements} />
            </div>
          </div>
        </div>
      </div>
      <MobileNav />
      <OnboardingTour />
      <StreakCelebration currentStreak={student.currentStreak} />
    </div>
  );
}
