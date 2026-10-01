"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, Headphones, Info, Loader2, Play, RotateCcw, SkipForward, Square, Volume2 } from "lucide-react";
import type { ClientGroup, ClientListeningPart, ExamAnswers, ListeningPartAudio, ScriptLine } from "@/lib/ielts/types";
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
import type { ProgrammeLine } from "@/lib/ielts/audio/programme";
import {
  finalCutMs,
  lineRefAt,
  positionInfo,
  resumeLineIndex,
  scriptLineCount,
  scriptStartMs,
  startMsOf,
  voiceLineAt,
} from "@/lib/ielts/audio/timeline";
import type { LineRef } from "@/lib/ielts/audio/timeline";
import { nextAfterPart, partCantBeHeard, readScriptLines, runContext, scriptUrl, scriptWaitMs } from "@/lib/ielts/audio/script";
import type { ScriptContext } from "@/lib/ielts/audio/script";
import { ExamShell } from "./exam-shell";
import type { ExamPartNav } from "./exam-shell";
import { QuestionGroupView } from "./question-group";
import { AudioBar, FILE_RATES } from "./audio-bar";
import type { AudioBarStatus } from "./audio-bar";
import { AudioFilePlayer, FILE_IDLE, createAudioElement, releaseMediaSession } from "./audio-file-player";
import type { FileErrorCode, FileSnapshot } from "./audio-file-player";
import { focusQuestion, useDeadline, useExamAnswers, useLeaveGuard } from "./use-exam";
import type { ListeningExamRunnerProps } from "./types";
import { ListeningRecordingRunner } from "./listening-recording-runner";
import { cn } from "@/lib/utils";

/**
 * Computer-delivered IELTS Listening. (A test with one real recording for the
 * whole test — CDI — is played by ./listening-recording-runner instead.)
 * Every part in scope plays either
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
 * Fail-open: a recording that can't be played (it keeps failing to load, or
 * stalls for good — deleted or replaced mid-sitting, Blob store restricted,
 * CDN blocked) is tried again once, then the runner fetches that part's
 * script (GET /api/listening/script) and browser voices carry on from the line
 * the recording had reached. Under exam conditions the server opens a part's
 * script only once the section clock has reached that part; asked earlier
 * ("not_yet"), the runner waits the time it is told and asks again. Without
 * speech synthesis, or when the script is refused (or keeps failing on the
 * server), the student is told the audio isn't available and can still answer
 * — and under exam conditions can go on to the next part ("Continue with Part
 * N", or the answer check after the last part), so the later recordings still
 * play.
 *
 * mock = exam conditions: the recording plays once, no pause / replay / speed / seeking;
 * after a refresh or an audio failure browser voices continue from the sentence
 * where they stopped, never from the start of the part.
 * practice = pause, replay the part, speed, skip the reading time; a recording
 * can also be scrubbed and moved ±10 s.
 */

/** The runner's props: the shared contract plus the context of the run. */
export type ListeningRunnerProps = ListeningExamRunnerProps & {
  /**
   * Whose rules the script fallback asks for when a recording can't be played
   * (lib/ielts/audio/script-access). Default: runContext — practice mode →
   * "practice"; exam conditions → "placement" for a placement form's test,
   * otherwise "mock".
   */
  context?: ScriptContext;
};

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
  /** Browser voices: the programme line they were reading (index into buildProgramme's lines). */
  line?: number;
  /** The script line / announcement playing then: finds the place again if the part switched between a recording and browser voices. */
  at?: LineRef;
  /** The part's recording couldn't be played, so browser voices were reading it (its script fetched on demand). */
  voices?: boolean;
}

/** Where browser voices continue a part (see resumeLineIndex). */
interface VoiceResume {
  line?: number;
  at?: LineRef;
}

/** early: exam conditions, and the section clock hasn't reached the part yet — ask again after `retryAfterMs`. */
type ScriptResult =
  | { ok: true; script: ScriptLine[] }
  | { ok: false; reason: "offline" | "denied" | "missing" | "failed" | "early"; retryAfterMs?: number };

