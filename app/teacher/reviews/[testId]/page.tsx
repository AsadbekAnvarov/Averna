export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Highlighter,
  Info,
  Link2,
  ListChecks,
  Mic,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Volume2,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { TeacherHeader } from "@/components/teacher/teacher-header";
import { AdminHeader } from "@/components/admin/admin-header";
import { Task1Chart } from "@/components/learning/task1-chart";
import { WritingHeatmap } from "@/components/learning/writing-heatmap";
import { ReviewForm } from "@/components/review/review-form";
import { SkillIconBox, SourceBadge } from "@/components/review/review-badges";
import { formatDuration } from "@/components/exam/results/attempt";
import { loadReviewAttempt, type ReviewAttempt, type SpeakingDetail, type WritingDetail } from "@/lib/review/detail";
import { parseQueueFilters, queueHref, reviewHref, type QueueFilters } from "@/lib/review/filters";
import { MIN_REVIEW_ESSAY_WORDS, criteriaFor, formatBand, type ReviewCriteria, type ReviewSkill, type WritingTask } from "@/lib/review/scoring";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Review attempt" };

type SearchParams = Record<string, string | string[] | undefined>;
const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const CARD = "glass rounded-2xl border border-white/10 p-5 sm:p-6";
const LINK_BTN =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60";

