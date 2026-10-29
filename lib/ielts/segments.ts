/**
 * Part boundaries of a supplied whole Listening recording (one file for Parts
 * 1–4). Pure: shared by the importer, the segments API, the catalog, the
 * Audio_Manager and the runner. A paper with a whole recording can be
 * practised one part at a time only when staff have confirmed all four
 * segments for the paper's current recording (isVerified).
 *
 * Spec: .kiro/specs/new-tests-articles-listening-parts (Requirements 10, 11, 13).
 */

import type { ExamListeningTest } from "./types";

export const MIN_PART_MS = 120_000;
export const MIN_SPLIT_DURATION_MS = 480_000;

export interface PartSegment {
  startMs: number;
  endMs: number;
}
export interface SegmentRange {
  frameStart: number;
  frameEnd: number;
  byteStart: number;
  byteEnd: number;
}
export interface StoredSegments {
  v: 1;
  sampleRate: number;
  samplesPerFrame: number;
  parts: (PartSegment & SegmentRange)[];
}
export interface Window {
  startMs: number;
  endMs: number;
}
export type SegmentRule = "partition" | "min-length" | "evidence";
export interface SegmentViolation {
  rule: SegmentRule;
  part: 1 | 2 | 3 | 4;
}
/** An importer suggestion for the boundary between part k and part k + 1. */
export interface BoundaryCandidate {
  boundary: 1 | 2 | 3;
  ms: number;
  method: "pause" | "evidence";
}

export interface SegmentRecordLike {
  recordingSha256: string;
  durationMs: number;
  segments: StoredSegments | null;
  verifiedAt: Date | string | null;
  verifiedById: string | null;
  revision: number;
}

export interface SegmentSaveInput {
  revision: number;
  confirm: boolean;
  actorId: string;
  segments: PartSegment[];
  ranges: SegmentRange[];
  sampleRate: number;
  samplesPerFrame: number;
  fileSha256: string;
  /** The paper's current recording and answer windows: the rules are checked against them. */
  recording: { sha256: string; durationMs: number; bytes: number | null };
  windowsByPart: Window[][];
}

export type SegmentSaveOutcome =
  | { ok: true; next: SegmentRecordLike; verified: boolean }
  | { ok: false; reason: "conflict" }
  | { ok: false; reason: "invalid"; violation: SegmentViolation }
  | { ok: false; reason: "recording" };

const PARTS = 4;

function partNo(i: number): 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(1, i + 1)) as 1 | 2 | 3 | 4;
}

/** Four segments from three inner boundaries. */
export function segmentsFromBoundaries(boundaries: readonly [number, number, number], durationMs: number): PartSegment[] {
  const cuts = [0, ...boundaries, durationMs];
  return [0, 1, 2, 3].map((i) => ({ startMs: cuts[i], endMs: cuts[i + 1] }));
}

/**
 * The first violated rule, in the order partition → min-length → evidence,
 * with the part it concerns; null when the segments are valid.
 */
export function validateSegments(
  segments: readonly PartSegment[],
  ctx: { durationMs: number; windowsByPart: readonly (readonly Window[])[] },
): SegmentViolation | null {
  if (!Array.isArray(segments) || segments.length !== PARTS) return { rule: "partition", part: 1 };
  for (let i = 0; i < PARTS; i++) {
    const s = segments[i];
    if (!s || !Number.isInteger(s.startMs) || !Number.isInteger(s.endMs)) return { rule: "partition", part: partNo(i) };
    if (i === 0 ? s.startMs !== 0 : s.startMs !== segments[i - 1].endMs) return { rule: "partition", part: partNo(i) };
    if (s.endMs <= s.startMs) return { rule: "partition", part: partNo(i) };
    if (i === PARTS - 1 && s.endMs !== ctx.durationMs) return { rule: "partition", part: partNo(i) };
  }
  for (let i = 0; i < PARTS; i++) {
    if (segments[i].endMs - segments[i].startMs < MIN_PART_MS) return { rule: "min-length", part: partNo(i) };
  }
  for (let i = 0; i < PARTS; i++) {
    for (const w of ctx.windowsByPart[i] ?? []) {
      if (w.startMs < segments[i].startMs || w.endMs > segments[i].endMs) return { rule: "evidence", part: partNo(i) };
    }
  }
  return null;
}

