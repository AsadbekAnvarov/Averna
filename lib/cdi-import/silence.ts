/**
 * Pauses in a recording: runs of 50 ms windows whose RMS level (all
 * channels) is below −40 dBFS for at least 1 s. The MP3 is decoded with
 * mpg123-decoder (WASM, offline importer only) about 2 s at a time, so the
 * PCM of a 30-minute recording is never held in memory.
 */

import type { Mp3Index } from "../ielts/audio/mp3-index";

export const WINDOW_MS = 50;
export const SILENCE_DBFS = -40;
export const MIN_PAUSE_MS = 1000;

export interface Pause {
  startMs: number;
  endMs: number;
}

/** RMS level in dBFS of one window over all channels (−120 for digital silence). */
export function rmsDbfs(samples: Float32Array[]): number {
  let sum = 0;
  let n = 0;
  for (const ch of samples) {
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    n += ch.length;
  }
  if (!n || sum <= 0) return -120;
  return Math.max(-120, 20 * Math.log10(Math.sqrt(sum / n)));
}

/** Maximal runs of windows below the threshold lasting at least `minMs`, in time order. */
export function detectPauses(windowsDb: ArrayLike<number>, windowMs = WINDOW_MS, thresholdDb = SILENCE_DBFS, minMs = MIN_PAUSE_MS): Pause[] {
  const out: Pause[] = [];
  let start = -1;
  for (let i = 0; i <= windowsDb.length; i++) {
    const quiet = i < windowsDb.length && windowsDb[i] < thresholdDb;
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      if ((i - start) * windowMs >= minMs) out.push({ startMs: start * windowMs, endMs: i * windowMs });
      start = -1;
    }
  }
  return out;
}

interface Decoder {
  ready: Promise<void>;
  decodeFrames(frames: Uint8Array[]): { channelData: Float32Array[]; samplesDecoded: number; sampleRate: number };
  free(): void;
}

/** Window levels of a whole MP3 (decoded in chunks of ~2 s). */
export async function windowLevels(bytes: Uint8Array, index: Mp3Index): Promise<Float32Array> {
  const mod = (await import("mpg123-decoder")) as unknown as { MPEGDecoder: new () => Decoder };
  const decoder = new mod.MPEGDecoder();
  await decoder.ready;
  try {
    const rate = index.format.sampleRate;
    const per = Math.max(1, Math.round((rate * WINDOW_MS) / 1000));
    const levels: number[] = [];
    let carry: Float32Array[] | null = null;
    const chunk = Math.max(1, Math.round(2000 / index.frameMs));
    for (let f = 0; f < index.frames; f += chunk) {
      const frames: Uint8Array[] = [];
      for (let i = f; i < Math.min(index.frames, f + chunk); i++) frames.push(bytes.subarray(index.offsets[i], index.offsets[i + 1]));
      const out = decoder.decodeFrames(frames);
      let data = out.channelData.map((c) => c.subarray(0, out.samplesDecoded));
      if (carry) data = data.map((c, i) => {
        const prev = carry![i] ?? new Float32Array(0);
        const m = new Float32Array(prev.length + c.length);
        m.set(prev);
        m.set(c, prev.length);
        return m;
      });
      const len = data[0]?.length ?? 0;
      let at = 0;
      for (; at + per <= len; at += per) levels.push(rmsDbfs(data.map((c) => c.subarray(at, at + per))));
      carry = data.map((c) => c.slice(at));
    }
    if (carry && (carry[0]?.length ?? 0) > 0) levels.push(rmsDbfs(carry));
    return Float32Array.from(levels);
  } finally {
    decoder.free();
  }
}

export async function pausesFromMp3(bytes: Uint8Array, index: Mp3Index): Promise<Pause[]> {
  return detectPauses(await windowLevels(bytes, index));
}
