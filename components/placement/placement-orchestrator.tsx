"use client";

/**
 * The placement test in the browser: Grammar & Vocabulary → Listening →
 * Reading → Writing (optional), with a short rules screen before each section.
 * The server owns the sitting (lib/placement/placement.ts): it runs each
 * section's clock and marks a section the moment it is submitted. This
 * component:
 *
 * - shows the progress rail and, before each section, its rules and a Start
 *   button (POST /api/placement/{id}/begin → refresh → the section's runner);
 *   Writing can be skipped from its rules screen or from inside the runner;
 * - renders the runner, keyed per section so every section starts clean:
 *   our Grammar & Vocabulary and Writing runners, and the exam's Listening and
 *   Reading runners in mode="mock" (recording once, server deadline);
 * - mirrors answers to the server (POST …/save): changes are coalesced for
 *   ~4 s, saves never overlap, and anything pending is flushed with keepalive
 *   when the tab is hidden or closed. Failures stay silent — the runners keep
 *   their own local copy;
 * - submits the section (POST …/section). Writing may be marked by the AI
 *   examiner, so a calm "Marking…" overlay covers the wait; a failure rejects
 *   `onSubmit`, so the runner keeps everything and offers Try again (retries
 *   are idempotent on the server);
 * - watches the server clock for Listening, which has no clock of its own.
 *
 * No scores are shown until the result page.
 */

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Flag,
  Headphones,
  Highlighter,
  Loader2,
  LogOut,
  PenLine,
  Play,
  RotateCcw,
  SkipForward,
  SpellCheck,
  Timer,
  Volume2,
} from "lucide-react";
import type { ExamAnswers } from "@/lib/ielts/types";
import type { PlacementDraft, PlacementSection, PlacementSectionView, PlacementStage, PlacementView } from "@/lib/placement/types";
import { GRACE_MS, PLACEMENT_HUB_HREF, SECTION_TITLE, placementResultHref } from "@/lib/placement/config";
import { cn } from "@/lib/utils";
import { ListeningExamRunner } from "@/components/exam/listening-exam-runner";
import { ReadingExamRunner } from "@/components/exam/reading-exam-runner";
import { MOCK_BTN, MockDialog, postJson } from "@/components/exam/mock-start-button";
import { GrammarRunner } from "./grammar-runner";
import { PlacementWritingRunner } from "./writing-runner";
import { PlacementLeaveButton, leavePlacement } from "./placement-actions";
import { SectionIcon } from "./section-icon";

type RunningStage = Extract<PlacementStage, { kind: "running" }>;
type IntroStage = Extract<PlacementStage, { kind: "intro" }>;

/** Answers are coalesced this long before a save goes out. */
const AUTOSAVE_MS = 4000;
/** Browsers cap keepalive request bodies at 64 KB. */
const KEEPALIVE_MAX_BYTES = 60_000;
/** Listening has no clock of its own: its answers are collected this long before the server stops taking them. */
const COLLECT_MARGIN_MS = 20_000;
const OBJECTIVE_TIMEOUT_MS = 45_000;
/** Writing may go to the AI examiner (the route may run for up to 60 s). */
const MARKED_TIMEOUT_MS = 95_000;
/** Smaller gaps between this device's clock and the server's are just network latency. */
const CLOCK_SKEW_MIN_MS = 3000;
/** When the next screen hasn't arrived by then, offer a manual way on. */
const STUCK_AFTER_MS = 12_000;

const RUNNER_SUFFIX: Record<PlacementSection, string> = { GRAMMAR: "G", LISTENING: "L", READING: "R", WRITING: "W" };

type Icon = typeof Clock;

