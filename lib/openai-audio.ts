/**
 * OpenAI audio endpoints over plain fetch (no SDK-version dependency):
 *   - synthesizeSpeech → POST /v1/audio/speech         (Listening audio)
 *   - transcribeAudio  → POST /v1/audio/transcriptions (recorded Speaking answers)
 *
 * Models are configurable: OPENAI_TTS_MODEL (default gpt-4o-mini-tts, which
 * follows accent / style `instructions`), OPENAI_STT_MODEL (default whisper-1,
 * the model that returns word timestamps and the audio duration).
 *
 * SERVER ONLY.
 */

import { hasOpenAI } from "@/lib/ai";

const API = "https://api.openai.com/v1";

export const TTS_MODEL = () => process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
export const STT_MODEL = () => process.env.OPENAI_STT_MODEL || "whisper-1";

/** True when a real OpenAI key is configured. */
export function audioAiConfigured(): boolean {
  return hasOpenAI();
}

export class OpenAiAudioError extends Error {
  constructor(
    message: string,
    /** HTTP status (0 = network / timeout). */
    readonly status: number,
    /** Seconds to wait before retrying, when the API said so (429). */
    readonly retryAfterSec?: number
  ) {
    super(message);
    this.name = "OpenAiAudioError";
  }
}

function key(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k || !hasOpenAI()) throw new OpenAiAudioError("OpenAI is not configured (OPENAI_API_KEY).", 0);
  return k;
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => "");
  let message = text.slice(0, 300);
  try {
    const j = JSON.parse(text) as { error?: { message?: string } };
    if (j?.error?.message) message = j.error.message;
  } catch {
    /* not JSON */
  }
  const retry = Number(res.headers.get("retry-after"));
  throw new OpenAiAudioError(`${what} failed (${res.status}): ${message}`, res.status, Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

function withTimeout(ms: number, outer?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  outer?.addEventListener("abort", onAbort);
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    },
  };
}

// ---------------------------------------------------------------------------
// Text to speech
// ---------------------------------------------------------------------------

/** OpenAI voices (gpt-4o-mini-tts supports all of them; tts-1 a subset). */
export type TtsVoice =
  | "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse";

export interface SpeechRequest {
  text: string;
  voice: TtsVoice;
  /** Delivery instructions (gpt-4o-mini-tts only), e.g. "Speak with a natural British accent." */
  instructions?: string;
  /** 0.25–4; default 1. */
  speed?: number;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** MP3 bytes (24 kHz) for one utterance. */
export async function synthesizeSpeech(r: SpeechRequest): Promise<Uint8Array> {
  const model = r.model || TTS_MODEL();
  const body: Record<string, unknown> = {
    model,
    voice: r.voice,
    input: r.text.slice(0, 4000),
    response_format: "mp3",
  };
  if (r.instructions && !model.startsWith("tts-1")) body.instructions = r.instructions.slice(0, 1000);
  if (r.speed && r.speed !== 1) body.speed = Math.max(0.25, Math.min(4, r.speed));
  const t = withTimeout(r.timeoutMs ?? 45_000, r.signal);
  let res: Response;
  try {
    res = await fetch(`${API}/audio/speech`, {
      method: "POST",
      headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: t.signal,
    });
  } catch (e) {
    t.done();
    throw new OpenAiAudioError(t.signal.aborted ? "Text-to-speech timed out." : `Text-to-speech failed: ${e instanceof Error ? e.message : "network error"}`, 0);
  }
  try {
    if (!res.ok) await fail(res, "Text-to-speech");
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    t.done();
  }
}

// ---------------------------------------------------------------------------
// Speech to text
// ---------------------------------------------------------------------------

export interface TranscribedWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  /** Probability that the segment is silence / non-speech (Whisper). */
  noSpeechProb?: number;
  avgLogprob?: number;
}

export interface Transcription {
  text: string;
  /** Audio duration in seconds (whisper-1 verbose_json); null when the model doesn't report it. */
  durationSec: number | null;
  words: TranscribedWord[];
  segments: TranscriptionSegment[];
  model: string;
}

export interface TranscribeRequest {
  audio: Blob;
  filename: string;
  /** ISO-639-1, default "en". */
  language?: string;
  /** Context that improves recognition (e.g. the examiner's question). */
  prompt?: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** Transcribe one recording (≤ 25 MB). */
export async function transcribeAudio(r: TranscribeRequest): Promise<Transcription> {
  const model = r.model || STT_MODEL();
  const verbose = model === "whisper-1";
  const form = new FormData();
  form.append("file", r.audio, r.filename);
  form.append("model", model);
  form.append("language", r.language ?? "en");
  if (r.prompt) form.append("prompt", r.prompt.slice(0, 800));
  form.append("response_format", verbose ? "verbose_json" : "json");
  if (verbose) {
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
  }
  const t = withTimeout(r.timeoutMs ?? 50_000, r.signal);
  let res: Response;
  try {
    res = await fetch(`${API}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key()}` },
      body: form,
      signal: t.signal,
    });
  } catch (e) {
    t.done();
    throw new OpenAiAudioError(t.signal.aborted ? "Transcription timed out." : `Transcription failed: ${e instanceof Error ? e.message : "network error"}`, 0);
  }
  try {
    if (!res.ok) await fail(res, "Transcription");
    const j = (await res.json()) as {
      text?: string;
      duration?: number;
      words?: { word?: string; start?: number; end?: number }[];
      segments?: { start?: number; end?: number; text?: string; no_speech_prob?: number; avg_logprob?: number }[];
    };
    const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
    return {
      text: typeof j.text === "string" ? j.text.trim() : "",
      durationSec: typeof j.duration === "number" && Number.isFinite(j.duration) ? j.duration : null,
      words: (j.words ?? [])
        .filter((w) => typeof w.word === "string")
        .map((w) => ({ word: String(w.word), start: num(w.start), end: num(w.end) })),
      segments: (j.segments ?? []).map((s) => ({
        start: num(s.start),
        end: num(s.end),
        text: typeof s.text === "string" ? s.text.trim() : "",
        noSpeechProb: typeof s.no_speech_prob === "number" ? s.no_speech_prob : undefined,
        avgLogprob: typeof s.avg_logprob === "number" ? s.avg_logprob : undefined,
      })),
      model,
    };
  } finally {
    t.done();
  }
}
