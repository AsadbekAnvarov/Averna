export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarClock, CheckCircle2, Eye, Notebook, PenLine, Users } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teacherOf } from "@/lib/access";
import { getListeningExam, getReadingExam } from "@/lib/ielts/catalog";
import type { ExamListeningTest, ExamReadingTest, GradeItem } from "@/lib/ielts/types";
import { AUTO_GRADED, isExamHomeworkKind } from "@/lib/homework/exam-homework";
import { attemptMismatch } from "@/lib/homework/exam-attempt";
import { describeExamHomework, type ExamHomeworkInfo } from "@/lib/homework/library";
import { reviewedTestIds } from "@/lib/homework/reviews";
import { aggregateClassStats, statsLayout, type StatsGroup } from "@/lib/homework/stats";
import { dueState, examPreviewHref, examResultHref, examReviewHref } from "@/lib/homework/library-shared";
import { formatDuration, parseObjectiveAttempt } from "@/components/exam/results/attempt";
import { AccountNotice } from "@/components/account-notice";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { PageHeader } from "@/components/ui/page-header";
import { ExamKindBadge, ModuleBadge } from "@/components/homework/exam-kind";
import { HomeworkQuestionStats } from "@/components/teacher/homework-question-stats";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * One homework, for the teacher of its group (or an admin): every student of
 * the group with their status, band and a link to the attempt; Writing /
 * Speaking attempts link to the review screen; Reading / Listening homework
 * adds class statistics per question.
 */

interface HomeworkRow {
  id: string;
  title: string;
  description: string;
  module: string;
  dueDate: Date;
  createdAt: Date;
  points: number;
  groupId: string;
  contentKind: string | null;
  contentId: string | null;
  contentPart: number | null;
  contentTitle: string | null;
  group: { id: string; name: string; teacherId: string } | null;
}

interface SubmissionRow {
  id: string;
  studentId: string;
  status: string;
  band: number | null;
  testId: string | null;
  submittedAt: Date;
  content: string;
  pointsAwarded: number;
  position: number | null;
  feedback: string | null;
  student: { user: { name: string | null } | null } | null;
}

interface StudentRow {
  id: string;
  user: { name: string | null; email: string | null } | null;
}

interface TestRow {
  id: string;
  studentId: string;
  module: string;
  score: number;
  answers: unknown;
  aiAnalysis: unknown;
  timeSpent: number;
  completedAt: Date;
}

type Status = "not-started" | "on-time" | "late";

const bandText = (b: number | null | undefined) => (typeof b === "number" && Number.isFinite(b) ? b.toFixed(1) : "—");

