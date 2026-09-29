export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { db } from "@/lib/db";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { FirstRunGuide } from "@/components/learning/first-run-guide";
import { ThirtyDaySummary } from "@/components/progress/thirty-day-summary";
import { BandProgress } from "@/components/dashboard/band-progress";
import { PersonalBests } from "@/components/dashboard/personal-bests";
import { TestHistory } from "@/components/dashboard/test-history";
import { AdaptivePractice } from "@/components/dashboard/adaptive-practice";

/** Progress → Overview: the last 30 days, the band journey and recent tests. */
export default async function ProgressOverviewPage() {
  const { session, student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to see your progress." />;
  }

  const testsCount = await db.iELTSTest.count({ where: { studentId: student.id } });

  return (
    <div className="space-y-6">
      {testsCount === 0 && <FirstRunGuide name={session.user.name} />}

      <Suspense fallback={<WidgetSkeleton rows={3} />}>
        <ThirtyDaySummary studentId={student.id} />
      </Suspense>

      {testsCount > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <BandProgress studentId={student.id} targetBand={student.targetBand} />
            </Suspense>
            <Suspense fallback={<WidgetSkeleton rows={3} />}>
              <PersonalBests studentId={student.id} />
            </Suspense>
          </div>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
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
