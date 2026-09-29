export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, Info, Trophy, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import HomeworkSubmissionForm from "@/components/homework/submission-form";
import { examHomeworkHref, isExamHomeworkKind, type ExamHomeworkKind } from "@/lib/homework/exam-homework";
import { describeExamHomework, type ExamHomeworkInfo } from "@/lib/homework/library";
import { reviewedTestIds } from "@/lib/homework/reviews";
import { EXAM_KIND_INFO, dueState, examResultHref } from "@/lib/homework/library-shared";
import { isWritingHomeworkKind, writingHomeworkRule } from "@/lib/homework/exam-attempt";
import { KindIcon, ExamKindBadge } from "@/components/homework/exam-kind";
import { DueChip } from "@/components/homework/homework-cards";
import { cn, formatDateTime } from "@/lib/utils";

interface SubmissionRow {
  id: string;
  status: string;
  band: number | null;
  testId: string | null;
  submittedAt: Date;
  pointsAwarded: number;
  position: number | null;
  feedback: string | null;
}

function bonusFor(count: number): number {
  return count === 0 ? 10 : count === 1 ? 8 : count === 2 ? 6 : 0;
}

export default async function HomeworkDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student: { id: string; groupId: string | null } | null = await db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true, groupId: true },
  });
  if (!student) return redirect("/auth/signin");

  const homework = await db.homework
    .findUnique({
      where: { id: params.id },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        _count: { select: { submissions: true } },
      },
    })
    .catch(() => null);
  if (!homework) return redirect("/homework");

  const existingSubmission: SubmissionRow | null = await db.homeworkSubmission.findUnique({
    where: { studentId_homeworkId: { studentId: student.id, homeworkId: homework.id } },
    select: { id: true, status: true, band: true, testId: true, submittedAt: true, pointsAwarded: true, position: true, feedback: true },
  });

  // Students only see their own group's homework (or homework they have already handed in).
  if (homework.groupId !== student.groupId && !existingSubmission) return redirect("/homework");

  const submissionCount: number = homework._count?.submissions ?? 0;

  if (isExamHomeworkKind(homework.contentKind)) {
    const kind: ExamHomeworkKind = homework.contentKind;
    const [info, reviewed] = await Promise.all([
      describeExamHomework(homework),
      existingSubmission?.testId
        ? reviewedTestIds([{ kind, testId: existingSubmission.testId }])
        : Promise.resolve(new Set<string>()),
    ]);
    return (
      <ExamHomeworkView
        kind={kind}
        homework={homework}
        info={info}
        startHref={examHomeworkHref(homework)}
        submission={existingSubmission}
        reviewed={!!existingSubmission?.testId && reviewed.has(existingSubmission.testId)}
        submissionCount={submissionCount}
      />
    );
  }

  if (existingSubmission) {
    return (
      <div className="min-h-screen premium-gradient">
        <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
          <div className="text-center text-white">
            <h1 className="mb-4 text-3xl font-bold">Already Submitted! ✓</h1>
            <p className="mb-2 text-gray-300">You&apos;ve already submitted this homework.</p>
            <p className="mb-6 text-sm text-gray-400">
              {existingSubmission.status === "GRADED" ? "Graded by your teacher" : "Waiting for your teacher to grade it"} ·{" "}
              {existingSubmission.pointsAwarded} pts
            </p>
            {existingSubmission.feedback && (
              <p className="mx-auto mb-6 max-w-xl whitespace-pre-line rounded-lg border border-white/10 bg-white/5 p-4 text-left text-sm text-gray-300">
                {existingSubmission.feedback}
              </p>
            )}
            <Link href="/homework" className="text-averna-neon hover:underline">
              ← Back to Homework
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <HomeworkSubmissionForm homework={homework} studentId={student.id} submissionCount={submissionCount} />;
}

function ExamHomeworkView({
  kind,
  homework,
  info,
  startHref,
  submission,
  reviewed,
  submissionCount,
}: {
  kind: ExamHomeworkKind;
  homework: {
    id: string;
    title: string;
    description: string;
    dueDate: Date;
    points: number;
    contentPart: number | null;
    teacher?: { user?: { name?: string | null } | null } | null;
  };
  info: ExamHomeworkInfo | null;
  startHref: string | null;
  submission: SubmissionRow | null;
  /** Writing / Speaking: the teacher has reviewed the attempt. */
  reviewed: boolean;
  submissionCount: number;
}) {
  const kindInfo = EXAM_KIND_INFO[kind];
  const due = dueState(homework.dueDate);
  const available = info?.available !== false && !!startHref;
  const bonus = bonusFor(submissionCount);
  const late = submission ? new Date(submission.submittedAt).getTime() > new Date(homework.dueDate).getTime() : false;
  // The review flow keeps HomeworkSubmission.band current (AI estimate until the teacher reviews it).
  const band = submission?.band ?? null;
  // Which attempt completes it: lib/homework/exam-attempt (a blank or token attempt leaves it in To do).
  const how =
    kindInfo.graded === "auto"
      ? "It is marked automatically the moment you submit. Your first attempt that answers at least half of the questions counts for this homework."
      : kindInfo.skill === "SPEAKING"
        ? "Record your answers in a quiet place. You get an AI band estimate straight away, then your teacher reviews it. Your first real attempt counts — a blank or very short one doesn't."
        : `You get an AI band estimate straight away, then your teacher reviews your writing. ${isWritingHomeworkKind(kind) ? writingHomeworkRule(kind) : "Your first real attempt counts."}`;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-8 pb-10 lg:pb-8">
        <Link href="/homework" className="mb-4 block text-sm text-averna-neon hover:underline">
          ← Back to Homework
        </Link>

        <article className="glass rounded-2xl border border-purple-500/30 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <KindIcon kind={kind} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ExamKindBadge kind={kind} part={homework.contentPart} />
                {!submission && <DueChip due={homework.dueDate} />}
              </div>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">{homework.title}</h1>
              {info && <p className="mt-1 text-gray-300">{info.contentTitle}</p>}
              {info && info.facts.length > 0 && <p className="mt-1 text-sm text-gray-400">{info.facts.join(" · ")}</p>}
            </div>
          </div>

          {homework.description && (
            <p className="mt-5 whitespace-pre-line break-words rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-200">
              {homework.description}
            </p>
          )}

          <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2 text-gray-300">
              <CalendarClock className="h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
              <dt className="sr-only">Due</dt>
              <dd>Due {formatDateTime(homework.dueDate)}</dd>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Trophy className="h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
              <dt className="sr-only">Points</dt>
              <dd>
                {homework.points} pts
                {!submission && bonus > 0 && <span className="text-averna-neon"> +{bonus} if you&apos;re next</span>}
              </dd>
            </div>
            {homework.teacher?.user?.name && (
              <div className="flex items-center gap-2 text-gray-300">
                <User className="h-4 w-4 shrink-0 text-averna-purple" aria-hidden />
                <dt className="sr-only">Set by</dt>
                <dd>Set by {homework.teacher.user.name}</dd>
              </div>
            )}
          </dl>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {how}
          </p>

          <div className="mt-6">
            {submission ? (
              <div className="flex flex-col gap-3 rounded-xl border border-averna-neon/30 bg-averna-neon/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-lg font-semibold text-averna-neon">
                    <CheckCircle2 className="h-5 w-5" aria-hidden /> Done{typeof band === "number" ? ` · band ${band.toFixed(1)}` : ""}
                  </p>
                  <p className="text-xs text-gray-400">
                    Submitted {formatDateTime(submission.submittedAt)}
                    {late ? " · late" : " · on time"} · {submission.pointsAwarded} pts
                    {kindInfo.graded === "review" && (reviewed ? " · reviewed by your teacher" : " · AI estimate, waiting for review")}
                  </p>
                </div>
                {submission.testId && (
                  <Link
                    href={examResultHref(kind, submission.testId)}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-medium text-white hover:border-averna-cyan/50"
                  >
                    <BarChart3 className="h-4 w-4" aria-hidden /> View result
                  </Link>
                )}
              </div>
            ) : available ? (
              <>
                {due.overdue && (
                  <p className="mb-3 text-sm text-red-300">This homework is overdue — you can still do it, but it will be marked late.</p>
                )}
                <Link
                  href={startHref as string}
                  className="glow-cta inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-averna-primary px-6 text-base font-semibold text-white transition-colors hover:bg-averna-light"
                >
                  Start {kindInfo.label}
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </>
            ) : (
              <p className={cn("rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-200")}>
                This test is no longer in the library, so it can&apos;t be started. Please ask your teacher.
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
