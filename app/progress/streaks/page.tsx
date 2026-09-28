export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { StreakStory } from "@/components/dashboard/streak-story";
import { StreakHeatmap } from "@/components/dashboard/streak-heatmap";
import { CommitmentCard } from "@/components/dashboard/commitment-card";
import { ActivityHistory } from "@/components/progression/activity-history";
import { LearningJournal } from "@/components/dashboard/learning-journal";
import { MonthlyRecapSection } from "@/components/dashboard/monthly-recap-section";
import { MemoriesSection } from "@/components/dashboard/memories-section";

export const metadata = { title: "Streaks · My Progress" };

/** Progress → Streaks: consistency, the study challenge, and your learning story over time. */
export default async function ProgressStreaksPage() {
  const { student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to see your progress." />;
  }

  return (
    <div className="space-y-6">
      <StreakStory currentStreak={student.currentStreak} longestStreak={student.longestStreak} />
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <StreakHeatmap studentId={student.id} />
      </Suspense>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <CommitmentCard studentId={student.id} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={4} />}>
          <ActivityHistory studentId={student.id} />
        </Suspense>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={4} />}>
          <LearningJournal studentId={student.id} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <MonthlyRecapSection studentId={student.id} />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <MemoriesSection studentId={student.id} />
      </Suspense>
    </div>
  );
}
