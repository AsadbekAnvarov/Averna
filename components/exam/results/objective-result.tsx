import { Suspense } from "react";
import { ArrowDown, RotateCcw } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SessionOutcomeSection } from "@/components/progression/session-outcome-section";
import { ProgressionSkeleton } from "@/components/progression/progression-skeleton";
import { READING_FULL } from "@/lib/ielts/format";
import type { ExamListeningTest, ExamReadingTest } from "@/lib/ielts/types";
import type { HomeworkNotice } from "@/lib/homework/exam-homework";
import { HomeworkNoticeCard } from "@/components/homework/homework-notice";
import { AnswerReview } from "./answer-review";
import { KindBreakdown } from "./kind-breakdown";
import { NextBand } from "./next-band";
import { PRIMARY_BTN, ResultActions, SECONDARY_BTN } from "./result-actions";
import { ResultHero } from "./result-hero";
import { libraryHref, plural, practiceHref, scopeLabel, skillWord, type ObjectiveAttempt } from "./attempt";

/**
 * The whole exam-v2 result page body for Reading and Listening (the route
 * pages load the data and handle access). Server component.
 */
export function ObjectiveResult({
  attempt,
  test,
  testRowId,
  studentId,
  timeSpent,
  completedAt,
  xp,
  target,
  viewerIsOwner = true,
  studentName,
  homeworkNotice = null,
}: {
  attempt: ObjectiveAttempt;
  /** The paper, or null when it can't be loaded any more. */
  test: ExamReadingTest | ExamListeningTest | null;
  /** IELTSTest id. */
  testRowId: string;
  studentId: string;
  timeSpent: number;
  completedAt: Date;
  xp: number | null;
  target: number | null;
  /** False when a teacher / admin opens a student's attempt: no progression panel or practice actions. */
  viewerIsOwner?: boolean;
  /** Shown to teachers: whose attempt this is. */
  studentName?: string;
  /** Owner only: open homework for this content that this attempt didn't complete (homeworkNoticeFor). */
  homeworkNotice?: HomeworkNotice | null;
}) {
  const { skill, part } = attempt;
  const word = skillWord(skill);
  const scope = scopeLabel(skill, part);
  const scopedPart = part != null ? test?.parts[part] : undefined;

  let scopeDetail: string | null = null;
  if (scopedPart) scopeDetail = "paragraphs" in scopedPart ? scopedPart.title : scopedPart.context || null;
  else if (part == null && test) {
    scopeDetail = `${plural(test.parts.length, skill === "READING" ? "passage" : "part")} · ${plural(attempt.total, "question")}`;
  }

  const timeLimit =
    skill === "READING" ? (part != null ? READING_FULL.minutesPerPart : test && "timeLimit" in test ? test.timeLimit : null) : null;
  const blanks = Math.max(0, attempt.total - attempt.answered);
  const mockHref =
    attempt.mock && attempt.mockAttemptId ? `/learning/mock-exam/result/${encodeURIComponent(attempt.mockAttemptId)}` : null;

  return (
    <div className="min-h-screen premium-gradient print:!bg-white print:!bg-none print:[&_*]:!bg-none print:[&_*]:!text-black print:[&_*]:!shadow-none">
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        <ResultHero
          skill={skill}
          title={attempt.title || test?.title || `${word} test`}
          scope={scope}
          scopeDetail={scopeDetail}
          band={attempt.band}
          correct={attempt.correct}
          total={attempt.total}
          answered={attempt.answered}
          timeSpent={timeSpent}
          timeLimitMinutes={timeLimit}
          completedAt={completedAt}
          xp={xp}
          mock={attempt.mock}
          mockHref={mockHref}
          auto={attempt.auto}
          backHref={viewerIsOwner ? libraryHref(skill) : "/teacher/students"}
          backLabel={viewerIsOwner ? `${word} library` : "Students"}
        >
          {!viewerIsOwner && (
            <p className="text-sm text-gray-300">
              Student: <span className="font-semibold text-white">{studentName || "—"}</span>
            </p>
          )}
          <NextBand
            skill={skill}
            band={attempt.band}
            correct={attempt.correct}
            total={attempt.total}
            part={part}
            target={target}
          />
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row print:hidden">
            {attempt.items.length > 0 && (
              <a href="#answer-review" className={PRIMARY_BTN}>
                <ArrowDown className="h-4 w-4" aria-hidden />
                Review your answers
              </a>
            )}
            {test && viewerIsOwner && (
              <a href={practiceHref(skill, attempt.examId, part)} className={SECONDARY_BTN}>
                <RotateCcw className="h-4 w-4" aria-hidden />
                Try again
                <span className="sr-only">: {part == null ? "the full test" : scope}</span>
              </a>
            )}
          </div>
        </ResultHero>

        {viewerIsOwner && homeworkNotice && <HomeworkNoticeCard notice={homeworkNotice} />}

        {viewerIsOwner && (
          <div className="print:hidden">
            <Suspense fallback={<ProgressionSkeleton rows={1} label="Calculating your progress…" />}>
              <SessionOutcomeSection studentId={studentId} testId={testRowId} label={word} score={attempt.band} />
            </Suspense>
          </div>
        )}

        <Reveal>
          <KindBreakdown skill={skill} byKind={attempt.byKind} items={attempt.items} blanks={blanks} />
        </Reveal>

        <AnswerReview skill={skill} test={test} part={part} items={attempt.items} />

        {viewerIsOwner && (
          <Reveal>
            <ResultActions skill={skill} examId={attempt.examId} part={part} partsCount={test ? test.parts.length : null} />
          </Reveal>
        )}
      </div>
    </div>
  );
}
