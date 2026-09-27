"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Headphones, Info, Loader2, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import type { ClientGroup, ClientListeningPart, ExamAnswers, ScriptLine } from "@/lib/ielts/types";
import { LISTENING_FULL, answeredNumbers, estimateListeningMinutes, partNumbers, partRange, rangeLabel } from "@/lib/ielts/format";
import { NARRATOR, ScriptPlayer, cancelSpeech, isTtsSupported, onVoicesChanged, pickVoices, waitForVoices } from "@/lib/ielts/tts";
import type { PlayerSnapshot } from "@/lib/ielts/tts";
import { ExamShell } from "./exam-shell";
import type { ExamPartNav } from "./exam-shell";
import { QuestionGroupView } from "./question-group";
import { AudioBar } from "./audio-bar";
import type { AudioBarStatus } from "./audio-bar";
import { focusQuestion, useDeadline, useExamAnswers, useLeaveGuard } from "./use-exam";
import type { ListeningExamRunnerProps } from "./types";
import { cn } from "@/lib/utils";

/**
 * Computer-delivered IELTS Listening, read aloud by the browser (multi-voice
 * speechSynthesis). For every part in scope the narrator introduces the part,
 * gives silent time to look at the questions, the recording plays, and the
 * narrator closes the part; parts advance by themselves and the question view
 * follows the audio (the student can still browse and answer anything). After
 * the last part there are 2 minutes (1 for a single-part practice) to check
 * answers, then the test submits itself.
 *
 * mock = exam conditions: the recording plays once, no pause / replay / speed.
 * practice = pause, replay the part, 0.9× / 1× / 1.1×, skip the reading time.
 */

const EXAM_READING_SECONDS = 30;
const PRACTICE_READING_SECONDS = 15;
const BETWEEN_PARTS_SECONDS = 3;
/** Silent gaps at least this long count as "reading time" (status + Skip). */
const READING_GAP_MS = 4000;
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

interface ScopePart {
  part: ClientListeningPart;
  /** Part number in the full test (1–4). */
  no: number;
  numbers: number[];
}

interface ProgrammeInfo {
  /** Index of the first recording line (after the announcements + reading time). */
  scriptStart: number;
  scriptCount: number;
}

interface Programme extends ProgrammeInfo {
  lines: ScriptLine[];
}

type Phase = "intro" | "playing" | "check";
/** Explicit hook shapes (identical to React's), so this file type-checks even where React is untyped. */
type SetState<T> = (value: T | ((prev: T) => T)) => void;
type State<T> = [T, SetState<T>];
type Ref<T> = { current: T };

/** What survives a refresh (localStorage `averna-exam-audio:{attemptId}`). */
interface AudioSave {
  /** Part index in the full test. */
  part: number;
  check?: boolean;
  checkEndsAt?: number;
  startedAt?: number;
}

const IDLE: PlayerSnapshot = { state: "idle", line: 0, total: 0, silenceEndsAt: null, silenceMs: 0, silenceLeftMs: 0 };

function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function minutesPhrase(n: number): string {
  return n === 1 ? "one minute" : `${countWord(n)} minutes`;
}

function asSentence(text: string | undefined | null): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return /[.!?…]["'”’)\]]*$/.test(t) ? t : `${t}.`;
}

function spokenRange(from: number, to: number): string {
  return from === to ? `question ${from}` : `questions ${from} to ${to}`;
}

/** Lines the player goes through: anything with words or a scripted pause. */
function recordingLines(part: ClientListeningPart): ScriptLine[] {
  return (part.script ?? []).filter((l) => l && (String(l.text ?? "").trim() || (Number(l.pauseAfter) || 0) > 0));
}

/** Lines with words (the practice transcript). */
function transcriptLines(part: ClientListeningPart): ScriptLine[] {
  return (part.script ?? []).filter((l) => l && String(l.text ?? "").trim());
}

