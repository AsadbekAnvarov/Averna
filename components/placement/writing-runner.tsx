"use client";

/**
 * Placement test · Writing (optional) — one short opinion answer (120–150
 * words in 15 minutes) inside the shared CD-IELTS ExamShell: the task on the
 * left, a plain editor with a live word count on the right, the server clock
 * in the header and a "Skip Writing" button next to it.
 *
 * - No spell check / autocorrect, as in the exam. The text autosaves on this
 *   device and mirrors to `onAutosave` (the orchestrator saves it on the server).
 * - At 0:00 the runner submits by itself (`meta.auto`).
 * - A failed submission keeps every word and offers Try again.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Lightbulb, Loader2, RotateCcw, SkipForward } from "lucide-react";
import { ExamShell, FONT_STEPS, type ExamPartNav } from "@/components/exam/exam-shell";
import { MOCK_BTN, MockDialog } from "@/components/exam/mock-start-button";
import { useDeadline, useLeaveGuard } from "@/components/exam/use-exam";
import type { SubmitMeta } from "@/components/exam/types";
import type { PlacementWritingPrompt } from "@/lib/placement/types";
import { cn } from "@/lib/utils";

export interface PlacementWritingRunnerProps {
  prompt: PlacementWritingPrompt;
  attemptId: string;
  /** Absolute deadline (ms epoch, adjusted to this device's clock). */
  deadline: number;
  minutes: number;
  initialEssay?: string;
  onAutosave?: (essay: string) => void;
  onSubmit: (essay: string, meta: SubmitMeta) => Promise<void>;
  /** Skip the section (rejects with a readable message on failure). */
  onSkip: () => Promise<void>;
}

const PARTS: ExamPartNav[] = [{ title: "Writing", numbers: [1] }];
const NO_FLAGS: Set<number> = new Set();
const FONT_KEY = "averna-exam-font";
const MAX_CHARS = 6000;
const LOCAL_SAVE_MS = 400;
const FALLBACK_ERROR = "Your writing wasn't submitted. Nothing was lost — please try again.";
const NETWORK_ERROR = "We couldn't reach the server. Check your connection and try again — your text is saved on this device.";

const storageKey = (attemptId: string) => `averna-placement:writing:${attemptId}`;

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function readLocal(key: string): string {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { essay?: unknown } | null;
    return parsed && typeof parsed.essay === "string" ? parsed.essay : "";
  } catch {
    return "";
  }
}

