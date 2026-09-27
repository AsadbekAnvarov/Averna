"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Headphones, Info, Loader2, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import type { ClientGroup, ClientListeningPart, ExamAnswers, ListeningPartAudio } from "@/lib/ielts/types";
import { LISTENING_FULL, answeredNumbers, estimatePartSeconds, partNumbers, partRange, rangeLabel } from "@/lib/ielts/format";
import { NARRATOR, ScriptPlayer, cancelSpeech, isTtsSupported, onVoicesChanged, pickVoices, unlockSpeech, waitForVoices } from "@/lib/ielts/tts";
import type { PlayerSnapshot } from "@/lib/ielts/tts";
import {
  EXAM_READING_SECONDS,
  PRACTICE_READING_SECONDS,
  READING_GAP_MS,
  asSentence,
  buildProgramme,
  countWord,
  minutesPhrase,
  recordingLines,
  transcriptLines,
} from "@/lib/ielts/audio/programme";
import { finalCutMs, positionInfo, scriptLineCount, scriptStartMs } from "@/lib/ielts/audio/timeline";
import { ExamShell } from "./exam-shell";
import type { ExamPartNav } from "./exam-shell";
import { QuestionGroupView } from "./question-group";
import { AudioBar, FILE_RATES } from "./audio-bar";
import type { AudioBarStatus } from "./audio-bar";
import { AudioFilePlayer, FILE_IDLE, createAudioElement, releaseMediaSession } from "./audio-file-player";
import type { FileSnapshot } from "./audio-file-player";
import { focusQuestion, useDeadline, useExamAnswers, useLeaveGuard } from "./use-exam";
import type { ListeningExamRunnerProps } from "./types";
import { cn } from "@/lib/utils";

/**
 * Computer-delivered IELTS Listening. Every part in scope plays either
 * - its pre-rendered recording (`part.audio`: one MP3 on the Blob CDN with the
 *   announcements, voices and pauses baked in — lib/ielts/audio), through ONE
 *   HTMLAudioElement kept for the whole run (./audio-file-player), or
 * - browser voices (multi-voice speechSynthesis) reading the same programme
 *   (lib/ielts/audio/programme) when the part has no recording.
 * For every part the narrator introduces the part, gives silent time to look
 * at the questions, the recording plays, and the narrator closes the part;
 * parts advance by themselves and the question view follows the audio (the
 * student can still browse and answer anything). After the last part there
 * are 2 minutes (1 for a single-part practice) to check answers, then the test
 * submits itself.
 *
 * mock = exam conditions: the recording plays once, no pause / replay / speed / seeking.
 * practice = pause, replay the part, speed, skip the reading time; a recording
 * can also be scrubbed and moved ±10 s.
 */

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
  /** A recorded part: where it had got to (ms into the part's file). */
  pos?: number;
}

const IDLE: PlayerSnapshot = { state: "idle", line: 0, total: 0, silenceEndsAt: null, silenceMs: 0, silenceLeftMs: 0 };

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
          pos: typeof o.pos === "number" && Number.isFinite(o.pos) && o.pos > 0 ? o.pos : undefined,
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

