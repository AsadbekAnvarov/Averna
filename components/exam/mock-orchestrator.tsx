"use client";

/**
 * The real IELTS mock exam in the browser: Listening → Reading → Writing →
 * Speaking, with a rules / break screen before every section. The server owns
 * the sitting (lib/ielts/mock.ts): it picked the papers, runs each section's
 * clock and grades a section the moment it is submitted. This component:
 *
 * - shows the progress rail and, before each section, its rules and a Start
 *   button (POST /api/mock/{id}/begin → refresh → the section's runner);
 * - renders the runner in mode="mock", keyed per section so every section
 *   starts from a clean state;
 * - mirrors answers to the server (POST …/save): changes are coalesced for
 *   ~4 s, a save never overlaps another (the latest draft waits its turn), and
 *   anything pending is flushed with `keepalive` when the tab is hidden or
 *   closed. Failures stay silent — the runners keep their own local copy;
 * - submits the section (POST …/section). Writing and Speaking are marked by
 *   the examiner, so a calm "Marking your answers…" overlay covers the wait. A
 *   failure rejects `onSubmit`, so the runner keeps every answer and offers
 *   Try again (retries are idempotent on the server);
 * - enforces the server clock where a runner has none: Listening answers are
 *   collected just before the server stops accepting them, and a Speaking test
 *   that runs past its window is closed with an explanation.
 *
 * Bands stay hidden until the result page, as in the real exam.
 */

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Headphones,
  Highlighter,
  Loader2,
  LogOut,
  MessagesSquare,
  Mic,
  NotebookPen,
  PenLine,
  Play,
  RotateCcw,
  SpellCheck,
  Timer,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import type { MockSection, MockSectionView, MockStage, MockView } from "@/lib/ielts/mock";
import type { ExamAnswers } from "@/lib/ielts/types";
import { cn } from "@/lib/utils";
import { SkillIcon } from "@/components/progression/ui";
import { ListeningExamRunner } from "./listening-exam-runner";
import { ReadingExamRunner } from "./reading-exam-runner";
import { WritingExamRunner } from "./writing-exam-runner";
import { SpeakingExamRunner } from "./speaking-exam-runner";
import {
  MOCK_BTN,
  MOCK_HUB_HREF,
  MockDialog,
  MockLeaveButton,
  abandonMock,
  mockResultHref,
  postJson,
} from "./mock-start-button";
import type { SpeakingTestSubmission, WritingEssays } from "./types";

type RunningStage = Extract<MockStage, { kind: "running" }>;
type IntroStage = Extract<MockStage, { kind: "intro" }>;

/** Answers are coalesced this long before a save goes out. */
const AUTOSAVE_MS = 4000;
/** Browsers cap keepalive request bodies at 64 KB. */
const KEEPALIVE_MAX_BYTES = 60_000;
/** Mirrors GRACE_MS in lib/ielts/mock.ts: answers still count this long after the deadline. */
const SERVER_GRACE_MS = 2 * 60_000;
/** Listening has no clock of its own: its answers are collected this long before the server stops taking them. */
const COLLECT_MARGIN_MS = 20_000;
const OBJECTIVE_TIMEOUT_MS = 45_000;
/** Writing / Speaking are assessed by the AI examiner (the route may run for up to 60 s). */
const MARKED_TIMEOUT_MS = 95_000;
/** Smaller gaps between this device's clock and the server's are just network latency. */
const CLOCK_SKEW_MIN_MS = 3000;
/** When the next screen hasn't arrived by then, offer a manual way on. */
const STUCK_AFTER_MS = 12_000;

const RUNNER_SUFFIX: Record<MockSection, string> = { LISTENING: "L", READING: "R", WRITING: "W", SPEAKING: "S" };

