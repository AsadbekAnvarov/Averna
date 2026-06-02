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
import { updateStudentStreak } from "@/lib/db-helpers";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
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
    redirect("/auth/signin");
  }

  // Update student streak on dashboard visit
  await updateStudentStreak(student.id);

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
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <DashboardHeader user={student.user} />
        
        <div className="space-y-6">
          <WelcomeSection 
            student={student}
            quote={dailyQuote}
          />

          <StatsGrid student={student} />

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <QuickActions />
              <UpcomingHomework homework={upcomingHomework} />
              <RecentActivity activities={student.activityLogs} />
            </div>

            <div className="space-y-6">
              <AchievementsPreview achievements={student.achievements} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
