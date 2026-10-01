export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardHomework, getDashboardStudent } from "@/lib/dashboard/data";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { DashboardPreferences } from "@/components/dashboard/dashboard-preferences";
import { StudentAttentionBar } from "@/components/dashboard/student-attention-bar";
import { DaypartAmbiance } from "@/components/dashboard/daypart-ambiance";
import { SeasonalDecor } from "@/components/dashboard/seasonal-decor";
import { LiveRefresh } from "@/components/ui/live-refresh";
import { AccountNotice } from "@/components/account-notice";
import { OnboardingTour } from "@/components/onboarding-tour";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { LevelUpCelebration } from "@/components/dashboard/level-up-celebration";

/**
 * Student dashboard shell: header, what-needs-you bar, blacklist banner, the
 * tab bar, onboarding and level-up. It stays mounted while the student switches
 * tabs; only the page (the active tab, see ./page.tsx) is re-rendered.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  // Route non-students to their own area (one-way, prevents redirect loops)
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");

  const student = await getDashboardStudent(session.user.id);

  if (!student) {
    return (
      <AccountNotice
        title="No student profile found"
        message="This account doesn't have a student profile yet. If you just signed up, please sign in again, or contact your teacher."
      />
    );
  }

  // Shared with the Today tab through React cache (one query per request).
  const { counts } = await getDashboardHomework(student.id, student.groupId);

  return (
    <div className="min-h-screen premium-gradient dashboard-anim">
      <DaypartAmbiance />
      <SeasonalDecor />
      <div className="container relative z-10 mx-auto px-4 py-4 sm:py-6 max-w-7xl pb-8 lg:pb-6">
        <h1 className="sr-only">Student dashboard</h1>
        <DashboardHeader
          user={student.user}
          tools={
            <>
              <DashboardPreferences />
              <LiveRefresh />
            </>
          }
        />

        {/* What needs you today (swipes sideways on phones) */}
        <div className="mb-4">
          <Suspense fallback={<div className="h-8" />}>
            <StudentAttentionBar
              userId={session.user.id}
              homeworkDue={counts.upcoming}
              homeworkOverdue={counts.overdue}
            />
          </Suspense>
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

        <DashboardTabs>{children}</DashboardTabs>
      </div>
      <OnboardingWizard />
      <OnboardingTour />
      <LevelUpCelebration points={student.totalPoints} />
    </div>
  );
}
