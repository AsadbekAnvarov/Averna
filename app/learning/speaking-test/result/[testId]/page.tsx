export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, Flag, Keyboard, Mic, RotateCcw, Sparkles, Timer } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewStudent } from "@/lib/access";
import { TeacherReviewCard } from "@/components/review/teacher-review-card";
import { HomeworkNoticeCard } from "@/components/homework/homework-notice";
import { homeworkNoticeFor } from "@/lib/homework/exam-homework";
import { SessionOutcomeSection } from "@/components/progression/session-outcome-section";
import { ProgressionSkeleton } from "@/components/progression/progression-skeleton";
import { SkillIcon } from "@/components/progression/ui";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { audioNotKeptReason, recordingsForTest, type SpeakingRecordingRow } from "@/lib/speaking/recording";
import { parseSpeechMetrics, parseSpeechMetricsTotal, type SpeechMetrics } from "@/lib/speaking/metrics";
import { daysLabel, normQuestion } from "@/lib/speaking/shared";
import { RecordingPlayer } from "./recording-player";

export const metadata = { title: "Speaking results" };

const LIBRARY = "/learning/speaking-test";
const DAY_MS = 86_400_000;

type Part = 1 | 2 | 3;

const PART_NAME: Record<Part, string> = {
  1: "Introduction and interview",
  2: "Long turn",
  3: "Discussion",
};

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const fmtBand = (b: number | null) => (b == null ? "–" : b.toFixed(1));
/** 75 → "1:15" (a server-side copy of the runner's clock format). */
function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

interface AnswerView {
  key: string;
  part: Part | null;
  /** 1-based question number in the test (null for legacy single answers). */
  number: number | null;
  question: string;
  transcript: string;
  seconds: number;
  typed: boolean;
  audioUrl: string | null;
  /** Why there's no player for a recorded answer ("Audio deleted after 30 days."). */
  audioNote: string | null;
  metrics: SpeechMetrics | null;
}

/** The saved answers: exam-v2 Parts 1–3, or an older single-question practice answer. */
function savedAnswers(answers: unknown): { part: Part | null; question: string; transcript: string; seconds: number; questionIndex: number | null; typed: boolean }[] {
  const a = asRec(answers) ?? {};
  if (Array.isArray(a.answers)) {
    return a.answers.flatMap((raw) => {
      const x = asRec(raw);
      if (!x) return [];
      const part = x.part === 1 || x.part === 2 || x.part === 3 ? x.part : null;
      const index = num(x.questionIndex);
      return [
        {
          part,
          question: str(x.question).trim(),
          transcript: str(x.transcript).trim(),
          seconds: Math.max(0, num(x.seconds) ?? 0),
          questionIndex: index != null && Number.isInteger(index) && index >= 0 ? index : null,
          typed: x.typed === true,
        },
      ];
    });
  }
  // Legacy single-answer Speaking practice: { question, transcript }.
  const question = str(a.question).trim();
  const transcript = str(a.transcript).trim();
  return question || transcript ? [{ part: null, question, transcript, seconds: 0, questionIndex: null, typed: false }] : [];
}

function playableUrl(rec: SpeakingRecordingRow | undefined, now: number): string | null {
  if (!rec?.audioUrl || !rec.audioUrl.startsWith("https://")) return null;
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() <= now) return null;
  return rec.audioUrl;
}

function audioNoteFor(rec: SpeakingRecordingRow | undefined, now: number): string | null {
  if (!rec || playableUrl(rec, now)) return null;
  if (rec.expiresAt) {
    const days = Math.max(1, Math.round((new Date(rec.expiresAt).getTime() - new Date(rec.createdAt).getTime()) / DAY_MS));
    return `Audio deleted after ${daysLabel(days)}.`;
  }
  if (audioNotKeptReason(rec.metrics) === "monthly-limit") return "Audio not kept — this month's storage limit was reached. The transcript is kept.";
  return "The audio of this answer wasn't kept.";
}

/** XP paid for this attempt (the ledger row written with the test), or null when unavailable. */
async function xpForTest(studentId: string, testId: string): Promise<number | null> {
  try {
    const row = await db.xpTransaction.findFirst({ where: { studentId, refId: testId } });
    return typeof row?.amount === "number" ? row.amount : null;
  } catch {
    return null;
  }
}

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">{value}</dd>
      {note && <dd className="text-xs text-gray-400">{note}</dd>}
    </div>
  );
}

function metricsLine(m: SpeechMetrics | null): string | null {
  if (!m || m.words < 5 || m.speechSec < 3) return null;
  const pauses = m.longPauses === 0 ? "no long pauses" : `${m.longPauses} long pause${m.longPauses === 1 ? "" : "s"}`;
  return `${m.wpm} words/min · ${pauses}`;
}