/** Narrator announcements + reading time + the part's recording. */
function buildProgramme(entry: ScopePart, readingSeconds: number, last: boolean, checkMinutes: number): Programme {
  const lines: ScriptLine[] = [];
  const context = asSentence(entry.part.context);
  lines.push({ speaker: NARRATOR, text: context ? `Part ${entry.no}. ${context}` : `Part ${entry.no}.`, pauseAfter: 1 });
  const range = partRange(entry.part);
  if (range) {
    lines.push({
      speaker: NARRATOR,
      text: `First, you have some time to look at ${spokenRange(range.from, range.to)}.`,
      pauseAfter: readingSeconds,
    });
  }
  const scriptStart = lines.length;
  const script = recordingLines(entry.part);
  lines.push(...script);
  lines.push({ speaker: NARRATOR, text: `That is the end of Part ${entry.no}.`, pauseAfter: last ? 1 : BETWEEN_PARTS_SECONDS });
  if (last) {
    lines.push({
      speaker: NARRATOR,
      text: `That is the end of the listening test. You now have ${minutesPhrase(checkMinutes)} to check your answers.`,
    });
  }
  return { lines, scriptStart, scriptCount: script.length };
}

function readAudioSave(key: string): AudioSave | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "number" && Number.isInteger(parsed) && parsed >= 0) return { part: parsed };
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      if (typeof o.part === "number" && Number.isInteger(o.part) && o.part >= 0) {
        return {
          part: o.part,
          check: o.check === true,
          checkEndsAt: typeof o.checkEndsAt === "number" ? o.checkEndsAt : undefined,
          startedAt: typeof o.startedAt === "number" ? o.startedAt : undefined,
        };
      }
    }
  } catch {
    /* corrupted — ignore */
  }
  return null;
}

function writeAudioSave(key: string, data: AudioSave): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    /* storage full / private mode */
  }
}

function audioErrorText(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Your browser blocked the audio. Press Try again to start it.";
    case "network":
      return "The voice couldn't load — check your internet connection, then press Try again.";
    case "no-start":
      return "The audio didn't start. Check that your device isn't muted, then press Try again.";
    case "unsupported":
      return "Audio isn't available in this browser — open Averna in Chrome, Edge or Safari.";
    default:
      return "The audio stopped unexpectedly. Press Try again to restart this part.";
  }
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

