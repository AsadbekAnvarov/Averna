/**
 * Render ONE Listening part into ONE MP3 with OpenAI text-to-speech.
 *
 * 1. The part's programme (lib/ielts/audio/programme — the same announcements,
 *    reading time and pauses the browser-voice player uses, exam timings).
 * 2. Every line with words → one TTS request with the speaker's voice and
 *    accent instructions (lib/ielts/audio/voices); very long lines go in
 *    sentence chunks. ~6 requests in parallel, longest first, 2 retries per
 *    request, everything inside TTS_BUDGET_MS so the route (maxDuration 60 s)
 *    still has time to upload.
 * 3. The clips are joined frame by frame with generated silence for the pauses
 *    (lib/ielts/audio/assemble + mp3), behind a Xing header, and the timeline
 *    records where every programme line starts and ends.
 *
 * Finished clips stay in a small per-instance cache for a few minutes, so a
 * retry after a timeout only asks for the missing lines.
 *
 * SERVER ONLY.
 */

import { createHash } from "crypto";
import { OpenAiAudioError, TTS_MODEL, synthesizeSpeech } from "@/lib/openai-audio";
import type { ExamListeningTest, ListeningPartAudio } from "../types";
import { splitForSpeech } from "../tts";
import { assembleProgramme } from "./assemble";
import type { AssembledPart } from "./assemble";
import { partAudioHash } from "./hash";
import { Mp3Error, describeFormat, parseMp3 } from "./mp3";
import type { ParsedMp3 } from "./mp3";
import { fileProgramme } from "./programme";
import { castVoices, voiceFor } from "./voices";
import type { CastVoice } from "./voices";

/** Parallel text-to-speech requests. */
export const TTS_CONCURRENCY = 6;
/** Extra attempts per request (network errors, 5xx, a short 429). */
export const TTS_RETRIES = 2;
/** Every clip must be back by then (from the start of the request). */
export const TTS_BUDGET_MS = 40_000;
const CALL_TIMEOUT_MS = 30_000;
/** Don't start an attempt with less time than this left. */
const MIN_CALL_MS = 2_500;
/** A 429 asking to wait longer than this ends the render (the admin queue waits instead). */
const MAX_RATE_WAIT_SEC = 5;
/** Lines longer than this are synthesised in sentence chunks of at most CHUNK_CHARS (in parallel). */
const SPLIT_ABOVE_CHARS = 600;
const CHUNK_CHARS = 420;

export type RenderErrorKind = "invalid" | "config" | "rate_limit" | "timeout" | "upstream" | "audio";

export class RenderError extends Error {
  constructor(
    readonly kind: RenderErrorKind,
    message: string,
    readonly retryAfterSec?: number
  ) {
    super(message);
    this.name = "RenderError";
  }
}

export interface RenderedPart {
  bytes: Uint8Array;
  durationMs: number;
  timeline: ListeningPartAudio["timeline"];
  scriptHash: string;
  voiceModel: string;
  /** Text-to-speech requests made (cached clips not counted). */
  requests: number;
  /** Lines (chunks) synthesised in total. */
  clips: number;
  /** e.g. "MPEG-2 Layer III, 24 kHz, mono · 160 kbps (Info)". */
  format: string;
}

interface Job {
  key: string;
  text: string;
  voice: CastVoice;
  instructions: string;
}

// ---------------------------------------------------------------------------
// Clip cache (per serverless instance)
// ---------------------------------------------------------------------------

const CACHE_MAX_BYTES = 48 * 1024 * 1024;
const CACHE_TTL_MS = 15 * 60_000;
const clipCache = new Map<string, { clip: ParsedMp3; size: number; at: number }>();
let clipCacheBytes = 0;

function cacheDelete(key: string): void {
  const hit = clipCache.get(key);
  if (!hit) return;
  clipCache.delete(key);
  clipCacheBytes -= hit.size;
}

function cacheGet(key: string): ParsedMp3 | null {
  const hit = clipCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cacheDelete(key);
    return null;
  }
  return hit.clip;
}

function cachePut(key: string, clip: ParsedMp3, size: number): void {
  if (clipCache.has(key) || size > CACHE_MAX_BYTES) return;
  clipCache.set(key, { clip, size, at: Date.now() });
  clipCacheBytes += size;
  while (clipCacheBytes > CACHE_MAX_BYTES) {
    const oldest = clipCache.keys().next();
    if (oldest.done) break;
    cacheDelete(oldest.value);
  }
}

function clipKey(model: string, voice: string, instructions: string, text: string): string {
  return createHash("sha256").update(`${model}\u0001${voice}\u0001${instructions}\u0001${text}`).digest("hex");
}