const SECTION_INFO: Record<MockSection, { rules: { icon: LucideIcon; text: string }[]; clock: string; start: string }> = {
  LISTENING: {
    rules: [
      { icon: Volume2, text: "The recording plays ONCE. There's no pause, replay or speed control." },
      { icon: PenLine, text: "Answer while you listen. You can move between the parts and change answers at any time." },
      {
        icon: Clock,
        text: "When the recording ends you have 2 minutes to check your answers, then the section is submitted automatically.",
      },
      {
        icon: Headphones,
        text: "Use headphones in a quiet place, and play the sound check on the next screen to set a comfortable volume.",
      },
    ],
    clock: "The section clock starts when you press Start. On the next screen, press “Start the test” to play the recording.",
    start: "Start Listening",
  },
  READING: {
    rules: [
      { icon: BookOpen, text: "3 passages and 40 questions in 60 minutes — about 20 minutes per passage." },
      { icon: Timer, text: "There's no extra time to transfer answers: type or choose them straight into the test." },
      { icon: Highlighter, text: "Highlight the passage as you read, and flag questions you want to come back to." },
      { icon: Clock, text: "At 0:00 your answers are submitted automatically." },
    ],
    clock: "The 60-minute clock starts as soon as you press Start.",
    start: "Start Reading",
  },
  WRITING: {
    rules: [
      { icon: BarChart3, text: "Task 1: describe the visual in at least 150 words — spend about 20 minutes on it." },
      {
        icon: PenLine,
        text: "Task 2: write an essay of at least 250 words in about 40 minutes. Task 2 counts twice as much as Task 1.",
      },
      { icon: SpellCheck, text: "Spell check and autocorrect are off, as in the real test. Your work saves as you type." },
      { icon: Clock, text: "One clock for both tasks — switch between them at any time. At 0:00 both are submitted automatically." },
    ],
    clock: "The 60-minute clock starts as soon as you press Start.",
    start: "Start Writing",
  },
  SPEAKING: {
    rules: [
      {
        icon: Mic,
        text: "Microphone check first — allow microphone access when your browser asks. An up-to-date Chrome, Edge or Safari works best.",
      },
      {
        icon: Volume2,
        text: "The examiner asks every question out loud, and your spoken answers are transcribed for marking.",
      },
      { icon: NotebookPen, text: "Part 2: you get 1 minute to prepare your cue card, then speak for up to 2 minutes." },
      {
        icon: MessagesSquare,
        text: "Part 1 is a short interview and Part 3 a discussion. Once it starts, the test can't be paused.",
      },
    ],
    clock: "The section clock starts when you press Start, so do the microphone check and begin straight away.",
    start: "Start Speaking",
  },
};