const IDLE: PlayerSnapshot = { state: "idle", line: 0, total: 0, silenceEndsAt: null, silenceMs: 0, silenceLeftMs: 0 };
/** A recording is played this many times (the first try + one retry) before browser voices take over. */
const FILE_TRIES = 2;
/** Wait before trying a failed recording again. */
const FILE_RETRY_DELAY_MS = 1000;
/** A recording that has played this far since its last failure starts counting failures afresh. */
const FILE_FAILS_RESET_MS = 20_000;
const SCRIPT_TIMEOUT_MS = 15_000;
/** A script asked for before the section clock reached its part ("not_yet"): asked again after the wait the server gives (capped) … */
const SCRIPT_WAIT_MAX_MS = 60_000;
/** … at most this many times before the part counts as refused. */
const SCRIPT_WAITS = 10;
const LINE_KINDS = new Set(["intro", "preview", "end", "final"]);

function readLineRef(raw: unknown): LineRef | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.i !== "number" || !Number.isInteger(o.i) || o.i < -1) return undefined;
  if (o.i >= 0) return { i: o.i };
  return typeof o.kind === "string" && LINE_KINDS.has(o.kind) ? { i: -1, kind: o.kind as LineRef["kind"] } : undefined;
}

function refOf(line: ProgrammeLine | undefined): LineRef | undefined {
  if (!line) return undefined;
  return line.kind ? { i: line.i, kind: line.kind } : { i: line.i };
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
          pos: typeof o.pos === "number" && Number.isFinite(o.pos) && o.pos > 0 ? o.pos : undefined,
          line: typeof o.line === "number" && Number.isInteger(o.line) && o.line >= 0 ? o.line : undefined,
          at: readLineRef(o.at),
          voices: o.voices === true,
        };
      }
    }
  } catch {
    /* corrupted — ignore */
  }
  return null;
}

/** One part's script for browser voices, when its recording can't be played (see lib/ielts/audio/script). */
async function fetchScript(testId: string, part: number, context: ScriptContext): Promise<ScriptResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
  const ctrl = typeof AbortController === "function" ? new AbortController() : null;
  const timer = ctrl ? window.setTimeout(() => ctrl.abort(), SCRIPT_TIMEOUT_MS) : null;
  try {
    const res = await fetch(scriptUrl(testId, part, context), {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: ctrl?.signal,
    });
    // Signed out: the middleware answers with a redirect to the sign-in page.
    if (res.redirected) return { ok: false, reason: "denied" };
    const body: unknown = await res.json().catch(() => null);
    const script = res.ok ? readScriptLines(body) : null;
    if (script) return { ok: true, script };
    const wait = scriptWaitMs(res.status, body, res.headers.get("retry-after"));
    if (wait != null) return { ok: false, reason: "early", retryAfterMs: wait };
    return { ok: false, reason: res.status === 401 || res.status === 403 ? "denied" : res.status === 404 ? "missing" : "failed" };
  } catch {
    return { ok: false, reason: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "failed" };
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
}

function writeAudioSave(key: string, data: AudioSave): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    /* storage full / private mode */
  }
}

/** Browser-voice errors. `carryOn`: Try again continues from the sentence where it stopped (else it restarts the part). */
function audioErrorText(code: string, carryOn = false): string {
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
      return carryOn
        ? "The audio stopped unexpectedly. Press Try again to continue from where it stopped."
        : "The audio stopped unexpectedly. Press Try again to restart this part.";
  }
}