// ---------------------------------------------------------------------------

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done);
  });
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/** One chunk, with retries. Throws RenderError (or whatever the abort produced). */
async function synthesize(job: Job, model: string, deadline: number, signal: AbortSignal): Promise<{ clip: ParsedMp3; size: number; calls: number }> {
  let calls = 0;
  let last: unknown = null;
  for (let attempt = 0; attempt <= TTS_RETRIES; attempt++) {
    const left = deadline - Date.now();
    if (signal.aborted) throw last ?? new RenderError("timeout", "Cancelled.");
    if (left < MIN_CALL_MS) throw new RenderError("timeout", "Out of time.");
    calls += 1;
    try {
      const bytes = await synthesizeSpeech({
        text: job.text,
        voice: job.voice,
        instructions: job.instructions,
        model,
        timeoutMs: Math.min(CALL_TIMEOUT_MS, left),
        signal,
      });
      return { clip: parseMp3(bytes), size: bytes.length, calls };
    } catch (e) {
      last = e;
      if (signal.aborted) throw e;
      if (e instanceof Mp3Error) {
        await sleep(300, signal); // unreadable audio: ask again
        continue;
      }
      if (e instanceof OpenAiAudioError) {
        if (e.status === 401 || e.status === 403) throw new RenderError("config", `OpenAI rejected the API key (${e.status}).`);
        if (e.status === 429) {
          if (/quota|billing/i.test(e.message)) throw new RenderError("config", "The OpenAI account has no credit left (insufficient quota).");
          const wait = e.retryAfterSec ?? 2;
          if (wait > MAX_RATE_WAIT_SEC || attempt === TTS_RETRIES) {
            throw new RenderError("rate_limit", "OpenAI rate limit reached.", Math.max(20, Math.ceil(wait)));
          }
          await sleep(wait * 1000, signal);
          continue;
        }
        // Bad requests won't get better by asking again.
        if (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 409) throw new RenderError("upstream", e.message);
        await sleep(400 * (attempt + 1), signal); // network / timeout / 5xx
        continue;
      }
      throw new RenderError("upstream", message(e, "Text-to-speech failed."));
    }
  }
  if (last instanceof Mp3Error) throw new RenderError("audio", `OpenAI returned audio that couldn't be read: ${last.message}`);
  throw new RenderError("upstream", message(last, "Text-to-speech failed."));
}

/** Run `work` over `items` with `limit` in flight; the first failure stops the rest (and is what's thrown). */
async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>, stop: () => void): Promise<void> {
  let next = 0;
  let failed = false;
  let first: unknown = null;
  const lane = async () => {
    while (!failed && next < items.length) {
      const item = items[next++];
      try {
        await work(item);
      } catch (e) {
        if (!failed) {
          failed = true;
          first = e;
          stop();
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  if (failed) throw first;
}

export interface RenderOptions {
  /** When the request started (the TTS budget counts from here). */
  startedAt?: number;
  signal?: AbortSignal;
}

export async function renderListeningPart(test: ExamListeningTest, partIndex: number, opts: RenderOptions = {}): Promise<RenderedPart> {
  const startedAt = opts.startedAt ?? Date.now();
  const deadline = startedAt + TTS_BUDGET_MS;
  const part = test.parts[partIndex];
  const programme = fileProgramme(test, partIndex);
  const model = TTS_MODEL();
  const scriptHash = partAudioHash(test, partIndex, model);
  if (!part || !programme || !scriptHash) throw new RenderError("invalid", `Part ${partIndex + 1} doesn't exist.`);
  const cast = castVoices(part);

  // Programme lines → TTS chunks (identical requests are made once).
  const jobs = new Map<string, Job>();
  const lineKeys: string[][] = programme.lines.map((line) => {
    const text = String(line.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    const v = voiceFor(cast, line.speaker);
    const chunks = text.length > SPLIT_ABOVE_CHARS ? splitForSpeech(text, CHUNK_CHARS) : [text];
    return chunks.map((chunk) => {
      const key = clipKey(model, v.voice, v.instructions, chunk);
      if (!jobs.has(key)) jobs.set(key, { key, text: chunk, voice: v.voice, instructions: v.instructions });
      return key;
    });
  });
  if (!jobs.size) throw new RenderError("invalid", "This part has nothing to read.");

  const clips = new Map<string, ParsedMp3>();
  const todo: Job[] = [];
  jobs.forEach((job) => {
    const hit = cacheGet(job.key);
    if (hit) clips.set(job.key, hit);
    else todo.push(job);
  });
  // Longest first: the slowest requests start at once, short ones fill the gaps.
  todo.sort((a, b) => b.text.length - a.text.length);

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(), Math.max(0, deadline - Date.now()));
  let requests = 0;
  try {
    await pool(
      todo,
      TTS_CONCURRENCY,
      async (job) => {
        const r = await synthesize(job, model, deadline, ctrl.signal);
        requests += r.calls;
        clips.set(job.key, r.clip);
        cachePut(job.key, r.clip, r.size);
      },
      () => ctrl.abort()
    );
  } catch (e) {
    if (e instanceof RenderError && e.kind !== "timeout") throw e;
    if (Date.now() >= deadline - 250 || (e instanceof RenderError && e.kind === "timeout")) {
      throw new RenderError(
        "timeout",
        `Text-to-speech took too long (${clips.size} of ${jobs.size} lines ready). Try again — the finished lines are kept for a few minutes.`
      );
    }
    throw new RenderError("upstream", message(e, "Text-to-speech failed."));
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }

  // Assemble in programme order: speech, then its pause + the gap before the next line.
  let assembled: AssembledPart;
  try {
    const lineClips = lineKeys.map((keys) =>
      keys.map((key) => {
        const clip = clips.get(key);
        if (!clip) throw new Mp3Error("A clip is missing.");
        return clip;
      })
    );
    assembled = assembleProgramme(programme.lines, lineClips);
  } catch (e) {
    if (e instanceof Mp3Error) throw new RenderError("audio", e.message);
    throw e;
  }

  // Done: this part's clips aren't needed any more.
  jobs.forEach((_job, key) => cacheDelete(key));
  return {
    bytes: assembled.bytes,
    durationMs: assembled.durationMs,
    timeline: assembled.timeline,
    scriptHash,
    voiceModel: model,
    requests,
    clips: jobs.size,
    format: `${describeFormat(assembled.format)} · ${assembled.audioKbps ?? "?"} kbps (${assembled.tag})`,
  };
}