function minutesLabel(s: MockSectionView): string {
  if (s.skill === "SPEAKING") return "11–14 min";
  if (s.skill === "LISTENING") return `about ${s.minutes} min`;
  return `${s.minutes} min`;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/** `{ answers }` draft → answers (Listening / Reading). */
function draftAnswers(draft: unknown): ExamAnswers | undefined {
  const src = asRec(asRec(draft)?.answers);
  if (!src) return undefined;
  const out: ExamAnswers = {};
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return Object.keys(out).length ? out : undefined;
}

/** `{ essays }` draft → essays (Writing). */
function draftEssays(draft: unknown): WritingEssays | undefined {
  const e = asRec(asRec(draft)?.essays);
  if (!e) return undefined;
  const task1 = typeof e.task1 === "string" ? e.task1 : "";
  const task2 = typeof e.task2 === "string" ? e.task2 : "";
  return task1 || task2 ? { task1, task2 } : undefined;
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
  /** Section over (or Speaking, which has no autosave): drop everything. */
  closed: boolean;
  /** The runner is unmounting / the page is going away: send immediately. */
  detached: boolean;
}

interface Session {
  key: string;
  attemptId: string;
  index: number;
  section: MockSection;
  running: boolean;
  initialAnswers?: ExamAnswers;
  initialEssays?: WritingEssays;
  /** Latest draft the runner reported (or the server's copy) — collected if the clock runs out. */
  latest: unknown;
  inFlight: Promise<void> | null;
  done: boolean;
  /** The server clock ran out and the paper was collected: the runner is gone for good. */
  collected: boolean;
  /** When this page started watching the clock (Listening / Speaking). */
  watchFrom: number | null;
  saves: SaveQueue;
}

function sessionKeyOf(view: MockView): string {
  const s = view.stage;
  return s.kind === "intro" || s.kind === "running" ? `${view.attemptId}:${s.kind}:${s.index}` : `${view.attemptId}:${s.kind}`;
}

function createSession(view: MockView, key: string): Session {
  const stage = view.stage;
  const running = stage.kind === "running";
  const section: MockSection = stage.kind === "intro" || stage.kind === "running" ? stage.section : "LISTENING";
  const draft = running ? stage.draft ?? null : null;
  return {
    key,
    attemptId: view.attemptId,
    index: stage.kind === "intro" || stage.kind === "running" ? stage.index : -1,
    section,
    running,
    initialAnswers: running && (section === "LISTENING" || section === "READING") ? draftAnswers(draft) : undefined,
    initialEssays: running && section === "WRITING" ? draftEssays(draft) : undefined,
    latest: draft,
    inFlight: null,
    done: false,
    collected: false,
    watchFrom: null,
    saves: {
      pending: null,
      timer: 0,
      inFlight: false,
      again: false,
      paused: false,
      closed: !running || section === "SPEAKING",
      detached: false,
    },
  };
}

/** Device clock minus server clock (0 when it's within network latency or unknown). */
function clockSkew(serverNow: number | undefined): number {
  if (typeof serverNow !== "number" || !Number.isFinite(serverNow)) return 0;
  const d = Date.now() - serverNow;
  return Math.abs(d) >= CLOCK_SKEW_MIN_MS ? d : 0;
}

function addSession(sessions: Map<string, Session>, view: MockView, key: string): Session {
  const s = createSession(view, key);
  sessions.set(key, s);
  return s;
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
  fetch(`/api/mock/${encodeURIComponent(s.attemptId)}/save`, {
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

/**
 * The runner reported new answers. Listening / Reading call this from inside a
 * state updater, so it must not touch React state — it only queues.
 */
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
  | { kind: "marking"; section: MockSection }
  | { kind: "advancing"; section: MockSection; done: boolean }
  | { kind: "timeup"; section: MockSection; busy: boolean; error: string | null }
  | { kind: "fatal"; message: string };

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function MockOrchestrator({ view, serverNow }: { view: MockView; serverNow?: number }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const stage = view.stage;
  const key = sessionKeyOf(view);

  // One session per stage, created during render so a runner that submits while
  // mounting (an already expired clock) never sees the previous section's state.
  // Kept by key, so a render that is thrown away can't reset a live session.
  const sessionsRef = useRef<Map<string, Session>>(new Map());
  const session: Session = sessionsRef.current.get(key) ?? addSession(sessionsRef.current, view, key);
  const latestKeyRef = useRef(key);
  latestKeyRef.current = key;

  const [overlayState, setOverlayState] = useState<{ key: string; overlay: Overlay } | null>(null);
  const overlay: Overlay | null = overlayState && overlayState.key === key ? overlayState.overlay : null;
  const show = useCallback((s: Session, next: Overlay | null) => {
    if (s.key !== latestKeyRef.current) return; // a finished section's late news
    setOverlayState(next ? { key: s.key, overlay: next } : null);
  }, []);

  // This device's clock vs the server's, so the runners' clocks match the server deadline. Known from
  // the first client render (the runners only start their clocks after hydration, so SSR's 0 is harmless).
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
      if (done) router.push(mockResultHref(s.attemptId));
      else refresh();
    },
    [router, refresh, show]
  );

  /**
   * Submit the section. Resolves when it's saved (the next screen is on its way);
   * rejects with a readable message. `collecting`: the time-up overlay owns the screen.
   */
  const submit = useCallback(
    (s: Session, payload: unknown, collecting = false): Promise<void> => {
      if (s.done) return Promise.resolve();
      if (s.inFlight) return s.inFlight; // the runner's auto-submit racing a click, or our own collection
      const marked = s.section === "WRITING" || s.section === "SPEAKING";
      pauseSaves(s);
      if (marked && !collecting) show(s, { kind: "marking", section: s.section });
      const run = async () => {
        const r = await postJson(
          `/api/mock/${encodeURIComponent(s.attemptId)}/section`,
          { section: s.index, payload },
          {
            timeoutMs: marked ? MARKED_TIMEOUT_MS : OBJECTIVE_TIMEOUT_MS,
            timeoutMessage: marked
              ? "Marking is taking longer than usual. Press Try again in a moment — if your answers were already marked, you'll move straight on."
              : undefined,
            fallback: "This section wasn't submitted. Please try again.",
          }
        );
        if (r.ok && r.data?.ok === true) {
          finish(s, r.data.done === true);
          return;
        }
        if (r.status === 409) {
          // Already graded, or this screen is out of date (e.g. another tab) — reload the exam.
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

  /** The server clock ran out: hand in what we have (Listening), or close the Speaking section. */
  const collect = useCallback(
    (s: Session) => {
      if (s.done) return;
      s.collected = true;
      show(s, { kind: "timeup", section: s.section, busy: true, error: null });
      // Speaking has no autosave: past its window the server marks the section from the (empty) draft.
      const payload =
        s.section === "SPEAKING" ? { answers: [], inputMode: "speech" } : { answers: draftAnswers(s.latest) ?? {} };
      submit(s, payload, true).catch((err: unknown) => {
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
    const s = session;
    if (!s.running) return;
    s.saves.detached = false;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSaves(s);
    };
    const onPageHide = () => flushSaves(s);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    // A reload requests the new page before the old one fires pagehide — send pending answers first.
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      // Leaving mid-section: send what's pending now, and whatever the runner reports while unmounting.
      s.saves.detached = true;
      flushSaves(s);
    };
  }, [session]);

  // The Listening runner has no deadline prop — watch the server clock for it. While the student is
  // working, give them every second the server still accepts (the grace period, which also covers the
  // runner's own late auto-submit); a section opened after its clock ran out is closed at once.
  // Speaking is NOT cut off here: its answers are spoken live (no autosave), and the server still
  // marks a late Speaking submission from what the student said (lib/ielts/mock.ts).
  const runningDeadline = stage.kind === "running" ? stage.deadline : null;
  useEffect(() => {
    const s = session;
    if (!s.running || runningDeadline == null) return;
    if (s.section !== "LISTENING") return;
    if (s.watchFrom == null) s.watchFrom = Date.now();
    const deadline = runningDeadline + skew;
    const fireAt =
      s.watchFrom >= deadline
        ? 0
        : deadline + (s.section === "LISTENING" ? SERVER_GRACE_MS - COLLECT_MARGIN_MS : SERVER_GRACE_MS);
    let fired = false;
    const check = () => {
      if (fired || s.done || s.inFlight || Date.now() < fireAt) return;
      fired = true;
      s.collected = true;
      if (s.section === "LISTENING") collect(s);
      else show(s, { kind: "timeup", section: "SPEAKING", busy: false, error: null });
    };
    check();
    const id = window.setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", check);
    };
  }, [session, runningDeadline, skew, collect, show]);

  // Runner callbacks, bound to this section's session.
  const onAnswersAutosave = useCallback((answers: ExamAnswers) => queueSave(session, { answers }), [session]);
  const onAnswersSubmit = useCallback((answers: ExamAnswers) => submit(session, { answers }), [session, submit]);
  const onEssaysAutosave = useCallback(
    (essays: WritingEssays) => queueSave(session, { essays: { task1: essays.task1, task2: essays.task2 } }),
    [session]
  );
  const onEssaysSubmit = useCallback(
    (essays: WritingEssays) => submit(session, { essays: { task1: essays.task1, task2: essays.task2 } }),
    [session, submit]
  );
  const onSpeakingSubmit = useCallback(
    (submission: SpeakingTestSubmission) => submit(session, { answers: submission.answers, inputMode: submission.inputMode }),
    [session, submit]
  );

  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    setLeaveError(null);
    const r = await abandonMock(view.attemptId);
    if (!r.ok) {
      setLeaving(false);
      setLeaveError(r.error);
      return;
    }
    router.push(MOCK_HUB_HREF);
    router.refresh();
  };

  if (stage.kind === "intro") {
    return <IntroScreen key={key} view={view} stage={stage} refreshing={refreshing} onBegun={refresh} />;
  }
  if (stage.kind !== "running") return <Redirecting view={view} />;

  const next = view.sections[stage.index + 1]?.title ?? null;

  return (
    <>
      {/* Time is up: the paper is collected, so the runner goes (and with it the recording / the examiner's voice). */}
      {session.collected ? (
        <div aria-hidden className="exam-shell fixed inset-0 z-[70] bg-[#040b09]" />
      ) : (
        <SectionRunner
          stage={stage}
          attemptId={view.attemptId}
          deadline={stage.deadline + skew}
          session={session}
          onAnswersAutosave={onAnswersAutosave}
          onAnswersSubmit={onAnswersSubmit}
          onEssaysAutosave={onEssaysAutosave}
          onEssaysSubmit={onEssaysSubmit}
          onSpeakingSubmit={onSpeakingSubmit}
        />
      )}
      {overlay && (
        <OverlayView
          overlay={overlay}
          next={next}
          attemptId={view.attemptId}
          onCollect={() => collect(session)}
          onDismiss={() => show(session, null)}
          onLeave={() => void leave()}
          leaving={leaving}
          leaveError={leaveError}
        />
      )}
    </>
  );
}

export default MockOrchestrator;

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
  onEssaysAutosave,
  onEssaysSubmit,
  onSpeakingSubmit,
}: {
  stage: RunningStage;
  attemptId: string;
  deadline: number;
  session: Session;
  onAnswersAutosave: (answers: ExamAnswers) => void;
  onAnswersSubmit: (answers: ExamAnswers) => Promise<void>;
  onEssaysAutosave: (essays: WritingEssays) => void;
  onEssaysSubmit: (essays: WritingEssays) => Promise<void>;
  onSpeakingSubmit: (submission: SpeakingTestSubmission) => Promise<void>;
}) {
  // Keyed per section: every section mounts a fresh runner (answers, clock, audio, recorder).
  const runnerKey = `${attemptId}:${stage.index}`;
  const runnerId = `${attemptId}-${RUNNER_SUFFIX[stage.section]}`;
  const c = stage.content;
  switch (c.skill) {
    case "LISTENING":
      return (
        <ListeningExamRunner
          key={runnerKey}
          test={c.test}
          mode="mock"
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
          deadline={deadline}
          initialAnswers={session.initialAnswers}
          onAutosave={onAnswersAutosave}
          onSubmit={onAnswersSubmit}
        />
      );
    case "WRITING":
      return (
        <WritingExamRunner
          key={runnerKey}
          task1={c.task1}
          task2={c.task2}
          mode="mock"
          attemptId={runnerId}
          deadline={deadline}
          initial={session.initialEssays}
          onAutosave={onEssaysAutosave}
          onSubmit={onEssaysSubmit}
        />
      );
    case "SPEAKING":
      return <SpeakingExamRunner key={runnerKey} set={c.set} mode="mock" attemptId={runnerId} onSubmit={onSpeakingSubmit} />;
  }
}

// ---------------------------------------------------------------------------
// Progress rail
// ---------------------------------------------------------------------------

function ProgressRail({ sections }: { sections: MockSectionView[] }) {
  return (
    <nav aria-label="Mock exam progress">
      <ol role="list" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {sections.map((s) => {
          const done = s.status === "done";
          const current = s.status === "current";
          return (
            <li
              key={s.skill}
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
                <span className={cn("block truncate text-sm font-semibold", done || current ? "text-white" : "text-gray-400")}>
                  {s.title}
                </span>
                <span className="block truncate text-xs text-gray-500">{done ? "Done" : minutesLabel(s)}</span>
              </span>
              <span className="sr-only">{done ? "(completed)" : current ? "(current section)" : "(not started yet)"}</span>
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
  view: MockView;
  stage: IntroStage;
  refreshing: boolean;
  onBegun: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const info = SECTION_INFO[stage.section];
  const total = view.sections.length;
  const current = view.sections[stage.index];
  const previous = stage.index > 0 ? view.sections[stage.index - 1] : null;
  const title = current?.title ?? stage.section;
  const busy = starting || refreshing;

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
      `/api/mock/${encodeURIComponent(view.attemptId)}/begin`,
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

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl px-4 py-6 pb-24 sm:py-8 lg:pb-8">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">IELTS mock exam</p>
            <p className="mt-0.5 text-sm text-gray-400">
              Section {stage.index + 1} of {total}
            </p>
          </div>
          <MockLeaveButton attemptId={view.attemptId} redirectTo={MOCK_HUB_HREF} />
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
              <p className="mt-0.5 text-sm text-gray-300">
                Take a breath — {title} starts when you press Start.
              </p>
            </div>
          </div>
        )}

        <section
          aria-labelledby="mock-section-title"
          className="av-panel av-panel-hero mt-5 rounded-3xl p-5 sm:p-8 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
        >
          <div className="flex items-start gap-4">
            <SkillIcon skill={stage.section} className="h-12 w-12 rounded-2xl" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-averna-neon">
                Section {stage.index + 1}
                {current ? ` · ${minutesLabel(current)}` : ""}
              </p>
              <h1
                id="mock-section-title"
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
            {info.rules.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-gray-200">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
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
              {busy ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
              {busy ? `Starting ${title}…` : info.start}
            </button>
            <p className="text-xs leading-relaxed text-gray-500">
              No bands until the end — like the real exam, you&apos;ll see your results after Speaking.
            </p>
          </div>
          <p aria-live="polite" className="sr-only">
            {busy ? `Starting ${title}…` : ""}
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
            {previous
              ? "Need a longer break? You can close this page and come back from the Mock exam page — the next clock only starts when you press Start."
              : "Not ready yet? You can close this page and come back from the Mock exam page — the clock only starts when you press Start."}
          </span>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

const SECTION_TITLE: Record<MockSection, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

function BusyMark({ icon: Icon = PenLine }: { icon?: LucideIcon }) {
  return (
    <div aria-hidden className="relative mx-auto flex h-16 w-16 items-center justify-center">
      <span className="absolute inset-0 rounded-full border-2 border-averna-neon/20" />
      <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-averna-neon/80 motion-safe:animate-spin motion-safe:[animation-duration:1.6s]" />
      <span className="absolute inset-2 rounded-full bg-averna-neon/10 blur-md motion-safe:animate-pulse-slow" />
      <Icon className="relative h-6 w-6 text-averna-neon" />
    </div>
  );
}

function StillMark({ icon: Icon, tone }: { icon: LucideIcon; tone: "calm" | "error" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
        tone === "error" ? "bg-red-500/15 text-red-300" : "bg-averna-neon/10 text-averna-neon"
      )}
    >
      <Icon className="h-6 w-6" />
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

  let icon: LucideIcon = PenLine;
  let title = "";
  let body = "";
  let busy = false;
  let actions: React.ReactNode = null;
  let dismiss: (() => void) | undefined;

  switch (overlay.kind) {
    case "marking":
      busy = true;
      icon = overlay.section === "SPEAKING" ? Mic : PenLine;
      title = "Marking your answers…";
      body =
        overlay.section === "SPEAKING"
          ? "The examiner is assessing your Speaking test. This usually takes 10–40 seconds — please keep this page open."
          : "The examiner is reading your Task 1 and Task 2. This usually takes 10–40 seconds — please keep this page open.";
      break;
    case "advancing":
      busy = !stuck;
      icon = CheckCircle2;
      if (overlay.done) {
        title = "All four sections are done";
        body = stuck ? "Your results are ready, but this page hasn't moved on yet." : "Well done. Opening your results…";
        if (stuck) {
          actions = (
            <a href={mockResultHref(attemptId)} data-autofocus className={MOCK_BTN.primary}>
              Open my results
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
    case "timeup": {
      const speaking = overlay.section === "SPEAKING";
      busy = overlay.busy;
      icon = Clock;
      title = `Time's up for ${SECTION_TITLE[overlay.section]}`;
      if (overlay.error) {
        body = speaking
          ? `We couldn't close the Speaking section. ${overlay.error}`
          : `Your answers haven't been handed in yet. ${overlay.error} They're still saved on this device.`;
      } else if (speaking) {
        body = overlay.busy
          ? "Closing the Speaking section…"
          : "The Speaking section's time window has ended, so answers given now can't be marked. Your other sections are already saved.";
      } else {
        body = "The section clock has run out, so your answers are being handed in now, exactly as they are.";
      }
      if (!overlay.busy && (overlay.error || speaking)) {
        actions = (
          <button type="button" data-autofocus onClick={onCollect} className={MOCK_BTN.primary}>
            {overlay.error ? <RotateCcw className="h-4 w-4" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
            {overlay.error ? "Try again" : "See my results"}
          </button>
        );
      }
      break;
    }
    case "fatal":
      icon = AlertCircle;
      title = "This section can't be marked";
      body = `${overlay.message} Leaving ends this mock; sections you've already submitted stay in your history.`;
      dismiss = leaving ? undefined : onDismiss;
      actions = (
        <>
          <button type="button" data-autofocus onClick={onDismiss} disabled={leaving} className={MOCK_BTN.secondary}>
            Back to the test
          </button>
          <button type="button" onClick={onLeave} aria-disabled={leaving || undefined} className={MOCK_BTN.danger}>
            {leaving ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
            {leaving ? "Leaving…" : "Leave the mock exam"}
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

function Redirecting({ view }: { view: MockView }) {
  const router = useRouter();
  const finished = view.stage.kind === "finished";
  useEffect(() => {
    router.replace(finished ? mockResultHref(view.attemptId) : MOCK_HUB_HREF);
  }, [finished, router, view.attemptId]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <p role="status" className="flex items-center gap-2 text-sm text-gray-300">
        <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
        {finished ? "Opening your results…" : "This mock exam has ended — taking you back…"}
      </p>
    </div>
  );
}