/** Messages for a pre-rendered recording (Try again continues from where it stopped). */
function fileErrorText(code: string): string {
  switch (code) {
    case "not-allowed":
      return "Your browser blocked the audio. Press Try again to start it.";
    case "network":
      return "The recording stopped loading — check your internet connection, then press Try again. It continues from where it stopped.";
    case "stalled":
      return "The recording is taking too long to load. Check your connection, then press Try again — it continues from where it stopped.";
    case "decode":
      return "This device couldn't play the recording. Press Try again, or open Averna in Chrome, Edge or Safari.";
    case "unsupported":
      return "Audio isn't available in this browser — open Averna in Chrome, Edge or Safari.";
    default:
      return "The recording couldn't load — check your internet connection, then press Try again.";
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
  const { test, partIndex, mode, attemptId, initialAnswers, onSubmit, onAutosave, exitHref, homeworkId } = props;
  const examName = props.examName?.trim() || "Mock exam";
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
  /** Some part plays a pre-rendered recording / some part needs browser voices. */
  const anyFile: boolean = useMemo(() => scope.some((s) => !!s.part.audio), [scope]);
  const needsTts: boolean = useMemo(() => scope.some((s) => !s.part.audio), [scope]);
  // Recordings know their length; browser voices only have the script-based estimate.
  const totalMinutes: number = useMemo(() => {
    const secs = scope.reduce((n, s) => n + (s.part.audio ? s.part.audio.durationMs / 1000 : estimatePartSeconds(s.part)), 0);
    const review = single ? 60 : LISTENING_FULL.reviewMinutes * 60;
    return Math.max(1, Math.round((secs + review) / 60));
  }, [scope, single]);

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
  const [fileSnap, setFileSnap]: State<FileSnapshot> = useState<FileSnapshot>(FILE_IDLE);
  const [programme, setProgramme]: State<ProgrammeInfo> = useState<ProgrammeInfo>({ scriptStart: 0, scriptCount: 0 });
  const [rate, setRate]: State<number> = useState(1);
  /** Scope position offered as "Continue from Part N" after a refresh. */
  const [resumeFrom, setResumeFrom]: State<number | null> = useState<number | null>(null);
  /** A recorded part continues from here (ms) after a refresh. */
  const [resumeAtMs, setResumeAtMs]: State<number | null> = useState<number | null>(null);
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
  /** The one <audio> element for every recorded part of this run (created on first use). */
  const mediaRef: Ref<HTMLAudioElement | null> = useRef<HTMLAudioElement | null>(null);
  const fileRef: Ref<AudioFilePlayer | null> = useRef<AudioFilePlayer | null>(null);
  const fileSoundRef: Ref<AudioFilePlayer | null> = useRef<AudioFilePlayer | null>(null);
  const primedRef: Ref<boolean> = useRef(false);
  const savedPosRef: Ref<number> = useRef(0);
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
  const playingPosRef: Ref<number> = useRef(0);
  playingPosRef.current = playingPos;
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

  // Recordings: stop (keeping the place) when the page is hidden for good; release the element on unmount.
  useEffect(() => {
    const onHide = () => {
      const f = fileRef.current;
      if (f) {
        const entry = scopeRef.current[playingPosRef.current];
        f.stop();
        if (entry && !doneRef.current) {
          writeAudioSave(audioKey, { part: entry.no - 1, startedAt: startedAtRef.current ?? undefined, pos: Math.round(f.snapshot.positionMs) });
        }
      }
      fileSoundRef.current?.dispose();
      fileSoundRef.current = null;
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      fileRef.current?.dispose();
      fileRef.current = null;
      fileSoundRef.current?.dispose();
      fileSoundRef.current = null;
      const el = mediaRef.current;
      mediaRef.current = null;
      if (el) {
        try {
          el.pause();
          el.removeAttribute("src");
          el.load(); // stop downloading
        } catch {
          /* ignore */
        }
      }
      releaseMediaSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // A recording picks up where it stopped (a second early); browser voices restart the part.
    const audio = scope[pos]?.part.audio;
    if (audio && saved.pos) setResumeAtMs(Math.max(0, Math.min(saved.pos - 1000, audio.durationMs - 1500)));
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
    fileSoundRef.current?.dispose();
    fileSoundRef.current = null;
    setSoundPlaying(false);
  }

  function stopFile() {
    fileRef.current?.dispose();
    fileRef.current = null;
  }

  function ensureMedia(): HTMLAudioElement | null {
    if (!mediaRef.current) mediaRef.current = createAudioElement();
    return mediaRef.current;
  }

  /**
   * Inside the tap that starts a run whose first part uses browser voices but a
   * later part is recorded: play the element once (muted) so iOS lets it start
   * that part later on its own. Also starts buffering the first recording.
   */
  function primeMedia() {
    if (primedRef.current) return;
    const first = scopeRef.current.find((s) => s.part.audio)?.part.audio;
    const el = first ? ensureMedia() : null;
    if (!first || !el) return;
    primedRef.current = true;
    try {
      el.muted = true;
      if (el.src !== first.url) el.src = first.url;
      const p = el.play();
      const settle = () => {
        try {
          if (!fileRef.current) el.pause();
        } catch {
          /* ignore */
        }
        el.muted = false;
      };
      if (p && typeof p.then === "function") p.then(settle, () => (el.muted = false));
      else settle();
    } catch {
      el.muted = false;
    }
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

  /** Remember where a recorded part is (every ~2 s) so a refresh can pick up there. */
  function rememberPos(entry: ScopePart, ms: number) {
    if (doneRef.current || Math.abs(ms - savedPosRef.current) < 2000) return;
    savedPosRef.current = ms;
    writeAudioSave(audioKey, { part: entry.no - 1, startedAt: startedAtRef.current ?? undefined, pos: Math.round(ms) });
  }

  function startPart(pos: number, fromScript = false, fromMs?: number) {
    const entry = scopeRef.current[pos];
    if (!entry || doneRef.current) return;
    if (entry.part.audio) {
      startFilePart(pos, entry, entry.part.audio, fromScript, fromMs);
      return;
    }
    if (!isTtsSupported()) {
      // A part without a recording, in a browser without speech, after recorded parts: say why it's silent.
      if (fileRef.current) {
        stopFile();
        setPlayingPos(pos);
        setPhase("playing");
        if (activePartRef.current !== pos) setActivePart(pos);
        setAudioError(audioErrorText("unsupported"));
      }
      return;
    }
    stopSoundCheck();
    stopFile();
    playerRef.current?.dispose();
    playerRef.current = null;
    const last = pos === scopeRef.current.length - 1;
    const prog = buildProgramme(entry.part, { no: entry.no, readingSeconds, last, checkMinutes });
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
    setResumeAtMs(null);
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

  /** A recorded part: one file, announcements and reading time included. */
  function startFilePart(pos: number, entry: ScopePart, audio: ListeningPartAudio, fromScript: boolean, fromMs?: number) {
    stopSoundCheck();
    // (Disposing a browser-voice player cancels its own speech; a global cancel here would also
    // drop the silent utterance that unlocks speech on iOS for later parts.)
    playerRef.current?.dispose();
    playerRef.current = null;
    stopFile();
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    setResumeFrom(null);
    setResumeAtMs(null);
    setShowTranscript(false);
    setPlayingPos(pos);
    setPhase("playing");
    if (activePartRef.current !== pos) setActivePart(pos);
    setCurrent((c: number | null) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
    const range = partRange(entry.part);
    setAnnounce(`Part ${entry.no} is starting.${range ? ` ${rangeLabel(range.from, range.to)}.` : ""}`);
    const el = ensureMedia();
    if (!el) {
      setAudioError(fileErrorText("unsupported"));
      return;
    }
    setAudioError(null);
    // Practising one part on its own: the run gives its own checking time, so stop before the file's end-of-test line.
    const endAtMs = single ? finalCutMs(audio) : undefined;
    const startMs = fromScript ? scriptStartMs(audio) : Math.max(0, Math.min(fromMs ?? 0, audio.durationMs - 1000));
    const player: AudioFilePlayer = new AudioFilePlayer(el, {
      url: audio.url,
      durationMs: audio.durationMs,
      startMs,
      endAtMs,
      rate: practice ? rateRef.current : 1,
      lockControls: !practice,
      title: `${test.title} · Part ${entry.no}`,
      onChange: (s) => {
        if (fileRef.current !== player) return;
        setFileSnap(s);
        if (s.state === "playing") setAudioError(null); // recovered
        rememberPos(entry, s.positionMs);
      },
      onEnd: () => {
        if (fileRef.current !== player) return;
        if (pos + 1 < scopeRef.current.length) startPartRef.current(pos + 1);
        else startCheckRef.current();
      },
      onError: (code) => {
        if (fileRef.current === player) setAudioError(fileErrorText(code));
      },
    });
    fileRef.current = player;
    setFileSnap(player.snapshot);
    savedPosRef.current = startMs;
    writeAudioSave(audioKey, { part: entry.no - 1, startedAt: startedAtRef.current ?? undefined, pos: Math.round(startMs) });
    // Synchronous play() — inside the tap that started it (mobile autoplay rules).
    player.play();
  }

  /** Start (or continue) the run from a tap: unlock whatever later parts will need, then play. */
  function beginRun(pos: number, resume: boolean) {
    const entry = scopeRef.current[pos];
    if (!entry || doneRef.current) return;
    if (entry.part.audio && scopeRef.current.some((s) => !s.part.audio)) unlockSpeech();
    if (!entry.part.audio && scopeRef.current.some((s) => !!s.part.audio)) primeMedia();
    startPart(pos, false, resume && entry.part.audio ? resumeAtMs ?? undefined : undefined);
  }

  function startCheck() {
    playerRef.current?.dispose();
    playerRef.current = null;
    stopFile();
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
    if (fileRef.current) {
      fileRef.current.stop();
      setFileSnap(fileRef.current.snapshot);
      stopFile();
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
          ...(homeworkId ? { homeworkId } : {}),
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
  const startPartRef: Ref<(pos: number, fromScript?: boolean, fromMs?: number) => void> = useRef(startPart);
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
    if (soundRef.current || fileSoundRef.current) {
      stopSoundCheck();
      return;
    }
    // A recorded test: play the start of the recording itself (its narrator, at its volume).
    const audio = (scopeRef.current[resumeFrom ?? 0] ?? scopeRef.current[0])?.part.audio;
    if (audio) {
      const el = ensureMedia();
      if (!el) {
        setSoundFailed(true);
        return;
      }
      setSoundFailed(false);
      const intro = audio.timeline.find((e) => e.kind === "intro") ?? audio.timeline[0];
      const endAtMs = Math.min(intro ? intro.endMs + 300 : 8000, 12000, audio.durationMs);
      const player: AudioFilePlayer = new AudioFilePlayer(el, {
        url: audio.url,
        durationMs: audio.durationMs,
        startMs: 0,
        endAtMs,
        rate: practice ? rateRef.current : 1,
        onEnd: () => {
          if (fileSoundRef.current !== player) return;
          fileSoundRef.current = null;
          player.dispose();
          setSoundPlaying(false);
        },
        onError: () => {
          if (fileSoundRef.current !== player) return;
          fileSoundRef.current = null;
          player.dispose();
          setSoundPlaying(false);
          setSoundFailed(true);
        },
      });
      fileSoundRef.current = player;
      setSoundPlaying(true);
      player.play();
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
    const f = fileRef.current;
    if (f) {
      const s = f.state;
      if (s === "paused" || s === "stopped") f.resume();
      else if (s === "playing" || s === "buffering" || s === "loading") f.pause();
      else if (s === "error") continueFile();
      return;
    }
    if (phase === "playing" && scopeRef.current[playingPosRef.current]?.part.audio) {
      continueFile(); // the recording was stopped (e.g. a submit that didn't go through)
      return;
    }
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
    fileRef.current?.setRate(r);
    fileSoundRef.current?.setRate(r);
  }

  // Practice controls for a recording.
  function seekFile(ms: number) {
    fileRef.current?.seek(ms);
  }

  function seekFileBy(deltaMs: number) {
    const f = fileRef.current;
    if (f) f.seek(f.snapshot.positionMs + deltaMs);
  }

  function replayFile() {
    const f = fileRef.current;
    const audio = scopeRef.current[playingPosRef.current]?.part.audio;
    if (!f || !audio) return;
    f.seek(scriptStartMs(audio));
    if (f.state === "paused" || f.state === "stopped") f.resume();
  }

  /** Stopped by the system → continue; failed → reload at the same place. */
  function continueFile() {
    if (doneRef.current || submittingRef.current) return;
    const f = fileRef.current;
    setAudioError(null);
    if (f && f.state === "error") f.retry();
    else if (f && (f.state === "stopped" || f.state === "paused")) f.resume();
    else startPart(playingPosRef.current, false, fileSnap.positionMs);
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
  const barEntry = phase === "intro" ? startEntry : playingEntry;
  /** The part the bar is about has a recording (time-based bar, file controls). */
  const barAudio = barEntry.part.audio;
  const fileLive = phase === "playing" && !!playingEntry.part.audio;
  const fileInfo = fileLive && playingEntry.part.audio ? positionInfo(playingEntry.part.audio, fileSnap.positionMs) : null;
  const fileGapLeftMs = fileInfo?.reading && fileInfo.gap ? Math.max(0, fileInfo.gap.endMs - fileSnap.positionMs) / (practice ? rate : 1) : 0;

  let barStatus: AudioBarStatus;
  if (supported === false && !barAudio) barStatus = "unsupported";
  else if (phase === "check") barStatus = "finished";
  else if (phase === "intro") barStatus = "ready";
  else if (barAudio) {
    if (audioError || fileSnap.state === "error") barStatus = "error";
    else if (fileSnap.state === "playing") barStatus = fileInfo?.reading ? "reading" : "playing";
    else if (fileSnap.state === "buffering") barStatus = "buffering";
    else if (fileSnap.state === "paused") barStatus = "paused";
    // Interrupted by the system: practice shows it as paused (Play resumes); the exam offers Continue.
    else if (fileSnap.state === "stopped") barStatus = practice ? "paused" : "stopped";
    else if (fileSnap.state === "ended") barStatus = "playing";
    else barStatus = "starting";
  } else if (audioError || snap.state === "error") barStatus = "error";
  else if (snap.state === "speaking" || snap.state === "ended") barStatus = "playing";
  else if (snap.state === "silence") barStatus = snap.silenceMs >= READING_GAP_MS ? "reading" : "playing";
  else if (snap.state === "paused") barStatus = "paused";
  else if (snap.state === "stopped") barStatus = "stopped";
  else barStatus = "starting";

  const barLines = barAudio ? scriptLineCount(barAudio) : phase === "playing" ? programme.scriptCount : recordingLines(barEntry.part).length;
  const barLine = barAudio
    ? phase === "check"
      ? barLines
      : fileInfo
        ? fileInfo.line
        : 0
    : phase === "playing"
      ? Math.max(0, Math.min(programme.scriptCount, snap.line - programme.scriptStart + 1))
      : phase === "check"
        ? barLines
        : 0;
  const barStart =
    barStatus === "ready"
      ? () => beginRun(startPos, resumeFrom != null)
      : barStatus === "stopped" || barStatus === "error"
        ? fileLive
          ? continueFile
          : () => startPart(playingPos)
        : undefined;
  const barStartLabel =
    barStatus === "error"
      ? "Try again"
      : barStatus === "stopped"
        ? fileLive
          ? "Continue"
          : `Continue from Part ${playingEntry.no}`
        : resumeFrom != null
          ? `Continue from Part ${startEntry.no}`
          : "Start";
  const reading = barAudio
    ? !!fileInfo?.reading && (barStatus === "reading" || barStatus === "paused")
    : barStatus === "reading" || (snap.state === "paused" && snap.silenceLeftMs >= READING_GAP_MS);
  const transcriptAvailable = practice && (supported === false || !!audioError) && transcriptLines(activeEntry.part).length > 0;
  /** Reading time before each part, as the student will hear it (a recording has the exam's 30 s). */
  const introReadingSeconds = startEntry.part.audio ? EXAM_READING_SECONDS : readingSeconds;
  const resumeRecording = resumeFrom != null && !!startEntry.part.audio && resumeAtMs != null && resumeAtMs > 0;

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
        silenceEndsAt={barAudio ? null : snap.silenceEndsAt}
        silenceLeftMs={barAudio ? fileGapLeftMs : snap.silenceLeftMs}
        rate={rate}
        rates={barAudio ? FILE_RATES : undefined}
        onRateChange={practice ? changeRate : undefined}
        onTogglePause={practice ? togglePause : undefined}
        onReplay={practice ? (fileLive ? replayFile : () => startPart(playingPos, true)) : undefined}
        onSkip={
          practice && reading
            ? fileLive
              ? () => {
                  if (fileInfo?.gap) seekFile(Math.max(0, fileInfo.gap.endMs - 200));
                }
              : () => playerRef.current?.skipSilence()
            : undefined
        }
        onStart={submitting ? undefined : barStart}
        startLabel={barStartLabel}
        startDisabled={barAudio ? false : supported == null}
        message={barStatus === "error" ? audioError ?? (barAudio ? fileErrorText(fileSnap.error ?? "") : audioErrorText("")) : null}
        timeMs={barAudio ? (phase === "intro" ? resumeAtMs ?? 0 : fileSnap.positionMs) : undefined}
        durationMs={barAudio ? barAudio.durationMs : undefined}
        bufferedMs={fileLive ? fileSnap.bufferedMs : undefined}
        onSeek={practice && fileLive ? seekFile : undefined}
        onSeekBy={practice && fileLive ? seekFileBy : undefined}
      />
    </>
  );

  const partsWord = scope.length === 1 ? "one recording" : `${countWord(scope.length)} recordings`;

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

        {/* No speech synthesis, and some part needs it */}
        {!finished && supported === false && needsTts && (
          <section role="alert" className="error-surface mb-6 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
              <div className="min-w-0">
                <h2 className="font-semibold text-red-200">
                  {anyFile
                    ? "Some parts of this test are read by your browser's voices, which aren't available here — open Averna in Chrome, Edge or Safari."
                    : "Audio isn't available in this browser — open Averna in Chrome, Edge or Safari."}
                </h2>
                <p className="mt-1 text-sm text-red-100/80">
                  {practice
                    ? "You can still practise: read the transcript instead, then answer the questions below."
                    : `You can still answer the questions and submit this section, but without the recording your score won't reflect your listening. If you can, reopen the ${examName.toLowerCase()} in Chrome, Edge or Safari.`}
                </p>
                {practice && transcriptLines(activeEntry.part).length > 0 && (
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
        {!finished && (supported !== false || !!startEntry.part.audio) && phase === "intro" && (
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
                  {resumeFrom != null ? "Welcome back" : "Before you start"}
                </h2>
              </div>
            </div>

            {resumeFrom != null ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span>
                  {resumeRecording ? (
                    <>Your answers are saved. The recording of Part {startEntry.no} will continue from where it stopped.</>
                  ) : (
                    <>
                      Your answers are saved. The recording can&apos;t pick up mid-sentence, so Part {startEntry.no} will start again
                      from the beginning.
                    </>
                  )}
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
                    `Each part starts with a short introduction, then ${introReadingSeconds} seconds to look at the questions${
                      practice && startEntry.part.audio ? " (press Skip to start sooner)" : ""
                    }.`,
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
                onClick={() => beginRun(startPos, resumeFrom != null)}
                disabled={(!startEntry.part.audio && supported == null) || submitting}
                className={primaryBtn}
              >
                <Play className="h-4 w-4" aria-hidden />
                {resumeFrom != null ? `Continue from Part ${startEntry.no}` : "Start the test"}
              </button>
              <button
                type="button"
                onClick={toggleSoundCheck}
                disabled={!startEntry.part.audio && supported == null}
                aria-pressed={soundPlaying}
                className={secondaryBtn}
              >
                {soundPlaying ? <Square className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                {soundPlaying ? "Stop the sound check" : "Play a sound check"}
              </button>
              {practice && resumeFrom != null && resumeFrom > 0 && (
                <button
                  type="button"
                  onClick={() => beginRun(0, false)}
                  disabled={(!scope[0].part.audio && supported == null) || submitting}
                  className={secondaryBtn}
                >
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
                  <button type="button" onClick={() => (fileLive ? continueFile() : startPart(playingPos))} disabled={submitting} className={dangerBtn}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Try again
                  </button>
                  {transcriptAvailable && (
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
                {barStatus === "paused"
                  ? "Paused"
                  : barStatus === "reading"
                    ? "Reading time"
                    : barStatus === "stopped"
                      ? "Stopped"
                      : barStatus === "buffering" || (fileLive && barStatus === "starting")
                        ? "Loading…"
                        : "Now playing"}
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
