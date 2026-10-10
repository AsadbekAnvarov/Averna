"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { ExamShell, FONT_STEPS, type ExamPartNav } from "./exam-shell";
import { PassagePane, clearPassageHighlights, findScrollParent } from "./passage-pane";
import { QuestionGroupView } from "./question-group";
import { focusQuestion, useDeadline, useExamAnswers, useLeaveGuard } from "./use-exam";
import type { ReadingExamRunnerProps, SubmitMeta } from "./types";
import type { ClientReadingPart, ExamAnswers } from "@/lib/ielts/types";
import { READING_FULL, answeredNumbers, partNumbers, rangeLabel } from "@/lib/ielts/format";

/**
 * Computer-delivered IELTS Reading inside the shared ExamShell: the passage on
 * the left (PassagePane, with highlighting), the active passage's questions on
 * the right, the question navigator along the bottom.
 *
 * - Scope: the full test, or one passage (`partIndex`).
 * - Clock: the server's absolute `deadline` when given (mock); otherwise
 *   now + minutes, persisted per attempt so a refresh keeps the same clock.
 *   At zero the runner submits by itself (`meta.auto = true`, no dialog).
 * - Answers autosave locally (useExamAnswers) and mirror to `onAutosave`.
 * - Submit: mock → `onSubmit`; practice → POST /api/learning/reading/submit,
 *   then the result page. A failure keeps every answer and offers a retry —
 *   the attempt id makes retries idempotent. The error stays on screen (a
 *   banner in the questions pane, mirrored above the navigator whenever that
 *   pane is hidden, e.g. on the phone's Passage tab) instead of a toast that
 *   disappears while the student is reading.
 */

const SUBMIT_URL = "/api/learning/reading/submit";
const SUBMIT_TIMEOUT_MS = 30_000;
/** Text size is a reader preference, so it's remembered across tests. */
const FONT_KEY = "averna-exam-font";
const FALLBACK_ERROR = "Your answers weren't submitted. Nothing was lost — please try again.";
const NETWORK_ERROR = "We couldn't reach the server. Check your connection and try again — your answers are saved on this device.";

const deadlineKey = (attemptId: string) => `averna-exam-deadline:${attemptId}`;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface ScopedPart {
  /** Index into test.parts. */
  index: number;
  part: ClientReadingPart;
  numbers: number[];
  from: number | null;
  to: number | null;
  /** Navigator title, e.g. "Passage 2". */
  nav: string;
  /** Passage pane label, e.g. "Reading Passage 2". */
  label: string;
  /** Exam rubric shown above the passage. */
  intro: string;
}

/** Practice submission. Resolves with the id of the saved attempt; throws a student-readable Error. */
async function postPracticeAttempt(body: Record<string, unknown>): Promise<string> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? window.setTimeout(() => ctrl.abort(), SUBMIT_TIMEOUT_MS) : 0;
  let res: Response;
  try {
    res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl?.signal,
    });
  } catch {
    throw new Error(
      ctrl?.signal.aborted
        ? "The server took too long to answer. Your answers are safe on this device — please try again."
        : NETWORK_ERROR
    );
  } finally {
    window.clearTimeout(timer);
  }
  const data = (await res.json().catch(() => null)) as { testId?: unknown; error?: unknown } | null;
  if (res.ok && data && typeof data.testId === "string" && data.testId) return data.testId;
  const serverError = data && typeof data.error === "string" ? data.error.trim() : "";
  if (serverError) throw new Error(serverError);
  if (res.status === 401) {
    throw new Error("Your session has expired. Sign in again in a new tab, then press Try again — your answers are saved.");
  }
  throw new Error(FALLBACK_ERROR);
}

// ---------------------------------------------------------------------------
// Questions pane pieces
// ---------------------------------------------------------------------------

