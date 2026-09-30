"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Clock, Loader2, RefreshCw, Scale, X } from "lucide-react";
import { ExamShell, type ExamPartNav } from "./exam-shell";
import { useDeadline, useLeaveGuard } from "./use-exam";
import type { WritingEssays, WritingExamRunnerProps } from "./types";
import { Task1Chart } from "@/components/learning/task1-chart";
import type { WritingPrompt } from "@/lib/writing-data";
import { cn } from "@/lib/utils";

/**
 * Computer-delivered IELTS Writing: Task 1 and Task 2 in one timed session
 * (60 minutes by default), inside the shared ExamShell.
 *
 * - Left pane: the task laid out like the real paper — time guidance, the boxed
 *   prompt, "Write at least N words.", then the Task 1 visual.
 * - Right pane: one plain editor per task (no spellcheck / autocorrect /
 *   autocapitalise — like the real test) with a live IELTS-style word count
 *   (whitespace-separated words) and a slim meter toward the minimum.
 * - Both essays autosave to localStorage (restored after a refresh unless the
 *   server passed text in `initial`) and mirror to `onAutosave` (~1.5 s debounce).
 * - The clock is an absolute deadline (server `deadline`, or now + minutes
 *   persisted per attempt) so a refresh can't reset it; at 0:00 the runner
 *   submits by itself (`auto: true`).
 * - A failed submission keeps every word and offers a retry.
 *
 * A new attempt needs a new `attemptId` (render with `key={attemptId}`).
 */

type TaskNo = 1 | 2;

const PARTS: ExamPartNav[] = [
  { title: "Task 1", numbers: [1] },
  { title: "Task 2", numbers: [2] },
];
const NO_FLAGS: Set<number> = new Set();
const MIN_WORDS: Record<TaskNo, number> = { 1: 150, 2: 250 };
const DEFAULT_MINUTES = 60;
/** The local copy is cheap, so it saves quickly; the server mirror waits ~1.5 s. */
const LOCAL_SAVE_MS = 400;
const LOCAL_MAX_WAIT_MS = 3000;
const REMOTE_SAVE_MS = 1500;
const REMOTE_MAX_WAIT_MS = 10000;
const SAVED_FLASH_MS = 1800;
/** Generous cap (~3,000 words) so a runaway paste can't exhaust the storage quota. */
const MAX_CHARS = 20000;

