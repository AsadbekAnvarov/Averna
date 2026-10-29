/**
 * One part of a whole Listening recording, played frame-exact: the browser
 * fetches only the part's bytes with a Range request (CORS-safelisted, no
 * preflight — GitHub Pages answers OPTIONS with 405) and wraps them in a new
 * Info/Xing header, so the clip starts and ends within one MP3 frame of the
 * verified boundary and nothing of the neighbouring parts is heard.
 *
 * Any failure (CORS, a 200 instead of 206, a frame count that doesn't match)
 * falls back to the whole file played through a window of the segment.
 *
 * No React; safe to import during SSR.
 */

import { buildClip, formatFromSegment } from "@/lib/ielts/audio/mp3-index";
import type { ClientSegment, ListeningPartAudio } from "@/lib/ielts/types";
import type { PartSegment } from "@/lib/ielts/segments";

export type SegmentAudio = ListeningPartAudio & { segment?: ClientSegment };

export type PlayableSegment =
  | { mode: "clip"; url: string; durationMs: number; bytes: Blob }
  | { mode: "window"; url: string; durationMs: number; window: PartSegment };

/** Bytes a saved clip takes: the segment plus at most 1 KB for the Info/Xing frame. */
export function clipBytesEstimate(seg: Pick<ClientSegment, "byteStart" | "byteEnd">): number {
  return seg.byteEnd - seg.byteStart + 1024;
}

export function windowFallback(seg: ClientSegment & { url: string }): PlayableSegment {
  return {
    mode: "window",
    url: seg.url,
    durationMs: seg.endMs - seg.startMs,
    window: { startMs: seg.startMs, endMs: seg.endMs },
  };
}

/** The clip bytes (Info/Xing + frames), or null when the response isn't exactly the segment. */
export function clipFromResponseBytes(bytes: Uint8Array, seg: ClientSegment): Uint8Array | null {
  if (bytes.length !== seg.byteEnd - seg.byteStart || bytes.length < 4) return null;
  const format = formatFromSegment(seg, bytes);
  if (!format) return null;
  return buildClip(bytes, seg.frameEnd - seg.frameStart, format);
}

async function readBody(res: Response, total: number, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array> {
  const reader = res.body?.getReader?.();
  if (!reader) return new Uint8Array(await res.arrayBuffer());
  const out = new Uint8Array(total);
  let at = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (at + value.length > total) {
      await reader.cancel().catch(() => undefined);
      throw new Error("too many bytes");
    }
    out.set(value, at);
    at += value.length;
    onProgress?.(at, total);
  }
  return at === total ? out : out.subarray(0, at);
}

/** Fetch one segment and build its clip; the window fallback on any failure (never throws, except on abort). */
export async function loadSegmentClip(
  seg: ClientSegment & { url: string },
  opts: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void } = {},
): Promise<PlayableSegment> {
  const total = seg.byteEnd - seg.byteStart;
  try {
    if (typeof fetch !== "function" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return windowFallback(seg);
    const res = await fetch(seg.url, {
      mode: "cors",
      credentials: "omit",
      headers: { Range: `bytes=${seg.byteStart}-${seg.byteEnd - 1}` },
      signal: opts.signal,
    });
    if (res.status !== 206) {
      // The host ignored Range: don't download the whole file twice.
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      return windowFallback(seg);
    }
    const bytes = await readBody(res, total, opts.onProgress);
    const clip = clipFromResponseBytes(bytes, seg);
    if (!clip) return windowFallback(seg);
    const blob = new Blob([clip as BlobPart], { type: "audio/mpeg" });
    return { mode: "clip", url: URL.createObjectURL(blob), durationMs: seg.endMs - seg.startMs, bytes: blob };
  } catch (e) {
    if ((e as { name?: string } | null)?.name === "AbortError") throw e;
    return windowFallback(seg);
  }
}
