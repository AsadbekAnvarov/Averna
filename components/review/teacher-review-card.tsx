import Link from "next/link";
import { ArrowRight, BadgeCheck, MessageSquareQuote } from "lucide-react";
import { db } from "@/lib/db";
import { cn, formatDateTime } from "@/lib/utils";
import { answersOf, isFullSpeakingTest, taskTypeOf } from "@/lib/review/answers";
import {
  attemptLabel,
  criteriaFor,
  formatBand,
  formatBandDelta,
  isReviewSkill,
  readCriteria,
  type ReviewSkill,
} from "@/lib/review/scoring";

/**
 * The teacher's review of a Writing / Speaking attempt, shown on the result
 * pages (student and teacher view). Server component; renders nothing while
 * the attempt hasn't been reviewed.
 *
 * It trusts the embedding page's access check (the result pages only render
 * for the student, a teacher of their group or an admin).
 */
export async function TeacherReviewCard({
  testId,
  viewerIsOwner,
}: {
  /** IELTSTest id. */
  testId: string;
  /** The viewer is the student who took the test (wording differs for teachers). */
  viewerIsOwner: boolean;
}) {
  const review: {
    band: number;
    aiBand: number | null;
    criteria: unknown;
    comment: string | null;
    reviewerId: string;
    createdAt: Date;
    updatedAt: Date;
    test: { module: string; answers: unknown } | null;
  } | null = await db.testReview
    .findUnique({
      where: { testId },
      select: {
        band: true,
        aiBand: true,
        criteria: true,
        comment: true,
        reviewerId: true,
        createdAt: true,
        updatedAt: true,
        test: { select: { module: true, answers: true } },
      },
    })
    .catch((e: unknown) => {
      console.error("TeacherReviewCard failed:", e);
      return null;
    });
  if (!review || !review.test || !isReviewSkill(review.test.module)) return null;

  const skill: ReviewSkill = review.test.module;
  const reviewer: { name: string | null } | null = await db.user
    .findUnique({ where: { id: review.reviewerId }, select: { name: true } })
    .catch(() => null);
  const reviewerName = reviewer?.name?.trim() || (viewerIsOwner ? "Your teacher" : "A teacher");
  const answers = answersOf(review.test.answers);
  const taskType = skill === "WRITING" ? taskTypeOf(answers) : null;
  const defs = criteriaFor(skill, taskType);
  const criteria = readCriteria(skill, review.criteria);
  const rated = defs.some((d) => typeof criteria[d.key] === "number");
  const delta = formatBandDelta(review.band, review.aiBand);
  const edited = review.updatedAt.getTime() - review.createdAt.getTime() > 60_000;
  const what = skill === "WRITING" && !taskType ? "essay" : attemptLabel(skill, taskType, isFullSpeakingTest(answers));
  const titleId = `teacher-review-${testId}`;

  return (
    <section
      aria-labelledby={titleId}
      className="glass mt-6 first:mt-0 rounded-2xl border border-averna-neon/30 p-5 sm:p-6 animate-fade-in"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-averna-neon/10 text-averna-neon"
          >
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Teacher review</p>
            <h2 id={titleId} className="mt-0.5 text-lg font-semibold text-white">
              {viewerIsOwner ? `Your teacher reviewed your ${what}` : `Reviewed by ${reviewerName}`}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {viewerIsOwner ? `${reviewerName} · ` : ""}
              <time dateTime={review.updatedAt.toISOString()}>{formatDateTime(review.updatedAt)}</time>
              {edited && " · updated"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-end gap-4 sm:flex-col sm:items-end sm:gap-1">
          <p className="text-4xl font-bold tabular-nums leading-none text-white">
            <span className="sr-only">Teacher&apos;s band </span>
            {formatBand(review.band)}
          </p>
          {typeof review.aiBand === "number" && (
            <p className="text-xs text-gray-400">
              AI estimate {formatBand(review.aiBand)}
              {delta && delta !== "±0" && <span className="text-gray-500"> · {delta}</span>}
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-300">
        {viewerIsOwner
          ? `Your teacher's band is now the band for this attempt${
              typeof review.aiBand === "number" ? ` (the AI's estimate was ${formatBand(review.aiBand)})` : ""
            }.`
          : "The reviewed band replaces the AI estimate as this attempt's band (XP is not recalculated)."}
      </p>

      {rated && (
        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {defs.map((d) => {
            const v = criteria[d.key];
            return (
              <div
                key={d.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
              >
                <dt className="text-xs text-gray-300">{d.label}</dt>
                <dd className={cn("shrink-0 font-semibold tabular-nums", typeof v === "number" ? "text-base text-white" : "text-xs text-gray-500")}>
                  {typeof v === "number" ? formatBand(v) : "Not rated"}
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      {review.comment ? (
        <figure className="mt-4 rounded-xl border border-averna-neon/15 bg-averna-neon/[0.04] p-4">
          <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-averna-neon">
            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
            {viewerIsOwner ? "Your teacher's comment" : "Comment to the student"}
          </figcaption>
          <blockquote className="whitespace-pre-line break-words text-sm leading-relaxed text-gray-100">{review.comment}</blockquote>
        </figure>
      ) : (
        !viewerIsOwner && <p className="mt-4 text-xs text-gray-500">No comment was added.</p>
      )}

      {!viewerIsOwner && (
        <div className="mt-4">
          <Link
            href={`/teacher/reviews/${encodeURIComponent(testId)}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
          >
            Edit the review
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
    </section>
  );
}