/**
 * Result of a Speaking test (Parts 1–3; older single-question practice is
 * shown too): the band, the criteria, every answer with its transcript and —
 * while it's kept — its recording, the examiner's feedback, XP and the
 * teacher's review. For the student, a teacher of their group, or an admin.
 */
export default async function SpeakingResultPage(props: { params: Promise<{ testId: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const row = await db.iELTSTest
    .findUnique({
      where: { id: params.testId },
      include: { student: { include: { user: { select: { name: true } } } } },
    })
    .catch(() => null);
  if (!row || row.module !== "SPEAKING") return redirect(LIBRARY);
  // The student, a teacher of their group, or an admin.
  const viewerIsOwner = row.student.userId === session.user.id;
  if (!viewerIsOwner && !(await canViewStudent(session.user, row.studentId))) return redirect(LIBRARY);
  const staff = !viewerIsOwner && (session.user.role === "TEACHER" || session.user.role === "ADMIN");

  const answersJson = asRec(row.answers) ?? {};
  const ai = asRec(row.aiAnalysis) ?? {};
  const examId = str(answersJson.examId) || null;
  const title = str(answersJson.title).trim() || (examId ? "Speaking test" : "Speaking practice");
  const recorded = answersJson.recorded === true;
  const typedMode = answersJson.inputMode === "typed";
  const mock = answersJson.mock === true;
  const mockAttemptId = str(answersJson.mockAttemptId) || null;
  const auto = answersJson.auto === true;

  // Open Speaking homework for this set that this attempt didn't complete (owner only): too few words,
  // or not started from the homework page.
  const homeworkNoticeP = viewerIsOwner ? homeworkNoticeFor(row.studentId, row) : Promise.resolve(null);

  const [recordings, review, xp, homeworkNotice] = await Promise.all([
    recordingsForTest(row),
    db.testReview.findUnique({ where: { testId: row.id } }).catch(() => null) as Promise<{ criteria: unknown } | null>,
    xpForTest(row.studentId, row.id),
    homeworkNoticeP,
  ]);

  // Answers + their recordings (by question index; by question text for anything older).
  const now = Date.now();
  const mine = recordings.filter((r) => !examId || r.setId === examId);
  const byIndex = new Map(mine.map((r) => [r.questionIndex, r]));
  const byQuestion = new Map(mine.map((r) => [normQuestion(r.question), r]));
  const answers: AnswerView[] = savedAnswers(row.answers).map((a, i) => {
    // By index while the recording was made for this question (the set may have been edited since), else by its text.
    const atIndex = a.questionIndex != null ? byIndex.get(a.questionIndex) : undefined;
    const sameQuestion = !!atIndex && normQuestion(atIndex.question) === normQuestion(a.question);
    const rec = a.typed ? undefined : (sameQuestion ? atIndex : undefined) ?? byQuestion.get(normQuestion(a.question));
    return {
      key: `${a.questionIndex ?? "q"}-${i}`,
      part: a.part,
      number: a.questionIndex != null ? a.questionIndex + 1 : null,
      question: a.question,
      transcript: a.transcript,
      seconds: a.seconds,
      typed: a.typed,
      audioUrl: playableUrl(rec, now),
      audioNote: audioNoteFor(rec, now),
      metrics: rec ? parseSpeechMetrics(rec.metrics) : null,
    };
  });
  const keptUntil = mine
    .filter((r) => playableUrl(r, now) && r.expiresAt)
    .reduce<Date | null>((min, r) => {
      const d = new Date(r.expiresAt as Date);
      return !min || d < min ? d : min;
    }, null);
  const hasAudio = answers.some((a) => a.audioUrl);

  // Criteria: the teacher's where they reviewed, otherwise the AI examiner's (older rows: flat fields).
  const c = asRec(ai.criteria) ?? {};
  const rc = asRec(review?.criteria) ?? {};
  const whose = viewerIsOwner ? "your teacher" : "the teacher";
  const criteria: { key: string; label: string; value: number | null; note: string | null }[] = [
    { key: "fluency", label: "Fluency & Coherence", value: num(rc.fluency) ?? num(c.fluency) ?? num(ai.fluency), note: null },
    { key: "lexical", label: "Lexical Resource", value: num(rc.lexical) ?? num(c.lexical) ?? num(ai.vocabulary), note: null },
    { key: "grammar", label: "Grammatical Range & Accuracy", value: num(rc.grammar) ?? num(c.grammar) ?? num(ai.grammar), note: null },
    {
      key: "pronunciation",
      label: "Pronunciation",
      value: review ? num(rc.pronunciation) : null,
      note: review
        ? `Rated by ${whose}`
        : hasAudio
          ? viewerIsOwner
            ? "Your teacher rates this after listening to your recordings"
            : "Rate it after listening to the recordings"
          : "Rated by a teacher or examiner",
    },
  ];

  const feedback = (Array.isArray(ai.feedback) ? ai.feedback : []).filter((f): f is string => typeof f === "string" && f.trim().length > 0);
  const totals = parseSpeechMetricsTotal(ai.metrics);
  const seconds = num(ai.seconds) ?? answers.reduce((s, a) => s + a.seconds, 0);
  const words = num(ai.wordCount) ?? 0;
  const band = Number.isFinite(row.score) ? row.score : num(ai.overall) ?? 0;
  const bandNote = review
    ? `Reviewed by ${whose}`
    : ai.assessedBy === "ai"
      ? "Estimated by Averna's AI examiner"
      : "Estimated automatically from the transcript";

  const parts = ([1, 2, 3] as const)
    .map((p) => ({ part: p, answers: answers.filter((a) => a.part === p) }))
    .filter((p) => p.answers.length > 0);
  const loose = answers.filter((a) => a.part === null);

  const mockHref = mock && mockAttemptId ? `/learning/mock-exam/result/${encodeURIComponent(mockAttemptId)}` : null;
  const backHref = viewerIsOwner ? LIBRARY : "/teacher/students";
  const backLabel = viewerIsOwner ? "Speaking tests" : "Students";

  const renderAnswer = (a: AnswerView) => (
    <li key={a.key} className="border-t border-white/5 pt-4 first:border-0 first:pt-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {a.number != null && <span>Question {a.number}</span>}
        {a.seconds > 0 && (
          <span className="font-medium normal-case tracking-normal text-gray-400">
            {a.number != null ? "· " : ""}
            {clock(a.seconds)}
          </span>
        )}
        {a.typed && (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 font-medium normal-case tracking-normal text-gray-300">
            <Keyboard className="h-3 w-3" aria-hidden /> Typed
          </span>
        )}
      </p>
      {a.question && <p className="mt-1 text-sm font-medium text-white">{a.question}</p>}
      {a.audioUrl ? (
        <div className="mt-2">
          <RecordingPlayer
            src={a.audioUrl}
            label={`Recording of the answer to question ${a.number ?? ""}`.trim()}
            durationLabel={a.seconds > 0 ? clock(a.seconds) : undefined}
          />
        </div>
      ) : (
        a.audioNote && <p className="mt-2 text-xs italic text-gray-500">{a.audioNote}</p>
      )}
      <p className={cn("mt-2 whitespace-pre-wrap text-sm leading-relaxed", a.transcript ? "text-gray-300" : "italic text-gray-500")}>
        {a.transcript || "No answer recorded."}
      </p>
      {metricsLine(a.metrics) && <p className="mt-1 text-xs text-gray-500">{metricsLine(a.metrics)}</p>}
    </li>
  );

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6 pb-10 sm:py-8 lg:pb-8">
        <section aria-labelledby="speaking-result-title" className="av-panel av-panel-hero rounded-3xl px-5 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-5">
          <Link
            href={backHref}
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>

          <div className="mt-2 flex items-start gap-4">
            <SkillIcon skill="SPEAKING" className="h-12 w-12 rounded-2xl" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">
                {mock ? "Mock exam · Speaking" : "Speaking results"}
                {examId ? " · Parts 1–3" : ""}
              </p>
              <h1 id="speaking-result-title" className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {title}
              </h1>
              {!viewerIsOwner && (
                <p className="mt-1 text-sm text-gray-300">
                  Student: <span className="font-semibold text-white">{row.student.user?.name || "—"}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">Submitted {formatDateTime(row.completedAt)}</p>
            </div>
          </div>

          {(mock || auto || recorded || typedMode) && (
            <ul role="list" aria-label="About this attempt" className="mt-4 flex flex-wrap gap-2">
              {mockHref && (
                <li>
                  <Link
                    href={mockHref}
                    className="glow-hover inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/[0.07] px-3 text-xs font-semibold text-averna-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                  >
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    Mock exam section
                    <span className="font-normal text-gray-300">· See the full mock result</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              )}
              {recorded && (
                <li className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-gray-200">
                  <Mic className="h-3.5 w-3.5 text-averna-cyan" aria-hidden />
                  Recorded answers
                </li>
              )}
              {typedMode && (
                <li className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-gray-200">
                  <Keyboard className="h-3.5 w-3.5 text-gray-300" aria-hidden />
                  Typed answers
                </li>
              )}
              {auto && (
                <li className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-xs font-medium text-amber-100">
                  <Timer className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                  Submitted when the section time ran out
                </li>
              )}
            </ul>
          )}

          <div className="mt-6 grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto text-center sm:mx-0">
              <p className="text-6xl font-bold tabular-nums tracking-tight text-white sm:text-7xl">{fmtBand(band)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">{review ? "Band" : "Est. band"}</p>
              <p className="mt-1 max-w-[12rem] text-xs text-gray-400">{bandNote}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2.5">
              <Stat label="Speaking time" value={seconds > 0 ? clock(seconds) : "—"} />
              <Stat label="Words" value={words > 0 ? String(words) : "—"} />
              <Stat
                label="Speech rate"
                value={totals && totals.wpm > 0 ? `${totals.wpm} wpm` : "—"}
                note={
                  totals && totals.wpm > 0
                    ? `${totals.longPauses === 0 ? "No" : totals.longPauses} long pause${totals.longPauses === 1 ? "" : "s"} (over 1.5 s)`
                    : recorded
                      ? null
                      : "Measured on recorded answers"
                }
              />
              <Stat label="XP earned" value={xp == null ? "—" : xp > 0 ? `+${xp} XP` : "0 XP"} />
            </dl>
          </div>
        </section>

        {homeworkNotice && <HomeworkNoticeCard notice={homeworkNotice} />}

        {viewerIsOwner && (
          <Suspense fallback={<ProgressionSkeleton rows={1} label="Calculating your progress…" />}>
            <SessionOutcomeSection studentId={row.studentId} testId={row.id} label="Speaking" score={band} />
          </Suspense>
        )}

        <TeacherReviewCard testId={row.id} viewerIsOwner={viewerIsOwner} />

        <section aria-labelledby="speaking-criteria-title" className="av-panel rounded-2xl p-5 sm:p-6">
          <h2 id="speaking-criteria-title" className="text-sm font-semibold text-white">
            Band by criterion
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {criteria.map((cr) => (
              <div key={cr.key} className="flex min-h-[72px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-sm text-gray-300">
                  {cr.label}
                  {cr.note && cr.value != null && <span className="mt-0.5 block text-xs text-gray-500">{cr.note}</span>}
                </dt>
                <dd className={cr.value == null ? "max-w-[11rem] text-right text-xs font-medium text-gray-400" : "text-2xl font-bold tabular-nums text-white"}>
                  {cr.value == null ? cr.note ?? "–" : fmtBand(cr.value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {feedback.length > 0 && (
          <section aria-labelledby="speaking-feedback-title" className="av-panel rounded-2xl p-5 sm:p-6">
            <h2 id="speaking-feedback-title" className="text-sm font-semibold text-white">
              {ai.assessedBy === "ai" ? "AI examiner feedback" : "Feedback"}
            </h2>
            <ul className="mt-3 space-y-2.5">
              {feedback.slice(0, 8).map((f, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-200">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="speaking-answers-title" className="av-panel rounded-2xl p-5 sm:p-6">
          <h2 id="speaking-answers-title" className="text-sm font-semibold text-white">
            {answers.length > 1 ? "Your answers" : "Your answer"}
          </h2>
          {keptUntil ? (
            <p className="mt-1 text-xs text-gray-400">
              {viewerIsOwner ? "Your teacher can listen to these recordings" : "The recordings are kept"} until {formatDate(keptUntil)}, then the
              audio is deleted — the transcripts stay.
            </p>
          ) : null}
          {answers.length === 0 && <p className="mt-3 text-sm italic text-gray-500">No answers were saved with this attempt.</p>}
          {parts.map((p) => (
            <div key={p.part} className="mt-5 first:mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-averna-neon">
                Part {p.part} · {PART_NAME[p.part]}
              </h3>
              <ol className="mt-3 space-y-4">{p.answers.map(renderAnswer)}</ol>
            </div>
          ))}
          {loose.length > 0 && <ol className="mt-4 space-y-4">{loose.map(renderAnswer)}</ol>}
        </section>

        <nav aria-label="What to do next" className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          {viewerIsOwner ? (
            <>
              {/* Plain <a>: a full request reaches the practice page, which issues a fresh attempt id. */}
              {examId && !mock && (
                <a
                  href={`${LIBRARY}/${encodeURIComponent(examId)}`}
                  className="glow-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Take this test again
                </a>
              )}
              <Link
                href={LIBRARY}
                className="glow-hover inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
              >
                Try another Speaking test
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/learning"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none"
              >
                Back to Learning
              </Link>
            </>
          ) : (
            <>
              {staff && (
                <Link
                  href={`/teacher/reviews/${encodeURIComponent(row.id)}`}
                  className="glow-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 motion-reduce:transition-none"
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                  {review ? "Edit the review" : "Review this attempt"}
                </Link>
              )}
              <Link
                href="/teacher/students"
                className="glow-hover inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to students
              </Link>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}
