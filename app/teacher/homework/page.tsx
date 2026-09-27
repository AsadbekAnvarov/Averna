export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, ChevronRight, Notebook, PlusCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teacherOf } from "@/lib/access";
import { AUTO_GRADED, isExamHomeworkKind } from "@/lib/homework/exam-homework";
import { dueState } from "@/lib/homework/library-shared";
import { reviewedTestIds } from "@/lib/homework/reviews";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { PageHeader } from "@/components/ui/page-header";
import { ExamKindBadge, ModuleBadge } from "@/components/homework/exam-kind";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

type SearchParams = Record<string, string | string[] | undefined>;
const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const LIMIT = 150;

interface GroupRow {
  id: string;
  name: string;
  students: { id: string }[];
}

interface HomeworkRow {
  id: string;
  title: string;
  module: string;
  dueDate: Date;
  groupId: string;
  contentKind: string | null;
  contentPart: number | null;
  contentTitle: string | null;
  group: { name: string } | null;
  submissions: {
    id: string;
    studentId: string;
    status: string;
    band: number | null;
    testId: string | null;
    submittedAt: Date;
    student: { user: { name: string | null } | null } | null;
  }[];
}

export default async function TeacherHomeworkPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");
  if (session.user.role === "STUDENT") return redirect("/dashboard");

  const teacher = await teacherOf(session.user.id);
  if (!teacher) {
    return (
      <AccountNotice
        title="No teacher profile found"
        message="This account doesn't have a teacher profile. Sign in with a teacher account to manage homework."
      />
    );
  }

  const groups: GroupRow[] = await db.group
    .findMany({
      where: { teacherId: teacher.id },
      select: { id: true, name: true, students: { select: { id: true } } },
      orderBy: { name: "asc" },
    })
    .catch(() => []);
  const wanted = firstParam(searchParams.group);
  const selected = groups.find((g) => g.id === wanted) ?? null;
  const groupIds = selected ? [selected.id] : groups.map((g) => g.id);

  // Homework of the groups this teacher teaches (whoever created it).
  const homework: HomeworkRow[] = groupIds.length
    ? await db.homework
        .findMany({
          where: { groupId: { in: groupIds } },
          orderBy: { createdAt: "desc" },
          take: LIMIT,
          select: {
            id: true,
            title: true,
            module: true,
            dueDate: true,
            groupId: true,
            contentKind: true,
            contentPart: true,
            contentTitle: true,
            group: { select: { name: true } },
            submissions: {
              orderBy: { submittedAt: "asc" },
              select: {
                id: true,
                studentId: true,
                status: true,
                band: true,
                testId: true,
                submittedAt: true,
                student: { select: { user: { select: { name: true } } } },
              },
            },
          },
        })
        .catch(() => [])
    : [];

  // Writing / Speaking attempts the teacher has already reviewed (bands come from the submission itself).
  const reviewed = await reviewedTestIds(
    homework.flatMap((h) => h.submissions.map((s) => ({ kind: h.contentKind, testId: s.testId })))
  );

  const members = new Map(groups.map((g) => [g.id, new Set(g.students.map((s) => s.id))]));

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-8 pb-24 lg:pb-8">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/teacher/dashboard", label: "Back to Dashboard" }}
          icon={Notebook}
          iconClassName="text-averna-purple"
          title="Homework Management"
          action={
            <Link href={selected ? `/teacher/homework/create?group=${encodeURIComponent(selected.id)}` : "/teacher/homework/create"}>
              <Button className="neon-button bg-averna-primary hover:bg-averna-light">
                <PlusCircle className="mr-2 h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Set homework</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
          }
        />

        {groups.length > 1 && (
          <nav aria-label="Filter by group" className="mb-6 flex flex-wrap gap-2">
            <Link
              href="/teacher/homework"
              aria-current={!selected ? "page" : undefined}
              className={cn(
                "inline-flex min-h-[36px] items-center rounded-full border px-3 text-sm transition-colors",
                !selected ? "border-averna-neon/50 bg-averna-neon/10 text-averna-neon" : "border-white/10 text-gray-300 hover:text-white"
              )}
            >
              All groups
            </Link>
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/teacher/homework?group=${encodeURIComponent(g.id)}`}
                aria-current={selected?.id === g.id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[36px] items-center rounded-full border px-3 text-sm transition-colors",
                  selected?.id === g.id ? "border-averna-neon/50 bg-averna-neon/10 text-averna-neon" : "border-white/10 text-gray-300 hover:text-white"
                )}
              >
                {g.name}
              </Link>
            ))}
          </nav>
        )}

        {homework.length === 0 ? (
          <Card className="glass border-purple-500/30">
            <CardContent className="py-2">
              <EmptyState
                icon={Notebook}
                title="No homework yet"
                description="Set a test from the library or a classic task — every student in the group is notified."
                accent="text-averna-purple"
                action={{ label: "Set homework", href: "/teacher/homework/create" }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {homework.map((hw) => {
              const inGroup = members.get(hw.groupId) ?? new Set<string>();
              const subs = hw.submissions.filter((s) => inGroup.has(s.studentId));
              const total = inGroup.size;
              const due = new Date(hw.dueDate);
              const dueInfo = dueState(due);
              const exam = isExamHomeworkKind(hw.contentKind) ? hw.contentKind : null;
              const lateCount = subs.filter((s) => new Date(s.submittedAt).getTime() > due.getTime()).length;
              const bands = hw.submissions.map((s) => s.band).filter((b): b is number => typeof b === "number" && Number.isFinite(b));
              const avg = bands.length ? Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 10) / 10 : null;
              const toReview = exam && !AUTO_GRADED[exam] ? hw.submissions.filter((s) => s.testId && !reviewed.has(s.testId)).length : 0;
              const pendingCount = hw.submissions.filter((s) => s.status === "SUBMITTED").length;
              const pct = total ? Math.round((subs.length / total) * 100) : 0;
              const href = `/teacher/homework/${encodeURIComponent(hw.id)}`;
              return (
                <Card key={hw.id} className="glass border-purple-500/30">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {exam ? <ExamKindBadge kind={exam} part={hw.contentPart} /> : <ModuleBadge module={hw.module} />}
                          <span className="text-xs text-gray-400">{hw.group?.name}</span>
                        </div>
                        <CardTitle className="text-lg leading-snug sm:text-xl">
                          <Link href={href} className="hover:underline focus-visible:underline">
                            {hw.title}
                          </Link>
                        </CardTitle>
                        {exam && hw.contentTitle && hw.contentTitle !== hw.title && (
                          <p className="mt-1 text-sm text-gray-400">{hw.contentTitle}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                          dueInfo.overdue ? "border-white/10 text-gray-400" : dueInfo.urgent ? "border-amber-300/30 text-amber-300" : "border-white/10 text-gray-300"
                        )}
                        title={formatDateTime(due)}
                      >
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        {dueInfo.overdue ? `Past due · ${formatDate(due)}` : `Due ${formatDateTime(due)}`}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                      <div className="min-w-[10rem] flex-1">
                        <p className="text-sm text-gray-300">
                          <span className="font-semibold text-white">
                            {subs.length}/{total}
                          </span>{" "}
                          submitted
                          {lateCount > 0 && <span className="text-amber-300"> · {lateCount} late</span>}
                        </p>
                        <span aria-hidden className="mt-1.5 block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full bg-averna-neon" style={{ width: `${pct}%` }} />
                        </span>
                      </div>
                      {exam && (
                        <p className="text-sm text-gray-300">
                          Average band <span className="font-semibold text-averna-neon">{avg != null ? avg.toFixed(1) : "—"}</span>
                        </p>
                      )}
                      {toReview > 0 && (
                        <p className="text-sm font-semibold text-averna-pink">
                          {toReview} to review
                        </p>
                      )}
                      {!exam && pendingCount > 0 && (
                        <p className="flex items-center gap-1 text-sm font-semibold text-yellow-400">
                          <AlertTriangle className="h-4 w-4" aria-hidden /> {pendingCount} pending grading
                        </p>
                      )}
                      <Link href={href} className="ml-auto inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-averna-neon hover:underline">
                        {exam ? "Results" : "Submissions"} <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>

                    {!exam && hw.submissions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {hw.submissions.slice(0, 3).map((sub) => (
                          <div key={sub.id} className="flex justify-between rounded bg-averna-dark/30 p-2 text-sm">
                            <span className="text-white">{sub.student?.user?.name ?? "Student"}</span>
                            <span className={sub.status === "GRADED" ? "text-green-400" : "text-yellow-400"}>{sub.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {homework.length >= LIMIT && (
              <p className="text-center text-xs text-gray-500">Showing the {LIMIT} most recent homework{selected ? "" : " — filter by group to see older ones"}.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
