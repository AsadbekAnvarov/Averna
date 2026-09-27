/**
 * Reading a pre-rendered part's timeline: where the playhead is in the
 * programme (script lines reached, reading-time gaps), where the recording
 * proper starts (practice "Replay") and where a run that isn't a full test
 * stops the file (before the end-of-test announcement).
 *
 * Pure and client-safe (the runner uses it every timeupdate; the server
 * sanitises stored rows with it).
 */

import type { ListeningPartAudio } from "../types";
import { READING_GAP_MS } from "./programme";

export type TimelineEntry = ListeningPartAudio["timeline"][number];

const KINDS = new Set(["intro", "preview", "end", "final"]);

/** Validate a stored timeline (JSON from the database). Invalid entries are dropped. */
export function sanitizeTimeline(raw: unknown, durationMs: number): TimelineEntry[] {
  if (!Array.isArray(raw)) return [];
  const max = Math.max(0, durationMs) + 1000;
  const out: TimelineEntry[] = [];
  for (const e of raw) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const i = o.i;
    const startMs = o.startMs;
    const endMs = o.endMs;
    if (typeof i !== "number" || !Number.isInteger(i) || i < -1) continue;
    if (typeof startMs !== "number" || typeof endMs !== "number" || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    if (startMs < 0 || endMs < startMs || endMs > max) continue;
    const entry: TimelineEntry = { i, startMs: Math.round(startMs), endMs: Math.round(endMs) };
    if (i === -1 && typeof o.kind === "string" && KINDS.has(o.kind)) entry.kind = o.kind as TimelineEntry["kind"];
    out.push(entry);
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

export interface TimelinePosition {
  /** Script lines (i ≥ 0) started so far, and in the part. */
  line: number;
  lines: number;
  /** The silent gap the playhead is in (after a line, before the next), if any. */
  gap: { startMs: number; endMs: number } | null;
  /** The gap is long enough to be reading time. */
  reading: boolean;
}

export function scriptLineCount(audio: ListeningPartAudio): number {
  return audio.timeline.reduce((n, e) => n + (e.i >= 0 ? 1 : 0), 0);
}

export function positionInfo(audio: ListeningPartAudio, posMs: number): TimelinePosition {
  const t = audio.timeline;
  let line = 0;
  let lines = 0;
  let current = -1;
  for (let k = 0; k < t.length; k++) {
    const e = t[k];
    if (e.i >= 0) {
      lines += 1;
      if (e.startMs <= posMs) line += 1;
    }
    if (e.startMs <= posMs) current = k;
  }
  let gap: TimelinePosition["gap"] = null;
  if (current >= 0 && posMs >= t[current].endMs) {
    const end = current + 1 < t.length ? t[current + 1].startMs : audio.durationMs;
    if (end > t[current].endMs) gap = { startMs: t[current].endMs, endMs: end };
  }
  return { line, lines, gap, reading: !!gap && gap.endMs - gap.startMs >= READING_GAP_MS };
}

/** Where the recording proper starts (after the part intro and the reading time). */
export function scriptStartMs(audio: ListeningPartAudio): number {
  const first = audio.timeline.find((e) => e.i >= 0);
  return first ? first.startMs : 0;
}

/**
 * Where to stop the file when this run ends here but the file goes on to the
 * end-of-test announcement (the test's last part practised on its own: the run
 * gives its own checking time). Undefined when the file has no such line.
 */
export function finalCutMs(audio: ListeningPartAudio): number | undefined {
  const k = audio.timeline.findIndex((e) => e.kind === "final");
  if (k < 0) return undefined;
  const final = audio.timeline[k];
  const before = k > 0 ? audio.timeline[k - 1] : null;
  // Half a second into the silence after "That is the end of Part N.", well before the next line.
  const cut = before ? Math.min(before.endMs + 500, final.startMs - 100) : final.startMs - 100;
  return Math.max(0, cut);
}
