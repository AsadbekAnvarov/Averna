"use client";

/**
 * Placement test · Grammar & Vocabulary — 30 multiple-choice items in three
 * parts of ten, inside the shared CD-IELTS ExamShell: the server clock in the
 * header, the question navigator (with review flags) along the bottom, and the
 * "review before you submit" dialog.
 *
 * - Answers autosave on this device (useExamAnswers) and mirror to `onAutosave`
 *   (the orchestrator sends them to the server).
 * - At 0:00 the runner submits by itself (`meta.auto`).
 * - A failed submission keeps every answer and offers Try again.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { ExamShell, FONT_STEPS, type ExamPartNav } from "@/components/exam/exam-shell";
import { QuestionGroupView } from "@/components/exam/question-group";
import { focusQuestion, useDeadline, useExamAnswers, useLeaveGuard } from "@/components/exam/use-exam";
import type { SubmitMeta } from "@/components/exam/types";
import type { ClientGroup, ExamAnswers } from "@/lib/ielts/types";
import { answeredNumbers, rangeLabel } from "@/lib/ielts/format";

export interface GrammarRunnerProps {
  groups: ClientGroup[];
  /** Stable per-sitting id (local autosave key). */
  attemptId: string;
  /** Absolute deadline (ms epoch, adjusted to this device's clock). */
  deadline: number;
  minutes: number;
  initialAnswers?: ExamAnswers;
  onAutosave?: (answers: ExamAnswers) => void;
  onSubmit: (answers: ExamAnswers, meta: SubmitMeta) => Promise<void>;
}

const FONT_KEY = "averna-exam-font";
const FALLBACK_ERROR = "Your answers weren't submitted. Nothing was lost — please try again.";
const NETWORK_ERROR = "We couldn't reach the server. Check your connection and try again — your answers are saved on this device.";

interface Part {
  group: ClientGroup;
  numbers: number[];
  from: number;
  to: number;
  title: string;
}

const PartQuestions = memo(function PartQuestions({
  part,
  answers,
  onAnswer,
  flagged,
  onToggleFlag,
  current,
  onFocusQuestion,
  disabled,
}: {
  part: Part;
  answers: ExamAnswers;
  onAnswer: (n: number, value: string | string[]) => void;
  flagged: Set<number>;
  onToggleFlag: (n: number) => void;
  current: number | null;
  onFocusQuestion: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <QuestionGroupView
      group={part.group}
      skill="READING"
      answers={answers}
      onAnswer={onAnswer}
      flagged={flagged}
      onToggleFlag={onToggleFlag}
      current={current}
      onFocusQuestion={onFocusQuestion}
      disabled={disabled}
    />
  );
});

