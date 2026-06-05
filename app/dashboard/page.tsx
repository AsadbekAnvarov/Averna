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

  // --- Learning Path progress queries (today) ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [hasListeningToday, hasReadingToday, hasWritingToday, hasSpeakingToday, hasMockExamToday, hasHomeworkToday] = await Promise.all([
    db.iELTSTest.count({ where: { studentId: student.id, module: "LISTENING", completedAt: { gte: todayStart } } }).then(c => c > 0),
    db.iELTSTest.count({ where: { studentId: student.id, module: "READING", completedAt: { gte: todayStart } } }).then(c => c > 0),
    db.iELTSTest.count({ where: { studentId: student.id, module: "WRITING", completedAt: { gte: todayStart } } }).then(c => c > 0),
    db.iELTSTest.count({ where: { studentId: student.id, module: "SPEAKING", completedAt: { gte: todayStart } } }).then(c => c > 0),
    db.iELTSTest.count({ where: { studentId: student.id, completedAt: { gte: todayStart } } }).then(c => c >= 4),
    db.homeworkSubmission.count({ where: { studentId: student.id, submittedAt: { gte: todayStart } } }).then(c => c > 0),
  ]);

  // Check if student did flashcards or challenge today via activity logs
  const todayActivities = await db.activityLog.findMany({
    where: { studentId: student.id, createdAt: { gte: todayStart } },
    select: { action: true },
  });

  const hasFlashcardsToday = todayActivities.some(a => a.action.toLowerCase().includes("flashcard"));
  const hasChallengeToday = todayActivities.some(a => a.action.toLowerCase().includes("challenge"));

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
            totalPoints={student.totalPoints}
            currentStreak={student.currentStreak}
            testsCompleted={testsCompleted}
            hasListening={hasListeningToday}
            hasReading={hasReadingToday}
            hasWriting={hasWritingToday}
            hasSpeaking={hasSpeakingToday}
            hasMockExam={hasMockExamToday}
            hasHomework={hasHomeworkToday}
            hasFlashcards={hasFlashcardsToday}
            hasChallenge={hasChallengeToday}
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
    </div>
  );
}