export function ListeningExamRunner(props: ListeningExamRunnerProps) {
  const { test, partIndex, mode, attemptId, initialAnswers, onSubmit, onAutosave, exitHref } = props;
  const router = useRouter();
  const practice = mode === "practice";
  const single = partIndex != null;

  const scope: ScopePart[] = useMemo(() => {
    const all = test.parts ?? [];
    const picked =
      partIndex == null
        ? all.map((part, i) => ({ part, i }))
        : all[partIndex]
          ? [{ part: all[partIndex], i: partIndex }]
          : [];
    return picked.map(({ part, i }) => ({ part, no: i + 1, numbers: partNumbers(part) }));
  }, [test, partIndex]);

  const readingSeconds = mode === "mock" || !single ? EXAM_READING_SECONDS : PRACTICE_READING_SECONDS;
  const checkMinutes = single ? 1 : LISTENING_FULL.reviewMinutes;
  const checkMs = checkMinutes * 60000;
  const audioKey = `averna-exam-audio:${attemptId}`;
  // The estimate only reads scripts; client parts carry no answer keys, so hand it answer-free groups.
  const totalMinutes: number = useMemo(
    () => estimateListeningMinutes({ parts: scope.map((s) => ({ ...s.part, groups: [] })) }, single ? 0 : undefined),
    [scope, single]
  );

  const navParts: ExamPartNav[] = useMemo(() => scope.map((s) => ({ title: `Part ${s.no}`, numbers: s.numbers })), [scope]);
  const allGroups: ClientGroup[] = useMemo(() => scope.flatMap((s) => s.part.groups), [scope]);

  const { answers, setAnswer, flagged, toggleFlag, hydrated, clearSaved } = useExamAnswers({
    storageKey: `averna-exam:listening:${test.id}:${attemptId}`,
    initial: initialAnswers,
    onChange: onAutosave,
  });
  const answered: Set<number> = useMemo(() => answeredNumbers(allGroups, answers), [allGroups, answers]);

  const [supported, setSupported]: State<boolean | null> = useState<boolean | null>(null);
  const [phase, setPhase]: State<Phase> = useState<Phase>("intro");
  const [playingPos, setPlayingPos]: State<number> = useState(0);
  const [activePart, setActivePart]: State<number> = useState(0);
  const [current, setCurrent]: State<number | null> = useState<number | null>(null);
  const [fontScale, setFontScale]: State<number> = useState(1);
  const [snap, setSnap]: State<PlayerSnapshot> = useState<PlayerSnapshot>(IDLE);
  const [programme, setProgramme]: State<ProgrammeInfo> = useState<ProgrammeInfo>({ scriptStart: 0, scriptCount: 0 });
  const [rate, setRate]: State<number> = useState(1);
  /** Scope position offered as "Continue from Part N" after a refresh. */
  const [resumeFrom, setResumeFrom]: State<number | null> = useState<number | null>(null);
  const [restoredCheck, setRestoredCheck]: State<boolean> = useState(false);
  const [checkEndsAt, setCheckEndsAt]: State<number | null> = useState<number | null>(null);
  const [submitting, setSubmitting]: State<boolean> = useState(false);
  const [submitError, setSubmitError]: State<string | null> = useState<string | null>(null);
  const [finished, setFinished]: State<boolean> = useState(false);
  const [audioError, setAudioError]: State<string | null> = useState<string | null>(null);
  const [showTranscript, setShowTranscript]: State<boolean> = useState(false);
  const [soundPlaying, setSoundPlaying]: State<boolean> = useState(false);
  const [soundFailed, setSoundFailed]: State<boolean> = useState(false);
  const [announce, setAnnounce]: State<string> = useState("");

  const playerRef: Ref<ScriptPlayer | null> = useRef<ScriptPlayer | null>(null);
  const soundRef: Ref<ScriptPlayer | null> = useRef<ScriptPlayer | null>(null);
  const voicesRef: Ref<SpeechSynthesisVoice[]> = useRef<SpeechSynthesisVoice[]>([]);
  const rateRef: Ref<number> = useRef(1);
  const startedAtRef: Ref<number | null> = useRef<number | null>(null);
  const mountedAtRef: Ref<number | null> = useRef<number | null>(null);
  const submittingRef: Ref<boolean> = useRef(false);
  const doneRef: Ref<boolean> = useRef(false);
  const answersRef: Ref<ExamAnswers> = useRef<ExamAnswers>({});
  answersRef.current = answers;
  const scopeRef: Ref<ScopePart[]> = useRef<ScopePart[]>(scope);
  scopeRef.current = scope;
  const activePartRef: Ref<number> = useRef(0);
  activePartRef.current = activePart;
  const pendingFocus: Ref<number | null> = useRef<number | null>(null);
  const didMountRef: Ref<boolean> = useRef(false);
  const topRef: Ref<HTMLDivElement | null> = useRef<HTMLDivElement>(null);

  // Support check, voice loading, and stopping speech when leaving.
  useEffect(() => {
    if (mountedAtRef.current == null) mountedAtRef.current = Date.now();
    const ok = isTtsSupported();
    setSupported(ok);
    if (!ok) return;
    cancelSpeech(); // Chrome can keep talking across a reload
    let alive = true;
    waitForVoices().then((v) => {
      if (alive && v.length) voicesRef.current = v;
    });
    const off = onVoicesChanged((v) => {
      if (v.length) voicesRef.current = v;
    });
    const onHide = () => {
      playerRef.current?.stop();
      soundRef.current?.stop();
      cancelSpeech();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      alive = false;
      off();
      window.removeEventListener("pagehide", onHide);
      playerRef.current?.dispose();
      playerRef.current = null;
      soundRef.current?.dispose();
      soundRef.current = null;
      cancelSpeech();
    };
  }, []);

  // Back after a refresh: offer "Continue from Part N", or resume the checking time.
  useEffect(() => {
    if (!hydrated) return;
    const saved = readAudioSave(audioKey);
    if (!saved) return;
    const pos = partIndex == null ? saved.part : saved.part === partIndex ? 0 : -1;
    if (pos < 0 || pos >= scope.length) return;
    if (saved.startedAt) startedAtRef.current = saved.startedAt;
    setPlayingPos(pos);
    setActivePart(pos);
    if (saved.check && saved.checkEndsAt) {
      setCheckEndsAt(saved.checkEndsAt);
      setRestoredCheck(true);
      setPhase("check");
      return;
    }
    setResumeFrom(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Part switches: land on the requested question, otherwise at the top of the part.
  useEffect(() => {
    const n = pendingFocus.current;
    pendingFocus.current = null;
    if (n != null) focusQuestion(n);
    else if (didMountRef.current) topRef.current?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    didMountRef.current = true;
  }, [activePart]);

  function stopSoundCheck() {
    soundRef.current?.dispose();
    soundRef.current = null;
    setSoundPlaying(false);
  }

  function freshVoices() {
    try {
      const live = window.speechSynthesis.getVoices();
      if (live.length) voicesRef.current = live;
    } catch {
      /* keep what we have */
    }
    return voicesRef.current;
  }

  function startPart(pos: number, fromScript = false) {
    const entry = scopeRef.current[pos];
    if (!entry || doneRef.current || !isTtsSupported()) return;
    stopSoundCheck();
    playerRef.current?.dispose();
    playerRef.current = null;
    const last = pos === scopeRef.current.length - 1;
    const prog = buildProgramme(entry, readingSeconds, last, checkMinutes);
    const player: ScriptPlayer = new ScriptPlayer(prog.lines, {
      voices: pickVoices(entry.part.speakers ?? [], freshVoices()),
      rate: practice ? rateRef.current : 1,
      onChange: (s) => {
        if (playerRef.current === player) setSnap(s);
      },
      onEnd: () => {
        if (playerRef.current !== player) return;
        if (pos + 1 < scopeRef.current.length) startPartRef.current(pos + 1);
        else startCheckRef.current();
      },
      onError: (code) => {
        if (playerRef.current === player) setAudioError(audioErrorText(code));
      },
    });
    playerRef.current = player;
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    setAudioError(null);
    setResumeFrom(null);
    setShowTranscript(false);
    setProgramme({ scriptStart: prog.scriptStart, scriptCount: prog.scriptCount });
    setPlayingPos(pos);
    setPhase("playing");
    if (activePartRef.current !== pos) setActivePart(pos);
    setCurrent((c: number | null) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
    writeAudioSave(audioKey, { part: entry.no - 1, startedAt: startedAtRef.current ?? undefined });
    const range = partRange(entry.part);
    setAnnounce(`Part ${entry.no} is starting.${range ? ` ${rangeLabel(range.from, range.to)}.` : ""}`);
    // Synchronous first speak() — inside the tap that started it (required on iOS).
    player.play(fromScript ? prog.scriptStart : 0);
  }

  function startCheck() {
    playerRef.current?.dispose();
    playerRef.current = null;
    if (doneRef.current) return;
    const ends = Date.now() + checkMs;
    setCheckEndsAt(ends);
    setPhase("check");
    setSnap((s: PlayerSnapshot) => ({ ...s, state: "ended", silenceEndsAt: null }));
    const lastEntry = scopeRef.current[scopeRef.current.length - 1];
    writeAudioSave(audioKey, {
      part: lastEntry ? lastEntry.no - 1 : 0,
      check: true,
      checkEndsAt: ends,
      startedAt: startedAtRef.current ?? undefined,
    });
    setAnnounce(`The recording has finished. You have ${minutesPhrase(checkMinutes)} to check your answers.`);
  }

  async function submit(auto: boolean) {
    if (submittingRef.current || doneRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    // Stop the recording before anything else (early submit from the review dialog).
    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
      setSnap((s: PlayerSnapshot) => (s.state === "ended" ? s : { ...s, state: "stopped", silenceEndsAt: null }));
    }
    stopSoundCheck();
    cancelSpeech();
    const started = startedAtRef.current ?? mountedAtRef.current ?? Date.now();
    const meta = { timeSpent: Math.max(0, Math.round((Date.now() - started) / 1000)), auto };
    const payload: ExamAnswers = answersRef.current;
    try {
      if (onSubmit) {
        await onSubmit(payload, meta);
        doneRef.current = true;
        setFinished(true);
        clearSaved();
        try {
          window.localStorage.removeItem(audioKey);
        } catch {
          /* ignore */
        }
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
        }),
      });
      const data = (await res.json().catch(() => null)) as { testId?: unknown; error?: unknown } | null;
      const id = data?.testId;
      if (!res.ok || (typeof id !== "string" && typeof id !== "number") || String(id) === "") {
        throw new Error(typeof data?.error === "string" && data.error ? data.error : "The server didn't confirm your submission.");
      }
      doneRef.current = true;
      setFinished(true);
      clearSaved();
      try {
        window.localStorage.removeItem(audioKey);
      } catch {
        /* ignore */
      }
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

  // Player callbacks outlive the render that created them — always call the latest version.
  const startPartRef: Ref<(pos: number, fromScript?: boolean) => void> = useRef(startPart);
  startPartRef.current = startPart;
  const startCheckRef: Ref<() => void> = useRef(startCheck);
  startCheckRef.current = startCheck;

  const { remainingMs } = useDeadline(phase === "check" ? checkEndsAt : null, () => {
    void submit(true);
  });
  // useDeadline's clock only ticks once a deadline exists — never show more than the checking time.
  const shownMs = phase === "check" && remainingMs != null ? Math.min(remainingMs, checkMs) : null;
  const timeUp = phase === "check" && remainingMs === 0;
  const locked = submitting || finished || timeUp;

  const inProgress = !finished && (phase !== "intro" || answered.size > 0);
  useLeaveGuard(inProgress);

  function toggleSoundCheck() {
    if (soundRef.current) {
      stopSoundCheck();
      return;
    }
    if (!isTtsSupported()) return;
    setSoundFailed(false);
    const player: ScriptPlayer = new ScriptPlayer(
      [{ speaker: NARRATOR, text: "This is a sound check. If you can hear this voice clearly, you're ready to start the test." }],
      {
        voices: pickVoices(scopeRef.current[0]?.part.speakers ?? [], freshVoices()),
        rate: practice ? rateRef.current : 1,
        onEnd: () => {
          if (soundRef.current !== player) return;
          soundRef.current = null;
          setSoundPlaying(false);
        },
        onError: () => {
          if (soundRef.current !== player) return;
          soundRef.current = null;
          setSoundPlaying(false);
          setSoundFailed(true);
        },
      }
    );
    soundRef.current = player;
    setSoundPlaying(true);
    player.play();
  }

  function togglePause() {
    const p = playerRef.current;
    if (!p) return;
    if (p.state === "paused") p.resume();
    else if (p.state === "speaking" || p.state === "silence") p.pause();
  }

  function changeRate(r: number) {
    rateRef.current = r;
    setRate(r);
    if (playerRef.current) playerRef.current.rate = r;
    if (soundRef.current) soundRef.current.rate = r;
  }

  const onJump = useCallback((n: number) => {
    setCurrent(n);
    const pos = scopeRef.current.findIndex((s) => s.numbers.includes(n));
    if (pos >= 0 && pos !== activePartRef.current) {
      pendingFocus.current = n;
      setActivePart(pos);
    } else focusQuestion(n);
  }, []);

  const onPartChange = useCallback((i: number) => {
    const entry = scopeRef.current[i];
    if (!entry) return;
    setActivePart(i);
    setCurrent((c: number | null) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
  }, []);

  // ---------------------------------------------------------------------------

  if (!scope.length) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div role="alert" className="error-surface max-w-md rounded-2xl p-5">
          <p className="font-semibold text-red-200">This Listening test couldn&apos;t be loaded.</p>
          <p className="mt-1 text-sm text-red-100/80">It has no parts to play. Please choose another test.</p>
        </div>
      </div>
    );
  }

  const activeEntry = scope[activePart] ?? scope[0];
  const playingEntry = scope[playingPos] ?? scope[0];
  const startPos = resumeFrom ?? 0;
  const startEntry = scope[startPos] ?? scope[0];
  const activeRange = partRange(activeEntry.part);

  let barStatus: AudioBarStatus;
  if (supported === false) barStatus = "unsupported";
  else if (phase === "check") barStatus = "finished";
  else if (phase === "intro") barStatus = "ready";
  else if (audioError || snap.state === "error") barStatus = "error";
  else if (snap.state === "speaking" || snap.state === "ended") barStatus = "playing";
  else if (snap.state === "silence") barStatus = snap.silenceMs >= READING_GAP_MS ? "reading" : "playing";
  else if (snap.state === "paused") barStatus = "paused";
  else if (snap.state === "stopped") barStatus = "stopped";
  else barStatus = "starting";

  const barEntry = phase === "intro" ? startEntry : playingEntry;
  const barLines = phase === "playing" ? programme.scriptCount : recordingLines(barEntry.part).length;
  const barLine =
    phase === "playing" ? Math.max(0, Math.min(programme.scriptCount, snap.line - programme.scriptStart + 1)) : phase === "check" ? barLines : 0;
  const barStart =
    barStatus === "ready"
      ? () => startPart(startPos)
      : barStatus === "stopped" || barStatus === "error"
        ? () => startPart(playingPos)
        : undefined;
  const barStartLabel =
    barStatus === "error"
      ? "Try again"
      : barStatus === "stopped"
        ? `Continue from Part ${playingEntry.no}`
        : resumeFrom != null
          ? `Continue from Part ${startEntry.no}`
          : "Start";
  const reading = barStatus === "reading" || (snap.state === "paused" && snap.silenceLeftMs >= READING_GAP_MS);
  const transcriptAvailable = practice && (supported === false || !!audioError);

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
        partLabel={`Part ${barEntry.no}`}
        partPosition={(phase === "intro" ? startPos : playingPos) + 1}
        partCount={scope.length}
        line={barLine}
        lines={barLines}
        silenceEndsAt={snap.silenceEndsAt}
        silenceLeftMs={snap.silenceLeftMs}
        rate={rate}
        onRateChange={practice ? changeRate : undefined}
        onTogglePause={practice ? togglePause : undefined}
        onReplay={practice ? () => startPart(playingPos, true) : undefined}
        onSkip={practice && reading ? () => playerRef.current?.skipSilence() : undefined}
        onStart={submitting ? undefined : barStart}
        startLabel={barStartLabel}
        startDisabled={supported == null}
        message={barStatus === "error" ? audioError ?? audioErrorText("") : null}
      />
    </>
  );

  const partsWord = scope.length === 1 ? "one recording" : `${countWord(scope.length)} recordings`;

  return (
    <ExamShell
      title={test.title}
      subtitle={mode === "mock" ? "Mock exam · Listening" : single ? `Listening practice · Part ${scope[0].no}` : "Listening practice"}
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

        {/* No speech synthesis at all */}
        {!finished && supported === false && (
          <section role="alert" className="error-surface mb-6 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
              <div className="min-w-0">
                <h2 className="font-semibold text-red-200">
                  Audio isn&apos;t available in this browser — open Averna in Chrome, Edge or Safari.
                </h2>
                <p className="mt-1 text-sm text-red-100/80">
                  {practice
                    ? "You can still practise: read the transcript instead, then answer the questions below."
                    : "You can still answer the questions and submit this section, but without the recording your score won't reflect your listening. If you can, reopen the mock exam in Chrome, Edge or Safari."}
                </p>
                {practice && (
                  <button
                    type="button"
                    onClick={() => setShowTranscript((v: boolean) => !v)}
                    aria-expanded={showTranscript}
                    aria-controls="listening-transcript"
                    className={cn(secondaryBtn, "mt-3")}
                  >
                    <FileText className="h-4 w-4" aria-hidden />
                    {showTranscript ? "Hide the transcript" : "Read the transcript instead"}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Before the recording starts */}
        {!finished && supported !== false && phase === "intro" && (
          <section aria-labelledby="listening-intro-title" className="av-panel av-panel-hero mb-6 rounded-2xl p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-averna-neon/30 bg-averna-neon/10 text-averna-neon">
                <Headphones className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-averna-neon/80">
                  {mode === "mock" ? "Mock exam · Listening" : "Listening practice"}
                </p>
                <h2 id="listening-intro-title" className="mt-1 text-xl font-bold text-white">
                  {resumeFrom != null ? "Welcome back" : "Before you start"}
                </h2>
              </div>
            </div>

            {resumeFrom != null ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span>
                  Your answers are saved. The recording can&apos;t pick up mid-sentence, so Part {startEntry.no} will start again
                  from the beginning.
                </span>
              </p>
            ) : (
              <>
                <p className="mt-4 leading-relaxed text-gray-200">
                  You will hear {partsWord}.{" "}
                  {practice ? (
                    <>
                      In the real test you hear each recording <strong className="font-bold text-white">ONCE</strong> only — in
                      practice mode you can pause, replay a part and change the speed.
                    </>
                  ) : (
                    <>
                      You&apos;ll hear each recording <strong className="font-bold text-white">ONCE</strong> only.
                    </>
                  )}
                </p>
                <ul className="mt-3 space-y-2 text-sm text-gray-300">
                  {[
                    `Each part starts with a short introduction, then ${readingSeconds} seconds to look at the questions.`,
                    "Answer while you listen. You can move between parts and change answers at any time.",
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
                  <span>
                    Use headphones in a quiet place, and play the sound check to set a comfortable volume before you start.
                  </span>
                </p>
              </>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => startPart(startPos)}
                disabled={supported == null || submitting}
                className={primaryBtn}
              >
                <Play className="h-4 w-4" aria-hidden />
                {resumeFrom != null ? `Continue from Part ${startEntry.no}` : "Start the test"}
              </button>
              <button
                type="button"
                onClick={toggleSoundCheck}
                disabled={supported == null}
                aria-pressed={soundPlaying}
                className={secondaryBtn}
              >
                {soundPlaying ? <Square className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                {soundPlaying ? "Stop the sound check" : "Play a sound check"}
              </button>
              {practice && resumeFrom != null && resumeFrom > 0 && (
                <button type="button" onClick={() => startPart(0)} disabled={supported == null || submitting} className={secondaryBtn}>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Start again from Part {scope[0].no}
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
                {scope.length === 1 ? "Your part" : `${scope.length} parts`} · about {totalMinutes} min in total
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

        {/* The audio failed while playing */}
        {!finished && phase === "playing" && audioError && (
          <section role="alert" className="error-surface mb-6 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-red-200">The audio stopped</p>
                <p className="mt-0.5 text-sm text-red-100/80">{audioError}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startPart(playingPos)} disabled={submitting} className={dangerBtn}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Try again
                  </button>
                  {practice && (
                    <button
                      type="button"
                      onClick={() => setShowTranscript((v: boolean) => !v)}
                      aria-expanded={showTranscript}
                      aria-controls="listening-transcript"
                      className={secondaryBtn}
                    >
                      <FileText className="h-4 w-4" aria-hidden />
                      {showTranscript ? "Hide the transcript" : "Read the transcript instead"}
                    </button>
                  )}
                </div>
              </div>
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
                  : `Check your answers now. The test is submitted automatically when the timer reaches 0:00.`}
              </p>
            </div>
          </section>
        )}

        {/* Practice fallback when there's no audio */}
        {transcriptAvailable && showTranscript && (
          <section id="listening-transcript" aria-labelledby="listening-transcript-title" className="av-panel mb-6 rounded-2xl p-4 sm:p-5">
            <h2 id="listening-transcript-title" className="text-[0.8em] font-bold uppercase tracking-wider text-gray-400">
              Transcript · Part {activeEntry.no}
            </h2>
            {asSentence(activeEntry.part.context) && (
              <p className="mt-1 text-[0.95em] italic text-gray-400">{asSentence(activeEntry.part.context)}</p>
            )}
            <ol className="mt-3 space-y-2.5">
              {transcriptLines(activeEntry.part).map((l, i) => (
                <li key={i} className="leading-relaxed text-gray-100">
                  <span className="mr-2 font-semibold text-averna-cyan">{l.speaker}:</span>
                  {l.text}
                </li>
              ))}
            </ol>
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
            {phase === "playing" && playingPos === activePart && !audioError && (
              <span className="inline-flex items-center gap-2 rounded-full border border-averna-neon/30 bg-averna-neon/10 px-3 py-1 text-[0.8em] font-semibold text-averna-neon">
                <span
                  className={cn("h-2 w-2 rounded-full bg-averna-neon", (barStatus === "playing" || barStatus === "reading") && "motion-safe:animate-pulse")}
                  aria-hidden
                />
                {barStatus === "paused" ? "Paused" : barStatus === "reading" ? "Reading time" : barStatus === "stopped" ? "Stopped" : "Now playing"}
              </span>
            )}
          </div>

          {phase === "playing" && playingPos !== activePart && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-averna-cyan/25 bg-averna-cyan/[0.06] px-3 py-1.5 text-[0.9em] text-gray-200">
              <span>The recording is on Part {playingEntry.no} now.</span>
              <button
                type="button"
                onClick={() => onPartChange(playingPos)}
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

export default ListeningExamRunner;
