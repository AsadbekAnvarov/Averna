import Link from "next/link";
import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, Clock, Trophy } from "lucide-react";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { EXAM_KIND_INFO, dueState, isLibraryKind, type ExamHomeworkKind } from "@/lib/homework/library-shared";
import { ExamKindBadge, ModuleBadge } from "./exam-kind";

/**
 * Student homework cards (the Homework page). Server-safe, no hooks: the
 * pages compute links (examHomeworkHref) and catalog facts and pass them in.
 */

export interface TodoHomework {
  id: string;
  title: string;
  description: string;
  module: string;
  difficulty: number;
  points: number;
  dueDate: Date | string;
  contentKind: string | null;
  contentPart: number | null;
  submissionCount: number;
}

export interface ExamFacts {
  contentTitle: string;
  facts: string[];
  available: boolean;
}

export function DueChip({ due, className }: { due: Date | string; className?: string }) {
  const d = dueState(due);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        d.overdue
          ? "border-red-400/40 bg-red-500/10 text-red-300"
          : d.urgent
            ? "border-amber-300/40 bg-amber-400/10 text-amber-300"
            : "border-white/10 bg-white/5 text-gray-300",
        className
      )}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {d.label}
    </span>
  );
}

function bonusFor(count: number): number {
  return count === 0 ? 10 : count === 1 ? 8 : count === 2 ? 6 : 0;
}

const cardCls = "glass flex h-full flex-col rounded-2xl border p-4 sm:p-5 transition-colors";

export function TodoCard({ hw, exam, startHref }: { hw: TodoHomework; exam: ExamFacts | null; startHref: string | null }) {
  const kind = isLibraryKind(hw.contentKind) ? hw.contentKind : null;
  const overdue = dueState(hw.dueDate).overdue;
  const bonus = bonusFor(hw.submissionCount);
  const detailHref = `/homework/${encodeURIComponent(hw.id)}`;
  const canStart = !!(kind && startHref && exam?.available !== false);
  return (
    <article className={cn(cardCls, overdue ? "border-red-400/30" : "border-purple-500/30 hover:border-averna-neon/40")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {kind ? <ExamKindBadge kind={kind} part={hw.contentPart} /> : <ModuleBadge module={hw.module} />}
        <DueChip due={hw.dueDate} />
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-white">
        <Link href={detailHref} className="hover:underline focus-visible:underline">
          {hw.title}
        </Link>
      </h3>
      {exam && (
        <p className="mt-1 text-sm text-gray-300">
          {exam.contentTitle}
          {exam.facts.length > 0 && <span className="block text-xs text-gray-400">{exam.facts.join(" · ")}</span>}
        </p>
      )}
      {!kind && <p className="mt-2 line-clamp-2 text-sm text-gray-300">{hw.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" aria-hidden /> {formatDateTime(hw.dueDate)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Trophy className="h-3 w-3 text-averna-neon" aria-hidden /> {hw.points} pts
          {bonus > 0 && <span className="text-averna-neon"> (+{bonus} if you're next)</span>}
        </span>
      </div>
      {overdue && <p className="mt-2 text-xs text-red-300">Overdue — you can still hand it in; it will be marked late.</p>}
      <div className="mt-auto flex gap-2 pt-4">
        {kind ? (
          canStart ? (
            <>
              <Link
                href={startHref as string}
                className="glow-cta inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-averna-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-averna-light"
              >
                Start {EXAM_KIND_INFO[kind].label}
                <span className="sr-only">: {hw.title}</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href={detailHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/10 px-4 text-sm text-gray-200 hover:border-white/25 hover:text-white"
              >
                Details
              </Link>
            </>
          ) : (
            <p className="text-xs text-amber-300">This test is no longer in the library — please ask your teacher.</p>
          )
        ) : (
          <Link
            href={detailHref}
            className="neon-button inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-purple-500 px-4 text-sm font-semibold text-white hover:bg-purple-600"
          >
            Start Homework
          </Link>
        )}
      </div>
    </article>
  );
}

export interface DoneHomework {
  submissionId: string;
  homeworkId: string;
  title: string;
  module: string;
  contentKind: string | null;
  contentPart: number | null;
  dueDate: Date | string;
  submittedAt: Date | string;
  status: string;
  position: number | null;
  pointsAwarded: number;
  feedback: string | null;
  /** HomeworkSubmission.band (the review flow updates it after the teacher's review). */
  band: number | null;
  testId: string | null;
  /** Writing / Speaking: the teacher has reviewed the attempt. */
  reviewed: boolean;
}

/** "Done · band 6.5 · View result" for exam homework; the classic status row otherwise. */
export function DoneCard({ d, resultHref }: { d: DoneHomework; resultHref: string | null }) {
  const kind: ExamHomeworkKind | null = isLibraryKind(d.contentKind) ? d.contentKind : null;
  const late = new Date(d.submittedAt).getTime() > new Date(d.dueDate).getTime();
  const band = d.band;
  const review = kind && EXAM_KIND_INFO[kind].graded === "review";
  return (
    <article className="glass rounded-2xl border border-averna-primary/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {kind ? <ExamKindBadge kind={kind} part={d.contentPart} /> : <ModuleBadge module={d.module} />}
            {late && <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">Late</span>}
          </div>
          <h3 className="font-semibold text-white">{d.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            <span>Submitted {formatDate(d.submittedAt)}</span>
            {d.position != null && <span className="text-averna-neon">#{d.position}</span>}
            <span className="text-averna-neon">{d.pointsAwarded} pts</span>
            {kind && (
              <span>
                {!review
                  ? "Marked automatically"
                  : d.reviewed
                    ? "Reviewed by your teacher"
                    : "AI estimate · waiting for your teacher's review"}
              </span>
            )}
          </p>
          {!kind && d.status === "GRADED" && d.feedback && <p className="mt-2 text-xs text-gray-400">✓ Graded by your teacher: {d.feedback}</p>}
        </div>
        {kind ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/10 px-3 py-1 text-sm font-semibold text-averna-neon">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Done{typeof band === "number" ? ` · band ${band.toFixed(1)}` : ""}
            </span>
            {resultHref && (
              <Link
                href={resultHref}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm text-gray-200 hover:border-averna-cyan/40 hover:text-white"
              >
                <BarChart3 className="h-4 w-4" aria-hidden /> View result
              </Link>
            )}
          </div>
        ) : (
          <span
            className={cn(
              "rounded px-3 py-1 text-xs font-semibold",
              d.status === "GRADED"
                ? "bg-green-500/20 text-green-400"
                : d.status === "SUBMITTED"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-500/20 text-gray-400"
            )}
          >
            {d.status}
          </span>
        )}
      </div>
    </article>
  );
}