const SECTION_INFO: Record<PlacementSection, { rules: { icon: Icon; text: string }[]; clock: string; start: string }> = {
  GRAMMAR: {
    rules: [
      { icon: SpellCheck, text: "30 multiple-choice questions in three parts. They start easy and get harder — that's how the test finds your level." },
      { icon: Timer, text: "15 minutes for the whole section. At 0:00 your answers are submitted automatically." },
      { icon: Flag, text: "Move between questions with the navigator at the bottom, and flag any you want to come back to." },
      { icon: CheckCircle2, text: "Don't worry if the last questions feel hard — nobody is expected to know everything." },
    ],
    clock: "The 15-minute clock starts as soon as you press Start.",
    start: "Start Grammar & Vocabulary",
  },
  LISTENING: {
    rules: [
      { icon: Volume2, text: "You'll hear one phone conversation, ONCE. There's no pause or replay." },
      { icon: PenLine, text: "10 questions: complete a form, then choose A, B or C. Answer while you listen." },
      { icon: Clock, text: "When the recording ends you have 2 minutes to check your answers, then the section is submitted automatically." },
      { icon: Headphones, text: "Use headphones, and play the sound check on the next screen to set a comfortable volume." },
    ],
    clock: "The section clock starts when you press Start. On the next screen, press “Start the test” to play the recording.",
    start: "Start Listening",
  },
  READING: {
    rules: [
      { icon: BookOpen, text: "One short article (about 500 words) and 12 questions." },
      { icon: Timer, text: "15 minutes. Read the questions first, then look for the answers in the text." },
      { icon: Highlighter, text: "You can highlight the text and flag questions to come back to." },
      { icon: Clock, text: "At 0:00 your answers are submitted automatically." },
    ],
    clock: "The 15-minute clock starts as soon as you press Start.",
    start: "Start Reading",
  },
  WRITING: {
    rules: [
      { icon: PenLine, text: "Write 120–150 words giving your opinion on a simple question about learning languages." },
      { icon: Timer, text: "15 minutes. Your text saves as you type, and at 0:00 it is handed in automatically." },
      { icon: SpellCheck, text: "Spell check is off — we want to see your own English." },
      { icon: SkipForward, text: "Writing is optional. If you skip it, your level comes from the other three sections." },
    ],
    clock: "The 15-minute clock starts as soon as you press Start.",
    start: "Start Writing",
  },
};