/** Answer windows of each part (by the part's question numbers). */
export function windowsByPart(test: Pick<ExamListeningTest, "parts" | "evidenceWindows">): Window[][] {
  const all = test.evidenceWindows ?? {};
  return test.parts.map((p) => {
    const out: Window[] = [];
    for (const g of p.groups) {
      for (const q of g.questions) {
        const w = all[String(q.n)];
        if (w && Number.isFinite(w.startMs) && Number.isFinite(w.endMs)) out.push({ startMs: w.startMs, endMs: w.endMs });
      }
    }
    return out;
  });
}

/** Frame and byte ranges of each segment: boundary b → frame round(b / frameMs). */
export function segmentRanges(
  index: { offsets: ArrayLike<number>; frames: number; frameMs: number },
  segments: readonly PartSegment[],
): SegmentRange[] {
  const frameAt = (ms: number) => Math.min(index.frames - 1, Math.max(1, Math.round(ms / index.frameMs)));
  const cuts = [0, ...segments.slice(0, -1).map((s) => frameAt(s.endMs)), index.frames];
  return segments.map((_, i) => ({
    frameStart: cuts[i],
    frameEnd: cuts[i + 1],
    byteStart: index.offsets[cuts[i]],
    byteEnd: index.offsets[cuts[i + 1]],
  }));
}

/**
 * Server-side plausibility of the ranges the staff browser computed: four
 * contiguous frame and byte ranges, frames matching milliseconds within one
 * frame, inside the file, and a bitrate between 8 and 320 kbps.
 */
