/**
 * Browser speech I/O for the IELTS Speaking simulator.
 *
 * Client-only and framework-free: nothing touches `window` at import time, so
 * any client component can import it safely.
 *
 *  - `Recorder` — continuous speech-to-text for ONE answer (Web Speech API).
 *    Chrome closes a recognition session whenever the candidate pauses; the
 *    recorder quietly reopens it and keeps accumulating the final results, so
 *    a two-minute Part 2 answer survives thinking pauses.
 *  - `speak()`  — the examiner's voice (speechSynthesis): one consistent
 *    British voice for the whole test, resolving when the line has been spoken
 *    (with fallbacks for browsers that lose the `end` event).
 */

// ---------------------------------------------------------------------------
// Speech recognition
// ---------------------------------------------------------------------------

/* Minimal structural types — lib.dom doesn't declare the recogniser itself. */
interface RecAlternative {
  readonly transcript: string;
}
interface RecResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: RecAlternative;
}
interface RecResultList {
  readonly length: number;
  readonly [index: number]: RecResult;
}
interface RecResultEvent {
  readonly resultIndex: number;
  readonly results: RecResultList;
}
interface RecErrorEvent {
  readonly error: string;
}
interface RecInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecResultEvent) => void) | null;
  onerror: ((event: RecErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecConstructor = new () => RecInstance;

function recognitionConstructor(): RecConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecConstructor; webkitSpeechRecognition?: RecConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when this browser can transcribe speech (Chrome, Edge, Safari 14.1+). */
export function isRecognitionSupported(): boolean {
  return recognitionConstructor() !== null;
}

export interface RecordingResult {
  /** Everything recognised between start() and stop(). */
  transcript: string;
  /** Whole seconds from start() to stop(). */
  seconds: number;
}

export interface LiveTranscript {
  /** Settled text so far (across every automatic restart). */
  final: string;
  /** The phrase still being recognised — it may still change. */
  interim: string;
}

export type RecorderErrorCode =
  | "not-supported"
  | "not-allowed"
  | "audio-capture"
  | "network"
  | "language-not-supported"
  | "unknown";

/** `text` = final + interim, ready to display. */
export type InterimListener = (text: string, live: LiveTranscript) => void;
/** `fatal` = the recogniser gave up for this recording (switch to typing); otherwise it is retrying. */
export type RecorderErrorListener = (code: RecorderErrorCode, fatal: boolean) => void;

/** Errors after which recognition can't continue. Everything else is retried. */
const FATAL_ERRORS: Record<string, RecorderErrorCode> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "audio-capture": "audio-capture",
  "language-not-supported": "language-not-supported",
};

/** How long stop() waits for the recogniser's last results. */
const STOP_GRACE_MS = 1500;
/** Back-off ceiling when the recogniser keeps closing straight away. */
const MAX_RESTART_DELAY_MS = 2000;
/** Consecutive network errors (with nothing heard yet) before giving up. */
const MAX_NETWORK_ERRORS = 3;

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const joinText = (parts: string[]) => parts.map(tidy).filter(Boolean).join(" ");
const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,!?;:"“”‘’()[\]…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const wordsOf = (s: string) => s.split(" ").filter(Boolean);

/**
 * Joins recognised segments, collapsing cumulative repeats: Chrome on Android
 * (and occasionally other engines) re-sends a growing phrase as several final
 * results — "I like" → "I like reading" → "I like reading books".
 */
function collapseRepeats(segments: string[], minWords: number): string[] {
  const out: string[] = [];
  for (const raw of segments) {
    const seg = tidy(raw);
    if (!seg) continue;
    if (out.length) {
      const a = normalise(out[out.length - 1]);
      const b = normalise(seg);
      if (b && wordsOf(a).length >= minWords) {
        if (b === a || b.startsWith(`${a} `)) {
          out[out.length - 1] = seg; // the new segment extends the previous one
          continue;
        }
        if (wordsOf(b).length >= minWords && a.startsWith(`${b} `)) continue; // a stale, shorter copy
      }
    }
    out.push(seg);
  }
  return out;
}

/** The unfinished phrase, minus any copy of the last settled phrase it repeats. */
function interimTail(lastFinal: string | undefined, interim: string, minWords: number): string {
  const tail = tidy(interim);
  if (!tail || !lastFinal) return tail;
  const a = normalise(lastFinal);
  const b = normalise(tail);
  if (wordsOf(a).length < minWords) return tail;
  if (b === a || a.startsWith(`${b} `)) return "";
  if (b.startsWith(`${a} `)) return wordsOf(tail).slice(wordsOf(tidy(lastFinal)).length).join(" ");
  return tail;
}

/**
 * Continuous speech-to-text for one answer.
 *
 *   const rec = new Recorder();
 *   const off = rec.onInterim((text) => setLive(text));
 *   rec.start();
 *   …
 *   const { transcript, seconds } = await rec.stop();
 *
 * One instance can record many answers in turn (start → stop → start …).
 * Call dispose() when the page goes away.
 */
export class Recorder {
  readonly lang: string;
  /** Repeat-collapsing threshold: 1 word on Android (known duplication bug), 3 elsewhere. */
  private readonly minRepeatWords: number;
  private rec: RecInstance | null = null;
  /** Bumped whenever a session is replaced, so late events from old sessions are ignored. */
  private generation = 0;
  private recording = false;
  private startedAt = 0;
  private sessionStartedAt = 0;
  private sessionHeard = false;
  private committed: string[] = [];
  private sessionFinal: string[] = [];
  private sessionInterim = "";
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private quickEnds = 0;
  private networkErrors = 0;
  private failure: RecorderErrorCode | null = null;
  private endWaiter: (() => void) | null = null;
  private stopping: Promise<RecordingResult> | null = null;
  private readonly interimListeners = new Set<InterimListener>();
  private readonly errorListeners = new Set<RecorderErrorListener>();

  constructor(options: { lang?: string } = {}) {
    this.lang = options.lang ?? "en-GB";
    const android = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
    this.minRepeatWords = android ? 1 : 3;
  }

  get isRecording(): boolean {
    return this.recording;
  }

  /** The error that stopped recognition during the current recording, if any. */
  get error(): RecorderErrorCode | null {
    return this.failure;
  }

  /** Seconds since start() while recording. */
  get elapsedSeconds(): number {
    return this.recording ? Math.max(0, (Date.now() - this.startedAt) / 1000) : 0;
  }

  /** Live transcript updates (final + interim). Returns an unsubscribe function. */
  onInterim(cb: InterimListener): () => void {
    this.interimListeners.add(cb);
    return () => {
      this.interimListeners.delete(cb);
    };
  }

  /** Recognition problems. Returns an unsubscribe function. */
  onError(cb: RecorderErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => {
      this.errorListeners.delete(cb);
    };
  }

  /** Start a new recording (clears the previous transcript). No-op while already recording. */
  start(): void {
    if (this.recording) return;
    // Settle a stop() still waiting on the previous session before starting afresh.
    const waiter = this.endWaiter;
    this.endWaiter = null;
    waiter?.();
    this.clearRestart();
    this.teardownSession();
    this.committed = [];
    this.sessionFinal = [];
    this.sessionInterim = "";
    this.failure = null;
    this.networkErrors = 0;
    this.quickEnds = 0;
    this.stopping = null;
    this.endWaiter = null;
    this.recording = true;
    this.startedAt = Date.now();
    this.emit();
    this.openSession();
  }

  /**
   * Stop recording. Resolves once the recogniser has delivered its last
   * results (or after a short grace period). Calling it again returns the same
   * result.
   */
  stop(): Promise<RecordingResult> {
    if (this.stopping) return this.stopping;
    const seconds = this.recording ? Math.max(0, Math.round((Date.now() - this.startedAt) / 1000)) : 0;
    this.recording = false;
    this.clearRestart();
    const rec = this.rec;
    this.stopping = new Promise<RecordingResult>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        this.endWaiter = null;
        // No `end` in time: keep what was heard and drop the session.
        if (this.rec) {
          this.commitSession();
          this.teardownSession();
        }
        this.emit();
        resolve({ transcript: joinText(this.committed), seconds });
      };
      if (!rec) {
        finish();
        return;
      }
      this.endWaiter = finish;
      timer = setTimeout(finish, STOP_GRACE_MS);
      try {
        rec.stop();
      } catch {
        finish();
      }
    });
    return this.stopping;
  }

  /** Stop immediately without waiting for final results (e.g. the page is closing). */
  cancel(): void {
    this.recording = false;
    this.clearRestart();
    this.teardownSession();
    const waiter = this.endWaiter;
    this.endWaiter = null;
    waiter?.();
  }

  /** cancel() + drop every listener. */
  dispose(): void {
    this.cancel();
    this.interimListeners.clear();
    this.errorListeners.clear();
  }

  // -- internals --------------------------------------------------------------

  private openSession(): void {
    const Ctor = recognitionConstructor();
    if (!Ctor) {
      this.fail("not-supported");
      return;
    }
    let rec: RecInstance;
    try {
      rec = new Ctor();
    } catch {
      this.fail("not-supported");
      return;
    }
    const gen = ++this.generation;
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      if (gen === this.generation) this.handleResult(e);
    };
    rec.onerror = (e) => {
      if (gen === this.generation) this.handleError(e);
    };
    rec.onend = () => {
      if (gen === this.generation) this.handleEnd();
    };
    this.rec = rec;
    this.sessionStartedAt = Date.now();
    this.sessionHeard = false;
    this.sessionFinal = [];
    this.sessionInterim = "";
    try {
      rec.start();
    } catch {
      // e.g. InvalidStateError straight after the previous session — retry shortly.
      this.teardownSession();
      this.quickEnds++;
      this.scheduleRestart();
    }
  }

  private handleResult(e: RecResultEvent): void {
    const finals: string[] = [];
    let interim = "";
    const results = e.results;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const text = r && r.length > 0 && r[0] ? r[0].transcript : "";
      if (!text || !text.trim()) continue;
      if (r.isFinal) finals.push(text);
      else interim += ` ${text}`;
    }
    this.sessionFinal = collapseRepeats(finals, this.minRepeatWords);
    this.sessionInterim = tidy(interim);
    if (this.sessionFinal.length || this.sessionInterim) {
      this.sessionHeard = true;
      this.networkErrors = 0;
      this.quickEnds = 0;
    }
    this.emit();
  }

  private handleError(e: RecErrorEvent): void {
    const code = e && typeof e.error === "string" ? e.error : "unknown";
    // Silence / our own abort: `end` follows and the session is reopened.
    if (code === "no-speech" || code === "aborted") return;
    if (code === "network") {
      this.networkErrors++;
      if (this.networkErrors >= MAX_NETWORK_ERRORS && !this.hasText()) this.fail("network");
      else this.notify("network", false);
      return;
    }
    const fatal = FATAL_ERRORS[code];
    if (fatal) {
      // A background tab can be refused the microphone for a while — keep retrying.
      if (fatal === "not-allowed" && typeof document !== "undefined" && document.visibilityState === "hidden") return;
      this.fail(fatal);
      return;
    }
    this.notify("unknown", false);
  }

  private handleEnd(): void {
    this.commitSession();
    this.rec = null;
    this.generation++;
    const waiter = this.endWaiter;
    if (waiter) {
      waiter();
      return;
    }
    if (!this.recording || this.failure) return;
    // Chrome ends the session after a pause (or about a minute): reopen while the answer continues.
    const quick = Date.now() - this.sessionStartedAt < 1000 && !this.sessionHeard;
    this.quickEnds = quick ? this.quickEnds + 1 : 0;
    this.scheduleRestart();
  }

  private scheduleRestart(): void {
    if (this.restartTimer || !this.recording || this.failure) return;
    const delay = this.quickEnds === 0 ? 0 : Math.min(MAX_RESTART_DELAY_MS, 120 * 2 ** this.quickEnds);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.recording && !this.failure && !this.rec) this.openSession();
    }, delay);
  }

  private clearRestart(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  private teardownSession(): void {
    const rec = this.rec;
    this.rec = null;
    this.generation++;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.abort();
    } catch {
      /* already closed */
    }
  }

  /** Move the live session's text (finals + any unfinished tail) into the transcript. */
  private commitSession(): void {
    const text = joinText([...this.sessionFinal, this.currentInterim()]);
    if (text) this.committed.push(text);
    this.sessionFinal = [];
    this.sessionInterim = "";
  }

  private currentInterim(): string {
    return interimTail(this.sessionFinal[this.sessionFinal.length - 1], this.sessionInterim, this.minRepeatWords);
  }

  private hasText(): boolean {
    return this.committed.length > 0 || this.sessionFinal.length > 0 || this.sessionInterim.length > 0;
  }

  private fail(code: RecorderErrorCode): void {
    if (this.failure) return;
    this.failure = code;
    this.clearRestart();
    this.commitSession();
    this.teardownSession();
    // A stop() waiting for `end` won't get one from the torn-down session — settle it now.
    const waiter = this.endWaiter;
    this.endWaiter = null;
    waiter?.();
    this.emit();
    this.notify(code, true);
    // Keep `recording` true: stop() still reports the seconds and what was heard.
  }

  private emit(): void {
    const live: LiveTranscript = {
      final: joinText([...this.committed, ...this.sessionFinal]),
      interim: this.currentInterim(),
    };
    const text = joinText([live.final, live.interim]);
    this.interimListeners.forEach((cb) => {
      try {
        cb(text, live);
      } catch {
        /* a listener bug must not break recording */
      }
    });
  }

  private notify(code: RecorderErrorCode, fatal: boolean): void {
    this.errorListeners.forEach((cb) => {
      try {
        cb(code, fatal);
      } catch {
        /* ignore */
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Examiner voice (speech synthesis)
// ---------------------------------------------------------------------------

/** Slightly slower than default — a clear, measured examiner. */
export const EXAMINER_RATE = 0.95;

/** No `start` within this long → the utterance was dropped (retried once) or the browser can't speak. */
const SPEAK_START_TIMEOUT_MS = 4000;
/** How long speak() waits for the voice list to load (Chrome loads it asynchronously). */
const VOICE_LOAD_TIMEOUT_MS = 1500;

export interface ExaminerVoiceInfo {
  name: string;
  lang: string;
  /** False when the device has no en-GB voice and another English voice is used. */
  british: boolean;
}

export interface SpeakOptions {
  /** Abort to cut the examiner off; the promise resolves straight away. */
  signal?: AbortSignal;
  /**
   * Called when the line couldn't be spoken:
   * "blocked" (autoplay policy), "no-start" (nothing happened), "voice-failed", "failed".
   */
  onError?: (reason: string) => void;
}

type ChunkOutcome = "ok" | "cancelled" | "blocked" | "voice-failed" | "no-start" | "failed";

/** Undefined = not chosen yet; null = no usable voice list (the platform default is used). */
let lockedVoice: SpeechSynthesisVoice | null | undefined;
let voicesLoading: Promise<SpeechSynthesisVoice[]> | null = null;
/** The voice list stayed empty once — don't make every later line wait for it again. */
let voiceListTimedOut = false;
const failedVoices = new Set<string>();
/** Strong references: Chrome drops the events of garbage-collected utterances. */
const liveUtterances = new Set<SpeechSynthesisUtterance>();
/** Resolvers of the chunks in flight, so stopSpeaking() settles every pending speak(). */
const pendingChunks = new Set<() => void>();

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

const voiceKey = (v: SpeechSynthesisVoice) => v.voiceURI || v.name;
const voiceLang = (v: SpeechSynthesisVoice) => (v.lang || "").toLowerCase().replace(/_/g, "-");
const isBritish = (v: SpeechSynthesisVoice) =>
  voiceLang(v).startsWith("en-gb") || (voiceLang(v).startsWith("en") && /united kingdom|\bbritish\b|\buk\b/i.test(v.name));

/** Higher = better examiner voice. Negative = not English. */
function voiceScore(v: SpeechSynthesisVoice): number {
  const lang = voiceLang(v);
  const name = (v.name || "").toLowerCase();
  let score: number;
  if (isBritish(v)) score = 100;
  else if (/^en-(ie|au|nz|za)/.test(lang)) score = 30;
  else if (lang.startsWith("en")) score = 15;
  else return -1;
  if (/\b(natural|neural)\b/.test(name)) score += 50; // Edge / Windows neural voices
  if (/\b(premium|enhanced)\b/.test(name)) score += 35; // Apple downloadable voices
  if (/google uk english/.test(name)) score += 30; // Chrome
  if (/\b(sonia|libby|ryan|maisie|thomas|abbi|bella|hollie|olivia|alfie|elliot|ethan|noah|oliver)\b/.test(name)) score += 15;
  if (/\b(daniel|kate|serena|arthur|martha|stephanie|jamie)\b/.test(name)) score += 20; // Apple en-GB
  if (/\b(hazel|george|susan)\b/.test(name)) score += 8; // older Windows en-GB
  // Novelty / character voices sound nothing like an examiner.
  if (/\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph)\b|bad news|good news/.test(name)) {
    score -= 60;
  }
  return score;
}

/** The best examiner voice from a list (British preferred), or null if none is English. */
export function pickExaminerVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;
  for (const v of voices) {
    if (failedVoices.has(voiceKey(v))) continue;
    const s = voiceScore(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return best;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const ready = synth.getVoices();
  if (ready.length || voiceListTimedOut) return Promise.resolve(ready);
  if (voicesLoading) return voicesLoading;
  voicesLoading = new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      clearTimeout(timer);
      synth.removeEventListener?.("voiceschanged", onChange);
      voicesLoading = null;
      const voices = synth.getVoices();
      if (!voices.length) voiceListTimedOut = true;
      resolve(voices);
    };
    const onChange = () => {
      if (synth.getVoices().length) finish();
    };
    // Some engines never fire `voiceschanged` — poll as well.
    const poll = setInterval(onChange, 100);
    const timer = setTimeout(finish, VOICE_LOAD_TIMEOUT_MS);
    synth.addEventListener?.("voiceschanged", onChange);
  });
  return voicesLoading;
}

/** The examiner's voice — chosen once, then kept for the whole session. */
async function examinerVoice(): Promise<SpeechSynthesisVoice | null> {
  if (lockedVoice !== undefined) return lockedVoice;
  const voices = await loadVoices();
  const voice = pickExaminerVoice(voices);
  // Only lock once the list is really there; an empty list may still fill in later.
  if (voices.length) lockedVoice = voice;
  return voice;
}

/** Load the voice list and choose the examiner's voice ahead of time. */
export async function prepareExaminerVoice(): Promise<ExaminerVoiceInfo | null> {
  if (!isSpeechSynthesisSupported()) return null;
  const v = await examinerVoice();
  return v ? { name: v.name, lang: v.lang, british: isBritish(v) } : null;
}

/**
 * Call synchronously inside a click handler before the first speak(): iOS
 * Safari only allows speech that was first started by a user gesture.
 */
export function primeSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try {
    const synth = window.speechSynthesis;
    synth.getVoices();
    if (synth.speaking || synth.pending) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}

/** Silence the examiner immediately; every pending speak() resolves. */
export function stopSpeaking(): void {
  if (!isSpeechSynthesisSupported()) return;
  Array.from(pendingChunks).forEach((cancel) => cancel());
  pendingChunks.clear();
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * Sentence-sized chunks: Chrome's network voices stop firing events on long
 * utterances (~15 s), and short fragments ("All right?") are merged with the
 * next sentence so the prosody stays natural.
 */
function splitForSpeech(text: string): string[] {
  const bits = text.split(/([.!?…]+["'”’)\]]*)\s+/);
  const sentences: string[] = [];
  for (let i = 0; i < bits.length; i += 2) {
    const s = `${bits[i]}${bits[i + 1] ?? ""}`.trim();
    if (!s) continue;
    if (countWords(s) > 30) {
      // Very long sentence: split at the comma closest to the middle.
      const mid = s.length / 2;
      let cut = -1;
      for (let j = s.indexOf(", "); j !== -1; j = s.indexOf(", ", j + 1)) {
        if (cut === -1 || Math.abs(j - mid) < Math.abs(cut - mid)) cut = j;
      }
      if (cut > 0) {
        sentences.push(s.slice(0, cut + 1).trim(), s.slice(cut + 2).trim());
        continue;
      }
    }
    sentences.push(s);
  }
  const chunks: string[] = [];
  for (const s of sentences) {
    const last = chunks[chunks.length - 1];
    if (last !== undefined && countWords(last) < 5 && countWords(last) + countWords(s) <= 32) chunks[chunks.length - 1] = `${last} ${s}`;
    else chunks.push(s);
  }
  return chunks.length ? chunks : [text];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function speakChunk(synth: SpeechSynthesis, text: string, voice: SpeechSynthesisVoice | null, signal?: AbortSignal): Promise<ChunkOutcome> {
  return new Promise<ChunkOutcome>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang || "en-GB";
    if (voice) u.voice = voice;
    u.rate = EXAMINER_RATE;
    u.pitch = 1;
    u.volume = 1;

    // ≈ 150 words per minute at rate 1.
    const expectedMs = (countWords(text) / (2.5 * EXAMINER_RATE)) * 1000;
    let settled = false;
    let started = false;
    let sawSpeaking = false;
    let idlePolls = 0;
    let deadline = Date.now() + SPEAK_START_TIMEOUT_MS;

    const finish = (outcome: ChunkOutcome) => {
      if (settled) return;
      settled = true;
      clearInterval(poll);
      signal?.removeEventListener("abort", onAbort);
      pendingChunks.delete(cancelChunk);
      liveUtterances.delete(u);
      u.onstart = null;
      u.onend = null;
      u.onerror = null;
      resolve(outcome);
    };
    const markStarted = () => {
      if (started) return;
      started = true;
      deadline = Date.now() + expectedMs * 1.8 + 2500;
    };
    const onAbort = () => {
      finish("cancelled");
      try {
        synth.cancel();
      } catch {
        /* ignore */
      }
    };
    const cancelChunk = () => finish("cancelled");

    u.onstart = markStarted;
    u.onend = () => finish("ok");
    u.onerror = (ev) => {
      const code = ev.error;
      if (code === "canceled" || code === "interrupted") finish("cancelled");
      else if (code === "not-allowed") finish("blocked");
      else if (code === "network" || code === "synthesis-unavailable" || code === "synthesis-failed" || code === "voice-unavailable" || code === "language-unavailable") {
        finish("voice-failed");
      } else finish("failed");
    };

    // Fallbacks for engines that lose `end` (or never fire `start`).
    const poll = setInterval(() => {
      if (synth.speaking) {
        sawSpeaking = true;
        idlePolls = 0;
        markStarted();
      } else if (started && sawSpeaking && ++idlePolls >= 3) {
        finish("ok");
        return;
      }
      if (Date.now() > deadline) {
        finish(started ? "ok" : "no-start");
        try {
          synth.cancel(); // never leave the examiner talking over the candidate
        } catch {
          /* ignore */
        }
      }
    }, 250);

    if (signal?.aborted) {
      finish("cancelled");
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    pendingChunks.add(cancelChunk);
    liveUtterances.add(u);
    try {
      synth.speak(u);
    } catch {
      finish("failed");
    }
  });
}

/**
 * Speak one examiner line in the examiner's voice. Resolves when it has been
 * spoken, was cancelled (signal / stopSpeaking) or could not be played — it
 * never rejects and never hangs.
 */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const { signal, onError } = options;
  const line = tidy(text);
  if (!line || !isSpeechSynthesisSupported() || signal?.aborted) return;
  const synth = window.speechSynthesis;
  let voice = await examinerVoice();
  if (signal?.aborted) return;
  // Whatever voice speaks first stays the examiner's voice for the rest of the session.
  if (lockedVoice === undefined) lockedVoice = voice;
  if (synth.speaking || synth.pending) {
    synth.cancel();
    await wait(80); // Chrome drops an utterance queued straight after cancel()
    if (signal?.aborted) return;
  }
  if (synth.paused) synth.resume();

  for (const chunk of splitForSpeech(line)) {
    let outcome = await speakChunk(synth, chunk, voice, signal);
    if (outcome === "no-start") {
      // Chrome occasionally drops an utterance (e.g. straight after cancel()) — try once more.
      synth.cancel();
      await wait(150);
      if (signal?.aborted) return;
      outcome = await speakChunk(synth, chunk, voice, signal);
    }
    if (outcome === "voice-failed" && voice) {
      // That voice is broken here (e.g. an offline network voice): fall back once.
      failedVoices.add(voiceKey(voice));
      lockedVoice = undefined;
      voice = await examinerVoice();
      if (lockedVoice === undefined) lockedVoice = voice;
      if (signal?.aborted) return;
      outcome = await speakChunk(synth, chunk, voice, signal);
    }
    if (outcome === "cancelled") return;
    if (outcome !== "ok") {
      onError?.(outcome);
      return;
    }
  }
}
