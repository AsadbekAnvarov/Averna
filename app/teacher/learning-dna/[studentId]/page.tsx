export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Brain, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountNotice } from "@/components/account-notice";
import { PageHeader } from "@/components/ui/page-header";
import { WidgetSkeleton } from "@/components/ui/widget-skeleton";
import { LearningDnaPanel } from "@/components/teacher/learning-dna-panel";

/**
 * Teacher view of one student's Learning DNA.
 *
 * Kept separate from the Parent Progress Report on purpose: that page is written
 * to be shared with a family, whereas this is a professional briefing containing
 * teaching strategy and habit diagnostics. Different audience, different page.
 *
 * Access is checked here as well as in the API: a teacher may only open a student
 * who is in one of their own groups. A behavioural profile is more revealing than
 * a grade, so it doesn't inherit the looser "any teacher" convention.
 */
export default async function TeacherLearningDnaPage({
  params,
}: {
  params: { studentId: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "STUDENT") redirect("/learning-dna");

  const student = await db.student.findUnique({
    where: { id: params.studentId },
    select: {
      id: true,
      level: true,
      targetBand: true,
      user: { select: { name: true } },
      group: { select: { name: true, teacherId: true } },
    },
  });

  if (!student) {
    return <AccountNotice title="Student not found" message="This student does not exist." />;
  }

  if (session.user.role === "TEACHER") {
    const teacher = await db.teacher.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!teacher || student.group?.teacherId !== teacher.id) {
      return (
        <AccountNotice
          title="Not your student"
          message="You can only view the Learning DNA of students in your own groups."
        />
      );
    }
  }

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-8 max-w-4xl pb-12">
        <PageHeader
          back={{ href: "/teacher/students", label: "Back to Students" }}
          icon={Brain}
          iconClassName="text-averna-purple"
          title={
            <>
              How <span className="neon-text-purple">{student.user.name ?? "this student"}</span> learns
            </>
          }
          subtitle={`${student.group?.name ?? "No group"} · ${student.level ?? "Level N/A"}${
            student.targetBand ? ` · target Band ${student.targetBand}` : ""
          }`}
          action={
            <Link
              href={`/teacher/parent-report/${student.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-averna-cyan/40 px-3 py-2 text-xs text-averna-cyan hover:bg-averna-cyan/10 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Parent report
            </Link>
          }
        />

        {/* A cold profile may need a full recomputation, so stream it in. */}
        <Suspense fallback={<WidgetSkeleton rows={6} />}>
          <LearningDnaPanel studentId={student.id} />
        </Suspense>
      </div>
    </div>
  );
}