const essayStorageKey = (attemptId: string) => `averna-exam:writing:${attemptId}`;
const deadlineStorageKey = (attemptId: string) => `averna-exam-deadline:${attemptId}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** IELTS-style count: whitespace-separated words. */
function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function normalizeEssays(e?: Partial<WritingEssays> | null): WritingEssays {
  return {
    task1: typeof e?.task1 === "string" ? e.task1 : "",
    task2: typeof e?.task2 === "string" ? e.task2 : "",
  };
}

const hasText = (e: WritingEssays) => e.task1.trim() !== "" || e.task2.trim() !== "";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full / private mode — the in-memory copy still exists */
  }
}

function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

interface SavedWriting {
  essays: WritingEssays;
  active: TaskNo | null;
}

function readSaved(key: string): SavedWriting | null {
  const raw = readStorage(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { essays?: unknown; active?: unknown } | null;
    if (!parsed || typeof parsed !== "object" || !parsed.essays || typeof parsed.essays !== "object") return null;
    return {
      essays: normalizeEssays(parsed.essays as Partial<WritingEssays>),
      active: parsed.active === 1 ? 1 : parsed.active === 2 ? 2 : null,
    };
  } catch {
    return null; // corrupted storage — start clean
  }
}

function readDeadline(key: string): number | null {
  const n = Number(readStorage(key));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nearest scrolling ancestor (the shell's pane), so a task switch starts at the top. */
function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

function describeSubmitError(err: unknown): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You seem to be offline. Reconnect, then try again.";
  }
  const raw = (err instanceof Error ? err.message : typeof err === "string" ? err : "").trim();
  if (!raw || /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|abort/i.test(raw)) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (/unexpected token|not valid json|json\.parse|syntaxerror/i.test(raw)) {
    return "Something went wrong on our side. Please try again in a moment.";
  }
  return raw.length > 180 ? `${raw.slice(0, 180)}…` : raw;
}

// Prompt layout: the stored prompts carry "Write at least N words." (and, for
// Task 2, "Give reasons…") inside the text. The real paper prints those outside
// the boxed prompt, so they are lifted out; any supplementary lines after the
// word rule (data values, process stages, map changes) follow the visual.
const WORD_RULE = /^\s*(?:you should\s+)?write at least\s+\d+\s+words\.?\s*$/i;
const REASONS_RULE = /^\s*give reasons for your answer\b/i;
const DROP_RULES = [
  /^\s*you should spend about\s+\d+\s+minutes on this task\.?\s*$/i,
  /^\s*write about the following topic:?\s*$/i,
  /^\s*writing task\s*[12]\s*:?\s*$/i,
];

interface PromptParts {
  statement: string;
  afterBox: string;
  extra: string;
}

const tidy = (lines: string[]) =>
  lines
    .join("\n")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .trim();

function splitPrompt(text: string): PromptParts {
  const lines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => !DROP_RULES.some((r) => r.test(l)));
  const at = lines.findIndex((l) => WORD_RULE.test(l));
  const head = at >= 0 ? lines.slice(0, at) : lines;
  const tail = at >= 0 ? lines.slice(at + 1).filter((l) => !WORD_RULE.test(l)) : [];
  return {
    statement: tidy(head.filter((l) => !REASONS_RULE.test(l))),
    afterBox: tidy(head.filter((l) => REASONS_RULE.test(l))),
    extra: tidy(tail),
  };
}

interface Debounced {
  schedule: () => void;
  /** Run now if something is pending. */
  flush: () => void;
  /** Run now, pending or not. */
  run: () => void;
  cancel: () => void;
  pending: () => boolean;
}

/** Trailing debounce with a max wait, so non-stop typing still saves. */
function useDebounced(fn: () => void, wait: number, maxWait: number): Debounced {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<number | null>(null);
  const since = useRef<number | null>(null);
  return useMemo<Debounced>(() => {
    const cancel = () => {
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = null;
      since.current = null;
    };
    const run = () => {
      cancel();
      fnRef.current();
    };
    const flush = () => {
      if (since.current != null) run();
    };
    const schedule = () => {
      const now = Date.now();
      if (since.current == null) since.current = now;
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, Math.max(0, Math.min(wait, since.current + maxWait - now)));
    };
    return { schedule, flush, run, cancel, pending: () => since.current != null };
  }, [wait, maxWait]);
}

// ---------------------------------------------------------------------------
// Left pane — the task
// ---------------------------------------------------------------------------

interface TaskPromptProps {
  n: TaskNo;
  prompt: WritingPrompt;
  /** Suggested minutes for this task. */
  minutes: number;
  /** Practice only: show the question type (the real test doesn't label it). */
  showType: boolean;
}

const TaskPrompt = memo(function TaskPrompt({ n, prompt, minutes, showType }: TaskPromptProps) {
  const { statement, afterBox, extra } = useMemo(() => splitPrompt(prompt.prompt), [prompt.prompt]);
  const chart = n === 1 && prompt.chart && prompt.chart.length > 0 ? prompt.chart : null;
  const image = n === 1 && !chart && prompt.imageUrl ? prompt.imageUrl : null;
  const headingId = `writing-task-${n}-heading`;

  return (
    <article aria-labelledby={headingId} lang="en" className="mx-auto w-full max-w-[46rem] px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={headingId} className="text-[1.3em] font-bold tracking-tight text-white">
          Writing Task {n}
        </h2>
        {showType && prompt.type && (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[0.72em] font-semibold text-gray-400">
            {prompt.type}
          </span>
        )}
      </div>

      <p className="mt-3 leading-relaxed text-gray-200">You should spend about {minutes} minutes on this task.</p>
      {n === 2 && <p className="mt-2 leading-relaxed text-gray-200">Write about the following topic:</p>}

      {statement && (
        <div className="mt-4 whitespace-pre-wrap rounded-xl border border-white/15 bg-white/[0.035] px-4 py-4 leading-[1.75] text-gray-100 sm:px-5">
          {statement}
        </div>
      )}
      {afterBox && <p className="mt-4 whitespace-pre-wrap leading-relaxed text-gray-200">{afterBox}</p>}

      <p className="mt-4 font-semibold text-white">Write at least {MIN_WORDS[n]} words.</p>

      {n === 2 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-averna-cyan/20 bg-averna-cyan/[0.06] px-3 py-2.5 text-[0.85em] leading-snug text-gray-200">
          <Scale className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
          <span>Task 2 counts twice as much as Task 1.</span>
        </p>
      )}

      {chart && (
        <div className="mt-5">
          <Task1Chart charts={chart} />
        </div>
      )}
      {image && (
        <figure className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-[#f4f7f5] p-2 sm:p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={`Writing Task 1 visual: ${prompt.title}`}
            decoding="async"
            className="mx-auto h-auto max-h-[70vh] w-auto max-w-full"
          />
        </figure>
      )}

      {extra && (
        <div className="mt-5 whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-[0.9em] leading-relaxed text-gray-300">
          {extra}
        </div>
      )}
    </article>
  );
});

// ---------------------------------------------------------------------------
// Right pane — the editor for one task
// ---------------------------------------------------------------------------

interface EssayPaneProps {
  n: TaskNo;
  value: string;
  words: number;
  /** Suggested minutes for this task. */
  minutes: number;
  visible: boolean;
  locked: boolean;
  expired: boolean;
  onChange: (n: TaskNo, value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

const EssayPane = memo(function EssayPane({ n, value, words, minutes, visible, locked, expired, onChange, inputRef }: EssayPaneProps) {
  const min = MIN_WORDS[n];
  const reached = words >= min;
  const left = min - words;
  const pct = Math.min(100, Math.round((words / min) * 100));
  const id = `writing-answer-${n}`;

  return (
    // Both editors stay mounted (one hidden) so each keeps its caret, scroll and undo history.
    <section aria-labelledby={`${id}-label`} className={cn("min-h-0 flex-1 flex-col", visible ? "flex" : "hidden")}>
      <div className="flex items-baseline justify-between gap-3">
        <label id={`${id}-label`} htmlFor={id} className="text-[0.8em] font-semibold uppercase tracking-[0.12em] text-gray-400">
          Task {n} · Your answer
        </label>
        <span className="text-[0.75em] text-gray-500">Suggested time: {minutes} min</span>
      </div>

      {expired && (
        <p className="mt-2 flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-[0.85em] text-amber-200">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          Time is up — your answers can no longer be edited.
        </p>
      )}

      <textarea
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(n, e.target.value)}
        readOnly={locked}
        aria-describedby={`${id}-count ${id}-hint`}
        maxLength={MAX_CHARS}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        lang="en"
        dir="ltr"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        placeholder="Type your answer here…"
        className={cn(
          "mt-2 min-h-[14rem] w-full flex-1 resize-none rounded-xl border border-white/10 bg-surface-well/25 px-4 py-4 leading-[1.85] text-gray-100 caret-averna-neon outline-none sm:px-5",
          "transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
          "placeholder:text-gray-600 focus:border-averna-neon/50 focus:ring-2 focus:ring-averna-neon/20",
          locked && "cursor-default text-gray-300"
        )}
      />

      <div className="mt-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p id={`${id}-count`} className="text-[0.9em] font-semibold tabular-nums text-gray-100">
            Word count: {words}
          </p>
          <p
            id={`${id}-hint`}
            className={cn(
              "flex items-center gap-1.5 text-[0.8em]",
              reached ? "text-averna-neon/90" : words > 0 ? "text-amber-200/80" : "text-gray-500"
            )}
          >
            {reached ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden /> Minimum reached
              </>
            ) : words > 0 ? (
              `${left} more ${left === 1 ? "word" : "words"} to reach ${min}`
            ) : (
              `Aim for at least ${min} words`
            )}
          </p>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
              reached ? "bg-averna-neon/80" : "bg-averna-cyan/60"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
});

function Tally({ n, words, active }: { n: TaskNo; words: number; active: boolean }) {
  const min = MIN_WORDS[n];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", active ? "text-gray-200" : "text-gray-400")}>
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", words >= min ? "bg-averna-neon" : words > 0 ? "bg-amber-300" : "bg-white/20")}
      />
      Task {n} · <span className="font-semibold text-white">{words}</span> {words === 1 ? "word" : "words"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function WritingExamRunner(props: WritingExamRunnerProps) {
  const { task1, task2, mode, attemptId, deadline: deadlineProp, initial, onSubmit, onAutosave, exitHref } = props;
  const minutes = props.minutes && props.minutes > 0 ? props.minutes : DEFAULT_MINUTES;
  const totalMs = minutes * 60_000;
  const task1Minutes = Math.max(1, Math.round(minutes / 3));
  const task2Minutes = Math.max(1, minutes - task1Minutes);
  const storageKey = essayStorageKey(attemptId);
  const timerKey = deadlineStorageKey(attemptId);

  const [essays, setEssays] = useState<WritingEssays>(() => normalizeEssays(initial));
  const [active, setActive] = useState<TaskNo>(1);
  const [fontScale, setFontScale] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [localDeadline, setLocalDeadline] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  /** `seq` changes on every failure, so a repeated message is announced (and focused) again. */
  const [submitError, setSubmitError] = useState<{ message: string; seq: number } | null>(null);
  /** When Ctrl/Cmd+S last saved (drives the brief "Saved"). */
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // The clock starts after mount: the server render and the first client render
  // then agree (no timer), and the persisted deadline is only readable client-side.
  const deadline = hydrated ? (deadlineProp && deadlineProp > 0 ? deadlineProp : localDeadline) : null;

  const essaysRef = useRef<WritingEssays>(essays);
  const activeRef = useRef<TaskNo>(active);
  activeRef.current = active;
  const deadlineRef = useRef<number | null>(deadline);
  deadlineRef.current = deadline;
  const hydratedRef = useRef(false);
  const lockedRef = useRef(false);
  const inFlightRef = useRef(false);
  const submittedRef = useRef(false);
  const lastAutoRef = useRef(false);
  const ownsDeadlineKeyRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onAutosaveRef = useRef(onAutosave);
  onAutosaveRef.current = onAutosave;
  const text1Ref = useRef<HTMLTextAreaElement>(null);
  const text2Ref = useRef<HTMLTextAreaElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const errorSeq = useRef(0);

  const localSave = useDebounced(
    () => {
      if (!hydratedRef.current || submittedRef.current) return;
      writeStorage(storageKey, JSON.stringify({ essays: essaysRef.current, active: activeRef.current, savedAt: Date.now() }));
    },
    LOCAL_SAVE_MS,
    LOCAL_MAX_WAIT_MS
  );

  const remoteSave = useDebounced(
    () => {
      if (submittedRef.current || inFlightRef.current) return;
      onAutosaveRef.current?.({ ...essaysRef.current });
    },
    REMOTE_SAVE_MS,
    REMOTE_MAX_WAIT_MS
  );

  // Restore this attempt (server-provided text wins) and start / resume its clock.
  useEffect(() => {
    const saved = readSaved(storageKey);
    const fromServer = normalizeEssays(initial);
    const restore = !!saved && !hasText(fromServer) && hasText(saved.essays);
    const start = restore && saved ? saved.essays : fromServer;
    essaysRef.current = start;
    setEssays(start);
    setActive(saved?.active ?? 1);
    if (restore) remoteSave.schedule(); // mirror the recovered copy to the server

    if (deadlineProp && deadlineProp > 0) {
      ownsDeadlineKeyRef.current = false;
    } else {
      ownsDeadlineKeyRef.current = true;
      const now = Date.now();
      const stored = readDeadline(timerKey);
      let dl = stored;
      if (dl != null && dl > now + totalMs) dl = now + totalMs; // never more than one full session away
      if (dl != null && dl <= now && !hasText(start)) dl = null; // abandoned blank attempt: fresh clock
      if (dl == null) dl = now + totalMs;
      if (dl !== stored) writeStorage(timerKey, String(dl));
      setLocalDeadline(dl);
    }

    submittedRef.current = false;
    setSubmitted(false);
    setSubmitError(null);
    hydratedRef.current = true;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (inFlightRef.current || submittedRef.current) return; // double-submit guard
      inFlightRef.current = true;
      lastAutoRef.current = auto;
      setSubmitting(true);
      // A previous error stays up during a retry, so focus stays on "Try again".
      localSave.flush();
      const hadRemote = remoteSave.pending();
      remoteSave.cancel();

      const snapshot: WritingEssays = { ...essaysRef.current };
      const now = Date.now();
      const dl = deadlineRef.current;
      const elapsedMs = dl ? now - (dl - totalMs) : now - mountedAtRef.current;
      const timeSpent = Math.round(Math.min(totalMs, Math.max(0, elapsedMs)) / 1000);

      try {
        await onSubmitRef.current(snapshot, { timeSpent, auto });
        submittedRef.current = true;
        localSave.cancel();
        removeStorage(storageKey);
        if (ownsDeadlineKeyRef.current) removeStorage(timerKey);
        setSubmitError(null);
        setSubmitted(true);
      } catch (err) {
        errorSeq.current += 1;
        setSubmitError({ message: describeSubmitError(err), seq: errorSeq.current });
        if (hadRemote) remoteSave.schedule();
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [storageKey, timerKey, totalMs, localSave, remoteSave]
  );

  const handleExpire = useCallback(() => {
    void submit(true);
  }, [submit]);

  const { remainingMs, expired } = useDeadline(deadline, handleExpire);
  const locked = expired || submitting || submitted;
  lockedRef.current = locked;

  const words1 = useMemo(() => countWords(essays.task1), [essays.task1]);
  const words2 = useMemo(() => countWords(essays.task2), [essays.task2]);
  const has1 = words1 > 0;
  const has2 = words2 > 0;
  const answered = useMemo(() => {
    const s = new Set<number>();
    if (has1) s.add(1);
    if (has2) s.add(2);
    return s;
  }, [has1, has2]);

  useLeaveGuard(hydrated && (has1 || has2) && !submitting && !submitted);

  const handleChange = useCallback(
    (n: TaskNo, value: string) => {
      if (lockedRef.current) return;
      const prev = essaysRef.current;
      const before = n === 1 ? prev.task1 : prev.task2;
      if (before === value) return;
      const next: WritingEssays = n === 1 ? { ...prev, task1: value } : { ...prev, task2: value };
      essaysRef.current = next;
      setEssays(next);
      localSave.schedule();
      remoteSave.schedule();
      const min = MIN_WORDS[n];
      if (countWords(before) < min && countWords(value) >= min) {
        setAnnouncement(`Task ${n}: ${min}-word minimum reached.`);
      }
    },
    [localSave, remoteSave]
  );

  // Focus after the commit — the shell may be revealing the editor pane in the same update.
  const focusEditor = useCallback((n: TaskNo) => {
    window.requestAnimationFrame(() => (n === 1 ? text1Ref : text2Ref).current?.focus());
  }, []);

  const switchTask = useCallback(
    (n: TaskNo) => {
      setActive(n);
      activeRef.current = n;
      localSave.schedule(); // remember the open task across a refresh
      focusEditor(n);
    },
    [localSave, focusEditor]
  );
  const onPartChange = useCallback((i: number) => switchTask(i === 1 ? 2 : 1), [switchTask]);
  const onJump = useCallback((n: number) => switchTask(n === 2 ? 2 : 1), [switchTask]);

  // Each task's prompt starts at the top.
  useEffect(() => {
    const pane = scrollParentOf(leftRef.current);
    if (pane) pane.scrollTop = 0;
  }, [active]);

  const submitFromShell = useCallback(() => submit(false), [submit]);
  const retry = useCallback(() => {
    void submit(lastAutoRef.current);
  }, [submit]);

  // Move focus to "Try again" once the review dialog has closed.
  useEffect(() => {
    if (!submitError) return;
    const t = window.setTimeout(() => retryRef.current?.focus(), 150);
    return () => window.clearTimeout(t);
  }, [submitError]);

  // A timed-out submission that failed offline retries by itself on reconnect.
  useEffect(() => {
    if (!submitError || !lastAutoRef.current) return;
    const onOnline = () => {
      void submit(true);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [submitError, submit]);

  // Ctrl/Cmd+S: save now and say so, instead of the browser's "Save page" dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const key = typeof e.key === "string" ? e.key.toLowerCase() : "";
      if (key !== "s" && e.code !== "KeyS") return;
      e.preventDefault();
      if (submittedRef.current) return;
      localSave.run();
      remoteSave.flush();
      setSavedAt(Date.now());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [localSave, remoteSave]);

  // Each save restarts the "Saved" window.
  useEffect(() => {
    if (savedAt == null) return;
    const t = window.setTimeout(() => setSavedAt(null), SAVED_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  // Don't lose the last keystrokes when the tab is hidden, closed or refreshed.
  useEffect(() => {
    const onPageHide = () => localSave.flush();
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      localSave.flush();
      remoteSave.flush();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [localSave, remoteSave]);

  // Unmount (e.g. "Leave"): write out anything pending, unless already submitted.
  useEffect(
    () => () => {
      if (submittedRef.current) {
        localSave.cancel();
        remoteSave.cancel();
        return;
      }
      localSave.flush();
      remoteSave.flush();
    },
    [localSave, remoteSave]
  );

  const showType = mode === "practice";
  const leftPane = (
    <div ref={leftRef}>
      {active === 1 ? (
        <TaskPrompt n={1} prompt={task1} minutes={task1Minutes} showType={showType} />
      ) : (
        <TaskPrompt n={2} prompt={task2} minutes={task2Minutes} showType={showType} />
      )}
    </div>
  );

  const editor = (
    <div className="flex min-h-full flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <EssayPane
        n={1}
        value={essays.task1}
        words={words1}
        minutes={task1Minutes}
        visible={active === 1}
        locked={locked}
        expired={expired}
        onChange={handleChange}
        inputRef={text1Ref}
      />
      <EssayPane
        n={2}
        value={essays.task2}
        words={words2}
        minutes={task2Minutes}
        visible={active === 2}
        locked={locked}
        expired={expired}
        onChange={handleChange}
        inputRef={text2Ref}
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );

  const status = submitted ? (
    <span className="inline-flex items-center gap-1.5 text-averna-neon">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Submitted
    </span>
  ) : submitting ? (
    <span className="inline-flex items-center gap-1.5 text-gray-300">
      <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> Submitting…
    </span>
  ) : savedAt != null ? (
    <span className="inline-flex items-center gap-1.5 text-averna-neon">
      <Check className="h-3.5 w-3.5" aria-hidden /> Saved
    </span>
  ) : expired ? (
    <span className="inline-flex items-center gap-1.5 text-amber-200">
      <Clock className="h-3.5 w-3.5" aria-hidden /> Time is up
    </span>
  ) : null;

  const footer = (
    <div className="px-3 py-2 sm:px-5">
      {submitError && (
        <div role="alert" className="error-surface mb-2 flex flex-col gap-3 rounded-xl px-3 py-3 sm:flex-row sm:items-center sm:px-4">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-200">Your essays weren&apos;t submitted.</p>
              {/* Re-keyed per failure so a repeated message is announced again. */}
              <p key={submitError.seq} className="mt-0.5 text-xs leading-relaxed text-red-100/80">
                {submitError.message} Your text is safe — nothing has been lost.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* aria-disabled (not disabled) so keyboard focus stays here while retrying; the submit guard ignores extra clicks. */}
            <button
              ref={retryRef}
              type="button"
              onClick={retry}
              aria-disabled={submitting || undefined}
              className="glow-cta inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-averna-primary px-4 text-sm font-semibold text-white transition hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 aria-disabled:cursor-wait aria-disabled:opacity-60 motion-reduce:transition-none sm:flex-none"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Try again
            </button>
            {!expired && (
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  focusEditor(activeRef.current);
                }}
                aria-label="Dismiss this message"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-red-100/80 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/50 motion-reduce:transition-none"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="flex min-h-[1.75rem] items-center justify-between gap-3 text-xs sm:text-[0.8125rem]">
        <p className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-0.5 tabular-nums">
          <Tally n={1} words={words1} active={active === 1} />
          <Tally n={2} words={words2} active={active === 2} />
        </p>
        <p role="status" className="shrink-0">
          {status}
        </p>
      </div>
    </div>
  );

  return (
    <ExamShell
      title="IELTS Writing"
      subtitle={`${mode === "mock" ? "Mock exam" : "Practice test"} · Task 1 + Task 2 · ${minutes} minutes`}
      remainingMs={remainingMs}
      parts={PARTS}
      activePart={active - 1}
      onPartChange={onPartChange}
      answered={answered}
      flagged={NO_FLAGS}
      current={active}
      onJump={onJump}
      fontScale={fontScale}
      onFontScale={setFontScale}
      left={leftPane}
      leftLabel={`Task ${active}`}
      rightLabel="Your answer"
      footerExtra={footer}
      onSubmit={submitFromShell}
      submitting={submitting || submitted}
      submitLabel="Submit"
      exitHref={exitHref}
    >
      {editor}
    </ExamShell>
  );
}

export default WritingExamRunner;
