"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Headphones, Info, Loader2, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import type { ClientGroup, ClientListeningPart, ExamAnswers } from "@/lib/ielts/types";
import { LISTENING_FULL, answeredNumbers, partNumbers, partRange, rangeLabel, recordingWindows } from "@/lib/ielts/format";
import { minutesPhrase } from "@/lib/ielts/audio/programme";
import { ExamShell } from "./exam-shell";
import type { ExamPartNav } from "./exam-shell";
import { QuestionGroupView } from "./question-group";
import { AudioBar, FILE_RATES } from "./audio-bar";
import type { AudioBarStatus } from "./audio-bar";
import { AudioFilePlayer, FILE_IDLE, releaseMediaSession } from "./audio-file-player";
import type { FileErrorCode, FileSnapshot } from "./audio-file-player";
import { focusQuestion, useDeadline, useExamAnswers, useLeaveGuard } from "./use-exam";
import type { ListeningExamRunnerProps } from "./types";
import { cn } from "@/lib/utils";

/**
 * Computer-delivered IELTS Listening for a test with ONE real recording for
 * all four parts (CDI tests: `test.recording`, see lib/ielts/sanitize). The
 * file plays through a plain <audio preload="metadata"> element (no Web Audio,
 * no crossOrigin) driven by AudioFilePlayer, like the pre-rendered parts of
 * ListeningExamRunner. The recording has the announcements and the time to
 * read the questions built in.
 *
 * - The navigator follows the recording: when it crosses `partStarts[i]` the
 *   questions of Part i+1 open (the student can still look at, and answer,
 *   any part). Without `partStarts` the parts can't be told apart reliably, so
 *   the student moves between parts with the tabs.
 * - practice: play / pause, back / forward 5 s, a seek bar, speed — the same
 *   AudioBar as every recorded part. One part (?part=n) plays that part's
 *   stretch of the file (from its start to the next part's start).
 * - mock = exam conditions: no pause / seek / speed, one pass, started by the
 *   student's Start (browsers block autoplay); after a refresh it continues
 *   from where it stopped.
 * - When the recording ends there are 2 minutes (1 for one part) to check the
 *   answers, then the test submits itself — as for per-part recordings.
 * - A file that can't be loaded shows an alert with Retry (it continues from
 *   the same place). There is no browser-voice fallback: these tests have no
 *   script, and their transcript stays on the server until submission.
 */

const SEEK_STEP_MS = 5_000;
/** The sound check plays the first seconds of the recording itself. */
const SOUND_CHECK_MS = 8_000;
export const RECORDING_LOAD_ERROR = "The recording could not be loaded. Check your connection and try again.";
const RECORDING_BLOCKED_ERROR = "Your browser blocked the audio. Press Retry to start it.";

interface RecordingSave {
  /** ms into the file. */
  pos?: number;
  startedAt?: number;
  check?: boolean;
  checkEndsAt?: number;
}

interface ScopePart {
  part: ClientListeningPart;
  /** Part number in the full test (1–4). */
  no: number;
  numbers: number[];
  /** Where the part sits in the file (seconds). */
  win: { start: number; end: number };
}

const num = (x: unknown): number | undefined => (typeof x === "number" && Number.isFinite(x) ? x : undefined);

function readSave(key: string): RecordingSave | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== "object") return null;
    const r = o as Record<string, unknown>;
    const pos = num(r.pos);
    return {
      pos: pos != null && pos > 0 ? pos : undefined,
      startedAt: num(r.startedAt),
      check: r.check === true,
      checkEndsAt: num(r.checkEndsAt),
    };
  } catch {
    return null;
  }
}

function writeSave(key: string, data: RecordingSave): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    /* storage full / private mode */
  }
}