function mean(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

function StatusPill({ status, overdue }: { status: Status; overdue: boolean }) {
  const map: Record<Status, { label: string; cls: string }> = {
    "on-time": { label: "On time", cls: "border-averna-neon/30 bg-averna-neon/10 text-averna-neon" },
    late: { label: "Late", cls: "border-amber-300/30 bg-amber-400/10 text-amber-300" },
    "not-started": overdue
      ? { label: "Not started · overdue", cls: "border-red-400/30 bg-red-500/10 text-red-300" }
      : { label: "Not started", cls: "border-white/10 bg-white/5 text-gray-400" },
  };
  const s = map[status];
  return <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", s.cls)}>{s.label}</span>;
}

function Tile({ label, value, sub, tone = "text-white" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

const linkCls =
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon";

export default async function TeacherHomeworkDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");
  if (session.user.role === "STUDENT") return redirect("/dashboard");
  const isAdmin = session.user.role === "ADMIN";
  const teacher = await teacherOf(session.user.id);
  if (!teacher && !isAdmin) {
    return <AccountNotice title="No teacher profile found" message="Sign in with a teacher account to see homework results." />;
  }

  const hw: HomeworkRow | null = await db.homework
    .findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        module: true,
        dueDate: true,
        createdAt: true,
        points: true,
        groupId: true,
        contentKind: true,
        contentId: true,
        contentPart: true,
        contentTitle: true,
        group: { select: { id: true, name: true, teacherId: true } },
      },
    })
    .catch(() => null);
  // Teachers see the homework of the groups they teach; admins see everything.
  if (!hw || (!isAdmin && hw.group?.teacherId !== teacher?.id)) {
    return <AccountNotice title="Homework not found" message="This homework doesn't exist or belongs to a group you don't teach." />;
  }

  const kind = isExamHomeworkKind(hw.contentKind) ? hw.contentKind : null;
  const auto = kind ? AUTO_GRADED[kind] : false;

  const [students, submissions]: [StudentRow[], SubmissionRow[]] = await Promise.all([
    db.student
      .findMany({ where: { groupId: hw.groupId }, select: { id: true, user: { select: { name: true, email: true } } } })
      .catch(() => []),
    db.homeworkSubmission
      .findMany({
        where: { homeworkId: hw.id },
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          studentId: true,
          status: true,
          band: true,
          testId: true,
          submittedAt: true,
          content: true,
          pointsAwarded: true,
          position: true,
          feedback: true,
          student: { select: { user: { select: { name: true } } } },
        },
      })
      .catch(() => []),
  ]);

  const testIds = submissions.map((s) => s.testId).filter((x): x is string => !!x);
  const [tests, reviewed, info, paper]: [
    TestRow[],
    Set<string>,
    ExamHomeworkInfo | null,
    ExamReadingTest | ExamListeningTest | null,
  ] = await Promise.all([
    kind && auto && testIds.length
      ? db.iELTSTest
          .findMany({
            where: { id: { in: testIds } },
            select: {
              id: true,
              studentId: true,
              module: true,
              score: true,
              answers: true,
              aiAnalysis: true,
              timeSpent: true,
              completedAt: true,
            },
          })
          .catch(() => [])
      : Promise.resolve([]),
    kind && !auto ? reviewedTestIds(submissions.map((s) => ({ kind, testId: s.testId }))) : Promise.resolve(new Set<string>()),
    kind ? describeExamHomework(hw) : Promise.resolve(null),
    hw.contentId && kind === "READING"
      ? getReadingExam(hw.contentId).catch(() => null)
      : hw.contentId && kind === "LISTENING"
        ? getListeningExam(hw.contentId).catch(() => null)
        : Promise.resolve(null),
  ]);

  const subByStudent = new Map(submissions.map((s) => [s.studentId, s]));

  // Reading / Listening: the graded items of each linked attempt — only the submitter's own
  // attempt at exactly this paper and part, saved after the homework was set (a linked test at
  // other content never reaches the class statistics or the average).
  const attemptByTest = new Map<string, { items: GradeItem[]; correct: number; total: number; timeSpent: number }>();
  const mismatched = new Set<string>();
  for (const t of tests) {
    const sub = submissions.find((s) => s.testId === t.id);
    if (!sub) continue;
    if (
      !kind ||
      !hw.contentId ||
      attemptMismatch({ homeworkId: hw.id, kind, contentId: hw.contentId, part: hw.contentPart ?? null, setAt: hw.createdAt }, sub.studentId, t)
    ) {
      mismatched.add(sub.id);
      continue;
    }
    const parsed = parseObjectiveAttempt(t);
    if (parsed) attemptByTest.set(t.id, { items: parsed.items, correct: parsed.correct, total: parsed.total, timeSpent: t.timeSpent });
  }
  const layout: StatsGroup[] | null = paper ? statsLayout(paper, hw.contentPart ?? null) : null;
  const stats = kind && auto ? aggregateClassStats(Array.from(attemptByTest.values()), layout) : null;
  const scopeQuestions = layout ? layout.reduce((s, g) => s + g.numbers.length, 0) : undefined;

  const due = new Date(hw.dueDate);
  const dueInfo = dueState(due);
  const statusOf = (s: SubmissionRow | undefined): Status =>
    !s ? "not-started" : new Date(s.submittedAt).getTime() > due.getTime() ? "late" : "on-time";
  const isReviewed = (s: SubmissionRow | undefined) => !!s?.testId && reviewed.has(s.testId);

  const memberIds = new Set(students.map((s) => s.id));
  const nameOf = (s: StudentRow) => s.user?.name?.trim() || s.user?.email || "Student";
  const rows = [
    ...students.map((s) => ({ studentId: s.id, name: nameOf(s), member: true, sub: subByStudent.get(s.id) })),
    ...submissions
      .filter((s) => !memberIds.has(s.studentId))
      .map((s) => ({ studentId: s.studentId, name: s.student?.user?.name?.trim() || "Student", member: false, sub: s as SubmissionRow | undefined })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const memberSubs = submissions.filter((s) => memberIds.has(s.studentId));
  const late = memberSubs.filter((s) => statusOf(s) === "late").length;
  const notStarted = rows.filter((r) => r.member && !r.sub);
  // HomeworkSubmission.band is kept current by the review flow (full Writing test: the combined Writing band).
  const avgBand = kind
    ? mean(
        submissions
          .filter((s) => !mismatched.has(s.id))
          .map((s) => s.band)
          .filter((b): b is number => typeof b === "number")
      )
    : null;
  // Current members only: a student who left the group can't be reviewed from here any more.
  const toReview = kind && !auto ? memberSubs.filter((s) => s.testId && !reviewed.has(s.testId)).length : 0;
  const pendingClassic = !kind ? submissions.filter((s) => s.status === "SUBMITTED").length : 0;
  const preview = kind ? examPreviewHref(hw) : null;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8 pb-10 lg:pb-8">
        <TeacherHeader user={{ name: session.user.name ?? "Teacher", email: session.user.email ?? "" }} />
        <PageHeader
          back={{ href: "/teacher/homework", label: "Back to Homework" }}
          icon={Notebook}
          iconClassName="text-averna-purple"
          title={hw.title}
          subtitle={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" aria-hidden /> {hw.group?.name ?? "Group"}
              </span>
              <span className={cn("inline-flex items-center gap-1", dueInfo.overdue && "text-amber-300")}>
                <CalendarClock className="h-4 w-4" aria-hidden /> Due {formatDateTime(due)}
                {dueInfo.overdue ? " · past due (late work is still accepted)" : ` · ${dueInfo.label.replace(/^Due /, "")}`}
              </span>
              <span>{hw.points} pts</span>
            </span>
          }
        />

        <section className="glass mb-6 rounded-2xl border border-white/10 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            {kind ? <ExamKindBadge kind={kind} part={hw.contentPart} /> : <ModuleBadge module={hw.module} />}
            {info && info.facts.length > 0 && <span className="text-xs text-gray-400">{info.facts.join(" · ")}</span>}
          </div>
          {info && <p className="mt-2 text-sm text-gray-200">{info.contentTitle}</p>}
          {info && !info.available && (
            <p className="mt-2 text-xs text-amber-300">This content is no longer in the library — students can't start it any more.</p>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-averna-cyan hover:underline">Instructions students see</summary>
            <p className="mt-2 whitespace-pre-line break-words text-gray-300">{hw.description}</p>
          </details>
          {preview && info?.available && (
            <Link href={preview} className={cn(linkCls, "mt-4 border-white/10 text-gray-200 hover:border-averna-cyan/40 hover:text-white")}>
              <Eye className="h-3.5 w-3.5" aria-hidden /> Preview the test
            </Link>
          )}
        </section>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile
            label="Submitted"
            value={`${memberSubs.length}/${students.length}`}
            sub={students.length ? `${Math.round((memberSubs.length / students.length) * 100)}% of the group` : "No students yet"}
          />
          <Tile label="Late" value={late} sub={late ? "after the due date" : "none"} tone={late ? "text-amber-300" : "text-white"} />
          {kind ? (
            <Tile label="Average band" value={bandText(avgBand)} sub={auto ? "marked automatically" : "AI estimate until reviewed"} tone="text-averna-neon" />
          ) : (
            <Tile label="To grade" value={pendingClassic} sub="submitted, not graded" tone={pendingClassic ? "text-amber-300" : "text-white"} />
          )}
          {kind && auto ? (
            <Tile
              label="Average score"
              value={stats && stats.attempts ? `${stats.meanCorrect}` : "—"}
              sub={stats && stats.attempts ? `out of ${scopeQuestions ?? stats.meanTotal} questions` : "no attempts yet"}
            />
          ) : kind ? (
            <Tile label="To review" value={toReview} sub={toReview ? "waiting for your review" : "all reviewed"} tone={toReview ? "text-averna-pink" : "text-white"} />
          ) : (
            <Tile label="Not started" value={notStarted.length} />
          )}
        </div>

        <section className="glass mb-6 rounded-2xl border border-white/10" aria-labelledby="hw-students">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 p-4 sm:px-6">
            <h2 id="hw-students" className="flex items-center gap-2 text-lg font-semibold text-white">
              <Users className="h-5 w-5 text-averna-cyan" aria-hidden /> Students
            </h2>
            {notStarted.length > 0 && notStarted.length < rows.length && (
              <p className="text-xs text-gray-400">
                Not started: {notStarted.slice(0, 6).map((r) => r.name).join(", ")}
                {notStarted.length > 6 ? ` and ${notStarted.length - 6} more` : ""}
              </p>
            )}
          </div>
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">This group has no students yet.</p>
          ) : (
            <ul role="list" className="divide-y divide-white/5">
              {rows.map((r) => {
                const sub = r.sub;
                const status = statusOf(sub);
                const attempt = sub?.testId ? attemptByTest.get(sub.testId) : undefined;
                const review = isReviewed(sub);
                return (
                  <li key={r.studentId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">
                        {r.name}
                        {!r.member && <span className="ml-2 text-xs font-normal text-gray-500">(no longer in this group)</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {sub ? `Submitted ${formatDateTime(sub.submittedAt)}` : dueInfo.overdue ? "Nothing submitted" : "Not submitted yet"}
                        {attempt ? ` · ${attempt.correct}/${attempt.total} correct` : ""}
                        {attempt && attempt.timeSpent > 0 ? ` · ${formatDuration(attempt.timeSpent)}` : ""}
                        {sub && !kind ? ` · ${sub.pointsAwarded} pts` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <StatusPill status={status} overdue={dueInfo.overdue} />
                      {kind && sub && (
                        <span className="min-w-[4.5rem] text-sm font-semibold tabular-nums text-white">
                          band {bandText(sub.band)}
                          {!auto && !review && <span className="ml-1 text-[11px] font-normal text-gray-500">AI</span>}
                        </span>
                      )}
                      {/* A student who left the group: their pages are only open to their current teacher. */}
                      {kind && sub?.testId && r.member && (
                        <Link
                          href={examResultHref(kind, sub.testId)}
                          className={cn(linkCls, "border-white/10 text-gray-200 hover:border-averna-cyan/40 hover:text-white")}
                        >
                          <BarChart3 className="h-3.5 w-3.5" aria-hidden /> Result
                        </Link>
                      )}
                      {kind && !auto && sub?.testId && r.member && (
                        <Link
                          href={examReviewHref(sub.testId)}
                          className={cn(
                            linkCls,
                            review
                              ? "border-averna-neon/30 text-averna-neon hover:bg-averna-neon/10"
                              : "border-averna-pink/40 bg-averna-pink/10 text-averna-pink hover:bg-averna-pink/20"
                          )}
                        >
                          {review ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <PenLine className="h-3.5 w-3.5" aria-hidden />}
                          {review ? "Reviewed" : "Review"}
                        </Link>
                      )}
                      {!kind && sub && (
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            sub.status === "GRADED" ? "text-averna-neon" : "text-amber-300"
                          )}
                        >
                          {sub.status === "GRADED" ? "Graded" : "To grade"}
                        </span>
                      )}
                    </div>
                    {!kind && sub && (
                      <details className="w-full text-sm sm:basis-full">
                        <summary className="cursor-pointer text-xs text-averna-cyan hover:underline">Read the answer</summary>
                        <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line break-words rounded-lg border border-white/5 bg-white/[0.02] p-3 text-gray-300">
                          {sub.content}
                        </p>
                        {sub.feedback && <p className="mt-2 text-xs text-gray-400">Feedback: {sub.feedback}</p>}
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {stats && (
          <section className="glass rounded-2xl border border-white/10 p-4 sm:p-6" aria-labelledby="hw-class-results">
            <h2 id="hw-class-results" className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <BarChart3 className="h-5 w-5 text-averna-neon" aria-hidden /> Class results by question
            </h2>
            <HomeworkQuestionStats stats={stats} maxQuestions={scopeQuestions} />
          </section>
        )}
      </div>
    </div>
  );
}