export function GrammarRunner({ groups, attemptId, deadline, minutes, initialAnswers, onAutosave, onSubmit }: GrammarRunnerProps) {
  const parts = useMemo(
    (): Part[] =>
      groups.map((group, i) => {
        const numbers = group.questions.map((q) => q.n);
        return { group, numbers, from: Math.min(...numbers), to: Math.max(...numbers), title: `Part ${i + 1}` };
      }),
    [groups]
  );
  const navParts = useMemo((): ExamPartNav[] => parts.map((p) => ({ title: p.title, numbers: p.numbers })), [parts]);
  const total = useMemo(() => parts.reduce((n, p) => n + p.numbers.length, 0), [parts]);

  const { answers, setAnswer, flagged, toggleFlag, hydrated, clearSaved } = useExamAnswers({
    storageKey: `averna-placement:grammar:${attemptId}`,
    initial: initialAnswers,
    onChange: onAutosave,
  });
  const answersRef = useRef<ExamAnswers>(answers);
  answersRef.current = answers;
  const answered = useMemo(() => answeredNumbers(groups, answers), [groups, answers]);

  // ---- submit ----------------------------------------------------------------
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const submit = useCallback(
    async (auto: boolean) => {
      if (busyRef.current || doneRef.current) return;
      busyRef.current = true;
      setSubmitting(true);
      setError(null);
      const spent = Math.round((Date.now() - (startedAt.current || Date.now())) / 1000);
      try {
        await onSubmitRef.current(answersRef.current, { timeSpent: Math.max(0, Math.min(minutes * 60, spent)), auto });
      } catch (err) {
        setError(err instanceof TypeError ? NETWORK_ERROR : err instanceof Error && err.message ? err.message : FALLBACK_ERROR);
        setSubmitting(false);
        busyRef.current = false;
        return;
      }
      doneRef.current = true;
      busyRef.current = false;
      clearSaved();
      setSubmitted(true);
      setSubmitting(false);
    },
    [clearSaved, minutes]
  );
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // The clock runs once saved answers are restored, so an expired section hands in what was saved.
  const { remainingMs, expired } = useDeadline(hydrated ? deadline : null, () => {
    if (!doneRef.current) void submitRef.current(true);
  });
  const expiredRef = useRef(expired);
  expiredRef.current = expired;
  useLeaveGuard(!submitted);
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

  // ---- parts + navigation ----------------------------------------------------
  const [active, setActive] = useState(0);
  const activeIdx = Math.min(active, Math.max(0, parts.length - 1));
  const [current, setCurrent] = useState<number | null>(null);
  const [focusReq, setFocusReq] = useState<{ n: number; seq: number } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const changePart = useCallback(
    (i: number) => {
      if (i < 0 || i >= parts.length) return;
      setActive(i);
      setCurrent(parts[i].numbers[0] ?? null);
      window.requestAnimationFrame(() => {
        const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        topRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      });
    },
    [parts]
  );

  const jump = useCallback(
    (n: number) => {
      const target = parts.findIndex((p) => p.numbers.includes(n));
      if (target < 0) return;
      setCurrent(n);
      setActive(target);
      setFocusReq((prev: { n: number; seq: number } | null) => ({ n, seq: (prev?.seq ?? 0) + 1 }));
    },
    [parts]
  );

  useEffect(() => {
    if (!focusReq) return;
    const id = window.requestAnimationFrame(() => focusQuestion(focusReq.n));
    return () => window.cancelAnimationFrame(id);
  }, [focusReq]);

  const part = parts[activeIdx];
  if (!part) {
    return (
      <div className="exam-shell fixed inset-0 z-[70] flex items-center justify-center bg-[#040b09] p-6">
        <p role="alert" className="text-sm text-red-200">
          This section has no questions. Please reload the page.
        </p>
      </div>
    );
  }
  const next = parts[activeIdx + 1] ?? null;

  return (
    <ExamShell
      title="Grammar & Vocabulary"
      subtitle={`Placement test · ${total} questions · ${minutes} minutes`}
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
      onSubmit={() => submit(expiredRef.current)}
      submitting={submitting || submitted}
      submitLabel="Finish section"
    >
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
        <div ref={topRef} className="scroll-mt-4" aria-hidden />
        <span className="sr-only" aria-live="polite">
          {`${part.title}, ${rangeLabel(part.from, part.to)}`}
        </span>

        {error ? (
          <div className="sticky top-0 z-10 -mx-4 mb-3 bg-[#040b09]/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
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
                onClick={() => void submit(expiredRef.current)}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300/40 bg-red-500/15 px-4 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 motion-reduce:transition-none"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Try again
              </button>
            </div>
          </div>
        ) : submitted ? (
          <div role="status" className="mb-5 flex items-center gap-2.5 rounded-xl border border-averna-neon/25 bg-averna-neon/[0.06] px-4 py-3 text-sm text-gray-100">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
            Answers submitted.
          </div>
        ) : submitting || expired ? (
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
        ) : null}

        <header className="mb-6">
          <p className="text-[0.72em] font-bold uppercase tracking-[0.18em] text-gray-400">
            {part.title} of {parts.length}
          </p>
          <p className="mt-1 text-gray-200">
            Answer <span className="font-semibold text-white">{rangeLabel(part.from, part.to)}</span>. The questions get harder as
            you go — just do your best.
          </p>
        </header>

        <PartQuestions
          part={part}
          answers={answers}
          onAnswer={setAnswer}
          flagged={flagged}
          onToggleFlag={toggleFlag}
          current={current}
          onFocusQuestion={setCurrent}
          disabled={locked}
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <p className="text-sm text-gray-400">
            {answered.size} of {total} answered
          </p>
          {next && (
            <button
              type="button"
              onClick={() => changePart(activeIdx + 1)}
              className="glow-hover inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-gray-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
            >
              Continue to {next.title}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </ExamShell>
  );
}

export default GrammarRunner;
