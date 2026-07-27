export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Dna } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { getDnaHistory, getLearningDna } from "@/lib/engine/learning-dna";
import { DnaOverview } from "@/components/learning-dna/dna-overview";
import { DnaChanges, DnaInsights } from "@/components/learning-dna/dna-insights";
import { DnaPlan, DnaRecommendations } from "@/components/learning-dna/dna-plan";
import { DnaGrowth, DnaSkills } from "@/components/learning-dna/dna-skills";
import { DnaMistakes, DnaMotivationTrend } from "@/components/learning-dna/dna-trends";

/**
 * The student's Learning DNA page.
 *
 * Reads the profile ONCE and passes it down to every section. The engine's read
 * path is memoised per request anyway, but threading a single object makes the
 * data flow obvious and keeps every panel on the page consistent with the others —
 * no section can render a metric computed a moment apart from its neighbour.
 *
 * Sections are ordered by what a student needs first: who they are, what to do
 * today, why, then the detail.
 */

async function DnaContent({ studentId }: { studentId: string }) {
  const [profile, history] = await Promise.all([
    getLearningDna(studentId),
    getDnaHistory(studentId, 60),
  ]);

  return (
    <div className="space-y-6">
      <DnaOverview profile={profile} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DnaPlan profile={profile} />
        <DnaRecommendations profile={profile} />
      </div>

      <DnaInsights profile={profile} />

      <DnaChanges profile={profile} />

      <DnaSkills profile={profile} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DnaMotivationTrend profile={profile} history={history} />
        <DnaMistakes profile={profile} />
      </div>

      <DnaGrowth profile={profile} />

      <p className="text-center text-[11px] text-gray-500 pt-2">
        Learning DNA updates itself as you study — nothing here is entered by hand. Profile computed{" "}
        {new Date(profile.computedAt).toLocaleString("en-GB", {
          timeZone: "Asia/Tashkent",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}{" "}
        from {profile.dataPoints} observations over {profile.windowDays} days.
      </p>
    </div>
  );
}

export default async function LearningDnaPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!student) {
    return (
      <AccountNotice
        title="No student profile found"
        message="Sign in with a student account to see your Learning DNA."
      />
    );
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-7xl pb-24 lg:pb-8">
        <PageHeader
          back={{ href: "/dashboard", label: "Back to Dashboard" }}
          icon={Dna}
          iconClassName="text-averna-purple"
          title={
            <>
              Learning <span className="neon-text-purple">DNA</span>
            </>
          }
          subtitle="How you learn best — discovered from your own study behaviour, not a questionnaire. 🧬"
        />

        {/* The profile can require a full recomputation on a cold read, so the
            page streams: the header is instant, the analysis arrives when ready. */}
        <Suspense
          fallback={
            <div className="space-y-5">
              <WidgetSkeleton rows={4} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <WidgetSkeleton rows={3} />
                <WidgetSkeleton rows={3} />
                <WidgetSkeleton rows={3} />
              </div>
              <WidgetSkeleton rows={5} />
            </div>
          }
        >
          <DnaContent studentId={student.id} />
        </Suspense>
      </div>
    </div>
  );
}
