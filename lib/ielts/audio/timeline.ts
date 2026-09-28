/**
 * Reading a pre-rendered part's timeline: where the playhead is in the
 * programme (script lines reached, reading-time gaps), where the recording
 * proper starts (practice "Replay") and where a run that isn't a full test
 * stops the file (before the end-of-test announcement).
 *
 * Also the bridge between a recording and browser voices reading the same
 * part (lib/ielts/audio/programme): a programme line is identified by the
 * script line it reads, or by which announcement it is (LineRef), so the
 * runner can continue with browser voices where a failed recording stopped
 * (voiceLineAt) and find its place again after a refresh (lineRefAt,
 * startMsOf, resumeLineIndex).
 *
 * Pure and client-safe (the runner uses it every timeupdate; the server
 * sanitises stored rows with it).
 */

import type { ListeningPartAudio } from "../types";
import { NARRATOR } from "../tts";
import { READING_GAP_MS } from "./programme";

export type TimelineEntry = ListeningPartAudio["timeline"][number];

/** A programme line's identity: the script line it reads (i ≥ 0), or the exam announcement it is (i = -1 and its kind). */
export interface LineRef {
  i: number;
  kind?: TimelineEntry["kind"];
}

/** Timeline entries and programme lines (buildProgramme) both carry i / kind. */
type LineLike = { i: number; kind?: string };

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

/** Same programme line: the same script line, or the same (known) announcement. */
export function sameLine(a: LineLike, b: LineLike): boolean {
  if (a.i >= 0) return a.i === b.i;
  return a.i === -1 && b.i === -1 && !!a.kind && a.kind === b.kind;
}

/** Where `ref` is in `lines` (a programme's lines); -1 when it isn't there. */
export function lineIndexOf(lines: readonly LineLike[], ref: LineLike): number {
  for (let k = 0; k < lines.length; k++) if (sameLine(lines[k], ref)) return k;
  return -1;
}

/**
 * The timeline entry the playhead is on — the last one that has started (as in
 * positionInfo) — and whether its speech is over (the playhead is in the
 * silence after it). Null before the first entry.
 */
export function entryAt(audio: ListeningPartAudio, posMs: number): { index: number; entry: TimelineEntry; after: boolean } | null {
  const t = audio.timeline;
  let index = -1;
  for (let k = 0; k < t.length; k++) if (t[k].startMs <= posMs) index = k;
  if (index < 0) return null;
  return { index, entry: t[index], after: posMs >= t[index].endMs };
}

/** The line playing at `posMs` (saved with the position, see resumeLineIndex). */
export function lineRefAt(audio: ListeningPartAudio, posMs: number): LineRef | null {
  const at = entryAt(audio, posMs);
  if (!at) return null;
  return at.entry.kind ? { i: at.entry.i, kind: at.entry.kind } : { i: at.entry.i };
}

/** Where `ref` starts in the recording (ms), or null when the file has no such line. */
export function startMsOf(audio: ListeningPartAudio, ref: LineRef): number | null {
  const e = audio.timeline.find((x) => sameLine(x, ref));
  return e ? e.startMs : null;
}

/**
 * Fail-open fallback: where browser voices pick up a recorded part that can't
 * be played any more — the index into `lines` (the part's browser-voice
 * programme, buildProgramme(...).lines) to start from, for the playhead at
 * `posMs` in the file:
 *   - inside a line's speech → that line, from its start (speech can't pick up
 *     mid-sentence);
 *   - in the silence after a line → the next line; but reading time after the
 *     narrator (≥ READING_GAP_MS) → that announcement again, so the pause is
 *     given in full;
 *   - before anything → 0; past the last line → lines.length (the part is over).
 * Lines the voices don't read (e.g. an end-of-test line the run doesn't have)
 * are skipped to the next one they do.
 */
export function voiceLineAt(audio: ListeningPartAudio, posMs: number, lines: readonly (LineLike & { speaker?: string })[]): number {
  const t = audio.timeline;
  const at = entryAt(audio, posMs);
  if (!at) return 0;
  let from = at.index;
  if (at.after) {
    const k = lineIndexOf(lines, at.entry);
    const narrator = at.entry.i < 0 || (k >= 0 && lines[k].speaker === NARRATOR);
    if (!(narrator && positionInfo(audio, posMs).reading)) from = at.index + 1;
  }
  for (let j = from; j < t.length; j++) {
    const k = lineIndexOf(lines, t[j]);
    if (k >= 0) return k;
  }
  return lines.length;
}

/**
 * Where browser voices continue a part after a refresh: the saved programme
 * line when it still reads the same thing, else wherever `at` is in this
 * programme (the part may have switched between a recording and browser voices
 * meanwhile), else the saved line as it is; null when nothing was saved.
 */
export function resumeLineIndex(lines: readonly LineLike[], line: number | undefined, at: LineRef | undefined): number | null {
  const valid = typeof line === "number" && Number.isInteger(line) && line >= 0 && line < lines.length;
  if (valid && (!at || sameLine(lines[line as number], at))) return line as number;
  if (at) {
    const k = lineIndexOf(lines, at);
    if (k >= 0) return k;
  }
  return valid ? (line as number) : null;
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