function TaskPane({ prompt, minutes }: { prompt: PlacementWritingPrompt; minutes: number }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5 sm:px-6 sm:pt-6">
      <p className="text-[0.72em] font-bold uppercase tracking-[0.18em] text-gray-400">Writing · optional</p>
      <p className="mt-1 text-gray-300">You should spend about {minutes} minutes on this task.</p>
      <div className="mt-4 rounded-xl border border-white/15 bg-white/[0.03] p-4 leading-relaxed text-gray-100 sm:p-5">
        <p className="font-semibold text-white">{prompt.title}</p>
        <p className="mt-2">{prompt.prompt}</p>
      </div>
      <p className="mt-4 font-semibold text-white">
        Write {prompt.minWords}–{prompt.maxWords} words.
      </p>
      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="flex items-center gap-2 text-[0.8em] font-bold uppercase tracking-wider text-gray-400">
          <Lightbulb className="h-4 w-4 text-averna-neon" aria-hidden />
          How to plan it
        </p>
        <ul className="mt-2 space-y-1.5 text-[0.95em] text-gray-300">
          {prompt.tips.map((t) => (
            <li key={t} className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-averna-neon" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function PlacementWritingRunner({
  prompt,
  attemptId,
  deadline,
  minutes,
  initialEssay,
  onAutosave,
  onSubmit,
  onSkip,
}: PlacementWritingRunnerProps) {
  const key = storageKey(attemptId);
  const [essay, setEssay] = useState(initialEssay ?? "");
  const [hydrated, setHydrated] = useState(false);
  const essayRef = useRef(essay);
  essayRef.current = essay;
  const onAutosaveRef = useRef(onAutosave);
  onAutosaveRef.current = onAutosave;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const counterId = useId();
  const editorId = useId();

  // Restore this device's copy when the server has none (e.g. the last autosave didn't arrive).
  useEffect(() => {
    if (!initialEssay) {
      const local = readLocal(key);
      if (local) {
        setEssay(local);
        onAutosaveRef.current?.(local);
      }
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Local copy (cheap, quick).
  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify({ essay, savedAt: Date.now() }));
      } catch {
        /* storage full / private mode */
      }
    }, LOCAL_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [essay, hydrated, key]);

  const change = (value: string) => {
    const next = value.slice(0, MAX_CHARS);
    setEssay(next);
    onAutosaveRef.current?.(next);
  };

  // ---- submit / skip -----------------------------------------------------------
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

  const finishLocal = useCallback(() => {
    doneRef.current = true;
    busyRef.current = false;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (busyRef.current || doneRef.current) return;
      busyRef.current = true;
      setSubmitting(true);
      setError(null);
      const spent = Math.round((Date.now() - (startedAt.current || Date.now())) / 1000);
      try {
        await onSubmitRef.current(essayRef.current, { timeSpent: Math.max(0, Math.min(minutes * 60, spent)), auto });
      } catch (err) {
        setError(err instanceof TypeError ? NETWORK_ERROR : err instanceof Error && err.message ? err.message : FALLBACK_ERROR);
        setSubmitting(false);
        busyRef.current = false;
        return;
      }
      finishLocal();
      setSubmitted(true);
      setSubmitting(false);
    },
    [finishLocal, minutes]
  );
  const submitRef = useRef(submit);
  submitRef.current = submit;

  const { remainingMs, expired } = useDeadline(hydrated ? deadline : null, () => {
    if (!doneRef.current) void submitRef.current(true);
  });
  const expiredRef = useRef(expired);
  expiredRef.current = expired;
  useLeaveGuard(!submitted);

  const [skipOpen, setSkipOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState<string | null>(null);
  const skipTitleId = useId();
  const skipDescId = useId();
  const skip = async () => {
    if (busyRef.current || doneRef.current) return;
    busyRef.current = true;
    setSkipping(true);
    setSkipError(null);
    try {
      await onSkip();
    } catch (err) {
      busyRef.current = false;
      setSkipping(false);
      setSkipError(err instanceof Error && err.message ? err.message : FALLBACK_ERROR);
      return;
    }
    finishLocal();
    setSkipping(false);
    setSkipOpen(false);
    setSubmitted(true);
  };

  const locked = submitting || submitted || expired || skipping;

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

  const words = countWords(essay);
  const answered = words > 0 ? new Set([1]) : NO_FLAGS;
  const inRange = words >= prompt.minWords && words <= prompt.maxWords;
  const hint =
    words === 0
      ? `Aim for ${prompt.minWords}–${prompt.maxWords} words.`
      : words < prompt.minWords
        ? `${prompt.minWords - words} more to reach ${prompt.minWords}.`
        : inRange
          ? "A good length — leave time to check your work."
          : "That's plenty — use the time left to check your work.";
  const pct = Math.min(100, Math.round((words / prompt.maxWords) * 100));

  return (
    <>
      <ExamShell
        title="Writing"
        subtitle={`Placement test · optional · ${minutes} minutes`}
        remainingMs={remainingMs}
        parts={PARTS}
        activePart={0}
        onPartChange={() => undefined}
        answered={answered}
        flagged={NO_FLAGS}
        current={1}
        onJump={() => textareaRef.current?.focus()}
        fontScale={fontScale}
        onFontScale={changeFont}
        left={<TaskPane prompt={prompt} minutes={minutes} />}
        leftLabel="Task"
        rightLabel="Your answer"
        headerExtra={
          <button
            type="button"
            onClick={() => setSkipOpen(true)}
            disabled={locked}
            aria-haspopup="dialog"
            className="hidden min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 px-3 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:opacity-50 sm:inline-flex motion-reduce:transition-none"
          >
            <SkipForward className="h-4 w-4" aria-hidden />
            Skip Writing
          </button>
        }
        onSubmit={() => submit(expiredRef.current)}
        submitting={submitting || submitted}
        submitLabel="Finish Writing"
      >
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 pb-6 pt-5 sm:px-6 sm:pt-6">
          {error ? (
            <div role="alert" className="error-surface mb-4 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-red-200">
                    {expired ? "Time is up, but your writing hasn't been sent yet" : "Your writing wasn't submitted"}
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
          ) : submitted ? (
            <div role="status" className="mb-4 flex items-center gap-2.5 rounded-xl border border-averna-neon/25 bg-averna-neon/[0.06] px-4 py-3 text-sm text-gray-100">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
              Done — opening your result…
            </div>
          ) : submitting || expired ? (
            <div role="status" className="mb-4 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-200">
              <Loader2 className="h-4 w-4 shrink-0 text-averna-neon motion-safe:animate-spin" aria-hidden />
              {expired ? "Time is up — handing in your writing…" : "Handing in your writing…"}
            </div>
          ) : null}

          <label htmlFor={editorId} className="text-[0.8em] font-bold uppercase tracking-wider text-gray-400">
            Your answer
          </label>
          <textarea
            id={editorId}
            ref={textareaRef}
            value={essay}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => change(e.target.value)}
            disabled={locked}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            maxLength={MAX_CHARS}
            aria-describedby={counterId}
            placeholder="Start writing here…"
            className="mt-2 min-h-[16rem] w-full flex-1 resize-none rounded-xl border border-white/15 bg-surface-well/30 p-4 leading-relaxed text-white outline-none transition placeholder:text-gray-500 focus:border-averna-neon/60 focus:ring-2 focus:ring-averna-neon/20 disabled:opacity-70 motion-reduce:transition-none"
          />
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p id={counterId} className="text-gray-300">
                <span className={cn("font-semibold tabular-nums", inRange ? "text-averna-neon" : "text-white")}>{words}</span>{" "}
                {words === 1 ? "word" : "words"} · <span className="text-gray-400">{hint}</span>
              </p>
              <button
                type="button"
                onClick={() => setSkipOpen(true)}
                disabled={locked}
                aria-haspopup="dialog"
                className={cn(MOCK_BTN.ghost, "sm:hidden")}
              >
                <SkipForward className="h-4 w-4" aria-hidden />
                Skip Writing
              </button>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", inRange ? "bg-averna-neon" : "bg-averna-cyan")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </ExamShell>

      {/* Outside the shell: on tablets the answer pane can be hidden behind the Task tab. */}
      {skipOpen && (
        <MockDialog
          titleId={skipTitleId}
          descriptionId={skipDescId}
          onClose={skipping ? undefined : () => setSkipOpen(false)}
          busy={skipping}
          role="alertdialog"
        >
          <h2 id={skipTitleId} className="text-lg font-bold text-white sm:text-xl">
            Skip Writing?
          </h2>
          <p id={skipDescId} className="mt-1 text-sm leading-relaxed text-gray-300">
            {words > 0
              ? "What you've written so far won't be marked. Your level will be worked out from the other three sections."
              : "Your level will be worked out from the other three sections. Your teacher may ask you for a writing sample in class."}
          </p>
          {skipError && (
            <p role="alert" className="error-surface mt-4 rounded-xl px-3.5 py-3 text-sm text-red-100/90">
              {skipError}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-autofocus onClick={() => setSkipOpen(false)} disabled={skipping} className={MOCK_BTN.secondary}>
              Keep writing
            </button>
            <button type="button" onClick={() => void skip()} aria-disabled={skipping || undefined} className={MOCK_BTN.primary}>
              {skipping ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <SkipForward className="h-4 w-4" aria-hidden />}
              {skipping ? "Skipping…" : "Skip and see my result"}
            </button>
          </div>
        </MockDialog>
      )}
    </>
  );
}

export default PlacementWritingRunner;
