"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  Clock,
  PenLine,
  RotateCcw,
  Save,
  Scale,
  Sparkles,
  Timer,
} from "lucide-react";
import { Aurora } from "@/components/motion/aurora";
import { writingBand } from "@/lib/ielts/bands";
import type { WritingPrompt } from "@/lib/writing-data";
import { cn } from "@/lib/utils";
import { useLeaveGuard } from "./use-exam";
import { WritingExamRunner } from "./writing-exam-runner";
import type { SubmitMeta, WritingEssays } from "./types";

/**
 * Practice-mode wrapper around the CD-IELTS Writing runner: a short intro
 * (the runner starts its 60-minute clock as soon as it mounts), the exam
 * itself, a calm "marking" state while both essays are assessed, and the
 * result — the overall Writing band plus one card per task.
 *
 * Submitting posts to /api/learning/writing/exam with the attempt id, so a
 * retry after a lost response returns the saved result instead of marking
 * twice. A failed submission throws a readable message; the runner shows it,
 * keeps every word and offers "Try again".
 */

const EXAM_API = "/api/learning/writing/exam";
const EXAM_HREF = "/learning/writing/exam";
const WRITING_HREF = "/learning/writing";
const MINUTES = 60;
const SUBMIT_TIMEOUT_MS = 75_000;
const SLOW_NOTICE_MS = 30_000;
/** The route refuses a paper with fewer words than this across both tasks. */
const MIN_TOTAL_WORDS = 20;
/** Essays shorter than this are scored as "no response" (band 0). */
const MARKABLE_WORDS = 20;
const MIN_WORDS: Record<1 | 2, number> = { 1: 150, 2: 250 };

// Session-only flags: a refresh resumes the running test (the runner restores
// the essays and the clock) or shows the marked result again.
const startedKey = (attemptId: string) => `averna-exam:writing-started:${attemptId}`;
const resultKey = (attemptId: string) => `averna-exam:writing-result:${attemptId}`;

/**
 * Messages end up in the runner's error box, which already says "Your essays
 * weren't submitted." and adds "Your text is safe — nothing has been lost.".
 * (Words like "abort" / "timed out" would be swapped for its generic network text.)
 */
const MSG = {
  offline: "Check your internet connection, then press Try again.",
  session: "Your session has expired. Sign in again in a new tab, then come back here and press Try again.",
  slow: "Marking is taking longer than usual. Press Try again in a moment — if your essays were already marked, you'll see the same result.",
  server: "Something went wrong while marking your essays. Please try again in a moment.",
  unreadable: "We couldn't read the examiner's result. Please try again.",
  profile: "We couldn't find your student profile. Please ask your school administrator for help.",
  empty: "There's nothing to mark yet — write your answers, then submit.",
};

const REVEAL =
  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out motion-safe:fill-mode-both";

// ---------------------------------------------------------------------------
// Result contract (POST /api/learning/writing/exam)
// ---------------------------------------------------------------------------

export interface WritingExamTaskResult {
  /** The saved WRITING test — its full feedback lives at /learning/writing/result/{testId}. */
  testId: string;
  band: number;
  words: number;
  xpAwarded: number;
  xpNotes: string[];
}

export interface WritingExamResult {
  /** Writing band: Task 2 counts twice as much as Task 1, IELTS-rounded. */
  band: number;
  task1: WritingExamTaskResult;
  task2: WritingExamTaskResult;
  xpAwarded: number;
}

export interface WritingExamClientProps {
  /** Prompts as sent in exam conditions (examPrompt: no model answer or tips). */
  task1: WritingPrompt;
  task2: WritingPrompt;
  attemptId: string;
  /** This attempt was already marked (e.g. a refresh on the result screen) — show the result straight away. */
  initialResult?: WritingExamResult | null;
  /** This attempt completes exam homework (the server re-validates it). */
  homeworkId?: string;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";

function parseTask(raw: unknown): WritingExamTaskResult | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (!isStr(t.testId) || !t.testId || !isNum(t.band)) return null;
  return {
    testId: t.testId,
    band: t.band,
    words: isNum(t.words) ? Math.max(0, Math.round(t.words)) : 0,
    xpAwarded: isNum(t.xpAwarded) ? Math.max(0, Math.round(t.xpAwarded)) : 0,
    xpNotes: Array.isArray(t.xpNotes) ? t.xpNotes.filter(isStr) : [],
  };
}

