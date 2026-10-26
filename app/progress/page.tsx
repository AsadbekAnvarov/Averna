export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { db } from "@/lib/db";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { FirstRunGuide } from "@/components/learning/first-run-guide";
import { ThirtyDaySummary } from "@/components/progress/thirty-day-summary";
import { BandForecastSection } from "@/components/forecast/forecast-sections";
import { PersonalBests } from "@/components/dashboard/personal-bests";
import { TestHistory } from "@/components/dashboard/test-history";
import { AdaptivePractice } from "@/components/dashboard/adaptive-practice";

/** Progress → Overview: the band forecast, the last 30 days, personal bests and recent tests. */
export default async function ProgressOverviewPage() {
  const { session, student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to see your progress." />;
  }

  const testsCount = await db.iELTSTest.count({ where: { studentId: student.id } });

  return (
    <div className="space-y-4 sm:space-y-5">
      {testsCount === 0 && <FirstRunGuide name={session.user.name} />}

      {testsCount > 0 && (
        <Suspense fallback={<WidgetSkeleton rows={5} />}>
          <BandForecastSection studentId={student.id} targetBand={student.targetBand} />
        </Suspense>
      )}

      <Suspense fallback={<WidgetSkeleton rows={3} />}>
        <ThirtyDaySummary studentId={student.id} />
      </Suspense>

      {testsCount > 0 && (
        <>
          <Suspense fallback={<WidgetSkeleton rows={3} />}>
            <PersonalBests studentId={student.id} />
          </Suspense>
          <div className="grid grid-cols-1 items-start gap-4 lg:gap-5 lg:grid-cols-2">
            <Suspense fallback={<WidgetSkeleton rows={4} />}>
              <TestHistory studentId={student.id} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton rows={4} />}>
              <AdaptivePractice studentId={student.id} />
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}
