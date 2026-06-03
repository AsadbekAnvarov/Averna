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
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { AccountNotice } from "@/components/account-notice";
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
              <UpcomingHomework homework={upcomingHomework} />
              <RecentActivity activities={student.activityLogs} />
            </div>

            <div className="space-y-6">
              <WordOfTheDay />
              <AchievementsPreview achievements={student.achievements} />
            </div>
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