/** Defensive read of the route's response — never crash the result screen. */
function parseResult(raw: unknown): WritingExamResult | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const task1 = parseTask(d.task1);
  const task2 = parseTask(d.task2);
  if (!task1 || !task2) return null;
  return {
    band: isNum(d.band) ? d.band : writingBand(task1.band, task2.band),
    task1,
    task2,
    xpAwarded: isNum(d.xpAwarded) ? Math.max(0, Math.round(d.xpAwarded)) : task1.xpAwarded + task2.xpAwarded,
  };
}

function errorText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const e = (data as { error?: unknown }).error;
  return isStr(e) ? e.trim() : "";
}

/** IELTS-style count: whitespace-separated words (same rule as the runner). */
function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

const fmtBand = (b: number) => (Number.isFinite(b) ? b.toFixed(1) : "–");

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode / quota — the in-memory state still works */
  }
}

function removeSession(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function readSavedResult(attemptId: string): WritingExamResult | null {
  const raw = readSession(resultKey(attemptId));
  if (!raw) return null;
  try {
    return parseResult(JSON.parse(raw));
  } catch {
    return null;
  }
}

interface ExamRequest {
  task1Id: string;
  task2Id: string;
  essays: WritingEssays;
  timeSpent: number;
  submissionId: string;
  homeworkId?: string;
}

async function postWritingExam(body: ExamRequest): Promise<WritingExamResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error(MSG.offline);

  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), SUBMIT_TIMEOUT_MS);
  let status = 0;
  let data: unknown = null;
  try {
    const res = await fetch(EXAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: ctrl.signal,
    });
    status = res.status;
    data = await res.json().catch(() => null);
  } catch {
    throw new Error(ctrl.signal.aborted ? MSG.slow : MSG.offline);
  } finally {
    window.clearTimeout(timer);
  }
  // The time limit cut the response body off.
  if (ctrl.signal.aborted && data === null) throw new Error(MSG.slow);

  if (status < 200 || status >= 300) {
    if (status === 401) throw new Error(MSG.session);
    if (status === 408 || status === 504) throw new Error(MSG.slow);
    if (status >= 500) throw new Error(MSG.server);
    if (status === 404 && errorText(data)) throw new Error(MSG.profile);
    throw new Error(errorText(data) || MSG.server);
  }
  const result = parseResult(data);
  if (!result) throw new Error(MSG.unreadable);
  return result;
}

// ---------------------------------------------------------------------------
// Frame — the same full-screen surface as the exam shell
// ---------------------------------------------------------------------------

function Frame({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="exam-shell fixed inset-0 z-[70] flex flex-col bg-[#040b09] text-gray-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(11,143,106,0.16),transparent_70%)]"
      />
      <header className="relative flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#07130f]/95 px-3 py-2 backdrop-blur sm:gap-3 sm:px-5">
        <Link
          href={WRITING_HREF}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Writing
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white sm:text-base">IELTS Writing</p>
          <p className="truncate text-xs text-gray-400">{subtitle}</p>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">{children}</div>
      </div>
    </div>
  );
}

const PRIMARY_BTN =
  "glow-cta inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none sm:text-base";
const SECONDARY_BTN =
  "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 px-6 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 motion-reduce:transition-none sm:text-base";

function EndActions() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      {/* No prefetch: every visit picks new tasks and a new attempt on the server. */}
      <Link href={EXAM_HREF} prefetch={false} className={PRIMARY_BTN}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        Take another Writing test
      </Link>
      <Link href={WRITING_HREF} className={SECONDARY_BTN}>
        Back to Writing
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------