function StatusBanner({
  error,
  submitting,
  submitted,
  expired,
  practice,
  onRetry,
}: {
  error: string | null;
  submitting: boolean;
  submitted: boolean;
  expired: boolean;
  practice: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return (
      // Sticky so the retry stays in reach while the student scrolls; the solid strip keeps it legible.
      <div className="sticky top-[var(--app-bar-h,0px)] z-10 -mx-4 mb-2 bg-exam-bg/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div role="alert" className="error-surface flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-red-200">
                {expired ? "Time is up, but your answers haven't been sent yet" : "Your answers weren't submitted"}
              </p>
              <p className="mt-0.5 break-words text-red-100/80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300/40 bg-red-500/15 px-4 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 motion-reduce:transition-none"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div
        role="status"
        className="mb-5 flex items-center gap-2.5 rounded-xl border border-averna-neon/25 bg-averna-neon/[0.06] px-4 py-3 text-sm text-gray-100"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
        {practice ? "Answers submitted — opening your results…" : "Answers submitted."}
      </div>
    );
  }
  if (submitting || expired) {
    return (
      <div
        role="status"
        className={
          expired
            ? "mb-5 flex items-center gap-2.5 rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
            : "mb-5 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-200"
        }
      >
        <Loader2 className="h-4 w-4 shrink-0 text-averna-neon motion-safe:animate-spin" aria-hidden />
        {expired ? "Time is up — submitting your answers…" : "Submitting your answers…"}
      </div>
    );
  }
  return null;
}

/** Above the navigator while the questions pane (and its banner) is out of sight. */
function SubmitErrorStrip({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="px-3 py-2 sm:px-4">
      <div role="alert" className="error-surface flex items-center gap-2.5 rounded-lg py-1 pl-3 pr-1">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-300" aria-hidden />
        <p className="line-clamp-2 min-w-0 flex-1 text-sm text-red-100/80">
          <span className="font-semibold text-red-200">Not submitted. </span>
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 motion-reduce:transition-none"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Try again
        </button>
      </div>
    </div>
  );
}

interface QuestionsListProps {
  sp: ScopedPart;
  answers: ExamAnswers;
  onAnswer: (n: number, value: string | string[]) => void;
  flagged: Set<number>;
  onToggleFlag: (n: number) => void;
  current: number | null;
  onFocusQuestion: (n: number) => void;
  disabled: boolean;
  nextNav: string | null;
  onNext: () => void;
}

