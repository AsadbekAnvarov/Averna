/**
 * Browser text-to-speech for the CD-IELTS Listening runner (Web Speech API).
 *
 * Client-only helpers, no React. Everything is safe to import during SSR and in
 * browsers without speechSynthesis: the helpers no-op or report "unsupported".
 *
 * - waitForVoices / onVoicesChanged: voices load asynchronously (Chrome, Firefox).
 * - pickVoices: one English voice per speaker that matches accent + gender, with
 *   different voices inside a part (pitch/rate variation when voices run out).
 * - ScriptPlayer: plays a script line by line with its scripted silences, pause /
 *   resume / speed, and the workarounds real browsers need: Chrome's long-speech
 *   stall, lost `end` events, and voices that fail (e.g. network voices offline).
 */

import type { ListeningSpeaker, ScriptLine, VoiceAccent, VoiceGender } from "./types";

/** Speaker name used for exam announcements ("Part 1. You will hear…"). */
export const NARRATOR = "Narrator";

/** Chrome cuts long utterances, so lines longer than this are split at sentence ends. */
export const MAX_UTTERANCE_CHARS = 220;

// ---------------------------------------------------------------------------
// Support + voices
// ---------------------------------------------------------------------------

export function isTtsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    !!window.speechSynthesis &&
    typeof window.speechSynthesis.speak === "function" &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

function engine(): SpeechSynthesis | null {
  return isTtsSupported() ? window.speechSynthesis : null;
}

function listVoices(s: SpeechSynthesis): SpeechSynthesisVoice[] {
  try {
    return s.getVoices() ?? [];
  } catch {
    return [];
  }
}