function Rule({ icon: Icon, children }: { icon: typeof Timer; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-relaxed text-gray-300">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <section
        aria-labelledby="writing-intro-title"
        className={cn("av-panel av-panel-hero relative isolate overflow-hidden rounded-3xl p-6 sm:p-8", REVEAL)}
      >
        <Aurora intensity="soft" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Full Writing test</p>
        <h1 id="writing-intro-title" className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Task 1 + Task 2 in 60 minutes
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-300 sm:text-base">
          Write both tasks in one sitting, as in the computer-delivered IELTS. You&apos;ll see the tasks — and the clock
          starts — when you press Start.
        </p>

        <ul role="list" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <span className="text-averna-pink">Task 1</span>
              <span className="font-medium normal-case tracking-normal text-gray-500">about 20 min</span>
            </p>
            <p className="mt-1.5 text-sm font-semibold text-white">Describe a visual</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">A chart, table, map or process · at least 150 words.</p>
          </li>
          <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <span className="text-averna-pink">Task 2</span>
              <span className="font-medium normal-case tracking-normal text-gray-500">about 40 min</span>
            </p>
            <p className="mt-1.5 text-sm font-semibold text-white">Write an essay</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Respond to an opinion, argument or problem · at least 250 words.
            </p>
          </li>
        </ul>

        <p className="mt-4 flex items-start gap-2 rounded-xl border border-averna-cyan/20 bg-averna-cyan/[0.06] px-3 py-2.5 text-sm leading-snug text-gray-200">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
          <span>
            Task 2 counts twice as much as Task 1: your Writing band is (Task 1 + 2 × Task 2) ÷ 3, rounded to the nearest
            half band.
          </span>
        </p>
      </section>

      <section aria-labelledby="writing-intro-rules" className={cn("av-panel rounded-2xl p-5 sm:p-6", REVEAL, "motion-safe:delay-100")}>
        <h2 id="writing-intro-rules" className="text-sm font-semibold text-white">
          Before you start
        </h2>
        <ul role="list" className="mt-3 space-y-2.5">
          <Rule icon={Timer}>One 60-minute clock for both tasks. It keeps running if you refresh the page.</Rule>
          <Rule icon={PenLine}>
            Move between Task 1 and Task 2 at any time. Spelling and grammar checks are off, as in the real test.
          </Rule>
          <Rule icon={Save}>Your essays are saved automatically in this browser.</Rule>
          <Rule icon={Clock}>When the time is up, whatever you have written is submitted automatically.</Rule>
          <Rule icon={Sparkles}>Averna&apos;s AI examiner marks both tasks — your result is ready in under a minute.</Rule>
        </ul>
      </section>

      <div className={cn("mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end", REVEAL, "motion-safe:delay-200")}>
        <Link href={WRITING_HREF} className={SECONDARY_BTN}>
          Back to Writing
        </Link>
        <button type="button" onClick={onStart} className={PRIMARY_BTN}>
          Start the test
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

function MarkingOverlay({ words1, words2 }: { words1: number; words2: number }) {
  const [slow, setSlow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => window.clearTimeout(t);
  }, []);

  const rows = [
    { n: 1, words: words1 },
    { n: 2, words: words2 },
  ];

  return (
    // Above the exam shell (z-70) and its review dialog (z-80).
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="writing-marking-title"
      aria-describedby="writing-marking-status"
      className="exam-shell fixed inset-0 z-[90] flex items-center justify-center bg-[#040b09]/95 p-4 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        aria-busy="true"
        className="av-panel av-panel-hero relative isolate w-full max-w-md overflow-hidden rounded-3xl p-6 text-center outline-none sm:p-8"
      >
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center" aria-hidden>
          <span className="absolute inset-0 rounded-full border-2 border-averna-neon/25 motion-safe:animate-[ping_2.6s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <span className="absolute -inset-2 rounded-full bg-averna-neon/10 blur-xl motion-safe:animate-pulse-slow" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-averna-neon/30 bg-[#07130f]">
            <PenLine className="h-7 w-7 text-averna-neon" />
          </span>
        </div>
        <h2 id="writing-marking-title" className="mt-6 text-lg font-bold text-white sm:text-xl">
          The examiner is marking both tasks…
        </h2>
        <p id="writing-marking-status" role="status" aria-live="polite" className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-300">
          {slow
            ? "Still marking — longer essays can take up to a minute. Please keep this page open."
            : "This takes 10–30 seconds. Please keep this page open."}
        </p>
        <ul role="list" className="mt-6 space-y-3 text-left" aria-label="Tasks being marked">
          {rows.map((r) => (
            <li key={r.n} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-white">Task {r.n}</span>
                <span className="tabular-nums text-gray-400">
                  {r.words} {r.words === 1 ? "word" : "words"}
                </span>
              </p>
              <div className="skeleton mt-2 h-1.5 w-full rounded-full" aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

function TaskResultCard({
  n,
  prompt,
  task,
  className,
}: {
  n: 1 | 2;
  prompt: WritingPrompt;
  task: WritingExamTaskResult;
  className?: string;
}) {
  const min = MIN_WORDS[n];
  const enough = task.words >= min;
  const criterion = n === 1 ? "Task Achievement" : "Task Response";

  return (
    <li className={cn("av-panel flex flex-col rounded-2xl p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-averna-pink">
            Task {n}
          </h3>
          {prompt.title && <p className="mt-1 text-sm font-medium leading-snug text-gray-200">{prompt.title}</p>}
        </div>
        {n === 2 && (
          <span className="shrink-0 rounded-full border border-averna-cyan/25 bg-averna-cyan/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-averna-cyan">
            Counts double
          </span>
        )}
      </div>

      <p className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums tracking-tight text-white">{fmtBand(task.band)}</span>
        <span className="text-sm text-gray-400">band</span>
      </p>

      <p className={cn("mt-3 flex items-center gap-1.5 text-sm", enough ? "text-gray-300" : "text-amber-200")}>
        {enough ? (
          <Check className="h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span>
          <span className="font-semibold tabular-nums text-white">{task.words}</span> {task.words === 1 ? "word" : "words"} ·
          minimum {min}
        </span>
      </p>
      {!enough && (
        <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
          {task.words < MARKABLE_WORDS
            ? "Too short to be marked — this task scores band 0, as in the real exam."
            : `${min - task.words} words short — short answers lose marks for ${criterion}.`}
        </p>
      )}

      <p className="mt-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            task.xpAwarded > 0 ? "border-averna-neon/30 bg-averna-neon/10 text-averna-neon" : "border-white/10 bg-white/5 text-gray-400"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {task.xpAwarded > 0 ? `+${task.xpAwarded} XP` : "0 XP"}
        </span>
      </p>

      <div className="mt-auto pt-5">
        <Link
          href={`/learning/writing/result/${encodeURIComponent(task.testId)}`}
          className="glow-hover inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-averna-neon/30 bg-averna-neon/[0.06] px-4 text-sm font-semibold text-averna-neon hover:bg-averna-neon/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
        >
          See full feedback<span className="sr-only"> for Task {n}</span>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </li>
  );
}

function ResultView({ result, task1, task2 }: { result: WritingExamResult; task1: WritingPrompt; task2: WritingPrompt }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    const raf = window.requestAnimationFrame(() => setFilled(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const b1 = result.task1.band;
  const b2 = result.task2.band;
  const weighted = (b1 + 2 * b2) / 3;
  const pct = Math.max(0, Math.min(100, (result.band / 9) * 100));
  const xp = result.xpAwarded;
  const notes = [...result.task1.xpNotes, ...result.task2.xpNotes];
  // 0 XP always comes with a note, except for a retried submission (the route returns the saved result without XP).
  const xpNote = xp > 0 ? null : notes[0] ?? "This attempt was already marked — its XP is already in your total.";

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="writing-result-title"
        className={cn("av-panel av-panel-hero relative isolate overflow-hidden rounded-3xl p-6 text-center sm:p-8", REVEAL)}
      >
        <Aurora intensity="soft" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Writing test result</p>
        <h1 id="writing-result-title" ref={headingRef} tabIndex={-1} className="mt-2 text-sm font-medium text-gray-300 outline-none">
          Overall Writing band (estimated)<span className="sr-only">: {fmtBand(result.band)}</span>
        </h1>
        <p
          aria-hidden
          className="mt-1 text-7xl font-bold tabular-nums tracking-tight text-white motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500 motion-safe:ease-out motion-safe:fill-mode-both motion-safe:delay-100"
        >
          {fmtBand(result.band)}
        </p>
        <div className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
          <div className="meter-fill h-full rounded-full bg-averna-neon/80" style={{ width: filled ? `${pct}%` : "0%" }} />
        </div>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-gray-300">
          Task 2 counts twice as much as Task 1. The average is rounded to the nearest half band, like the real IELTS.
        </p>
        <p className="mx-auto mt-3 inline-flex flex-wrap items-center justify-center gap-x-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm tabular-nums text-gray-200">
          <span>
            ({fmtBand(b1)} + 2 × {fmtBand(b2)}) ÷ 3 = {weighted.toFixed(2)}
          </span>
          <span aria-hidden className="text-gray-500">
            →
          </span>
          <span className="sr-only">rounded to</span>
          <span className="font-semibold text-white">{fmtBand(result.band)}</span>
        </p>
      </section>

      <section aria-labelledby="writing-result-tasks">
        <h2 id="writing-result-tasks" className="sr-only">
          Your tasks
        </h2>
        <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TaskResultCard n={1} prompt={task1} task={result.task1} className={cn(REVEAL, "motion-safe:delay-150")} />
          <TaskResultCard n={2} prompt={task2} task={result.task2} className={cn(REVEAL, "motion-safe:delay-200")} />
        </ul>
      </section>

      <section
        aria-labelledby="writing-result-xp"
        className={cn("av-panel rounded-2xl p-5 sm:p-6", REVEAL, "motion-safe:delay-300")}
      >
        <h2 id="writing-result-xp" className="sr-only">
          XP
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold",
              xp > 0 ? "border-averna-neon/30 bg-averna-neon/10 text-averna-neon" : "border-white/10 bg-white/5 text-gray-300"
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {xp > 0 ? `+${xp} XP earned` : "No XP this time"}
          </span>
          {xpNote && <span className="text-sm text-gray-400">{xpNote}</span>}
        </div>
      </section>

      <div className={cn("pt-1", REVEAL, "motion-safe:delay-300")}>
        <EndActions />
      </div>
    </div>
  );
}

/** Time ran out on a (nearly) blank paper — nothing to mark, so end calmly instead of an error that can't be fixed. */
function NothingToMark() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <section
      aria-labelledby="writing-empty-title"
      className={cn("av-panel rounded-3xl p-6 text-center sm:p-8", REVEAL)}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300" aria-hidden>
        <Clock className="h-6 w-6" />
      </span>
      <h1 id="writing-empty-title" ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-bold text-white outline-none">
        Time is up
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-300">
        You didn&apos;t write enough for the examiner to mark, so this test wasn&apos;t scored. Next time, aim for at least
        150 words in Task 1 and 250 words in Task 2.
      </p>
      <div className="mt-6">
        <EndActions />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

type Phase = "intro" | "exam" | "result" | "empty";

export function WritingExamClient({ task1, task2, attemptId, initialResult, homeworkId }: WritingExamClientProps) {
  const [phase, setPhase] = useState<Phase>(initialResult ? "result" : "intro");
  const [result, setResult] = useState<WritingExamResult | null>(initialResult ?? null);
  const [marking, setMarking] = useState<{ words1: number; words2: number } | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Same tab, same attempt: show the marked result again, or go straight back
  // into a test in progress (the runner restores the essays and the clock).
  useEffect(() => {
    if (initialResult) {
      removeSession(startedKey(attemptId));
      return;
    }
    const saved = readSavedResult(attemptId);
    if (saved) {
      setResult(saved);
      setPhase("result");
    } else if (readSession(startedKey(attemptId))) {
      setPhase("exam");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  useLeaveGuard(marking !== null);

  const start = useCallback(() => {
    writeSession(startedKey(attemptId), "1");
    setPhase("exam");
  }, [attemptId]);

  // A rejected promise is shown by the runner, which keeps the essays and offers "Try again".
  const handleSubmit = useCallback(
    async (essays: WritingEssays, meta: SubmitMeta) => {
      const words1 = countWords(essays.task1);
      const words2 = countWords(essays.task2);
      if (words1 + words2 < MIN_TOTAL_WORDS) {
        if (!meta.auto) throw new Error(MSG.empty);
        removeSession(startedKey(attemptId));
        if (mountedRef.current) setPhase("empty");
        return;
      }

      setMarking({ words1, words2 });
      try {
        const r = await postWritingExam({
          task1Id: task1.id,
          task2Id: task2.id,
          essays,
          timeSpent: meta.timeSpent,
          submissionId: attemptId,
          ...(homeworkId ? { homeworkId } : {}),
        });
        writeSession(resultKey(attemptId), JSON.stringify(r));
        removeSession(startedKey(attemptId));
        if (!mountedRef.current) return;
        setResult(r);
        setPhase("result");
      } finally {
        if (mountedRef.current) setMarking(null);
      }
    },
    [attemptId, homeworkId, task1.id, task2.id]
  );

  if (phase === "result" && result) {
    return (
      <Frame subtitle="Full test result · Task 1 + Task 2">
        <ResultView result={result} task1={task1} task2={task2} />
      </Frame>
    );
  }

  if (phase === "empty") {
    return (
      <Frame subtitle="Practice test · Task 1 + Task 2 · 60 minutes">
        <NothingToMark />
      </Frame>
    );
  }

  if (phase === "exam") {
    return (
      <>
        <WritingExamRunner
          key={attemptId}
          task1={task1}
          task2={task2}
          mode="practice"
          attemptId={attemptId}
          minutes={MINUTES}
          exitHref={WRITING_HREF}
          onSubmit={handleSubmit}
        />
        {marking && <MarkingOverlay words1={marking.words1} words2={marking.words2} />}
      </>
    );
  }

  return (
    <Frame subtitle="Practice test · Task 1 + Task 2 · 60 minutes">
      <Intro onStart={start} />
    </Frame>
  );
}

export default WritingExamClient;