function QuestionsListImpl({
  sp,
  answers,
  onAnswer,
  flagged,
  onToggleFlag,
  current,
  onFocusQuestion,
  disabled,
  nextNav,
  onNext,
}: QuestionsListProps) {
  return (
    <>
      <header className="mb-6">
        <p className="text-[0.72em] font-bold uppercase tracking-[0.18em] text-gray-400">{sp.nav}</p>
        <p className="mt-1 text-gray-200">
          {sp.from != null && sp.to != null ? (
            <>
              Read the passage and answer <span className="font-semibold text-white">{rangeLabel(sp.from, sp.to)}</span>.
            </>
          ) : (
            "Read the passage."
          )}
        </p>
      </header>

      {sp.part.groups.map((g, gi) => (
        <QuestionGroupView
          key={`${sp.part.id}:${g.questions[0]?.n ?? gi}`}
          group={g}
          skill="READING"
          answers={answers}
          onAnswer={onAnswer}
          flagged={flagged}
          onToggleFlag={onToggleFlag}
          current={current}
          onFocusQuestion={onFocusQuestion}
          disabled={disabled}
        />
      ))}
      {sp.part.groups.length === 0 && <p className="text-gray-400">There are no questions for this passage.</p>}

      {nextNav && (
        <div className="mt-2 flex justify-end border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={onNext}
            className="glow-hover inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
          >
            Continue to {nextNav}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

const QuestionsList = memo(QuestionsListImpl);

function EmptyTest({ exitHref }: { exitHref?: string }) {
  return (
    <div className="exam-shell fixed inset-0 z-[70] flex items-center justify-center bg-exam-bg p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[calc(1.5rem+env(safe-area-inset-left))] pr-[calc(1.5rem+env(safe-area-inset-right))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-gray-100">
      <div role="alert" className="av-panel w-full max-w-md rounded-2xl p-6 text-center">
        <p className="text-lg font-bold text-white">This test has no passages yet</p>
        <p className="mt-2 text-sm text-gray-400">Please choose another Reading test.</p>
        {exitHref && (
          <Link
            href={exitHref}
            className="glow-cta mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
          >
            Go back
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function ReadingExamRunner(props: ReadingExamRunnerProps) {
  const { test, partIndex, mode, attemptId, minutes, deadline: serverDeadline, initialAnswers, onSubmit, onAutosave, exitHref, homeworkId } = props;
  const router = useRouter();
  const practice = !onSubmit;
  // In-text dictionary: practice only — never in the mock, like the real exam.
  const lookup = mode === "practice" && props.lookup !== false;

  // ---- scope ---------------------------------------------------------------
  // An out-of-range partIndex falls back to the full test, consistently for the UI, the clock and the payload.
  const single =
    typeof partIndex === "number" && Number.isInteger(partIndex) && partIndex >= 0 && partIndex < test.parts.length
      ? partIndex
      : undefined;

  const runMinutes = useMemo(() => {
    if (typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0) return minutes;
    if (single != null) return READING_FULL.minutesPerPart;
    return test.timeLimit > 0 ? test.timeLimit : READING_FULL.minutesPerPart * Math.max(1, test.parts.length);
  }, [minutes, single, test.timeLimit, test.parts.length]);
  const durationMs = Math.round(runMinutes * 60_000);

  const scoped = useMemo((): ScopedPart[] => {
    const indices = single != null ? [single] : test.parts.map((_, i) => i);
    const perPart = single != null ? runMinutes : Math.max(1, Math.round(runMinutes / Math.max(1, indices.length)));
    const mins = `${perPart} minute${perPart === 1 ? "" : "s"}`;
    return indices.map((index) => {
      const part = test.parts[index];
      const numbers = partNumbers(part);
      const from = numbers.length ? Math.min(...numbers) : null;
      const to = numbers.length ? Math.max(...numbers) : null;
      const n = index + 1;
      return {
        index,
        part,
        numbers,
        from,
        to,
        nav: `Passage ${n}`,
        label: `Reading Passage ${n}`,
        intro:
          from != null && to != null
            ? `You should spend about ${mins} on ${rangeLabel(from, to)}, which are based on Reading Passage ${n} below.`
            : `You should spend about ${mins} on Reading Passage ${n}.`,
      };
    });
  }, [test.parts, single, runMinutes]);

  const hasContent = scoped.length > 0;
  const allGroups = useMemo(() => scoped.flatMap((s) => s.part.groups), [scoped]);
  const navParts = useMemo((): ExamPartNav[] => scoped.map((s) => ({ title: s.nav, numbers: s.numbers })), [scoped]);

  const subtitle = useMemo(() => {
    if (!scoped.length) return undefined;
    const nums = scoped.flatMap((s) => s.numbers);
    const range = nums.length ? rangeLabel(Math.min(...nums), Math.max(...nums)) : "";
    const join = (...bits: string[]) => bits.filter(Boolean).join(" · ");
    if (single != null) return join(`${scoped[0].nav}${mode === "practice" ? " practice" : ""}`, range);
    const count = `${scoped.length} passage${scoped.length === 1 ? "" : "s"}`;
    return join(mode === "mock" ? "Reading" : "Full test", count, range);
  }, [scoped, single, mode]);

  // ---- answers ---------------------------------------------------------------
  const { answers, setAnswer, flagged, toggleFlag, hydrated, clearSaved } = useExamAnswers({
    storageKey: `averna-exam:reading:${test.id}:${attemptId}`,
    initial: initialAnswers,
    preferInitial: props.preferInitial,
    onChange: onAutosave,
  });
  const answersRef = useRef<ExamAnswers>(answers);
  answersRef.current = answers;
  const answered = useMemo(() => answeredNumbers(allGroups, answers), [allGroups, answers]);

  // ---- clock -----------------------------------------------------------------
  const hasServerDeadline = typeof serverDeadline === "number" && Number.isFinite(serverDeadline) && serverDeadline > 0;
  const [localDeadline, setLocalDeadline] = useState<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  // Computed on mount (not during render → no hydration mismatch) and persisted per attempt.
  useEffect(() => {
    if (hasServerDeadline || !hasContent) return;
    const key = deadlineKey(attemptId);
    const now = Date.now();
    let d: number | null = null;
    try {
      const stored = Number(window.localStorage.getItem(key));
      // Same attempt after a refresh → same clock. Ignore corrupt / impossible values.
      if (Number.isFinite(stored) && stored > 0 && stored <= now + durationMs + 60_000) d = stored;
    } catch {
      /* storage unavailable */
    }
    if (d == null) {
      d = now + durationMs;
      try {
        window.localStorage.setItem(key, String(d));
      } catch {
        /* private mode — the clock still runs, it just won't survive a refresh */
      }
    }
    setLocalDeadline(d);
  }, [attemptId, durationMs, hasServerDeadline, hasContent]);

  const deadline: number | null = hasServerDeadline ? (serverDeadline as number) : localDeadline;
  const deadlineRef = useRef<number | null>(deadline);
  deadlineRef.current = deadline;

  const timeSpent = useCallback(() => {
    const total = Math.round(durationMs / 1000);
    const now = Date.now();
    const d = deadlineRef.current;
    let spent = d ? Math.round((now - (d - durationMs)) / 1000) : 0;
    if (spent <= 0 && startedAtRef.current) spent = Math.round((now - startedAtRef.current) / 1000);
    return Math.max(0, Math.min(total, spent));
  }, [durationMs]);

  // ---- submit ----------------------------------------------------------------
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const lastAutoRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const cleanupAfterSubmit = useCallback(() => {
    clearSaved();
    try {
      window.localStorage.removeItem(deadlineKey(attemptId));
    } catch {
      /* ignore */
    }
    clearPassageHighlights(attemptId);
  }, [clearSaved, attemptId]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (busyRef.current || doneRef.current) return; // double-click / timer racing a click
      busyRef.current = true;
      lastAutoRef.current = auto;
      setSubmitting(true);
      setError(null);
      const payload = answersRef.current;
      const meta: SubmitMeta = { timeSpent: timeSpent(), auto };
      const handler = onSubmitRef.current;
      let savedId: string | null = null;
      try {
        if (handler) await handler(payload, meta);
        else
          savedId = await postPracticeAttempt({
            format: "exam-v2",
            testId: test.id,
            part: single ?? null,
            answers: payload,
            timeSpent: meta.timeSpent,
            auto: meta.auto,
            submissionId: attemptId,
            ...(homeworkId ? { homeworkId } : {}),
          });
      } catch (err) {
        // Answers stay in state and in localStorage; the same attempt id makes the retry safe.
        // A TypeError is fetch's "Failed to fetch" (e.g. from the mock's onSubmit) — say it in plain words.
        setError(err instanceof TypeError ? NETWORK_ERROR : err instanceof Error && err.message ? err.message : FALLBACK_ERROR);
        setSubmitting(false);
        busyRef.current = false;
        return;
      }
      doneRef.current = true;
      busyRef.current = false;
      cleanupAfterSubmit();
      setSubmitted(true);
      if (handler) {
        setSubmitting(false);
        return;
      }
      // Practice: `submitting` stays on until the result page replaces this screen.
      const url = `/learning/reading/result/${encodeURIComponent(savedId ?? "")}`;
      try {
        // replace, not push: Back must not reopen the paper that was just handed in.
        router.replace(url);
      } catch {
        window.setTimeout(() => window.location.assign(url), 50);
      }
    },
    [attemptId, cleanupAfterSubmit, homeworkId, router, single, test.id, timeSpent]
  );
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // The clock starts once saved answers are restored, so an expired attempt submits what was saved.
  // At zero: submit straight away (no review dialog); the status banner says why.
  const { remainingMs, expired } = useDeadline(hydrated && hasContent ? deadline : null, () => {
    if (!doneRef.current) void submitRef.current(true);
  });
  const expiredRef = useRef(expired);
  expiredRef.current = expired;

  const finish = useCallback(() => submit(expiredRef.current), [submit]);
  const retry = useCallback(() => {
    void submit(lastAutoRef.current || expiredRef.current);
  }, [submit]);

  useLeaveGuard(hasContent && !submitted);

  const locked = submitting || submitted || expired;

  // ---- text size -------------------------------------------------------------
  const [fontScale, setFontScale] = useState(1);
  useEffect(() => {
    try {
      const v = Number(window.localStorage.getItem(FONT_KEY));
      if (FONT_STEPS.includes(v)) setFontScale(v);
    } catch {
      /* ignore */
    }
  }, []);
  const changeFont = useCallback((v: number) => {
    if (!FONT_STEPS.includes(v)) return;
    setFontScale(v);
    try {
      window.localStorage.setItem(FONT_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  // ---- parts, current question, jumping ----------------------------------------
  const [active, setActive] = useState(0);
  const activeIdx = Math.min(active, Math.max(0, scoped.length - 1));
  const activeRef = useRef(activeIdx);
  activeRef.current = activeIdx;
  const [current, setCurrent] = useState<number | null>(null);
  const lastCurrent = useRef<Record<number, number>>({});
  const [focusReq, setFocusReq] = useState<{ n: number; seq: number } | null>(null);

  // Remember where the student was in each passage.
  useEffect(() => {
    if (current != null && scoped[activeIdx]?.numbers.includes(current)) lastCurrent.current[activeIdx] = current;
  }, [current, activeIdx, scoped]);

  const changePart = useCallback(
    (i: number) => {
      if (i < 0 || i >= scoped.length || i === activeRef.current) return;
      activeRef.current = i;
      setActive(i);
      setCurrent(lastCurrent.current[i] ?? scoped[i].numbers[0] ?? null);
    },
    [scoped]
  );

  const goNext = useCallback(() => changePart(activeRef.current + 1), [changePart]);

  const jump = useCallback(
    (n: number) => {
      const target = scoped.findIndex((s) => s.numbers.includes(n));
      if (target < 0) return;
      setCurrent(n);
      if (target !== activeRef.current) {
        activeRef.current = target;
        setActive(target);
      }
      // Focus after the (possibly new) part — and the phone's Questions tab — have rendered.
      setFocusReq((prev: { n: number; seq: number } | null) => ({ n, seq: (prev?.seq ?? 0) + 1 }));
    },
    [scoped]
  );

  useEffect(() => {
    if (!focusReq) return;
    const id = window.requestAnimationFrame(() => focusQuestion(focusReq.n));
    return () => window.cancelAnimationFrame(id);
  }, [focusReq]);

  // Each passage keeps its own scroll position in the questions pane.
  const questionsRef = useRef<HTMLDivElement>(null);
  const qScroll = useRef<Record<number, number>>({});
  const scrollOwner = useRef(activeIdx);
  useIsoLayoutEffect(() => {
    scrollOwner.current = activeIdx;
    const sp = findScrollParent(questionsRef.current);
    if (sp) sp.scrollTop = qScroll.current[activeIdx] ?? 0;
  }, [activeIdx]);
  useEffect(() => {
    const sp = findScrollParent(questionsRef.current);
    if (!sp) return;
    const onScroll = () => {
      qScroll.current[scrollOwner.current] = sp.scrollTop;
    };
    sp.addEventListener("scroll", onScroll, { passive: true });
    return () => sp.removeEventListener("scroll", onScroll);
  }, [hasContent]);

  // Is the questions pane on screen? (Phones show one pane at a time.) Drives the error strip.
  const [paneVisible, setPaneVisible] = useState(true);
  useEffect(() => {
    const el = questionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      const last = entries[entries.length - 1];
      if (last) setPaneVisible(last.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasContent]);

  // ---- render ------------------------------------------------------------------
  if (!hasContent) return <EmptyTest exitHref={mode === "practice" ? exitHref : undefined} />;

  const sp = scoped[activeIdx];
  const nextNav = activeIdx < scoped.length - 1 ? scoped[activeIdx + 1].nav : null;

  return (
    <ExamShell
      title={test.title}
      subtitle={subtitle}
      remainingMs={remainingMs}
      parts={navParts}
      activePart={activeIdx}
      onPartChange={changePart}
      answered={answered}
      flagged={flagged}
      current={current}
      onJump={jump}
      fontScale={fontScale}
      onFontScale={changeFont}
      left={<PassagePane passage={sp.part} label={sp.label} intro={sp.intro} attemptId={attemptId} lookup={lookup} />}
      leftLabel="Passage"
      rightLabel="Questions"
      footerExtra={error && !paneVisible ? <SubmitErrorStrip error={error} onRetry={retry} /> : undefined}
      onSubmit={finish}
      submitting={submitting || submitted}
      submitLabel={mode === "mock" ? "Finish Reading" : "Finish Test"}
      exitHref={mode === "practice" ? exitHref : undefined}
    >
      <div ref={questionsRef} className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
        <span className="sr-only" aria-live="polite">
          {sp.from != null && sp.to != null ? `${sp.nav}, ${rangeLabel(sp.from, sp.to)}` : sp.nav}
        </span>
        <StatusBanner
          error={error}
          submitting={submitting}
          submitted={submitted}
          expired={expired}
          practice={practice}
          onRetry={retry}
        />
        <QuestionsList
          sp={sp}
          answers={answers}
          onAnswer={setAnswer}
          flagged={flagged}
          onToggleFlag={toggleFlag}
          current={current}
          onFocusQuestion={setCurrent}
          disabled={locked}
          nextNav={nextNav}
          onNext={goNext}
        />
      </div>
    </ExamShell>
  );
}

export default ReadingExamRunner;