function errorText(code: FileErrorCode): string {
  return code === "not-allowed" ? RECORDING_BLOCKED_ERROR : RECORDING_LOAD_ERROR;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

const secondaryBtn =
  "glow-hover inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-4 text-sm font-semibold text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:cursor-not-allowed disabled:opacity-50";
const primaryBtn =
  "glow-cta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-averna-primary px-5 text-sm font-semibold text-white transition hover:bg-averna-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/70 disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtn =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-red-300/40 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60 disabled:opacity-50";

type Phase = "intro" | "playing" | "check";

export function ListeningRecordingRunner(props: ListeningExamRunnerProps) {
  const { test, partIndex, mode, attemptId, initialAnswers, onSubmit, onAutosave, exitHref, homeworkId } = props;
  const examName = props.examName?.trim() || "Mock exam";
  const router = useRouter();
  const practice = mode === "practice";
  const single = partIndex != null;
  const url = test.recording?.url ?? "";
  const durationSec = test.recording?.durationSec;

  const timing = useMemo(() => recordingWindows(test.recording, test.parts?.length ?? 0), [test]);
  /** Part boundaries are an even split of the length (no partStarts): the navigator doesn't follow them. */
  const estimated = !timing || timing.estimated;

  const scope: ScopePart[] = useMemo(() => {
    const all = test.parts ?? [];
    const wins = timing?.windows ?? all.map(() => ({ start: 0, end: Infinity }));
    const picked = partIndex == null ? all.map((part, i) => ({ part, i })) : all[partIndex] ? [{ part: all[partIndex], i: partIndex }] : [];
    return picked.map(({ part, i }) => ({ part, no: i + 1, numbers: partNumbers(part), win: wins[i] ?? { start: 0, end: Infinity } }));
  }, [test, partIndex, timing]);

  const [metaMs, setMetaMs] = useState(0);
  /** Length of the file (ms): from the content, else from the element's metadata (0 = not known yet). */
  const fileMs = durationSec && durationSec > 0 ? durationSec * 1000 : metaMs;
  /** This run's stretch of the file: the whole file, or one part's window. */
  const runStartMs = single && scope[0] ? scope[0].win.start * 1000 : 0;
  const runEndMs: number | null =
    single && scope[0] && Number.isFinite(scope[0].win.end) && (fileMs <= 0 || scope[0].win.end * 1000 < fileMs - 500)
      ? scope[0].win.end * 1000
      : null;
  const runLengthMs = Math.max(0, (runEndMs ?? fileMs) - runStartMs);

  const checkMinutes = single ? 1 : LISTENING_FULL.reviewMinutes;
  const checkMs = checkMinutes * 60_000;
  const saveKey = `averna-exam-recording:${attemptId}`;
  const totalMinutes = runLengthMs > 0 ? Math.max(1, Math.round((runLengthMs / 1000 + checkMinutes * 60) / 60)) : null;

  const navParts: ExamPartNav[] = useMemo(() => scope.map((s) => ({ title: `Part ${s.no}`, numbers: s.numbers })), [scope]);
  const allGroups: ClientGroup[] = useMemo(() => scope.flatMap((s) => s.part.groups), [scope]);

  const { answers, setAnswer, flagged, toggleFlag, hydrated, clearSaved } = useExamAnswers({
    storageKey: `averna-exam:listening:${test.id}:${attemptId}`,
    initial: initialAnswers,
    onChange: onAutosave,
  });
  const answered = useMemo(() => answeredNumbers(allGroups, answers), [allGroups, answers]);

  const [phase, setPhase] = useState<Phase>("intro");
  const [fileSnap, setFileSnap] = useState<FileSnapshot>(FILE_IDLE);
  const [activePart, setActivePart] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [fontScale, setFontScale] = useState(1);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<FileErrorCode | null>(null);
  /** The file failed to load before the run started (metadata). */
  const [preloadError, setPreloadError] = useState(false);
  /** After a refresh: the recording continues from here (ms into the file). */
  const [resumeAtMs, setResumeAtMs] = useState<number | null>(null);
  const [restoredCheck, setRestoredCheck] = useState(false);
  const [checkEndsAt, setCheckEndsAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundFailed, setSoundFailed] = useState(false);
  const [announce, setAnnounce] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<AudioFilePlayer | null>(null);
  const soundRef = useRef<AudioFilePlayer | null>(null);
  const rateRef = useRef(1);
  const startedAtRef = useRef<number | null>(null);
  const mountedAtRef = useRef<number | null>(null);
  const savedPosRef = useRef(0);
  const submittingRef = useRef(false);
  const doneRef = useRef(false);
  const answersRef = useRef<ExamAnswers>({});
  answersRef.current = answers;
  const pendingFocus = useRef<number | null>(null);
  const didMountRef = useRef(false);
  const topRef = useRef<HTMLDivElement | null>(null);

  /** Scope position of the part the playhead is in (always 0 for one part). */
  const posMs = phase === "intro" ? resumeAtMs ?? runStartMs : fileSnap.positionMs;
  let playingIdx = 0;
  if (!single) {
    for (let i = 0; i < scope.length; i++) if (scope[i].win.start * 1000 <= posMs + 1) playingIdx = i;
  }
  /** The navigator follows the recording (real part starts, the whole test, while it plays). */
  const followIdx = phase === "playing" && !estimated && !single ? playingIdx : null;

  useEffect(() => {
    if (mountedAtRef.current == null) mountedAtRef.current = Date.now();
  }, []);

  // Stop (keeping the place) when the page is hidden for good; release everything on unmount.
  useEffect(() => {
    const onHide = () => {
      const p = playerRef.current;
      if (p && !doneRef.current) {
        p.stop();
        writeSave(saveKey, { pos: Math.round(p.snapshot.positionMs), startedAt: startedAtRef.current ?? undefined });
      }
      soundRef.current?.dispose();
      soundRef.current = null;
    };
    window.addEventListener("pagehide", onHide);
    const el = audioRef.current;
    return () => {
      window.removeEventListener("pagehide", onHide);
      playerRef.current?.dispose();
      playerRef.current = null;
      soundRef.current?.dispose();
      soundRef.current = null;
      try {
        el?.pause();
      } catch {
        /* ignore */
      }
      releaseMediaSession();
    };
  }, [saveKey]);

  // Back after a refresh: resume the checking time, or offer to continue the recording where it stopped.
  useEffect(() => {
    if (!hydrated) return;
    const saved = readSave(saveKey);
    if (!saved) return;
    if (saved.startedAt) startedAtRef.current = saved.startedAt;
    if (saved.check && saved.checkEndsAt) {
      setCheckEndsAt(saved.checkEndsAt);
      setRestoredCheck(true);
      setPhase("check");
      return;
    }
    if (saved.pos != null && saved.pos - 1000 > runStartMs) {
      const end = runEndMs ?? (fileMs > 0 ? fileMs : Infinity);
      setResumeAtMs(Math.max(runStartMs, Math.min(saved.pos - 1000, end - 1500)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // The recording reached another part: its questions open.
  useEffect(() => {
    if (followIdx == null) return;
    const entry = scope[followIdx];
    if (!entry) return;
    setActivePart(followIdx);
    setCurrent((c) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
    const range = partRange(entry.part);
    setAnnounce(`Part ${entry.no}.${range ? ` ${rangeLabel(range.from, range.to)}.` : ""}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followIdx]);

  // Part switches: land on the requested question, otherwise at the top of the part.
  useEffect(() => {
    const n = pendingFocus.current;
    pendingFocus.current = null;
    if (n != null) focusQuestion(n);
    else if (didMountRef.current) topRef.current?.scrollIntoView?.({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    didMountRef.current = true;
  }, [activePart]);

  function stopSoundCheck() {
    soundRef.current?.dispose();
    soundRef.current = null;
    setSoundPlaying(false);
  }

  function rememberPos(ms: number) {
    if (doneRef.current || Math.abs(ms - savedPosRef.current) < 2000) return;
    savedPosRef.current = ms;
    writeSave(saveKey, { pos: Math.round(ms), startedAt: startedAtRef.current ?? undefined });
  }

  /** Play the run from `fromMs` (ms into the file). Synchronous play() — call inside the tap (autoplay rules). */
  function startPlayer(fromMs: number) {
    const el = audioRef.current;
    if (!el || doneRef.current || !url) return;
    stopSoundCheck();
    playerRef.current?.dispose();
    const player: AudioFilePlayer = new AudioFilePlayer(el, {
      url,
      durationMs: fileMs > 0 ? fileMs : Number.POSITIVE_INFINITY,
      startMs: fromMs,
      endAtMs: runEndMs ?? undefined,
      rate: practice ? rateRef.current : 1,
      lockControls: !practice,
      title: single && scope[0] ? `${test.title} · Part ${scope[0].no}` : test.title,
      onChange: (s) => {
        if (playerRef.current !== player) return;
        setFileSnap(s);
        if (s.state === "playing") setError(null);
        rememberPos(s.positionMs);
      },
      onEnd: () => {
        if (playerRef.current === player) startCheckRef.current();
      },
      onError: (code) => {
        if (playerRef.current !== player) return;
        setError(code);
        setAnnounce(errorText(code));
      },
    });
    playerRef.current = player;
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    savedPosRef.current = fromMs;
    writeSave(saveKey, { pos: Math.round(fromMs), startedAt: startedAtRef.current ?? undefined });
    setError(null);
    setPreloadError(false);
    setResumeAtMs(null);
    setFileSnap(player.snapshot);
    setPhase("playing");
    player.play();
  }

  function beginRun(fromStart: boolean) {
    if (doneRef.current || submittingRef.current) return;
    startPlayer(!fromStart && resumeAtMs != null ? resumeAtMs : runStartMs);
  }

  /** Retry after a failure: the file is loaded again and continues from the same place. */
  function retry() {
    if (doneRef.current || submittingRef.current) return;
    setError(null);
    const p = playerRef.current;
    if (!p) {
      setPreloadError(false);
      try {
        audioRef.current?.load();
      } catch {
        /* reported by the element */
      }
      return;
    }
    if (p.state === "error") p.retry();
    else if (p.state === "paused" || p.state === "stopped") p.resume();
    else p.play();
  }

  function startCheck() {
    playerRef.current?.dispose();
    playerRef.current = null;
    if (doneRef.current) return;
    const ends = Date.now() + checkMs;
    setCheckEndsAt(ends);
    setPhase("check");
    setError(null);
    writeSave(saveKey, { check: true, checkEndsAt: ends, startedAt: startedAtRef.current ?? undefined });
    setAnnounce(`The recording has finished. You have ${minutesPhrase(checkMinutes)} to check your answers.`);
  }
  const startCheckRef = useRef(startCheck);
  startCheckRef.current = startCheck;

  async function submit(auto: boolean) {
    if (submittingRef.current || doneRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    // Stop the recording before anything else (early submit from the review dialog).
    const p = playerRef.current;
    if (p) {
      p.stop();
      setFileSnap(p.snapshot);
    }
    stopSoundCheck();
    const started = startedAtRef.current ?? mountedAtRef.current ?? Date.now();
    const meta = { timeSpent: Math.max(0, Math.round((Date.now() - started) / 1000)), auto };
    const payload: ExamAnswers = answersRef.current;
    const done = () => {
      doneRef.current = true;
      setFinished(true);
      playerRef.current?.dispose();
      playerRef.current = null;
      clearSaved();
      try {
        window.localStorage.removeItem(saveKey);
      } catch {
        /* ignore */
      }
    };
    try {
      if (onSubmit) {
        await onSubmit(payload, meta);
        done();
        return;
      }
      const res = await fetch("/api/learning/listening/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "exam-v2",
          testId: test.id,
          part: partIndex ?? null,
          answers: payload,
          timeSpent: meta.timeSpent,
          auto: meta.auto,
          submissionId: attemptId,
          ...(homeworkId ? { homeworkId } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as { testId?: unknown; error?: unknown } | null;
      const id = data?.testId;
      if (!res.ok || (typeof id !== "string" && typeof id !== "number") || String(id) === "") {
        throw new Error(typeof data?.error === "string" && data.error ? data.error : "The server didn't confirm your submission.");
      }
      done();
      // replace, not push: Back must not reopen the paper that was just handed in.
      router.replace(`/learning/listening/result/${encodeURIComponent(String(id))}`);
    } catch (e) {
      const offline = e instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
      setSubmitError(
        offline
          ? "Check your internet connection and try again."
          : e instanceof Error && e.message
            ? e.message
            : "Something went wrong — please try again."
      );
    } finally {
      if (!doneRef.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }

  const { remainingMs } = useDeadline(phase === "check" ? checkEndsAt : null, () => {
    void submit(true);
  });
  const shownMs = phase === "check" && remainingMs != null ? Math.min(remainingMs, checkMs) : null;
  const timeUp = phase === "check" && remainingMs === 0;
  const locked = submitting || finished || timeUp;
  useLeaveGuard(!finished && (phase !== "intro" || answered.size > 0));

  function toggleSoundCheck() {
    if (soundRef.current) {
      stopSoundCheck();
      return;
    }
    const el = audioRef.current;
    if (!el || !url) return;
    setSoundFailed(false);
    const player: AudioFilePlayer = new AudioFilePlayer(el, {
      url,
      durationMs: fileMs > 0 ? fileMs : Number.POSITIVE_INFINITY,
      startMs: 0,
      endAtMs: SOUND_CHECK_MS,
      onEnd: () => {
        if (soundRef.current !== player) return;
        soundRef.current = null;
        player.dispose();
        setSoundPlaying(false);
      },
      onError: () => {
        if (soundRef.current !== player) return;
        soundRef.current = null;
        player.dispose();
        setSoundPlaying(false);
        setSoundFailed(true);
      },
    });
    soundRef.current = player;
    setSoundPlaying(true);
    player.play();
  }

  // Practice controls.
  function togglePause() {
    const p = playerRef.current;
    if (!p) return;
    const s = p.state;
    if (s === "paused" || s === "stopped") p.resume();
    else if (s === "playing" || s === "buffering" || s === "loading") p.pause();
    else if (s === "error") retry();
  }

  function seekTo(fileMsTarget: number) {
    const p = playerRef.current;
    if (!p) return;
    const end = runEndMs ?? (fileMs > 0 ? fileMs : Infinity);
    p.seek(Math.max(runStartMs, Math.min(fileMsTarget, end - 250)));
  }

  function changeRate(r: number) {
    rateRef.current = r;
    setRate(r);
    playerRef.current?.setRate(r);
  }

  function replayPart() {
    const p = playerRef.current;
    const entry = scope[playingIdx];
    if (!p || !entry) return;
    seekTo(single || estimated ? runStartMs : entry.win.start * 1000);
    if (p.state === "paused" || p.state === "stopped") p.resume();
  }

  const onJump = useCallback(
    (n: number) => {
      setCurrent(n);
      const pos = scope.findIndex((s) => s.numbers.includes(n));
      if (pos >= 0 && pos !== activePart) {
        pendingFocus.current = n;
        setActivePart(pos);
      } else focusQuestion(n);
    },
    [scope, activePart]
  );

  const onPartChange = useCallback(
    (i: number) => {
      const entry = scope[i];
      if (!entry) return;
      setActivePart(i);
      setCurrent((c) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
    },
    [scope]
  );

  // ---------------------------------------------------------------------------

  if (!scope.length || !url) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div role="alert" className="error-surface max-w-md rounded-2xl p-5">
          <p className="font-semibold text-red-200">This Listening test couldn&apos;t be loaded.</p>
          <p className="mt-1 text-sm text-red-100/80">It has no parts or no recording to play. Please choose another test.</p>
        </div>
      </div>
    );
  }

  const activeEntry = scope[activePart] ?? scope[0];
  const playingEntry = scope[playingIdx] ?? scope[0];
  const activeRange = partRange(activeEntry.part);
  /** Which part the bar names: a real part start, or one part on its own; else just "the recording". */
  const partKnown = single || !estimated;
  const barLabel = partKnown ? `Part ${playingEntry.no}` : "Recording";

  let barStatus: AudioBarStatus;
  if (phase === "check") barStatus = "finished";
  else if (phase === "intro") barStatus = preloadError ? "error" : "ready";
  else if (error || fileSnap.state === "error") barStatus = "error";
  else if (fileSnap.state === "playing" || fileSnap.state === "ended") barStatus = "playing";
  else if (fileSnap.state === "buffering") barStatus = "buffering";
  else if (fileSnap.state === "paused") barStatus = "paused";
  // Interrupted by the system: practice shows it as paused (Play resumes); the exam offers Continue.
  else if (fileSnap.state === "stopped") barStatus = practice ? "paused" : "stopped";
  else barStatus = "starting";

  const failed = (phase === "playing" && barStatus === "error") || (phase === "intro" && preloadError);
  const failText = phase === "intro" ? RECORDING_LOAD_ERROR : errorText(error ?? fileSnap.error ?? "load");
  const live = phase === "playing" && !!playerRef.current;
  const barStart =
    barStatus === "ready" ? () => beginRun(false) : barStatus === "stopped" ? () => playerRef.current?.resume() : barStatus === "error" ? retry : undefined;
  const barStartLabel = barStatus === "error" ? "Retry" : barStatus === "stopped" ? "Continue" : resumeAtMs != null ? "Continue" : "Start";
  const timed = runLengthMs > 0;

  const footer = finished ? null : (
    <>
      {submitError && (
        <div role="alert" className="error-surface mx-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2 sm:mx-5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-red-200">
            Your answers weren&apos;t submitted. {submitError} They&apos;re still saved on this device.
          </p>
          <button type="button" onClick={() => void submit(timeUp)} disabled={submitting} className={dangerBtn}>
            {submitting ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
            Try again
          </button>
        </div>
      )}
      <AudioBar
        mode={mode}
        status={barStatus}
        partLabel={barLabel}
        partPosition={partKnown ? playingIdx + 1 : undefined}
        partCount={partKnown ? scope.length : undefined}
        line={0}
        lines={0}
        rate={rate}
        rates={FILE_RATES}
        onRateChange={practice ? changeRate : undefined}
        onTogglePause={practice ? togglePause : undefined}
        onReplay={practice ? replayPart : undefined}
        onStart={submitting ? undefined : barStart}
        startLabel={barStartLabel}
        message={barStatus === "error" ? failText : null}
        timeMs={timed ? Math.max(0, posMs - runStartMs) : undefined}
        durationMs={timed ? runLengthMs : undefined}
        bufferedMs={live && timed ? Math.max(0, fileSnap.bufferedMs - runStartMs) : undefined}
        onSeek={practice && live && timed ? (ms: number) => seekTo(runStartMs + ms) : undefined}
        onSeekBy={practice && live ? (delta: number) => seekTo(fileSnap.positionMs + delta) : undefined}
        seekStepMs={SEEK_STEP_MS}
      />
    </>
  );

  return (
    <ExamShell
      title={test.title}
      subtitle={mode === "mock" ? `${examName} · Listening` : single ? `Listening practice · Part ${scope[0].no}` : "Listening practice"}
      remainingMs={shownMs}
      parts={navParts}
      activePart={activePart}
      onPartChange={onPartChange}
      answered={answered}
      flagged={flagged}
      current={current}
      onJump={onJump}
      fontScale={fontScale}
      onFontScale={setFontScale}
      footerExtra={footer}
      onSubmit={() => submit(false)}
      submitting={submitting || finished}
      exitHref={exitHref}
    >
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-5 sm:px-6">
        {/* The recording itself: a plain media element (no controls of its own — the bar drives it). */}
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          playsInline
          aria-hidden
          className="hidden"
          data-testid="listening-recording"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setMetaMs(d * 1000);
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setMetaMs(d * 1000);
          }}
          onError={(e) => {
            // Before the run starts (the player reports its own failures).
            const code = e.currentTarget.error?.code;
            if (!playerRef.current && !soundRef.current && code !== 1) setPreloadError(true);
          }}
        />
        <div ref={topRef} className="scroll-mt-4" aria-hidden />
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>

        {finished && (
          <section role="status" className="av-panel av-panel-hero mb-6 flex items-center gap-3 rounded-2xl p-5">
            {onSubmit ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
            ) : (
              <Loader2 className="h-5 w-5 shrink-0 text-averna-neon motion-safe:animate-spin" aria-hidden />
            )}
            <div>
              <p className="font-semibold text-white">{onSubmit ? "Listening submitted" : "Answers submitted — opening your results…"}</p>
              {onSubmit && <p className="text-sm text-gray-300">Your answers are saved.</p>}
            </div>
          </section>
        )}

        {/* The recording can't be loaded */}
        {!finished && failed && (
          <section role="alert" aria-labelledby="listening-recording-error" className="error-surface mb-6 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p id="listening-recording-error" className="font-semibold text-red-200">
                  {failText}
                </p>
                <p className="mt-0.5 text-sm text-red-100/80">
                  {phase === "intro"
                    ? "Your answers are kept on this device."
                    : "Retry continues from where it stopped. Your answers are kept on this device."}
                </p>
                <button type="button" onClick={retry} disabled={submitting} className={cn(dangerBtn, "mt-3")}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Retry
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Before the recording starts */}
        {!finished && phase === "intro" && (
          <section aria-labelledby="listening-intro-title" className="av-panel av-panel-hero mb-6 rounded-2xl p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-averna-neon/30 bg-averna-neon/10 text-averna-neon">
                <Headphones className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-averna-neon/80">
                  {mode === "mock" ? `${examName} · Listening` : "Listening practice"}
                </p>
                <h2 id="listening-intro-title" className="mt-1 text-xl font-bold text-white">
                  {resumeAtMs != null ? "Welcome back" : "Before you start"}
                </h2>
              </div>
            </div>

            {resumeAtMs != null ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span>Your answers are saved. The recording will continue from where it stopped.</span>
              </p>
            ) : (
              <>
                <p className="mt-4 leading-relaxed text-gray-200">
                  {single ? `You will hear Part ${scope[0].no} of the recording.` : `You will hear one recording with ${scope.length} parts.`}{" "}
                  {practice ? (
                    <>
                      In the real test you hear it <strong className="font-bold text-white">ONCE</strong> only — in practice mode you
                      can pause, go back or forward 5 seconds and change the speed.
                    </>
                  ) : (
                    <>
                      You&apos;ll hear it <strong className="font-bold text-white">ONCE</strong> only. There&apos;s no pause, replay or
                      speed control.
                    </>
                  )}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  {[
                    "Each part starts with a short introduction and time to look at the questions — it's all in the recording.",
                    estimated && !single
                      ? "Answer while you listen. Use the part tabs to move between parts, and change answers at any time."
                      : "Answer while you listen. The questions move on with the recording; you can switch parts and change answers at any time.",
                    `When the recording ends you have ${minutesPhrase(checkMinutes)} to check your answers — then the test is submitted automatically.`,
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-averna-neon" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-gray-300">
                  <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
                  <span>Use headphones in a quiet place, and play the sound check to set a comfortable volume before you start.</span>
                </p>
              </>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button type="button" onClick={() => beginRun(false)} disabled={submitting} className={primaryBtn}>
                <Play className="h-4 w-4" aria-hidden />
                {resumeAtMs != null ? "Continue the recording" : "Start the test"}
              </button>
              <button type="button" onClick={toggleSoundCheck} aria-pressed={soundPlaying} className={secondaryBtn}>
                {soundPlaying ? <Square className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                {soundPlaying ? "Stop the sound check" : "Play a sound check"}
              </button>
              {practice && resumeAtMs != null && (
                <button type="button" onClick={() => beginRun(true)} disabled={submitting} className={secondaryBtn}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Start again from the beginning
                </button>
              )}
            </div>
            {soundFailed && (
              <p role="status" className="mt-3 text-sm text-amber-200">
                We couldn&apos;t play the sound check. Check that your device isn&apos;t muted and the volume is up, then try again.
              </p>
            )}

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {scope.length === 1 ? "Your part" : `${scope.length} parts`}
                {totalMinutes ? ` · about ${totalMinutes} min in total` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {scope.map((s, i) => {
                  const r = partRange(s.part);
                  const on = i === activePart;
                  return (
                    <button
                      key={s.part.id || s.no}
                      type="button"
                      onClick={() => onPartChange(i)}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "glow-hover min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60",
                        on ? "border-averna-neon/50 bg-averna-neon/10 text-averna-neon" : "border-white/10 bg-white/[0.02] text-gray-300"
                      )}
                    >
                      Part {s.no}
                      {r && <span className="ml-1.5 font-normal text-gray-400">· {r.from === r.to ? `Q${r.from}` : `Q${r.from}–${r.to}`}</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">You can read — and even answer — the questions below before you start.</p>
            </div>
          </section>
        )}

        {/* Checking time */}
        {!finished && phase === "check" && (
          <section className="av-panel av-panel-hero mb-6 flex items-start gap-3 rounded-2xl p-4 sm:p-5">
            {timeUp && !submitError ? (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 text-averna-neon motion-safe:animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-white">
                {timeUp ? "Time's up" : restoredCheck ? "Welcome back — it's time to check your answers" : "The recording has finished"}
              </p>
              <p className="mt-0.5 text-sm text-gray-300">
                {timeUp
                  ? submitError
                    ? "Your answers haven't been submitted yet — use Try again below."
                    : "Submitting your answers…"
                  : "Check your answers now. The test is submitted automatically when the timer reaches 0:00."}
              </p>
            </div>
          </section>
        )}

        {/* Questions of the part on screen */}
        <section aria-labelledby="listening-part-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
            <div className="min-w-0">
              <p className="text-[0.75em] font-semibold uppercase tracking-[0.16em] text-averna-neon/80">Part {activeEntry.no}</p>
              <h2 id="listening-part-heading" className="text-[1.2em] font-bold text-white">
                {activeRange ? rangeLabel(activeRange.from, activeRange.to) : "Questions"}
              </h2>
              {activeRange && (
                <p className="text-[0.9em] text-gray-400">Listen and answer {rangeLabel(activeRange.from, activeRange.to).toLowerCase()}.</p>
              )}
            </div>
            {phase === "playing" && partKnown && playingIdx === activePart && !failed && (
              <span className="inline-flex items-center gap-2 rounded-full border border-averna-neon/30 bg-averna-neon/10 px-3 py-1 text-[0.8em] font-semibold text-averna-neon">
                <span className={cn("h-2 w-2 rounded-full bg-averna-neon", barStatus === "playing" && "motion-safe:animate-pulse")} aria-hidden />
                {barStatus === "paused" ? "Paused" : barStatus === "stopped" ? "Stopped" : barStatus === "playing" ? "Now playing" : "Loading…"}
              </span>
            )}
          </div>

          {phase === "playing" && partKnown && playingIdx !== activePart && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-averna-cyan/25 bg-averna-cyan/[0.06] px-3 py-1.5 text-[0.9em] text-gray-200">
              <span>The recording is on Part {playingEntry.no} now.</span>
              <button
                type="button"
                onClick={() => onPartChange(playingIdx)}
                className="min-h-[44px] rounded-lg px-3 font-semibold text-averna-cyan transition hover:bg-averna-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-cyan/60"
              >
                Go to Part {playingEntry.no}
              </button>
            </div>
          )}

          {activeEntry.part.groups.map((g, gi) => (
            <QuestionGroupView
              key={`${activeEntry.part.id}-${gi}`}
              group={g}
              skill="LISTENING"
              answers={answers}
              onAnswer={setAnswer}
              flagged={flagged}
              onToggleFlag={toggleFlag}
              current={current}
              onFocusQuestion={setCurrent}
              disabled={locked}
            />
          ))}
          {!activeEntry.part.groups.length && <p className="text-gray-400">This part has no questions.</p>}
        </section>
      </div>
    </ExamShell>
  );
}

export default ListeningRecordingRunner;
