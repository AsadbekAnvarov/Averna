export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { AiClone } from "@/components/dashboard/ai-clone";
import { SkillRadar } from "@/components/dashboard/skill-radar";
import { SkillDna } from "@/components/dashboard/skill-dna";
import { MemoryTimelineSection } from "@/components/dashboard/memory-timeline-section";
import { WritingTimeMachine } from "@/components/dashboard/writing-time-machine";

export const metadata = { title: "Skills · My Progress" };

/** Progress → Skills: predicted bands, skill balance, memory strength and writing growth. */
export default async function ProgressSkillsPage() {
  const { student } = await getPageStudent();
  if (!student) {
    return <AccountNotice title="No student profile found" message="Sign in with a student account to see your progress." />;
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <AiClone studentId={student.id} />
      </Suspense>
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <SkillRadar studentId={student.id} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton rows={3} />}>
          <SkillDna studentId={student.id} />
        </Suspense>
      </div>
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <MemoryTimelineSection studentId={student.id} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton rows={4} />}>
        <WritingTimeMachine studentId={student.id} />
      </Suspense>
    </div>
  );
}