export default async function ReviewAttemptPage(
  props: {
    params: Promise<{ testId: string }>;
    searchParams?: Promise<SearchParams>;
  }
) {
  const searchParams = (await props.searchParams) ?? {};
  const params = await props.params;
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");
  const role: string = session.user.role;
  if (role !== "TEACHER" && role !== "ADMIN") return redirect("/dashboard");
  const viewer = { id: session.user.id as string, role };

  const filters = parseQueueFilters(searchParams);
  const loaded = await loadReviewAttempt(viewer, safeDecode(params.testId));
  // Unknown attempt or another teacher's student: back to the queue (never reveal which).
  if (!loaded.ok) return redirect(queueHref(filters));
  const a = loaded.attempt;
  const saved = firstParam(searchParams.saved) === "1";
  const user = { name: session.user.name ?? (role === "ADMIN" ? "Admin" : "Teacher"), email: session.user.email ?? "" };
  const back = queueHref(filters);
  const taskType: WritingTask | null = a.writing?.taskType ?? null;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8 pb-10 lg:pb-8">
        {role === "ADMIN" ? <AdminHeader user={user} /> : <TeacherHeader user={user} />}

        <Link href={back} className="mb-4 inline-flex items-center gap-1 text-sm text-averna-neon hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Review queue
        </Link>

        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <SkillIconBox skill={a.skill} className="h-11 w-11" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {a.studentName} <span className="text-gray-400">· {a.label}</span>
              </h1>
              <p className="mt-1 text-sm text-gray-300">{a.title}</p>
              <ul role="list" className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400">
                <li>
                  <SourceBadge source={a.source} title={a.homeworkTitle} />
                  {a.homeworkTitle && <span className="ml-1.5 text-gray-400">{a.homeworkTitle}</span>}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                  {a.groupName ?? "No group"}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                  Submitted <time dateTime={a.completedAt.toISOString()}>{formatDateTime(a.completedAt)}</time>
                </li>
                {a.timeSpent > 0 && (
                  <li className="inline-flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                    {formatDuration(a.timeSpent)}
                  </li>
                )}
                {a.auto && (
                  <li className="inline-flex items-center gap-1.5 text-amber-200">
                    <Timer className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                    Submitted automatically when time ran out
                  </li>
                )}
              </ul>
            </div>
          </div>
          <Link href={a.resultHref} className={cn(LINK_BTN, "shrink-0")}>
            Student&apos;s result page
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        </header>

        {saved && (
          <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-averna-neon/30 bg-averna-neon/10 px-4 py-3 text-sm text-averna-neon">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Review saved. This is the next attempt waiting for you.
          </p>
        )}
        {a.review && !saved && (
          <p className="mb-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            <span>
              Reviewed{a.review.reviewerName ? ` by ${a.review.reviewerName}` : ""} on {formatDateTime(a.review.updatedAt)} — band{" "}
              <strong className="text-white">{formatBand(a.review.band)}</strong>. Saving again updates the review and the student&apos;s band.
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            {a.writing && <WritingWork attempt={a} w={a.writing} filters={filters} />}
            {a.speaking && <SpeakingWork s={a.speaking} />}
            <AiAssessment attempt={a} taskType={taskType} />
          </div>

          <aside
            aria-label="Your review"
            className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:p-0.5"
          >
            <ReviewForm
              key={a.testId}
              testId={a.testId}
              skill={a.skill}
              taskType={taskType}
              studentName={a.studentName}
              aiBand={a.aiBand}
              aiCriteria={a.aiCriteria}
              existing={a.review ? { band: a.review.band, criteria: a.review.criteria, comment: a.review.comment } : null}
              filters={filters}
            />
            <SaveEffects attempt={a} />
          </aside>
        </div>
      </div>
    </div>
  );
}

/** What saving the review changes — so the teacher knows before pressing Save. */
function SaveEffects({ attempt: a }: { attempt: ReviewAttempt }) {
  const sitting = !!a.writing?.sibling;
  const effects = [
    "Your band replaces the AI's as this attempt's band (XP stays as it is), and your review appears on the student's result page.",
    ...(a.source === "homework"
      ? [
          sitting
            ? `The homework “${a.homeworkTitle ?? "Homework"}” gets the Writing band of both tasks (Task 2 counts double) and your comments; it is marked graded once both tasks are reviewed (a task under ${MIN_REVIEW_ESSAY_WORDS} words has nothing to review).`
            : `The homework “${a.homeworkTitle ?? "Homework"}” is marked graded with your band and comment.`,
        ]
      : []),
    ...(a.source === "mock"
      ? [a.skill === "WRITING" ? "The mock exam's Writing band and overall band are recalculated." : "The mock exam's Speaking band and overall band are recalculated."]
      : []),
    `${a.studentName} is notified.`,
  ];
  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">When you save</h2>
      <ul role="list" className="mt-2 space-y-1.5">
        {effects.map((e, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-gray-400">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
            <span>{e}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function WritingWork({ attempt, w, filters }: { attempt: ReviewAttempt; w: WritingDetail; filters: QueueFilters }) {
  const pct = Math.min(100, Math.round((w.words / Math.max(1, w.minWords)) * 100));
  const short = w.words < w.minWords;
  return (
    <>
      {w.sibling && (
        <section aria-label="The other task of this sitting" className="flex flex-col gap-3 rounded-2xl border border-averna-cyan/25 bg-averna-cyan/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-gray-200">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            <span>
              {attempt.label} of a full Writing test{attempt.mockAttemptId ? " (mock exam)" : ""}. {w.sibling.label}:{" "}
              {w.sibling.reviewed ? (
                <>
                  reviewed, band <strong className="text-white">{formatBand(w.sibling.band)}</strong>
                </>
              ) : (
                <>
                  waiting for review (AI {formatBand(w.sibling.band)})
                </>
              )}
              . Task 2 counts twice as much as Task 1 in the Writing band.
            </span>
          </p>
          <Link href={reviewHref(w.sibling.testId, filters)} className={cn(LINK_BTN, "shrink-0")}>
            Open {w.sibling.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}

      <section aria-labelledby="rv-task" className={CARD}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="rv-task" className="flex items-center gap-2 text-lg font-semibold text-white">
            <FileText className="h-5 w-5 text-averna-pink" aria-hidden />
            The task
          </h2>
          {w.promptType && (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-gray-400">{w.promptType}</span>
          )}
        </div>
        {w.prompt ? (
          <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-gray-200">{w.prompt}</p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">The task text wasn&apos;t saved with this attempt.</p>
        )}
        {w.chart && (
          <div className="mt-4">
            <Task1Chart charts={w.chart} />
          </div>
        )}
        {w.imageUrl && (
          <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={w.imageUrl} alt="Task 1 visual shown to the student" className="h-auto w-full" />
          </div>
        )}
      </section>

      <section aria-labelledby="rv-essay" className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rv-essay" className="flex items-center gap-2 text-lg font-semibold text-white">
            <Highlighter className="h-5 w-5 text-averna-cyan" aria-hidden />
            The essay
          </h2>
          <p className={cn("text-sm tabular-nums", short ? "text-amber-300" : "text-gray-300")}>
            {w.words} / {w.minWords} words{short ? " — under the minimum" : ""}
          </p>
        </div>
        <div
          role="meter"
          aria-label="Length against the minimum"
          aria-valuemin={0}
          aria-valuemax={w.minWords}
          aria-valuenow={Math.min(w.words, w.minWords)}
          aria-valuetext={`${w.words} of ${w.minWords} words`}
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div className={cn("h-full rounded-full", short ? "bg-amber-300" : "bg-averna-neon")} style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-4">
          {w.essay.trim() ? (
            w.issues.length > 0 ? (
              <WritingHeatmap essay={w.essay} issues={w.issues} />
            ) : (
              <div className="whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-gray-200">
                {w.essay}
              </div>
            )
          ) : (
            <p className="text-sm text-gray-500">No essay was written for this task.</p>
          )}
        </div>

        {w.issues.length > 0 && (
          <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 rounded">
              All {w.issues.length} issues the AI flagged
            </summary>
            <ul role="list" className="mt-3 space-y-2">
              {w.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <span className="mt-0.5 shrink-0 rounded-full border border-averna-pink/30 bg-averna-pink/20 px-2 py-0.5 text-[10px] uppercase text-averna-pink">
                    {issue.type}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm text-red-200">&ldquo;{issue.text}&rdquo;</p>
                    {issue.suggestion && <p className="break-words text-xs text-gray-400">{issue.suggestion}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

function SpeakingWork({ s }: { s: SpeakingDetail }) {
  const recordedCount = s.parts.reduce((n, p) => n + p.answers.filter((x) => x.audioUrl).length, 0);
  const expiredCount = s.parts.reduce((n, p) => n + p.answers.filter((x) => x.audioExpired).length, 0);
  const budgetCount = s.parts.reduce((n, p) => n + p.answers.filter((x) => x.audioNotKept === "monthly-limit").length, 0);
  const notKeptCount = s.parts.reduce((n, p) => n + p.answers.filter((x) => x.audioNotKept).length, 0);
  return (
    <>
      <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-300">
        <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <span>
          {recordedCount > 0
            ? `${recordedCount} recorded ${recordedCount === 1 ? "answer" : "answers"} — listen before you rate Pronunciation.${
                s.audioUntil ? ` Audio is kept until ${formatDate(s.audioUntil)}.` : ""
              }`
            : expiredCount > 0
              ? "These answers were recorded, but the audio files have expired — only the transcripts are left."
              : budgetCount > 0
                ? "These answers were recorded and transcribed, but their audio wasn't kept — this month's storage limit was reached."
                : notKeptCount > 0
                  ? "These answers were recorded and transcribed on the server; their audio isn't kept on this deployment."
              : s.inputMode === "typed"
                ? "The student typed these answers (speech recognition wasn't available), so there is no audio."
                : "Transcribed live in the student's browser — no audio was recorded for this attempt."}{" "}
          {s.words} words · {formatDuration(s.seconds)} of speech.
        </span>
      </p>

      {s.parts.map((p, pi) => {
        const id = `rv-part-${pi}`;
        return (
          <section key={id} aria-labelledby={id} className={CARD}>
            <h2 id={id} className="flex items-center gap-2 text-lg font-semibold text-white">
              <Mic className="h-5 w-5 text-amber-300" aria-hidden />
              {p.title}
            </h2>
            {p.cue && (
              <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-4 text-sm text-gray-200">
                <p className="font-semibold text-white">{p.cue.cue}</p>
                {p.cue.points.length > 0 && (
                  <>
                    <p className="mt-2 text-xs text-gray-400">You should say:</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {p.cue.points.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  </>
                )}
                {p.cue.closing && <p className="mt-2">{p.cue.closing}</p>}
              </div>
            )}
            <ol className="mt-4 space-y-4">
              {p.answers.map((x) => (
                <li key={x.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-sm font-semibold text-white">{x.question || "Question"}</h3>
                  <p className="mt-1 text-xs tabular-nums text-gray-500">
                    {x.seconds > 0 ? formatDuration(x.seconds) : "—"} · {x.words} words
                  </p>
                  {x.audioUrl ? (
                    <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                      <audio
                        controls
                        preload="none"
                        aria-label={`Recording of the answer to: ${x.question || "this question"}`}
                        className="w-full"
                      >
                        <source src={x.audioUrl} {...(x.mimeType ? { type: x.mimeType } : {})} />
                      </audio>
                      <a
                        href={x.audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded text-xs text-gray-400 underline-offset-2 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                      >
                        Open audio<span className="sr-only"> for: {x.question || "this answer"} (new tab)</span>
                      </a>
                    </div>
                  ) : (
                    (x.audioExpired || x.audioNotKept) && (
                      <p className="mt-2 text-xs text-gray-500">
                        {x.audioExpired
                          ? "The recording of this answer has expired."
                          : x.audioNotKept === "monthly-limit"
                            ? "Audio not kept — this month's storage limit was reached."
                            : "The audio of this answer wasn't kept."}
                      </p>
                    )
                  )}
                  {x.transcript ? (
                    <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border-l-2 border-amber-300/40 bg-black/10 px-3 py-2 text-sm leading-relaxed text-gray-200">
                      {x.transcript}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm italic text-gray-500">No answer.</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// The AI's assessment
// ---------------------------------------------------------------------------

function CriteriaList({ skill, taskType, criteria }: { skill: ReviewSkill; taskType: WritingTask | null; criteria: ReviewCriteria }) {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {criteriaFor(skill, taskType).map((c) => {
        const v = criteria[c.key];
        return (
          <div key={c.key} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
            <dt className="text-xs text-gray-300">{c.label}</dt>
            <dd className={cn("shrink-0 font-semibold tabular-nums", typeof v === "number" ? "text-base text-white" : "text-[11px] text-gray-500")}>
              {typeof v === "number" ? formatBand(v) : c.key === "pronunciation" ? "Not assessed" : "—"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function TextList({ items, icon: Icon, tone }: { items: string[]; icon: typeof CheckCircle2; tone: string }) {
  return (
    <ul role="list" className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden />
          <span className="break-words">{t}</span>
        </li>
      ))}
    </ul>
  );
}

function AiAssessment({ attempt: a, taskType }: { attempt: ReviewAttempt; taskType: WritingTask | null }) {
  const w = a.writing;
  const s = a.speaking;
  return (
    <section aria-labelledby="rv-ai" className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="rv-ai" className="flex items-center gap-2 text-lg font-semibold text-white">
            <Sparkles className="h-5 w-5 text-averna-neon" aria-hidden />
            The AI&apos;s assessment
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {a.assessedBy === "heuristic"
              ? "An automatic estimate (the AI examiner wasn't available) — check it carefully."
              : a.skill === "SPEAKING"
                ? "Assessed from the transcript — Pronunciation can't be judged from text."
                : "What the student saw before your review."}
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-3xl font-bold tabular-nums leading-none text-white">{formatBand(a.aiBand)}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">AI band</span>
        </p>
      </div>

      <div className="mt-4">
        <CriteriaList skill={a.skill} taskType={taskType} criteria={a.aiCriteria} />
      </div>

      {w && (w.strengths.length > 0 || w.weaknesses.length > 0 || w.recommendations.length > 0) && (
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {w.strengths.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-green-400">Strengths</h3>
              <TextList items={w.strengths} icon={TrendingUp} tone="text-green-400" />
            </div>
          )}
          {w.weaknesses.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-orange-400">Areas to improve</h3>
              <TextList items={w.weaknesses} icon={TrendingDown} tone="text-orange-400" />
            </div>
          )}
          {w.recommendations.length > 0 && (
            <div className="md:col-span-2">
              <h3 className="mb-2 text-sm font-semibold text-blue-400">Recommendations</h3>
              <TextList items={w.recommendations} icon={ListChecks} tone="text-blue-400" />
            </div>
          )}
        </div>
      )}
      {w?.detailedFeedback && (
        <details className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <summary className="cursor-pointer rounded text-sm font-semibold text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60">
            Detailed feedback
          </summary>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-gray-300">{w.detailedFeedback}</p>
        </details>
      )}

      {s && s.feedback.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-gray-200">Feedback</h3>
          <TextList items={s.feedback} icon={AlertCircle} tone="text-amber-300" />
        </div>
      )}
    </section>
  );
}