/** The recording failed and its script couldn't be fetched for browser voices either. */
function voicesErrorText(reason: Exclude<ScriptResult, { ok: true }>["reason"]): string {
  return reason === "offline" || reason === "failed"
    ? "The recording couldn't be played, and browser voices couldn't take over — check your internet connection, then press Try again."
    : "The recording can't be played right now, and browser voices can't take over. You can still answer the questions below.";
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

const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

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

/**
 * A test with ONE real recording for all its parts (CDI: `test.recording`)
 * plays it through ListeningRecordingRunner; every other test keeps the
 * per-part runner below (pre-rendered parts / browser voices), unchanged.
 */
export function ListeningExamRunner(props: ListeningRunnerProps) {
  if (props.test.recording?.url) {
    const { context: _context, ...rest } = props;
    return <ListeningRecordingRunner {...rest} />;
  }
  return <ListeningPartsRunner {...props} />;
}

function ListeningPartsRunner(props: ListeningRunnerProps) {
  const { test, partIndex, mode, attemptId, initialAnswers, onSubmit, onAutosave, exitHref, homeworkId } = props;
  const examName = props.examName?.trim() || "Mock exam";
  const router = useRouter();
  const practice = mode === "practice";
  const single = partIndex != null;
  const scriptContext: ScriptContext = props.context ?? runContext(mode, test.id);

  /** Scripts fetched for recorded parts that browser voices read instead (part index in the full test → script). */
  const [voiced, setVoiced]: State<Record<number, ScriptLine[]>> = useState<Record<number, ScriptLine[]>>({});

  const scope: ScopePart[] = useMemo(() => {
    const all = test.parts ?? [];
    const picked =
      partIndex == null
        ? all.map((part, i) => ({ part, i }))
        : all[partIndex]
          ? [{ part: all[partIndex], i: partIndex }]
          : [];
    // A recording that couldn't be played: from then on the part is read by browser voices from its fetched script.
    return picked.map(({ part, i }) => ({
      part: voiced[i] ? { ...part, script: voiced[i], audio: undefined } : part,
      no: i + 1,
      numbers: partNumbers(part),
    }));
  }, [test, partIndex, voiced]);

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
  /** Browser voices continue from here after a refresh (exam conditions, and recordings they read instead). */
  const [resumeVoice, setResumeVoice]: State<VoiceResume | null> = useState<VoiceResume | null>(null);
  /** A failed recording is being tried again / browser voices are taking over (its script is loading). */
  const [recovering, setRecovering]: State<"retry" | "voices" | null> = useState<"retry" | "voices" | null>(null);
  /** Exam conditions: the part at this scope position can't be heard (no browser voices, its script refused or failing) — the run can go on. */
  const [stuck, setStuck]: State<number | null> = useState<number | null>(null);
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
  const testRef: Ref<typeof test> = useRef(test);
  testRef.current = test;
  const voicedRef: Ref<Record<number, ScriptLine[]>> = useRef<Record<number, ScriptLine[]>>({});
  /** Recorded parts browser voices read without trying the file again (it failed before a refresh). */
  const voicesWantedRef: Ref<Set<number>> = useRef<Set<number>>(new Set<number>());
  /** Script requests in flight, by part index. */
  const scriptLoadsRef: Ref<Map<number, Promise<ScriptResult>>> = useRef<Map<number, Promise<ScriptResult>>>(new Map());
  /** The switch to browser voices that couldn't finish (Try again repeats it). */
  const pendingSwitchRef: Ref<{ pos: number; posMs?: number; resume?: VoiceResume } | null> = useRef<{
    pos: number;
    posMs?: number;
    resume?: VoiceResume;
  } | null>(null);
  /** Failures of the playing recording (bounded retries, then browser voices). */
  const fileFailsRef: Ref<{ part: number; count: number; atMs: number }> = useRef({ part: -1, count: 0, atMs: 0 });
  /** A recording of this run already failed for good: later ones hand over after their first failure. */
  const filesFailingRef: Ref<boolean> = useRef(false);
  /** Bumped whenever a part starts or the run stops: late retries and scripts are ignored. */
  const runTokenRef: Ref<number> = useRef(0);
  /** The browser-voice programme playing (to save where it is). */
  const progLinesRef: Ref<ProgrammeLine[]> = useRef<ProgrammeLine[]>([]);
  const savedLineRef: Ref<number> = useRef(-1);

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
      runTokenRef.current += 1; // a script still loading must not start anything
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
          const ms = f.snapshot.positionMs;
          const at = entry.part.audio ? lineRefAt(entry.part.audio, ms) ?? undefined : undefined;
          writeAudioSave(audioKey, { part: entry.no - 1, startedAt: startedAtRef.current ?? undefined, pos: Math.round(ms), at });
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
    const entry = scope[pos];
    const audio = entry?.part.audio;
    if (audio && saved.voices) {
      // Its recording had failed: browser voices carry on where they were (fetch the script now, so Continue can start at once).
      voicesWantedRef.current.add(entry.no - 1);
      filesFailingRef.current = true;
      void loadScript(entry.no - 1);
      setResumeVoice({ line: saved.line, at: saved.at });
    } else if (audio) {
      // A recording picks up where it stopped (a second early) — or where browser voices were, if they read this part before.
      const ms = saved.pos != null ? saved.pos - 1000 : saved.at ? startMsOf(audio, saved.at) : null;
      if (ms != null && ms > 0) setResumeAtMs(Math.max(0, Math.min(ms, audio.durationMs - 1500)));
    } else if (!practice && (saved.line != null || saved.at)) {
      // Exam conditions: browser voices continue from the sentence where they stopped (the part is heard once).
      setResumeVoice({ line: saved.line, at: saved.at });
    }
    // (Practice: browser voices restart the part.)
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
    const at = entry.part.audio ? lineRefAt(entry.part.audio, ms) ?? undefined : undefined;
    writeAudioSave(audioKey, { part: entry.no - 1, startedAt: startedAtRef.current ?? undefined, pos: Math.round(ms), at });
  }

  /** Remember the line browser voices are reading, so a refresh can continue from it (exam conditions). */
  function rememberLine(entry: ScopePart, line: number, voices: boolean) {
    if (doneRef.current || line === savedLineRef.current) return;
    savedLineRef.current = line;
    writeAudioSave(audioKey, {
      part: entry.no - 1,
      startedAt: startedAtRef.current ?? undefined,
      line,
      at: refOf(progLinesRef.current[line]),
      ...(voices ? { voices: true } : {}),
    });
  }

  /**
   * The script browser voices read instead of a recording that can't be played
   * (fetched once per part; a refresh prefetches it). From then on the part is
   * read by browser voices (`voiced`).
   */
  function loadScript(index: number): Promise<ScriptResult> {
    const have = voicedRef.current[index];
    if (have) return Promise.resolve({ ok: true, script: have });
    const pending = scriptLoadsRef.current.get(index);
    if (pending) return pending;
    const p = fetchScript(testRef.current.id, index, scriptContext).then((r: ScriptResult) => {
      scriptLoadsRef.current.delete(index);
      if (r.ok) {
        voicedRef.current = { ...voicedRef.current, [index]: r.script };
        setVoiced(voicedRef.current);
      }
      return r;
    });
    scriptLoadsRef.current.set(index, p);
    return p;
  }

  /** `resume`: where browser voices continue (a refresh under exam conditions, Try again). */
  function startPart(pos: number, fromScript = false, fromMs?: number, resume?: VoiceResume) {
    const entry = scopeRef.current[pos];
    if (!entry || doneRef.current) return;
    runTokenRef.current += 1;
    const index = entry.no - 1;
    const script = voicedRef.current[index];
    if (entry.part.audio && script) {
      // Browser voices read this recording's script (the scope catches up on the next render).
      startVoicePart(pos, { ...entry, part: { ...entry.part, script, audio: undefined } }, { fromScript, resume });
      return;
    }
    if (entry.part.audio) {
      // Its recording already failed (before a refresh, too): straight to browser voices, where they were.
      if (voicesWantedRef.current.has(index)) void switchToVoices(pos, resume ? { resume } : { posMs: fromScript ? scriptStartMs(entry.part.audio) : fromMs });
      else startFilePart(pos, entry, entry.part.audio, fromScript, fromMs);
      return;
    }
    startVoicePart(pos, entry, { fromScript, resume });
  }

  /**
   * Browser voices read a part — its own script, or the one fetched for a
   * recording that can't be played. Starts at the part's beginning, its script
   * (fromScript: practice Replay), a saved place (resume), or the line a failed
   * recording had reached (file).
   */
  function startVoicePart(
    pos: number,
    entry: ScopePart,
    start: { fromScript?: boolean; resume?: VoiceResume; file?: { audio: ListeningPartAudio; posMs: number } }
  ) {
    if (!isTtsSupported()) {
      // A part without a recording, in a browser without speech — after a recorded part, or gone on to
      // from a part that couldn't be heard: say why it's silent. Under exam conditions the run can go on
      // from here too, so the later recordings still play.
      if (fileRef.current || !practice) {
        stopFile();
        setRecovering(null);
        setPlayingPos(pos);
        setPhase("playing");
        if (activePartRef.current !== pos) setActivePart(pos);
        setCurrent((c: number | null) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
        setAudioError(audioErrorText("unsupported"));
        if (!practice) setStuck(pos);
      }
      return;
    }
    stopSoundCheck();
    stopFile();
    playerRef.current?.dispose();
    playerRef.current = null;
    setStuck(null);
    const last = pos === scopeRef.current.length - 1;
    const prog = buildProgramme(entry.part, { no: entry.no, readingSeconds, last, checkMinutes });
    const voices = !!voicedRef.current[entry.no - 1];
    // Exam conditions, and recordings read by browser voices: Try again carries on from the sentence where it stopped.
    const carryOn = !practice || voices;
    const player: ScriptPlayer = new ScriptPlayer(prog.lines, {
      voices: pickVoices(entry.part.speakers ?? [], freshVoices()),
      rate: practice ? rateRef.current : 1,
      onChange: (s) => {
        if (playerRef.current !== player) return;
        setSnap(s);
        rememberLine(entry, s.line, voices);
      },
      onEnd: () => {
        if (playerRef.current !== player) return;
        if (pos + 1 < scopeRef.current.length) startPartRef.current(pos + 1);
        else startCheckRef.current();
      },
      onError: (code) => {
        if (playerRef.current === player) setAudioError(audioErrorText(code, carryOn));
      },
    });
    playerRef.current = player;
    progLinesRef.current = prog.lines;
    savedLineRef.current = -1;
    pendingSwitchRef.current = null;
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    setAudioError(null);
    setRecovering(null);
    setResumeFrom(null);
    setResumeAtMs(null);
    setResumeVoice(null);
    setShowTranscript(false);
    setProgramme({ scriptStart: prog.scriptStart, scriptCount: prog.scriptCount });
    setPlayingPos(pos);
    setPhase("playing");
    if (activePartRef.current !== pos) setActivePart(pos);
    setCurrent((c: number | null) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
    writeAudioSave(audioKey, { part: entry.no - 1, startedAt: startedAtRef.current ?? undefined, ...(voices ? { voices: true } : {}) });
    let from = start.fromScript ? prog.scriptStart : 0;
    if (start.file) from = voiceLineAt(start.file.audio, start.file.posMs, prog.lines);
    else if (start.resume) from = resumeLineIndex(prog.lines, start.resume.line, start.resume.at) ?? from;
    const range = partRange(entry.part);
    setAnnounce(
      start.file
        ? `The recording of Part ${entry.no} couldn't be played. Browser voices continue from where it stopped.`
        : `Part ${entry.no} is ${start.resume && from > 0 ? "continuing" : "starting"}.${range ? ` ${rangeLabel(range.from, range.to)}.` : ""}`
    );
    // Synchronous first speak() — inside the tap that started it (required on iOS).
    player.play(from);
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
    setResumeVoice(null);
    setShowTranscript(false);
    setStuck(null);
    setPlayingPos(pos);
    setPhase("playing");
    if (activePartRef.current !== pos) setActivePart(pos);
    setCurrent((c: number | null) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
    const range = partRange(entry.part);
    setAnnounce(`Part ${entry.no} is starting.${range ? ` ${rangeLabel(range.from, range.to)}.` : ""}`);
    const startMs = fromScript ? scriptStartMs(audio) : Math.max(0, Math.min(fromMs ?? 0, audio.durationMs - 1000));
    const el = ensureMedia();
    if (!el) {
      // No audio element in this browser: browser voices read the part instead (if it has them).
      void switchToVoices(pos, { posMs: startMs });
      return;
    }
    setAudioError(null);
    setRecovering(null);
    pendingSwitchRef.current = null;
    // Practising one part on its own: the run gives its own checking time, so stop before the file's end-of-test line.
    const endAtMs = single ? finalCutMs(audio) : undefined;
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
        if (s.state === "playing") {
          setAudioError(null); // recovered
          setRecovering(null);
          // Playing well again for a while: earlier failures no longer count.
          const fails = fileFailsRef.current;
          if (fails.part === entry.no - 1 && fails.count > 0 && s.positionMs - fails.atMs > FILE_FAILS_RESET_MS) {
            fileFailsRef.current = { ...fails, count: 0 };
          }
        }
        rememberPos(entry, s.positionMs);
      },
      onEnd: () => {
        if (fileRef.current !== player) return;
        if (pos + 1 < scopeRef.current.length) startPartRef.current(pos + 1);
        else startCheckRef.current();
      },
      onError: (code) => {
        if (fileRef.current === player) onFileError(pos, entry, player, code);
      },
    });
    fileRef.current = player;
    setFileSnap(player.snapshot);
    savedPosRef.current = startMs;
    writeAudioSave(audioKey, {
      part: entry.no - 1,
      startedAt: startedAtRef.current ?? undefined,
      pos: Math.round(startMs),
      at: lineRefAt(audio, startMs) ?? undefined,
    });
    // Synchronous play() — inside the tap that started it (mobile autoplay rules).
    player.play();
  }

  /**
   * A recording failed. Autoplay blocked or offline: the student's Try again
   * fixes that. Otherwise the file is tried once more by itself, then browser
   * voices take over from where it stopped — at once for a stall that didn't
   * recover, or when a recording of this run has already failed for good.
   */
  function onFileError(pos: number, entry: ScopePart, player: AudioFilePlayer, code: FileErrorCode) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (code === "not-allowed" || offline) {
      setRecovering(null);
      setAudioError(fileErrorText(offline ? "network" : code));
      return;
    }
    const index = entry.no - 1;
    const prev = fileFailsRef.current;
    const count = (prev.part === index ? prev.count : 0) + 1;
    const posMs = player.snapshot.positionMs;
    fileFailsRef.current = { part: index, count, atMs: posMs };
    const tries = code === "stalled" || filesFailingRef.current ? 1 : FILE_TRIES;
    if (count < tries) {
      setRecovering("retry");
      const token = runTokenRef.current;
      window.setTimeout(() => {
        if (token === runTokenRef.current && fileRef.current === player && player.state === "error" && !doneRef.current) player.retry();
      }, FILE_RETRY_DELAY_MS);
      return;
    }
    void switchToVoices(pos, { posMs });
  }

  /**
   * Fail-open: this part's recording can't be played. Fetch its script and let
   * browser voices carry on from the line the recording had reached (`posMs`),
   * or from where they were before a refresh (`resume`) — never from the start
   * of the part under exam conditions. Asked before the section clock reached
   * the part ("not_yet": a recording failed while browser voices ran ahead of
   * the files), it waits as told and asks again. Without speech synthesis, or
   * when the script is refused, the student is told the audio isn't available
   * and can still answer (practice also gets the transcript; exam conditions can
   * go on to the next part — skipPart).
   */
  async function switchToVoices(pos: number, opts: { posMs?: number; resume?: VoiceResume }) {
    const entry = scopeRef.current[pos];
    if (!entry || doneRef.current) return;
    const index = entry.no - 1;
    const audio = testRef.current.parts?.[index]?.audio;
    const token = ++runTokenRef.current;
    stopSoundCheck();
    playerRef.current?.dispose();
    playerRef.current = null;
    stopFile();
    filesFailingRef.current = true;
    pendingSwitchRef.current = { pos, ...opts };
    if (startedAtRef.current == null) startedAtRef.current = Date.now();
    setResumeFrom(null);
    setResumeAtMs(null);
    setResumeVoice(null);
    setShowTranscript(false);
    setStuck(null);
    setPlayingPos(pos);
    setPhase("playing");
    if (activePartRef.current !== pos) setActivePart(pos);
    setCurrent((c: number | null) => (c != null && entry.numbers.includes(c) ? c : entry.numbers[0] ?? null));
    const tts = isTtsSupported();
    if (tts) {
      voicesWantedRef.current.add(index);
      // A refresh from here on goes straight to browser voices, at this place.
      const at = opts.resume?.at ?? (audio && opts.posMs != null ? lineRefAt(audio, opts.posMs) ?? undefined : undefined);
      writeAudioSave(audioKey, { part: index, startedAt: startedAtRef.current ?? undefined, voices: true, line: opts.resume?.line, at });
    } else if (!practice) {
      // No browser voices either: say so — the questions can still be answered, and the run can go on.
      setRecovering(null);
      setAudioError(audioErrorText("unsupported"));
      if (partCantBeHeard("no-voices")) setStuck(pos);
      return;
    }
    setAudioError(null);
    setRecovering("voices");
    setAnnounce(`The recording of Part ${entry.no} couldn't be played. Switching to browser voices.`);
    let r = await loadScript(index);
    // Exam conditions, asked before the section clock reached this part: wait as long as the server says, then ask again.
    for (let waits = 0; !r.ok && r.reason === "early" && waits < SCRIPT_WAITS; waits++) {
      if (token !== runTokenRef.current || doneRef.current) return;
      await pause(Math.min(SCRIPT_WAIT_MAX_MS, Math.max(1000, r.retryAfterMs ?? 5000)));
      if (token !== runTokenRef.current || doneRef.current) return;
      r = await loadScript(index);
    }
    if (token !== runTokenRef.current || doneRef.current) return; // another part started, or the run ended, meanwhile
    setRecovering(null);
    if (!r.ok) {
      setAudioError(voicesErrorText(r.reason));
      if (!practice && partCantBeHeard(r.reason)) setStuck(pos);
      return;
    }
    if (!tts) {
      setAudioError(audioErrorText("unsupported")); // practice: the transcript can be read instead
      return;
    }
    const voicedEntry: ScopePart = { ...entry, part: { ...entry.part, script: r.script, audio: undefined } };
    startVoicePart(pos, voicedEntry, opts.resume ? { resume: opts.resume } : audio && opts.posMs != null ? { file: { audio, posMs: opts.posMs } } : {});
  }

  /** Start (or continue) the run from a tap: unlock whatever later parts will need, then play. */
  function beginRun(pos: number, resume: boolean) {
    const entry = scopeRef.current[pos];
    if (!entry || doneRef.current) return;
    // Browser voices may be needed later — for a part without a recording, or for a recording that can't
    // be played: this tap unlocks speech (iOS only speaks after a speak() made inside a tap).
    if (entry.part.audio) unlockSpeech();
    if (!entry.part.audio && scopeRef.current.some((s) => !!s.part.audio)) primeMedia();
    startPart(pos, false, resume && entry.part.audio ? resumeAtMs ?? undefined : undefined, resume ? resumeVoice ?? undefined : undefined);
  }

  /**
   * Exam conditions, a part that can't be heard (no browser voices, its script
   * refused or failing): go on to the next part — or to the answer check after
   * the last one — so the later recordings still play. Inside the tap, like
   * Start (autoplay rules). The part's questions stay open.
   */
  function skipPart() {
    if (doneRef.current || submittingRef.current || practice) return;
    const pos = playingPosRef.current;
    if (stuck !== pos) return;
    const next = nextAfterPart(pos, scopeRef.current.length);
    setStuck(null);
    setAudioError(null);
    pendingSwitchRef.current = null;
    if (next.kind === "check") {
      startCheck();
      return;
    }
    // A recorded part may need browser voices later on (iOS only speaks after a speak() made inside a tap).
    if (scopeRef.current[next.pos]?.part.audio) unlockSpeech();
    startPart(next.pos);
  }

  function startCheck() {
    playerRef.current?.dispose();
    playerRef.current = null;
    stopFile();
    runTokenRef.current += 1;
    pendingSwitchRef.current = null;
    setRecovering(null);
    setStuck(null);
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
    runTokenRef.current += 1; // a retry or a script still loading must not start the audio again
    setRecovering(null);
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
    // A recorded test: play the start of the recording itself (its narrator, at its volume) — unless that
    // recording already failed and browser voices will read the part.
    const checkEntry = scopeRef.current[resumeFrom ?? 0] ?? scopeRef.current[0];
    const audio = checkEntry && !voicesWantedRef.current.has(checkEntry.no - 1) ? checkEntry.part.audio : undefined;
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

  /**
   * A recorded part's Continue / Try again. Stopped by the system → continue.
   * Failed → the file once more at the same place (if that fails too, browser
   * voices take over — never an endless retry), or, when browser voices already
   * tried to take over and their script didn't load, that again.
   */
  function continueFile() {
    if (doneRef.current || submittingRef.current) return;
    const pos = playingPosRef.current;
    const entry = scopeRef.current[pos];
    if (!entry) return;
    unlockSpeech(); // in this tap: browser voices may have to take over (iOS)
    const f = fileRef.current;
    setAudioError(null);
    if (f && (f.state === "stopped" || f.state === "paused")) {
      f.resume();
      return;
    }
    const pending = pendingSwitchRef.current;
    if (pending && pending.pos === pos && isTtsSupported()) {
      void switchToVoices(pos, pending);
      return;
    }
    fileFailsRef.current = { part: entry.no - 1, count: FILE_TRIES - 1, atMs: fileSnap.positionMs };
    if (f && f.state === "error") f.retry();
    else startPart(pos, false, fileSnap.positionMs);
  }

  /**
   * Browser voices stopped or failed: Continue / Try again carries on from the
   * sentence where they were under exam conditions and for a recording they
   * read instead; practice restarts a part without a recording (as before).
   */
  function retryVoices() {
    if (doneRef.current || submittingRef.current) return;
    const pos = playingPosRef.current;
    const entry = scopeRef.current[pos];
    if (!entry) return;
    const carryOn = !practice || !!voicedRef.current[entry.no - 1];
    startPart(pos, false, undefined, carryOn ? { line: snap.line, at: refOf(progLinesRef.current[snap.line]) } : undefined);
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
    // Trying the file again / browser voices taking over: shown as loading, not as an error.
    if (recovering && phase === "playing" && !audioError) barStatus = "buffering";
    else if (audioError || fileSnap.state === "error") barStatus = "error";
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
  /** Browser voices read the playing part because its recording couldn't be played. */
  const playingVoiced = phase === "playing" && !!voiced[playingEntry.no - 1];
  /** Continue / Try again on browser voices carries on from the sentence where they stopped (else practice restarts the part). */
  const voicesCarryOn = !practice || playingVoiced;
  const barStart =
    barStatus === "ready"
      ? () => beginRun(startPos, resumeFrom != null)
      : barStatus === "stopped" || barStatus === "error"
        ? fileLive
          ? continueFile
          : retryVoices
        : undefined;
  const barStartLabel =
    barStatus === "error"
      ? "Try again"
      : barStatus === "stopped"
        ? fileLive || voicesCarryOn
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
  /** Browser voices will continue the part mid-way after the refresh (not from its first line). */
  const resumeVoices =
    resumeFrom != null && !!resumeVoice && ((resumeVoice.line ?? 0) > 0 || (!!resumeVoice.at && resumeVoice.at.kind !== "intro"));
  /** Exam conditions: the playing part can't be heard — offer to go on (skipPart). */
  const canGoOn = !practice && phase === "playing" && stuck === playingPos;
  const goOn = nextAfterPart(playingPos, scope.length);
  const goOnLabel = goOn.kind === "part" ? `Continue with Part ${scope[goOn.pos]?.no ?? playingEntry.no + 1}` : "Go to the answer check";
  /** Try again can't help a part without a recording in a browser without speech. */
  const retryUseless = supported === false && !playingEntry.part.audio;

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
                  ) : resumeVoices ? (
                    <>Your answers are saved. Part {startEntry.no} will continue from the sentence where it stopped.</>
                  ) : practice ? (
                    <>
                      Your answers are saved. The recording can&apos;t pick up mid-sentence, so Part {startEntry.no} will start again
                      from the beginning.
                    </>
                  ) : (
                    <>Your answers are saved. Part {startEntry.no} will start from the beginning.</>
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

        {/* A recording that couldn't be played: browser voices take over */}
        {!finished && phase === "playing" && !audioError && (recovering === "voices" || playingVoiced) && (
          <p role="status" className="mb-6 flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
            {recovering === "voices" ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300 motion-safe:animate-spin" aria-hidden />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            )}
            <span>
              {recovering === "voices"
                ? `The recording of Part ${playingEntry.no} couldn't be played — switching to your browser's voices…`
                : `The recording of Part ${playingEntry.no} couldn't be played, so your browser's voices are reading it instead.`}
            </span>
          </p>
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
                  {!retryUseless && (
                    <button type="button" onClick={() => (fileLive ? continueFile() : retryVoices())} disabled={submitting} className={dangerBtn}>
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Try again
                    </button>
                  )}
                  {canGoOn && (
                    <button type="button" onClick={skipPart} disabled={submitting} className={secondaryBtn}>
                      <SkipForward className="h-4 w-4" aria-hidden />
                      {goOnLabel}
                    </button>
                  )}
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
                {canGoOn && (
                  <p className="mt-2 text-xs text-red-100/70">
                    {goOn.kind === "part"
                      ? `The next recording plays from the start of Part ${scope[goOn.pos]?.no ?? playingEntry.no + 1}.`
                      : "The time to check your answers starts, then the test is submitted."}{" "}
                    You can still answer the Part {playingEntry.no} questions after you go on.
                  </p>
                )}
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