export function checkRanges(stored: StoredSegments, ctx: { bytes: number | null; durationMs: number }): boolean {
  if (!stored || stored.v !== 1 || !Array.isArray(stored.parts) || stored.parts.length !== PARTS) return false;
  if (![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(stored.sampleRate)) return false;
  if (stored.samplesPerFrame !== 576 && stored.samplesPerFrame !== 1152) return false;
  const frameMs = (stored.samplesPerFrame * 1000) / stored.sampleRate;
  const p = stored.parts;
  if (p[0].frameStart !== 0 || p[0].startMs !== 0) return false;
  for (let i = 0; i < PARTS; i++) {
    const s = p[i];
    for (const v of [s.frameStart, s.frameEnd, s.byteStart, s.byteEnd, s.startMs, s.endMs]) if (!Number.isInteger(v) || v < 0) return false;
    if (s.frameEnd <= s.frameStart || s.byteEnd <= s.byteStart) return false;
    if (i > 0 && (s.frameStart !== p[i - 1].frameEnd || s.byteStart !== p[i - 1].byteEnd || s.startMs !== p[i - 1].endMs)) return false;
    if (Math.abs(s.frameStart * frameMs - s.startMs) > frameMs + 1) return false;
    // The last frame ends the file: allow up to 1 s against a duration measured by an older importer.
    if (Math.abs(s.frameEnd * frameMs - s.endMs) > (i === PARTS - 1 ? Math.max(frameMs + 1, 1000) : frameMs + 1)) return false;
    const kbps = ((s.byteEnd - s.byteStart) * 8) / ((s.frameEnd - s.frameStart) * frameMs);
    if (!(kbps >= 7.5 && kbps <= 330)) return false;
  }
  if (p[PARTS - 1].endMs !== ctx.durationMs) return false;
  if (ctx.bytes != null && p[PARTS - 1].byteEnd > ctx.bytes) return false;
  return true;
}

function sameRecording(record: SegmentRecordLike, test: Pick<ExamListeningTest, "recordingSha256" | "recordingDurationMs">): boolean {
  return !!test.recordingSha256 && record.recordingSha256 === test.recordingSha256 && record.durationMs === test.recordingDurationMs;
}

/** Verified for the paper's current recording, and still valid against its answer windows. */
export function isVerified(
  record: SegmentRecordLike | null | undefined,
  test: Pick<ExamListeningTest, "recordingSha256" | "recordingDurationMs" | "parts" | "evidenceWindows">,
): boolean {
  if (!record || !record.verifiedAt || !record.segments || !sameRecording(record, test)) return false;
  const durationMs = test.recordingDurationMs ?? 0;
  if (validateSegments(record.segments.parts, { durationMs, windowsByPart: windowsByPart(test) })) return false;
  return checkRanges(record.segments, { bytes: null, durationMs });
}

function innerBoundaries(s: StoredSegments | null): number[] | null {
  return s ? s.parts.slice(0, -1).map((p) => p.endMs) : null;
}

/** The save rules (10.7, 10.9, 11.4, 11.5, 11.9) without the database. */
export function applySegmentSave(prev: SegmentRecordLike | null, input: SegmentSaveInput, now: Date): SegmentSaveOutcome {
  const current = prev?.revision ?? 0;
  if (input.revision !== current) return { ok: false, reason: "conflict" };
  const violation = validateSegments(input.segments, { durationMs: input.recording.durationMs, windowsByPart: input.windowsByPart });
  if (violation) return { ok: false, reason: "invalid", violation };
  if (input.fileSha256 !== input.recording.sha256 || input.ranges.length !== PARTS) return { ok: false, reason: "recording" };
  const stored: StoredSegments = {
    v: 1,
    sampleRate: input.sampleRate,
    samplesPerFrame: input.samplesPerFrame,
    parts: input.segments.map((s, i) => ({
      startMs: s.startMs,
      endMs: s.endMs,
      frameStart: input.ranges[i].frameStart,
      frameEnd: input.ranges[i].frameEnd,
      byteStart: input.ranges[i].byteStart,
      byteEnd: input.ranges[i].byteEnd,
    })),
  };
  if (!checkRanges(stored, { bytes: input.recording.bytes, durationMs: input.recording.durationMs })) return { ok: false, reason: "recording" };

  let verifiedAt: Date | string | null = null;
  let verifiedById: string | null = null;
  if (input.confirm) {
    verifiedAt = now;
    verifiedById = input.actorId;
  } else if (prev?.verifiedAt && prev.recordingSha256 === input.recording.sha256 && prev.durationMs === input.recording.durationMs) {
    const before = innerBoundaries(prev.segments);
    const after = innerBoundaries(stored)!;
    const moved = !before || before.some((b, i) => Math.abs(b - after[i]) >= 1);
    if (!moved) {
      verifiedAt = prev.verifiedAt;
      verifiedById = prev.verifiedById;
    }
  }
  const next: SegmentRecordLike = {
    recordingSha256: input.recording.sha256,
    durationMs: input.recording.durationMs,
    segments: stored,
    verifiedAt,
    verifiedById,
    revision: current + 1,
  };
  return { ok: true, next, verified: !!verifiedAt };
}

/** What the boundary block shows: saved segments, else importer candidates, else empty inner boundaries. */
export function boundaryValues(
  record: SegmentRecordLike | null,
  candidates: readonly (BoundaryCandidate | null)[] | null,
  durationMs: number,
): { source: "saved" | "candidates" | "empty"; boundaries: [number | null, number | null, number | null]; verified: boolean } {
  if (record?.segments && record.segments.parts.length === PARTS) {
    const b = innerBoundaries(record.segments)!;
    return { source: "saved", boundaries: [b[0], b[1], b[2]], verified: !!record.verifiedAt && record.durationMs === durationMs };
  }
  if (candidates && candidates.some((c) => c)) {
    const at = (k: number) => {
      const c = candidates.find((x) => x?.boundary === k) ?? candidates[k - 1];
      return c && Number.isFinite(c.ms) ? Math.round(c.ms) : null;
    };
    return { source: "candidates", boundaries: [at(1), at(2), at(3)], verified: false };
  }
  return { source: "empty", boundaries: [null, null, null], verified: false };
}

/** Where a part continues after a refresh: up to 3 s before the saved position, or 0 outside the segment. */
export function resumeInSegment(savedMs: number | null | undefined, lengthMs: number): number {
  if (savedMs == null || !Number.isFinite(savedMs) || savedMs <= 0 || savedMs >= lengthMs - 250) return 0;
  return Math.max(0, Math.round(savedMs) - 3000);
}

/** Practice minutes of one part: the recording plus one minute to check answers. */
export function partPracticeMinutes(segment: PartSegment): number {
  return Math.ceil((segment.endMs - segment.startMs) / 60000) + 1;
}

const CLOCK_RE = /^(\d{2}):([0-5]\d)\.(\d)$/;

/** "06:42.3" → 402300; anything else → null. */
export function parseClock(text: string): number | null {
  const m = CLOCK_RE.exec(typeof text === "string" ? text.trim() : "");
  if (!m) return null;
  return Number(m[1]) * 60000 + Number(m[2]) * 1000 + Number(m[3]) * 100;
}

/** 402300 → "06:42.3" (tenths, rounded). */
export function formatClock(ms: number): string {
  const tenths = Math.max(0, Math.round(ms / 100));
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  const d = tenths % 10;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${d}`;
}