/** Stop anything the page is saying (also clears Chrome's queue after a reload). */
export function cancelSpeech(): void {
  try {
    engine()?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Call synchronously inside a click/tap handler BEFORE any async work: iOS
 * Safari only lets a page speak once a speak() has happened during a gesture.
 */
export function unlockSpeech(): void {
  const s = engine();
  if (!s || s.speaking || s.pending) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    u.lang = "en-GB";
    s.speak(u);
  } catch {
    /* ignore */
  }
}

const voiceListeners = new Set<(voices: SpeechSynthesisVoice[]) => void>();
let voiceHookInstalled = false;

/** Subscribe to `voiceschanged` (property fallback for old engines). Returns an unsubscribe. */
export function onVoicesChanged(cb: (voices: SpeechSynthesisVoice[]) => void): () => void {
  const s = engine();
  if (!s) return () => {};
  if (!voiceHookInstalled) {
    voiceHookInstalled = true;
    const fire = () => {
      const list = listVoices(s);
      voiceListeners.forEach((l) => {
        try {
          l(list);
        } catch {
          /* a listener must not break the others */
        }
      });
    };
    if (typeof s.addEventListener === "function") {
      s.addEventListener("voiceschanged", fire);
    } else {
      const prev = s.onvoiceschanged;
      s.onvoiceschanged = function (this: SpeechSynthesis, ev: Event) {
        prev?.call(this, ev);
        fire();
      };
    }
  }
  voiceListeners.add(cb);
  return () => {
    voiceListeners.delete(cb);
  };
}

/**
 * The browser's voices, waiting for them to load when needed. Resolves with
 * whatever is available after `timeoutMs` (possibly [] — speech still works
 * with the default voice for the utterance's `lang`).
 */
export function waitForVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const s = engine();
  if (!s) return Promise.resolve([]);
  const ready = listVoices(s);
  if (ready.length) return Promise.resolve(ready);
  return new Promise((resolve) => {
    let done = false;
    let settle: number | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.clearTimeout(settle);
      unsubscribe();
      resolve(listVoices(s));
    };
    // Chrome fires this more than once (local voices, then network ones): let it settle briefly.
    const unsubscribe = onVoicesChanged((list) => {
      if (!list.length) return;
      window.clearTimeout(settle);
      settle = window.setTimeout(finish, 250);
    });
    const timer = window.setTimeout(finish, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// Voice casting
// ---------------------------------------------------------------------------

export interface VoiceChoice {
  /** null = the browser's default voice for `lang`. */
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  /** Per-speaker rate; multiplied by the player's speed setting. */
  rate: number;
  /** BCP-47 tag for the utterance (always English, even when no voice matched). */
  lang: string;
  /** Pitch to use if `voice` fails and the default voice stands in (keeps speakers apart). */
  fallbackPitch: number;
}

const ACCENTS: VoiceAccent[] = ["british", "american", "australian"];
const ACCENT_LANG: Record<VoiceAccent, string> = { british: "en-GB", american: "en-US", australian: "en-AU" };
const ACCENT_MAIN: Record<VoiceAccent, string> = { british: "en-gb", american: "en-us", australian: "en-au" };
/** Close relatives that sound right for the accent (Irish/Scottish for British …). */
const ACCENT_NEAR: Record<VoiceAccent, string[]> = {
  british: ["en-ie", "en-scotland", "en-wls"],
  american: ["en-ca"],
  australian: ["en-nz"],
};

const FEMALE_NAMES = new Set([
  "samantha", "karen", "serena", "moira", "tessa", "fiona", "victoria", "kate", "susan", "zira", "hazel", "libby",
  "sonia", "martha", "catherine", "allison", "ava", "aria", "jenny", "michelle", "emma", "natasha", "clara", "emily",
  "molly", "leah", "luna", "neerja", "veena", "nicky", "joelle", "noelle", "zoe", "kathy", "vicki", "agnes",
  "princess", "stephanie", "amy", "olivia", "salli", "joanna", "kendra", "kimberly", "ivy", "maisie", "ana",
  "heera", "isha", "linda", "heather", "nicole", "ruth", "hayley", "sara", "sarah", "elizabeth", "abbi", "bella",
  "hollie", "ellie", "yasmin", "ashley", "cora", "jane", "nancy", "amber", "aoife", "hannah", "mia", "grandma",
  "flo", "sandy", "shelley", "tina", "annette", "natalie", "freya", "elsa", "kiri",
]);
const MALE_NAMES = new Set([
  "daniel", "alex", "fred", "oliver", "george", "arthur", "thomas", "david", "mark", "ryan", "guy", "james",
  "aaron", "tom", "lee", "gordon", "rishi", "ravi", "christopher", "eric", "roger", "steffan", "andrew", "brian",
  "william", "liam", "connor", "mitchell", "wayne", "luke", "prabhat", "evan", "nathan", "ralph", "bruce", "junior",
  "jamie", "malcolm", "richard", "sean", "reed", "rocko", "eddy", "grandpa", "matthew", "joey", "justin", "kevin",
  "russell", "geraint", "jacob", "tony", "alfie", "elliot", "ethan", "noah", "oscar", "harry", "jack", "ken",
  "darren", "duncan", "hugh", "ian", "john", "paul", "peter", "rob", "simon", "stephen", "steve", "ollie", "ken",
  "duncan", "neil", "tim", "duke",
]);
/** Good-sounding Apple voices (macOS / iOS). */
const APPLE_GOOD = new Set([
  "samantha", "daniel", "karen", "serena", "moira", "tessa", "fiona", "kate", "oliver", "arthur", "martha",
  "catherine", "gordon", "aaron", "nicky", "alex", "allison", "ava", "susan", "tom", "lee", "rishi", "veena", "zoe",
  "evan", "nathan", "joelle", "noelle", "stephanie", "jamie",
]);
/** Apple "Eloquence" voices — robotic, only if nothing else exists. */
const ELOQUENCE = new Set(["eddy", "flo", "grandma", "grandpa", "reed", "rocko", "sandy", "shelley"]);
/** Old macOS voices. */
const LEGACY = new Set(["agnes", "bruce", "fred", "junior", "kathy", "princess", "ralph", "vicki", "victoria"]);
/** Child voices sound wrong for adult speakers. */
const CHILD = new Set(["maisie", "ana", "ivy", "junior", "justin", "kevin", "princess"]);
/** macOS novelty voices — never used. */
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;

interface VoiceInfo {
  voice: SpeechSynthesisVoice;
  key: string;
  order: number;
  gender: VoiceGender | null;
  accent: VoiceAccent | null;
  /** lang is exactly the accent's main locale (en-GB / en-US / en-AU). */
  exact: boolean;
  quality: number;
}

function normLang(lang: string | undefined | null): string {
  return String(lang ?? "")
    .trim()
    .replace(/_/g, "-")
    .toLowerCase();
}

function voiceKey(v: SpeechSynthesisVoice): string {
  return `${v.voiceURI || v.name}|${normLang(v.lang)}`;
}

function tokensOf(name: string): string[] {
  return name.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

function genderOf(name: string, tokens: string[]): VoiceGender | null {
  if (tokens.includes("female") || tokens.includes("woman")) return "female";
  if (tokens.includes("male") || tokens.includes("man")) return "male";
  if (/^google us english$/i.test(name.trim())) return "female";
  for (const t of tokens) {
    if (FEMALE_NAMES.has(t)) return "female";
    if (MALE_NAMES.has(t)) return "male";
  }
  return null;
}

function accentOf(lang: string, name: string): { accent: VoiceAccent | null; exact: boolean } {
  for (const a of ACCENTS) if (lang === ACCENT_MAIN[a]) return { accent: a, exact: true };
  for (const a of ACCENTS) {
    const near = [ACCENT_MAIN[a], ...ACCENT_NEAR[a]];
    if (near.some((p) => lang === p || lang.startsWith(`${p}-`))) return { accent: a, exact: false };
  }
  // Bare "en" (Linux, some Android builds): look for hints in the name.
  const n = name.toLowerCase();
  if (/\b(uk|united kingdom|british|great britain|england)\b/.test(n)) return { accent: "british", exact: false };
  if (/\b(us|united states|american|america)\b/.test(n)) return { accent: "american", exact: false };
  if (/\b(australia|australian)\b/.test(n)) return { accent: "australian", exact: false };
  return { accent: null, exact: false };
}

function qualityOf(v: SpeechSynthesisVoice, tokens: string[]): number {
  const n = v.name.toLowerCase();
  let q = 0;
  if (/\b(natural|neural)\b/.test(n)) q += 45; // Edge "Online (Natural)" voices
  else if (/\b(premium|enhanced)\b/.test(n)) q += 35; // downloaded Apple voices
  else if (/\bgoogle\b/.test(n)) q += 22;
  else if (/\bmicrosoft\b/.test(n)) q += 6;
  else if (tokens.some((t) => APPLE_GOOD.has(t))) q += 12;
  if (tokens.some((t) => ELOQUENCE.has(t))) q -= 25;
  if (tokens.some((t) => LEGACY.has(t))) q -= 10;
  if (tokens.some((t) => CHILD.has(t))) q -= 20;
  if (v.localService) q += 3;
  if (v.default) q += 2;
  // Network voices can't work offline.
  if (!v.localService && typeof navigator !== "undefined" && navigator.onLine === false) q -= 60;
  return q;
}

function describeVoices(voices: SpeechSynthesisVoice[]): VoiceInfo[] {
  const out: VoiceInfo[] = [];
  const keys = new Set<string>();
  (voices ?? []).forEach((v, order) => {
    if (!v || typeof v.name !== "string") return;
    const lang = normLang(v.lang);
    const english = lang ? /^en(?:$|-|g)/.test(lang) : /\benglish\b/i.test(v.name);
    if (!english || NOVELTY.test(v.name)) return;
    const key = voiceKey(v);
    if (keys.has(key)) return;
    keys.add(key);
    const tokens = tokensOf(v.name);
    const { accent, exact } = accentOf(lang, v.name);
    out.push({ voice: v, key, order, gender: genderOf(v.name, tokens), accent, exact, quality: qualityOf(v, tokens) });
  });
  return out;
}

function fit(v: VoiceInfo, gender: VoiceGender | null, accent: VoiceAccent): number {
  let s = v.quality;
  if (v.accent === accent) s += v.exact ? 30 : 18;
  if (gender) {
    if (v.gender === gender) s += 40;
    else if (v.gender == null) s += 12;
    else s -= 35;
  }
  return s;
}

function rank(pool: VoiceInfo[], score: (v: VoiceInfo) => number): VoiceInfo[] {
  return pool
    .map((v) => ({ v, s: score(v) }))
    .sort((a, b) => b.s - a.s || a.v.order - b.v.order)
    .map((x) => x.v);
}

const PITCH_STEPS: Record<VoiceGender | "neutral", number[]> = {
  female: [1.12, 1.25, 0.96, 1.36],
  male: [0.85, 0.72, 1, 0.62],
  neutral: [1, 0.9, 1.1, 0.84],
};

/** A pitch for this kind of voice that stays audibly apart from the ones already taken. */
function distinctPitch(kind: VoiceGender | "neutral", taken: number[]): number {
  const steps = PITCH_STEPS[kind];
  // Speakers sharing a voice need a clear gap; the narrator only needs a nudge.
  const gap = kind === "neutral" ? 0.09 : 0.12;
  return steps.find((p) => taken.every((t) => Math.abs(t - p) >= gap)) ?? steps[steps.length - 1];
}

/**
 * Cast the voices for one part. English voices only; each speaker gets the best
 * match for their accent (default British) and gender, and different speakers
 * get different voices whenever enough exist. When voices run out, speakers
 * share one with different pitch/rate (female ~1.1, male ~0.85) so they stay
 * distinguishable. "Narrator" gets a neutral British voice (a speaker's
 * `accent`/`gender` apply if the part lists a "Narrator" speaker).
 */
export function pickVoices(speakers: ListeningSpeaker[], voices: SpeechSynthesisVoice[]): Map<string, VoiceChoice> {
  const pool = describeVoices(voices);
  const out = new Map<string, VoiceChoice>();
  /** voice key → pitches already given to speakers on that voice. */
  const onVoice = new Map<string, number[]>();
  /** Pitches of speakers left on the browser default voice (no voices available). */
  const onDefault: number[] = [];
  /** Pitches reserved in case chosen voices fail and everyone lands on the default voice. */
  const onFallback: number[] = [];

  const seen = new Set<string>();
  const cast = (speakers ?? []).filter((s) => {
    if (!s || typeof s.name !== "string" || !s.name || s.name === NARRATOR || seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  });

  for (const sp of cast) {
    const gender: VoiceGender = sp.gender === "male" ? "male" : "female";
    const accent: VoiceAccent = sp.accent && ACCENT_LANG[sp.accent] ? sp.accent : "british";
    const ranked = rank(pool, (v) => fit(v, gender, accent));
    const best = ranked[0] ?? null;
    const fresh = ranked.find((v) => !onVoice.has(v.key)) ?? null;
    // A new voice beats sharing one — unless every new voice is clearly the wrong gender.
    const wrongGender = !!fresh && fresh.gender != null && fresh.gender !== gender;
    const pick = fresh && !(wrongGender && best?.gender === gender) ? fresh : best;
    const taken = pick ? onVoice.get(pick.key) ?? [] : onDefault;
    const shared = taken.length > 0;
    const pitch = pick && pick.gender === gender && !shared ? 1 : distinctPitch(gender, taken);
    const fallbackPitch = distinctPitch(gender, onFallback);
    onFallback.push(fallbackPitch);
    if (pick) onVoice.set(pick.key, [...taken, pitch]);
    else onDefault.push(pitch);
    out.set(sp.name, {
      voice: pick?.voice ?? null,
      pitch,
      rate: shared ? (gender === "female" ? 1.04 : 0.96) : 1,
      lang: pick?.voice.lang || ACCENT_LANG[accent],
      fallbackPitch,
    });
  }

  // Narrator: British first, then a voice nobody in this part uses.
  const listed = (speakers ?? []).find((s) => s?.name === NARRATOR);
  const nAccent: VoiceAccent = listed?.accent && ACCENT_LANG[listed.accent] ? listed.accent : "british";
  const nGender: VoiceGender | null = listed?.gender === "male" || listed?.gender === "female" ? listed.gender : null;
  const nPick = rank(pool, (v) => fit(v, nGender, nAccent) + (onVoice.has(v.key) ? 0 : 25))[0] ?? null;
  const nTaken = nPick ? onVoice.get(nPick.key) ?? [] : onDefault;
  out.set(NARRATOR, {
    voice: nPick?.voice ?? null,
    pitch: nTaken.length ? distinctPitch("neutral", nTaken) : 1,
    rate: 0.95,
    lang: nPick?.voice.lang || ACCENT_LANG[nAccent],
    fallbackPitch: distinctPitch("neutral", onFallback),
  });

  return out;
}

// ---------------------------------------------------------------------------
// Text chunking
// ---------------------------------------------------------------------------

/** "Mr. Smith", "e.g. the", "J. Brown" — full stops that don't end a sentence. */
const ABBREVIATION = /(?:\b(?:mr|mrs|ms|dr|prof|st|sr|jr|mt|no|vs|etc|approx|ave|rd|e\.g|i\.e)|\b[A-Z])\.$/i;

function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?…]+["'”’)\]]*\s+/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const piece = text.slice(start, m.index + m[0].trimEnd().length);
    if (ABBREVIATION.test(piece)) continue;
    out.push(piece.trim());
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

/** One over-long sentence: cut after a comma/semicolon/colon, else at a space. */
function splitLong(sentence: string, max: number): string[] {
  const out: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const head = rest.slice(0, max + 1);
    let cut = Math.max(head.lastIndexOf(", "), head.lastIndexOf("; "), head.lastIndexOf(": "));
    if (cut >= max * 0.4) cut += 1;
    else cut = head.lastIndexOf(" ");
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Split text into utterance-sized pieces: whole text when it fits, otherwise
 * sentences packed together up to `max` characters.
 */
export function splitForSpeech(text: string, max = MAX_UTTERANCE_CHARS): string[] {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const out: string[] = [];
  let buf = "";
  for (const s of splitSentences(clean)) {
    if (s.length > max) {
      if (buf) out.push(buf);
      buf = "";
      out.push(...splitLong(s, max));
    } else if (!buf) buf = s;
    else if (buf.length + 1 + s.length <= max) buf = `${buf} ${s}`;
    else {
      out.push(buf);
      buf = s;
    }
  }
  if (buf) out.push(buf);
  return out;
}

/** Index where the sentence containing `idx` starts (used to resume after a pause). */
function sentenceStart(text: string, idx: number): number {
  const upto = text.slice(0, Math.max(0, Math.min(idx, text.length)));
  const re = /[.!?…]+["'”’)\]]*\s+/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(upto))) start = m.index + m[0].length;
  return start;
}

// ---------------------------------------------------------------------------
// ScriptPlayer
// ---------------------------------------------------------------------------

export type PlayerState = "idle" | "speaking" | "silence" | "paused" | "ended" | "stopped" | "error";

export interface PlayerSnapshot {
  state: PlayerState;
  /** Current line (0-based). */
  line: number;
  total: number;
  /** While state is "silence": when the silent gap ends (ms epoch). */
  silenceEndsAt: number | null;
  /** Length of the current silent gap in ms (0 when none). */
  silenceMs: number;
  /** Paused inside a silent gap: the ms that were left. */
  silenceLeftMs: number;
}

export interface ScriptPlayerOptions {
  /** Speaker name → voice (see pickVoices). Unknown speakers use the Narrator's voice. */
  voices?: Map<string, VoiceChoice>;
  /** Speed multiplier (0.5–2). */
  rate?: number;
  /** A line starts playing. */
  onProgress?: (lineIndex: number, total: number) => void;
  /** Every line (and its pause) has played. Not called after stop(). */
  onEnd?: () => void;
  /** Speech failed for good ("not-allowed", "network", "no-start", …). */
  onError?: (code: string) => void;
  /** Any state or line change. */
  onChange?: (snapshot: PlayerSnapshot) => void;
}

interface Chunk {
  line: number;
  text: string;
  first: boolean;
  last: boolean;
}

const DEFAULT_CHOICE: VoiceChoice = { voice: null, pitch: 1, rate: 1, lang: "en-GB", fallbackPitch: 1 };
/** Give up on an utterance that hasn't started after this long (then retry with the default voice). */
const START_TIMEOUT_MS = 8000;
/** Chrome can drop a speak() issued right after cancel(). */
const RESTART_DELAY_MS = 60;
/** Chrome stops long speech from network voices after ~15 s unless nudged. */
const KEEP_ALIVE_MS = 10000;
const GAP_SAME_SPEAKER_MS = 140;
const GAP_NEW_SPEAKER_MS = 320;
/** Errors that mean "this voice doesn't work here" — stop using it. */
const BAD_VOICE_ERRORS = new Set([
  "network",
  "synthesis-unavailable",
  "synthesis-failed",
  "voice-unavailable",
  "language-unavailable",
  "no-start",
]);

let chromiumDesktop: boolean | null = null;
function isChromiumDesktop(): boolean {
  if (chromiumDesktop != null) return chromiumDesktop;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  chromiumDesktop =
    /\b(Chrome|Chromium|Edg)\/\d/.test(ua) && !/Android|iPhone|iPad|iPod|CriOS|EdgiOS|Mobile/i.test(ua) && !/Firefox\//.test(ua);
  return chromiumDesktop;
}

function clampRate(v: number): number {
  return Math.min(2, Math.max(0.5, Number.isFinite(v) && v > 0 ? v : 1));
}

function clampPitch(v: number): number {
  return Math.min(1.6, Math.max(0.5, Number.isFinite(v) && v > 0 ? v : 1));
}

/**
 * Plays script lines with browser TTS: one utterance per line (long lines split
 * into sentence chunks), a silent timer for `pauseAfter`, short natural gaps
 * between speakers.
 *
 * pause() cancels the speech and resume() restarts the current sentence —
 * native speechSynthesis.pause() is unreliable (Android cancels, Safari/Chrome
 * sometimes never resume). Speed changes apply from the next sentence.
 */
export class ScriptPlayer {
  onProgress?: (lineIndex: number, total: number) => void;
  onEnd?: () => void;
  onError?: (code: string) => void;
  onChange?: (snapshot: PlayerSnapshot) => void;

  private readonly lines: ScriptLine[];
  private readonly chunks: Chunk[] = [];
  private readonly lineStart: number[] = [];
  private voices: Map<string, VoiceChoice>;
  private speed: number;
  private current: PlayerState = "idle";
  /** Current chunk. */
  private ci = 0;
  /** Char offset (in the chunk) where the current utterance began / where to resume. */
  private offset = 0;
  private resumeAt = 0;
  /** Last word boundary reached (char index in the chunk). */
  private boundary = 0;
  /** Bumped whenever an utterance is abandoned: its late events are ignored. */
  private token = 0;
  private timer: number | null = null;
  private keepAlive: number | null = null;
  private watchdog: number | null = null;
  /** Strong reference: Chrome can garbage-collect a playing utterance and never fire `end`. */
  private utterance: SpeechSynthesisUtterance | null = null;
  private started = false;
  private spokeAt = 0;
  private startedAt = 0;
  private everStarted = false;
  private failures = 0;
  private interruptions = 0;
  private retriedChunk = -1;
  private readonly badVoices = new Set<string>();
  private mode: "none" | "speech" | "gap" | "silence" = "none";
  private pausedIn: "speech" | "gap" | "silence" | null = null;
  private silenceEndsAt: number | null = null;
  private silenceMs = 0;
  private silenceLeft = 0;
  private progressLine = -1;

  constructor(lines: ScriptLine[], opts: ScriptPlayerOptions = {}) {
    this.lines = (lines ?? [])
      .filter((l): l is ScriptLine => !!l)
      .map((l) => ({ speaker: String(l.speaker || NARRATOR), text: String(l.text ?? ""), pauseAfter: l.pauseAfter }));
    this.lines.forEach((l, i) => {
      this.lineStart.push(this.chunks.length);
      const parts = splitForSpeech(l.text);
      if (!parts.length) this.chunks.push({ line: i, text: "", first: true, last: true });
      else parts.forEach((text, k) => this.chunks.push({ line: i, text, first: k === 0, last: k === parts.length - 1 }));
    });
    this.voices = opts.voices ?? new Map();
    this.speed = clampRate(opts.rate ?? 1);
    this.onProgress = opts.onProgress;
    this.onEnd = opts.onEnd;
    this.onError = opts.onError;
    this.onChange = opts.onChange;
  }

  get state(): PlayerState {
    return this.current;
  }

  get total(): number {
    return this.lines.length;
  }

  get rate(): number {
    return this.speed;
  }

  /** Speed multiplier; applies from the next sentence. */
  set rate(v: number) {
    this.speed = clampRate(v);
  }

  setRate(v: number): void {
    this.rate = v;
  }

  /** Swap the cast (applies from the next sentence). */
  setVoices(voices: Map<string, VoiceChoice>): void {
    this.voices = voices;
  }

  get snapshot(): PlayerSnapshot {
    const chunk = this.chunks[this.ci];
    return {
      state: this.current,
      line: chunk ? chunk.line : Math.max(0, this.lines.length - 1),
      total: this.lines.length,
      silenceEndsAt: this.current === "silence" ? this.silenceEndsAt : null,
      silenceMs: this.silenceMs,
      silenceLeftMs: this.pausedIn === "silence" ? this.silenceLeft : 0,
    };
  }

  /** Play from `fromLine` (restarts if already playing). */
  play(fromLine = 0): void {
    this.halt();
    this.resetSilence();
    this.pausedIn = null;
    this.failures = 0;
    this.interruptions = 0;
    this.retriedChunk = -1;
    this.progressLine = -1;
    this.resumeAt = 0;
    if (!isTtsSupported()) {
      this.fail("unsupported");
      return;
    }
    const line = Math.max(0, Math.min(Math.floor(fromLine) || 0, this.lines.length));
    if (line >= this.lines.length) {
      this.finish();
      return;
    }
    this.ci = this.lineStart[line];
    this.runChunk();
  }

  pause(): void {
    if (this.current === "speaking") {
      const where = this.mode === "gap" ? "gap" : "speech";
      if (where === "speech") {
        const chunk = this.chunks[this.ci];
        this.resumeAt = chunk ? sentenceStart(chunk.text, this.started ? this.boundary : this.offset) : 0;
      }
      this.halt();
      this.mode = "none";
      this.pausedIn = where;
      this.setState("paused");
    } else if (this.current === "silence") {
      this.silenceLeft = Math.max(0, (this.silenceEndsAt ?? Date.now()) - Date.now());
      this.clearTimer();
      this.silenceEndsAt = null;
      this.mode = "none";
      this.pausedIn = "silence";
      this.setState("paused");
    }
  }

  resume(): void {
    if (this.current !== "paused") return;
    const where = this.pausedIn;
    this.pausedIn = null;
    if (where === "silence") {
      this.mode = "silence";
      this.silenceEndsAt = Date.now() + this.silenceLeft;
      if (!this.silenceMs) this.silenceMs = this.silenceLeft;
      this.setState("silence");
      this.later(() => this.endSilence(), this.silenceLeft);
      return;
    }
    // "speech": say the interrupted sentence again; "gap": start the next line.
    this.runChunk();
  }

  /** End the current silent gap now (practice "Skip"). Returns false when not in one. */
  skipSilence(): boolean {
    if (this.current === "silence" || (this.current === "paused" && this.pausedIn === "silence")) {
      this.pausedIn = null;
      this.endSilence();
      return true;
    }
    return false;
  }

  stop(): void {
    const active = this.current === "speaking" || this.current === "silence" || this.current === "paused";
    this.halt();
    this.resetSilence();
    this.mode = "none";
    this.pausedIn = null;
    if (active) this.setState("stopped");
  }

  /** stop() and drop every callback (unmount). */
  dispose(): void {
    this.onProgress = undefined;
    this.onEnd = undefined;
    this.onError = undefined;
    this.onChange = undefined;
    this.stop();
  }

  // ---- internals ---------------------------------------------------------

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      console.error("ScriptPlayer callback failed", e);
    }
  }

  private emit(): void {
    const cb = this.onChange;
    if (cb) this.safe(() => cb(this.snapshot));
  }

  private setState(s: PlayerState): void {
    this.current = s;
    this.emit();
  }

  private later(fn: () => void, ms: number): void {
    this.clearTimer();
    this.timer = window.setTimeout(() => {
      this.timer = null;
      fn();
    }, Math.max(0, ms));
  }

  private clearTimer(): void {
    if (this.timer != null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  private clearSpeechTimers(): void {
    if (this.keepAlive != null) window.clearInterval(this.keepAlive);
    if (this.watchdog != null) window.clearInterval(this.watchdog);
    this.keepAlive = null;
    this.watchdog = null;
  }

  private resetSilence(): void {
    this.silenceEndsAt = null;
    this.silenceMs = 0;
    this.silenceLeft = 0;
  }

  /** Abandon whatever is in flight (timers + our utterance). */
  private halt(): void {
    this.token += 1;
    this.clearTimer();
    this.clearSpeechTimers();
    const s = engine();
    if (s && this.utterance) {
      try {
        s.cancel();
      } catch {
        /* ignore */
      }
    }
    this.utterance = null;
    this.started = false;
  }

  private choiceFor(speaker: string): VoiceChoice {
    return this.voices.get(speaker) ?? this.voices.get(NARRATOR) ?? DEFAULT_CHOICE;
  }

  private runChunk(): void {
    const chunk = this.chunks[this.ci];
    if (!chunk) {
      this.finish();
      return;
    }
    if (chunk.first && this.progressLine !== chunk.line) {
      this.progressLine = chunk.line;
      const t = this.token;
      const cb = this.onProgress;
      if (cb) this.safe(() => cb(chunk.line, this.lines.length));
      if (t !== this.token) return; // the callback restarted or stopped us
    }
    if (!chunk.text) {
      this.afterChunk(); // text-less line: straight to its pause
      return;
    }
    this.mode = "speech";
    this.setState("speaking");
    this.speak(false);
  }

  private speak(fallback: boolean): void {
    const s = engine();
    const chunk = this.chunks[this.ci];
    if (!s || !chunk) {
      this.fail("unsupported");
      return;
    }
    this.offset = Math.min(this.resumeAt, chunk.text.length);
    const text = chunk.text.slice(this.offset).trim();
    if (!text) {
      this.chunkDone();
      return;
    }
    const choice = this.choiceFor(this.lines[chunk.line].speaker);
    const voice = !fallback && choice.voice && !this.badVoices.has(voiceKey(choice.voice)) ? choice.voice : null;
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || choice.lang || "en-GB";
    u.pitch = clampPitch(voice ? choice.pitch : choice.fallbackPitch);
    u.rate = clampRate(choice.rate * this.speed);
    u.volume = 1;

    const token = ++this.token;
    u.onstart = () => {
      if (token !== this.token) return;
      this.started = true;
      this.everStarted = true;
      this.startedAt = Date.now();
    };
    u.onboundary = (e: SpeechSynthesisEvent) => {
      if (token !== this.token) return;
      if (typeof e.charIndex === "number") this.boundary = this.offset + e.charIndex;
    };
    u.onend = () => {
      if (token !== this.token) return;
      this.failures = 0;
      this.interruptions = 0;
      this.chunkDone();
    };
    u.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (token !== this.token) return;
      const code = String(e?.error || "synthesis-failed");
      // Our own cancel() bumps the token first, so this came from elsewhere: say the sentence again.
      if (code === "interrupted" || code === "canceled") this.interrupted();
      else this.chunkFailed(code, voice);
    };

    this.utterance = u;
    this.started = false;
    this.boundary = this.offset;
    const go = () => {
      if (token !== this.token) return;
      try {
        if (s.paused) s.resume();
        s.speak(u);
      } catch {
        this.chunkFailed("synthesis-failed", voice);
        return;
      }
      this.spokeAt = Date.now();
      this.armWatchdog(token, text.length, voice);
      this.armKeepAlive(token, voice);
    };
    if (s.speaking || s.pending) {
      try {
        s.cancel();
      } catch {
        /* ignore */
      }
      this.later(go, RESTART_DELAY_MS);
    } else go();
  }

  private armKeepAlive(token: number, voice: SpeechSynthesisVoice | null): void {
    if (this.keepAlive != null) window.clearInterval(this.keepAlive);
    this.keepAlive = null;
    // Only Chromium desktop needs it, and only for network (or unknown) voices.
    if (!isChromiumDesktop() || (voice && voice.localService)) return;
    this.keepAlive = window.setInterval(() => {
      const s = engine();
      if (token !== this.token || !s) return;
      if (s.speaking && !s.paused) {
        s.pause();
        s.resume();
      }
    }, KEEP_ALIVE_MS);
  }

  private armWatchdog(token: number, chars: number, voice: SpeechSynthesisVoice | null): void {
    if (this.watchdog != null) window.clearInterval(this.watchdog);
    const expectedMs = ((chars / 13) * 1000) / Math.max(0.5, this.speed);
    let quiet = 0;
    this.watchdog = window.setInterval(() => {
      const s = engine();
      if (token !== this.token || !s) return;
      const now = Date.now();
      if (!this.started) {
        if (now - this.spokeAt > START_TIMEOUT_MS) this.chunkFailed("no-start", voice);
        return;
      }
      if (!s.speaking && !s.pending) {
        quiet += 1;
        if (quiet >= 2) this.chunkDone(); // `end` never arrived
        return;
      }
      quiet = 0;
      if (now - this.startedAt > expectedMs * 3 + 10000) {
        // Stalled mid-utterance: move on rather than hang the recording.
        this.token += 1;
        try {
          s.cancel();
        } catch {
          /* ignore */
        }
        this.chunkDone();
      }
    }, 1000);
  }

  private chunkDone(): void {
    this.token += 1;
    this.clearSpeechTimers();
    this.utterance = null;
    this.started = false;
    this.resumeAt = 0;
    this.afterChunk();
  }

  private interrupted(): void {
    this.token += 1;
    this.clearSpeechTimers();
    this.utterance = null;
    this.interruptions += 1;
    if (this.interruptions > 3) {
      this.fail("interrupted");
      return;
    }
    const chunk = this.chunks[this.ci];
    this.resumeAt = chunk ? sentenceStart(chunk.text, this.started ? this.boundary : this.offset) : 0;
    this.started = false;
    this.later(() => this.speak(false), 250);
  }

  private chunkFailed(code: string, voice: SpeechSynthesisVoice | null): void {
    this.token += 1; // ignore late events from the failed utterance
    this.clearSpeechTimers();
    const s = engine();
    if (s && this.utterance && (s.speaking || s.pending)) {
      try {
        s.cancel();
      } catch {
        /* ignore */
      }
    }
    this.utterance = null;
    this.started = false;
    if (code === "not-allowed") {
      this.fail(code); // needs a user gesture — only the UI can fix that
      return;
    }
    // First failure with a chosen voice: it may be offline/unavailable — retry on the default voice.
    if (voice && this.retriedChunk !== this.ci) {
      if (BAD_VOICE_ERRORS.has(code)) this.badVoices.add(voiceKey(voice));
      this.retriedChunk = this.ci;
      this.later(() => this.speak(true), 150);
      return;
    }
    this.failures += 1;
    if (!this.everStarted || this.failures >= 3) {
      this.fail(code);
      return;
    }
    this.resumeAt = 0;
    this.afterChunk(); // skip this sentence rather than stall the whole recording
  }

  private afterChunk(): void {
    const chunk = this.chunks[this.ci];
    if (!chunk) {
      this.finish();
      return;
    }
    if (!chunk.last) {
      this.ci += 1;
      this.runChunk();
      return;
    }
    const pauseMs = Math.max(0, Number(this.lines[chunk.line].pauseAfter) || 0) * 1000;
    if (pauseMs > 0) this.startSilence(pauseMs);
    else this.nextLine();
  }

  private nextLine(): void {
    if (this.ci + 1 >= this.chunks.length) {
      this.finish();
      return;
    }
    const cur = this.lines[this.chunks[this.ci].line];
    const next = this.lines[this.chunks[this.ci + 1].line];
    this.ci += 1;
    this.mode = "gap";
    this.later(() => this.runChunk(), cur.speaker !== next.speaker ? GAP_NEW_SPEAKER_MS : GAP_SAME_SPEAKER_MS);
  }

  private startSilence(ms: number): void {
    this.mode = "silence";
    this.silenceMs = ms;
    this.silenceLeft = ms;
    this.silenceEndsAt = Date.now() + ms;
    this.setState("silence");
    this.later(() => this.endSilence(), ms);
  }

  private endSilence(): void {
    this.clearTimer();
    this.resetSilence();
    this.mode = "none";
    if (this.ci + 1 >= this.chunks.length) {
      this.finish();
      return;
    }
    this.setState("speaking");
    this.nextLine();
  }

  private finish(): void {
    this.token += 1;
    this.clearTimer();
    this.clearSpeechTimers();
    this.utterance = null;
    this.mode = "none";
    this.ci = this.chunks.length;
    this.resetSilence();
    this.setState("ended");
    const cb = this.onEnd;
    if (cb) this.safe(cb);
  }

  private fail(code: string): void {
    this.halt();
    this.resetSilence();
    this.mode = "none";
    this.pausedIn = null;
    this.setState("error");
    const cb = this.onError;
    if (cb) this.safe(() => cb(code));
  }
}