function minutesLabel(s: PlacementSectionView): string {
  if (s.section === "LISTENING") return `about ${s.minutes} min`;
  if (s.section === "WRITING") return `${s.minutes} min · optional`;
  return `${s.minutes} min`;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/** A `{ "14": "B" }` record → answers (undefined when empty). */
function answersOf(raw: unknown): ExamAnswers | undefined {
  const src = asRec(raw);
  if (!src) return undefined;
  const out: ExamAnswers = {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return Object.keys(out).length ? out : undefined;
}

function draftAnswers(draft: PlacementDraft | null | undefined): ExamAnswers | undefined {
  return answersOf(draft?.answers);
}

// ---------------------------------------------------------------------------
// One section's session: submission state + the autosave queue
// ---------------------------------------------------------------------------

interface SaveQueue {
  pending: { draft: unknown } | null;
  timer: number;
  inFlight: boolean;
  /** A save was due while another was in flight — send the latest draft when it returns. */
  again: boolean;
  /** Submitting: hold new saves. */
  paused: boolean;
  /** Section over: drop everything. */
  closed: boolean;
  /** The runner is unmounting / the page is going away: send immediately. */
  detached: boolean;
}

interface Session {
  key: string;
  attemptId: string;
  index: number;
  section: PlacementSection;
  running: boolean;
  initialAnswers?: ExamAnswers;
  initialEssay?: string;
  /** Latest draft the runner reported (or the server's copy) — collected if the clock runs out. */
  latest: unknown;
  inFlight: Promise<void> | null;
  done: boolean;
  /** The server clock ran out and the answers were collected: the runner is gone for good. */
  collected: boolean;
  /** When this page started watching the clock (Listening). */
  watchFrom: number | null;
  saves: SaveQueue;
}

function sessionKeyOf(view: PlacementView): string {
  const s = view.stage;
  return s.kind === "intro" || s.kind === "running" ? `${view.attemptId}:${s.kind}:${s.index}` : `${view.attemptId}:${s.kind}`;
}

function createSession(view: PlacementView, key: string): Session {
  const stage = view.stage;
  const running = stage.kind === "running";
  const section: PlacementSection = stage.kind === "intro" || stage.kind === "running" ? stage.section : "GRAMMAR";
  const draft = running ? stage.draft : null;
  return {
    key,
    attemptId: view.attemptId,
    index: stage.kind === "intro" || stage.kind === "running" ? stage.index : -1,
    section,
    running,
    initialAnswers: running && section !== "WRITING" ? draftAnswers(draft) : undefined,
    initialEssay: running && section === "WRITING" && typeof draft?.essay === "string" && draft.essay ? draft.essay : undefined,
    latest: draft ? (section === "WRITING" ? { essay: draft.essay ?? "" } : { answers: draft.answers ?? {} }) : null,
    inFlight: null,
    done: false,
    collected: false,
    watchFrom: null,
    saves: { pending: null, timer: 0, inFlight: false, again: false, paused: false, closed: !running, detached: false },
  };
}

/** Device clock minus server clock (0 when it's within network latency or unknown). */
function clockSkew(serverNow: number | undefined): number {
  if (typeof serverNow !== "number" || !Number.isFinite(serverNow)) return 0;
  const d = Date.now() - serverNow;
  return Math.abs(d) >= CLOCK_SKEW_MIN_MS ? d : 0;
}

function byteLength(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length * 3;
  }
}

function clearSaveTimer(q: SaveQueue) {
  if (q.timer) window.clearTimeout(q.timer);
  q.timer = 0;
}

/** Send the pending draft. `urgent` (tab hidden / closing): right away, with keepalive. */
function sendSave(s: Session, urgent: boolean): void {
  const q = s.saves;
  clearSaveTimer(q);
  if (q.closed || !q.pending) return;
  if (q.inFlight && !urgent) {
    q.again = true;
    return;
  }
  const { draft } = q.pending;
  q.pending = null;
  let body: string;
  try {
    body = JSON.stringify({ section: s.index, draft });
  } catch {
    return;
  }
  q.inFlight = true;
  fetch(`/api/placement/${encodeURIComponent(s.attemptId)}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: urgent && byteLength(body) <= KEEPALIVE_MAX_BYTES,
  })
    .catch(() => undefined) // silent: the runner keeps a local copy, and the next change saves again
    .then(() => {
      q.inFlight = false;
      if (!q.again) return;
      q.again = false;
      if (q.pending && !q.paused && !q.closed) sendSave(s, false);
    });
}

function scheduleSave(s: Session) {
  const q = s.saves;
  if (q.timer || q.paused || q.closed || !q.pending) return;
  q.timer = window.setTimeout(() => {
    q.timer = 0;
    sendSave(s, false);
  }, AUTOSAVE_MS);
}

/** The runner reported new work. May be called from inside a state updater — it only queues. */
function queueSave(s: Session, draft: unknown) {
  s.latest = draft;
  const q = s.saves;
  if (q.closed) return;
  q.pending = { draft };
  if (q.detached) sendSave(s, true);
  else scheduleSave(s);
}

function pauseSaves(s: Session) {
  s.saves.paused = true;
  clearSaveTimer(s.saves);
}

function resumeSaves(s: Session) {
  s.saves.paused = false;
  scheduleSave(s);
}

function closeSaves(s: Session) {
  const q = s.saves;
  q.closed = true;
  q.pending = null;
  clearSaveTimer(q);
}

function flushSaves(s: Session) {
  if (!s.saves.paused) sendSave(s, true);
}

class SectionSubmitError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "SectionSubmitError";
    this.status = status;
  }
}

type Overlay =
  | { kind: "marking" }
  | { kind: "advancing"; section: PlacementSection; done: boolean }
  | { kind: "timeup"; section: PlacementSection; busy: boolean; error: string | null }
  | { kind: "fatal"; message: string };

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function PlacementOrchestrator({ view, serverNow }: { view: PlacementView; serverNow?: number }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const stage = view.stage;
  const key = sessionKeyOf(view);

  // One session per stage, created during render so a runner that submits while
  // mounting (an already expired clock) never sees the previous section's state.
  const sessionsRef = useRef<Map<string, Session>>(new Map());
  let session: Session | undefined = sessionsRef.current.get(key);
  if (!session) {
    session = createSession(view, key);
    sessionsRef.current.set(key, session);
  }
  const s0: Session = session;
  const latestKeyRef = useRef(key);
  latestKeyRef.current = key;

  const [overlayState, setOverlayState] = useState<{ key: string; overlay: Overlay } | null>(null);
  const overlay: Overlay | null = overlayState && overlayState.key === key ? overlayState.overlay : null;
  const show = useCallback((s: Session, next: Overlay | null) => {
    if (s.key !== latestKeyRef.current) return; // a finished section's late news
    setOverlayState(next ? { key: s.key, overlay: next } : null);
  }, []);

  // This device's clock vs the server's, so the runners' clocks match the server deadline.
  const [skew, setSkew] = useState(() => (typeof window === "undefined" ? 0 : clockSkew(serverNow)));
  useEffect(() => {
    setSkew(clockSkew(serverNow));
  }, [serverNow]);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const finish = useCallback(
    (s: Session, done: boolean) => {
      s.done = true;
      closeSaves(s);
      show(s, { kind: "advancing", section: s.section, done });
      if (done) router.push(placementResultHref(s.attemptId));
      else refresh();
    },
    [router, refresh, show]
  );

  /**
   * Submit the section. Resolves when it's saved (the next screen is on its way);
   * rejects with a readable message. `collecting`: the time-up overlay owns the screen.
   */
  const submit = useCallback(
    (s: Session, payload: Record<string, unknown>, collecting = false): Promise<void> => {
      if (s.done) return Promise.resolve();
      if (s.inFlight) return s.inFlight; // the runner's auto-submit racing a click, or our own collection
      const marked = s.section === "WRITING" && payload.skip !== true;
      pauseSaves(s);
      if (marked && !collecting) show(s, { kind: "marking" });
      const run = async () => {
        const r = await postJson(
          `/api/placement/${encodeURIComponent(s.attemptId)}/section`,
          { section: s.index, payload },
          {
            timeoutMs: marked ? MARKED_TIMEOUT_MS : OBJECTIVE_TIMEOUT_MS,
            timeoutMessage: marked
              ? "Marking is taking longer than usual. Press Try again in a moment — if your writing was already marked, you'll move straight on."
              : undefined,
            fallback: "This section wasn't submitted. Please try again.",
          }
        );
        if (r.ok && r.data?.ok === true) {
          finish(s, r.data.done === true);
          return;
        }
        if (r.status === 409) {
          // Already marked, or this screen is out of date (e.g. another tab) — reload the test.
          finish(s, false);
          return;
        }
        resumeSaves(s);
        if (r.status === 410) show(s, { kind: "fatal", message: r.error });
        else if (marked && !collecting) show(s, null);
        throw new SectionSubmitError(r.error, r.status);
      };
      const p = run();
      s.inFlight = p;
      p.then(
        () => {
          s.inFlight = null;
        },
        () => {
          s.inFlight = null;
        }
      );
      return p;
    },
    [finish, show]
  );

  /** Listening's server clock ran out: hand in what we have. */
  const collect = useCallback(
    (s: Session) => {
      if (s.done) return;
      s.collected = true;
      show(s, { kind: "timeup", section: s.section, busy: true, error: null });
      submit(s, { answers: answersOf(asRec(s.latest)?.answers) ?? {} }, true).catch((err: unknown) => {
        if (err instanceof SectionSubmitError && err.status === 410) return; // the fatal overlay is up
        show(s, {
          kind: "timeup",
          section: s.section,
          busy: false,
          error: err instanceof Error && err.message ? err.message : "Please try again.",
        });
      });
    },
    [show, submit]
  );

  // Autosave plumbing for the running section.
  useEffect(() => {
    const s = s0;
    if (!s.running) return;
    s.saves.detached = false;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSaves(s);
    };
    const onPageHide = () => flushSaves(s);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    // A reload requests the new page before the old one fires pagehide — send pending work first.
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      // Leaving mid-section: send what's pending now, and whatever the runner reports while unmounting.
      s.saves.detached = true;
      flushSaves(s);
    };
  }, [s0]);

  // The Listening runner has no deadline prop — watch the server clock for it: give the student every
  // second the server still accepts (the grace period also covers the runner's own late auto-submit);
  // a section opened after its clock ran out is collected at once.
  const runningDeadline = stage.kind === "running" ? stage.deadline : null;
  useEffect(() => {
    const s = s0;
    if (!s.running || runningDeadline == null || s.section !== "LISTENING") return;
    if (s.watchFrom == null) s.watchFrom = Date.now();
    const deadline = runningDeadline + skew;
    const fireAt = s.watchFrom >= deadline ? 0 : deadline + GRACE_MS - COLLECT_MARGIN_MS;
    let fired = false;
    const check = () => {
      if (fired || s.done || s.inFlight || Date.now() < fireAt) return;
      fired = true;
      collect(s);
    };
    check();
    const id = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [s0, runningDeadline, skew, collect]);

  // Runner callbacks, bound to this section's session.
  const onAnswersAutosave = useCallback((answers: ExamAnswers) => queueSave(s0, { answers }), [s0]);
  const onAnswersSubmit = useCallback((answers: ExamAnswers) => submit(s0, { answers }), [s0, submit]);
  const onEssayAutosave = useCallback((essay: string) => queueSave(s0, { essay }), [s0]);
  const onEssaySubmit = useCallback((essay: string) => submit(s0, { essay }), [s0, submit]);
  const onSkipWriting = useCallback(() => submit(s0, { skip: true }), [s0, submit]);

  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);
    const r = await leavePlacement(view.attemptId);
    if (!r.ok) {
      setLeaving(false);
      setLeaveError(r.error);
      return;
    }
    router.push(PLACEMENT_HUB_HREF);
    router.refresh();
  };

  if (stage.kind === "intro") {
    return <IntroScreen key={key} view={view} stage={stage} refreshing={refreshing} onBegun={refresh} />;
  }
  if (stage.kind !== "running") return <Redirecting view={view} />;

  const next = view.sections[stage.index + 1]?.title ?? null;

  return (
    <>
      {/* Time is up: the answers are collected, so the runner goes (and with it the recording). */}
      {s0.collected ? (
        <div aria-hidden className="exam-shell fixed inset-0 z-[70] bg-[#040b09]" />
      ) : (
        <SectionRunner
          stage={stage}
          attemptId={view.attemptId}
          deadline={stage.deadline + skew}
          session={s0}
          onAnswersAutosave={onAnswersAutosave}
          onAnswersSubmit={onAnswersSubmit}
          onEssayAutosave={onEssayAutosave}
          onEssaySubmit={onEssaySubmit}
          onSkipWriting={onSkipWriting}
        />
      )}
      {overlay && (
        <OverlayView
          overlay={overlay}
          next={next}
          attemptId={view.attemptId}
          onCollect={() => collect(s0)}
          onDismiss={() => show(s0, null)}
          onLeave={() => void leave()}
          leaving={leaving}
          leaveError={leaveError}
        />
      )}
    </>
  );
}

export default PlacementOrchestrator;

// ---------------------------------------------------------------------------
// Runner switch
// ---------------------------------------------------------------------------

function SectionRunner({
  stage,
  attemptId,
  deadline,
  session,
  onAnswersAutosave,
  onAnswersSubmit,
  onEssayAutosave,
  onEssaySubmit,
  onSkipWriting,
}: {
  stage: RunningStage;
  attemptId: string;
  deadline: number;
  session: Session;
  onAnswersAutosave: (answers: ExamAnswers) => void;
  onAnswersSubmit: (answers: ExamAnswers) => Promise<void>;
  onEssayAutosave: (essay: string) => void;
  onEssaySubmit: (essay: string) => Promise<void>;
  onSkipWriting: () => Promise<void>;
}) {
  // Keyed per section: every section mounts a fresh runner (answers, clock, audio).
  const runnerKey = `${attemptId}:${stage.index}`;
  const runnerId = `${attemptId}-${RUNNER_SUFFIX[stage.section]}`;
  const c = stage.content;
  switch (c.section) {
    case "GRAMMAR":
      return (
        <GrammarRunner
          key={runnerKey}
          groups={c.groups}
          attemptId={runnerId}
          deadline={deadline}
          minutes={c.minutes}
          initialAnswers={session.initialAnswers}
          onAutosave={onAnswersAutosave}
          onSubmit={onAnswersSubmit}
        />
      );
    case "LISTENING":
      return (
        <ListeningExamRunner
          key={runnerKey}
          test={c.test}
          mode="mock"
          examName="Placement test"
          attemptId={runnerId}
          initialAnswers={session.initialAnswers}
          onAutosave={onAnswersAutosave}
          onSubmit={onAnswersSubmit}
        />
      );
    case "READING":
      return (
        <ReadingExamRunner
          key={runnerKey}
          test={c.test}
          mode="mock"
          attemptId={runnerId}
          minutes={c.minutes}
          deadline={deadline}
          initialAnswers={session.initialAnswers}
          onAutosave={onAnswersAutosave}
          onSubmit={onAnswersSubmit}
        />
      );
    case "WRITING":
      return (
        <PlacementWritingRunner
          key={runnerKey}
          prompt={c.prompt}
          attemptId={runnerId}
          deadline={deadline}
          minutes={c.minutes}
          initialEssay={session.initialEssay}
          onAutosave={onEssayAutosave}
          onSubmit={onEssaySubmit}
          onSkip={onSkipWriting}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Progress rail
// ---------------------------------------------------------------------------

function ProgressRail({ sections }: { sections: PlacementSectionView[] }) {
  return (
    <nav aria-label="Placement test progress">
      <ol role="list" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sections.map((s) => {
          const done = s.status === "done";
          const current = s.status === "current";
          return (
            <li
              key={s.section}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-3 py-3",
                done
                  ? "border-averna-neon/25 bg-averna-neon/[0.05]"
                  : current
                    ? "border-averna-neon/50 bg-averna-neon/[0.08] shadow-[0_0_24px_-12px_rgba(0,255,148,0.6)]"
                    : "border-white/10 bg-white/[0.02]"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                  done
                    ? "bg-averna-neon text-averna-dark"
                    : current
                      ? "border-2 border-averna-neon text-averna-neon"
                      : "border border-white/15 text-gray-500"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : s.index + 1}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-sm font-semibold", done || current ? "text-white" : "text-gray-400")}>{s.title}</span>
                <span className="block truncate text-xs text-gray-500">{done ? (s.skipped ? "Skipped" : "Done") : minutesLabel(s)}</span>
              </span>
              <span className="sr-only">{done ? (s.skipped ? "(skipped)" : "(completed)") : current ? "(current section)" : "(not started yet)"}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Rules / break screen
// ---------------------------------------------------------------------------

function IntroScreen({
  view,
  stage,
  refreshing,
  onBegun,
}: {
  view: PlacementView;
  stage: IntroStage;
  refreshing: boolean;
  onBegun: () => void;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipTitleId = useId();
  const skipDescId = useId();
  const info = SECTION_INFO[stage.section];
  const total = view.sections.length;
  const current = view.sections[stage.index];
  const previous = stage.index > 0 ? view.sections[stage.index - 1] : null;
  const title = current?.title ?? SECTION_TITLE[stage.section];
  const busy = starting || skipping || refreshing;
  const writing = stage.section === "WRITING";

  // A section just ended (its runner covered the page): start the break screen at the top, focus on its heading.
  useEffect(() => {
    if (stage.index === 0) return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [stage.index]);

  const begin = async () => {
    if (busy) return;
    setStarting(true);
    setError(null);
    const r = await postJson(
      `/api/placement/${encodeURIComponent(view.attemptId)}/begin`,
      { section: stage.index },
      { timeoutMs: 30_000, fallback: "The section couldn't be started. Please try again." }
    );
    setStarting(false);
    // 409: this screen is out of date (the section already started or ended) — the refresh shows where things are.
    if ((r.ok && r.data?.ok === true) || r.status === 409) {
      onBegun();
      return;
    }
    setError(r.error);
  };

  const skip = async () => {
    if (busy) return;
    setSkipping(true);
    setError(null);
    const r = await postJson(
      `/api/placement/${encodeURIComponent(view.attemptId)}/section`,
      { section: stage.index, payload: { skip: true } },
      { timeoutMs: 45_000, fallback: "Writing couldn't be skipped. Please try again." }
    );
    if (r.ok && r.data?.ok === true) {
      if (r.data.done === true) router.push(placementResultHref(view.attemptId));
      else onBegun();
      return;
    }
    setSkipping(false);
    if (r.status === 409) {
      onBegun();
      return;
    }
    setSkipOpen(false);
    setError(r.error);
  };

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl px-4 py-6 pb-24 sm:py-8 lg:pb-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">Placement test</p>
            <p className="mt-0.5 text-sm text-gray-400">
              Section {stage.index + 1} of {total}
            </p>
          </div>
          <PlacementLeaveButton attemptId={view.attemptId} redirectTo={PLACEMENT_HUB_HREF} />
        </header>

        <ProgressRail sections={view.sections} />

        {previous && (
          <div
            role="status"
            className="mt-5 flex items-start gap-3 rounded-2xl border border-averna-neon/25 bg-averna-neon/[0.06] p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold text-white">{previous.title} complete.</p>
              <p className="mt-0.5 text-sm text-gray-300">Take a breath — {title} starts when you press Start.</p>
            </div>
          </div>
        )}

        <section
          aria-labelledby="placement-section-title"
          className="av-panel av-panel-hero mt-5 rounded-3xl p-5 sm:p-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
        >
          <div className="flex items-start gap-4">
            <SectionIcon section={stage.section} className="h-12 w-12 rounded-2xl" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">
                Section {stage.index + 1}
                {current ? ` · ${minutesLabel(current)}` : ""}
              </p>
              <h1
                id="placement-section-title"
                ref={headingRef}
                tabIndex={-1}
                className="mt-1 text-2xl font-bold tracking-tight text-white outline-none sm:text-3xl"
              >
                {previous ? `Next: ${title}` : title}
              </h1>
              {current?.detail && <p className="mt-1 text-sm text-gray-300">{current.detail}</p>}
            </div>
          </div>

          <ul role="list" className="mt-6 grid gap-3 sm:grid-cols-2">
            {info.rules.map(({ icon: RuleIcon, text }) => (
              <li key={text} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-200">
                <RuleIcon className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <p className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-gray-300">
            <Timer className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            <span>{info.clock}</span>
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void begin()}
              aria-disabled={busy || undefined}
              className={cn(MOCK_BTN.primary, "min-h-[52px] px-7 text-base")}
            >
              {starting || refreshing ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {starting || refreshing ? `Starting ${title}…` : info.start}
            </button>
            {writing ? (
              <button type="button" onClick={() => setSkipOpen(true)} aria-haspopup="dialog" disabled={busy} className={MOCK_BTN.secondary}>
                <SkipForward className="h-4 w-4" aria-hidden />
                Skip Writing
              </button>
            ) : (
              <p className="text-xs leading-relaxed text-gray-500">Your results appear at the end, after the last section.</p>
            )}
          </div>
          <p aria-live="polite" className="sr-only">
            {starting ? `Starting ${title}…` : skipping ? "Skipping Writing…" : ""}
          </p>
          {error && (
            <div role="alert" className="error-surface mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
              <p className="text-sm text-red-100/90">{error}</p>
            </div>
          )}
        </section>

        <p className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-gray-400">
          <Coffee className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          <span>
            Need a break? You can close this page and come back from the Placement test page — the next clock only starts when you
            press Start.
          </span>
        </p>
      </div>

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
            Your level will be worked out from Grammar & Vocabulary, Listening and Reading. Your teacher may ask you for a writing
            sample in class.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-autofocus onClick={() => setSkipOpen(false)} disabled={skipping} className={MOCK_BTN.secondary}>
              Do the Writing
            </button>
            <button type="button" onClick={() => void skip()} aria-disabled={skipping || undefined} className={MOCK_BTN.primary}>
              {skipping ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <SkipForward className="h-4 w-4" aria-hidden />}
              {skipping ? "Working out your level…" : "Skip and see my result"}
            </button>
          </div>
        </MockDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

function BusyMark({ icon: MarkIcon = PenLine }: { icon?: Icon }) {
  return (
    <div aria-hidden className="relative mx-auto flex h-16 w-16 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-2 border-averna-neon/20" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-averna-neon/80 motion-safe:animate-spin motion-safe:[animation-duration:1.6s]" />
      <span className="absolute inset-2 rounded-full bg-averna-neon/10 blur-md motion-safe:animate-pulse-slow" />
      <MarkIcon className="relative h-6 w-6 text-averna-neon" />
    </div>
  );
}

function StillMark({ icon: MarkIcon, tone }: { icon: Icon; tone: "calm" | "error" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
        tone === "error" ? "bg-red-500/15 text-red-300" : "bg-averna-neon/10 text-averna-neon"
      )}
    >
      <MarkIcon className="h-6 w-6" />
    </span>
  );
}

function OverlayView({
  overlay,
  next,
  attemptId,
  onCollect,
  onDismiss,
  onLeave,
  leaving,
  leaveError,
}: {
  overlay: Overlay;
  next: string | null;
  attemptId: string;
  onCollect: () => void;
  onDismiss: () => void;
  onLeave: () => void;
  leaving: boolean;
  leaveError: string | null;
}) {
  const titleId = useId();
  const descId = useId();
  const actionsRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const waiting = overlay.kind === "advancing";

  // The next screen normally arrives within a second or two; offer a way on if it doesn't.
  useEffect(() => {
    setStuck(false);
    if (!waiting) return;
    const t = window.setTimeout(() => setStuck(true), STUCK_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [waiting]);

  // When a button appears in an open overlay (an error, a way on), put the keyboard on it.
  const actionKey = `${overlay.kind}:${overlay.kind === "timeup" ? `${overlay.busy}:${overlay.error ?? ""}` : ""}:${stuck}`;
  useEffect(() => {
    const el: HTMLDivElement | null = actionsRef.current;
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [actionKey]);

  let icon: Icon = PenLine;
  let title = "";
  let body = "";
  let busy = false;
  let actions: React.ReactNode = null;
  let dismiss: (() => void) | undefined;

  switch (overlay.kind) {
    case "marking":
      busy = true;
      icon = PenLine;
      title = "Marking your writing…";
      body = "This usually takes 10–40 seconds — please keep this page open. Your result comes straight after.";
      break;
    case "advancing":
      busy = !stuck;
      icon = CheckCircle2;
      if (overlay.done) {
        title = "All done!";
        body = stuck ? "Your result is ready, but this page hasn't moved on yet." : "Working out your level…";
        if (stuck) {
          actions = (
            <a href={placementResultHref(attemptId)} data-autofocus className={MOCK_BTN.primary}>
              Open my result
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          );
        }
      } else {
        title = `${SECTION_TITLE[overlay.section]} submitted`;
        body = stuck
          ? "Your answers are saved, but the next section is taking longer than usual to load."
          : next
            ? `Your answers are saved. Getting ${next} ready…`
            : "Your answers are saved. Loading the next section…";
        if (stuck) {
          actions = (
            <button type="button" data-autofocus onClick={() => window.location.reload()} className={MOCK_BTN.primary}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reload the page
            </button>
          );
        }
      }
      break;
    case "timeup":
      busy = overlay.busy;
      icon = Clock;
      title = `Time's up for ${SECTION_TITLE[overlay.section]}`;
      body = overlay.error
        ? `Your answers haven't been handed in yet. ${overlay.error} They're still saved on this device.`
        : "The section clock has run out, so your answers are being handed in now, exactly as they are.";
      if (!overlay.busy && overlay.error) {
        actions = (
          <button type="button" data-autofocus onClick={onCollect} className={MOCK_BTN.primary}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        );
      }
      break;
    case "fatal":
      icon = AlertCircle;
      title = "This section can't be marked";
      body = `${overlay.message} Leaving ends this sitting — you can start the placement test again from the beginning.`;
      dismiss = leaving ? undefined : onDismiss;
      actions = (
        <>
          <button type="button" data-autofocus onClick={onDismiss} disabled={leaving} className={MOCK_BTN.secondary}>
            Back to the test
          </button>
          <button type="button" onClick={onLeave} aria-disabled={leaving || undefined} className={MOCK_BTN.danger}>
            {leaving ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
            {leaving ? "Leaving…" : "Leave the test"}
          </button>
        </>
      );
      break;
  }

  return (
    <MockDialog
      titleId={titleId}
      descriptionId={descId}
      role={overlay.kind === "timeup" || overlay.kind === "fatal" ? "alertdialog" : "dialog"}
      busy={busy}
      onClose={dismiss}
      className="max-w-md text-center"
    >
      {busy ? <BusyMark icon={icon} /> : <StillMark icon={icon} tone={overlay.kind === "fatal" ? "error" : "calm"} />}
      <h2 id={titleId} className="mt-4 text-xl font-bold text-white">
        {title}
      </h2>
      <p id={descId} aria-live="polite" className="mt-2 text-sm leading-relaxed text-gray-300">
        {body}
      </p>
      {overlay.kind === "fatal" && leaveError && (
        <p role="alert" className="mt-3 text-sm text-red-200">
          {leaveError}
        </p>
      )}
      <div ref={actionsRef} className={cn(actions ? "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center" : "hidden")}>
        {actions}
      </div>
    </MockDialog>
  );
}

// ---------------------------------------------------------------------------
// Finished / abandoned (normally redirected by the page before we get here)
// ---------------------------------------------------------------------------

function Redirecting({ view }: { view: PlacementView }) {
  const router = useRouter();
  const finished = view.stage.kind === "finished";
  useEffect(() => {
    router.replace(finished ? placementResultHref(view.attemptId) : PLACEMENT_HUB_HREF);
  }, [finished, router, view.attemptId]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <p role="status" className="flex items-center gap-2 text-sm text-gray-300">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        {finished ? "Opening your result…" : "This placement test has ended — taking you back…"}
      </p>
    </div>
  );
}
