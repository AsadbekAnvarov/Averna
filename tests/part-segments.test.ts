// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { silentFrame, type Mp3Format } from "@/lib/ielts/audio/mp3";
import { buildClip, indexMp3 } from "@/lib/ielts/audio/mp3-index";
import {
  MIN_PART_MS,
  applySegmentSave,
  boundaryValues,
  checkRanges,
  formatClock,
  isVerified,
  parseClock,
  partPracticeMinutes,
  resumeInSegment,
  segmentRanges,
  segmentsFromBoundaries,
  validateSegments,
  type PartSegment,
  type SegmentRecordLike,
  type SegmentSaveInput,
  type StoredSegments,
  type Window,
} from "@/lib/ielts/segments";
import type { ExamListeningTest } from "@/lib/ielts/types";

const SHA = "a".repeat(64);
const FORMAT: Mp3Format = { version: 1, sampleRate: 48000, sampleRateIndex: 1, channels: 2, channelMode: 1, samplesPerFrame: 1152, sideInfoLength: 32, flags: 0 };
const FRAME_MS = 24;

/** An index of `frames` frames of 24 ms with random lengths (no bytes needed). */
function fakeIndex(frames: number, lengths: (i: number) => number) {
  const offsets = new Uint32Array(frames + 1);
  offsets[0] = 417;
  for (let i = 0; i < frames; i++) offsets[i + 1] = offsets[i] + lengths(i);
  return { offsets, frames, frameMs: FRAME_MS };
}

function stored(segments: PartSegment[], durationMs: number): StoredSegments {
  const frames = Math.round(durationMs / FRAME_MS);
  const idx = fakeIndex(frames, () => 576);
  const ranges = segmentRanges(idx, segments);
  return { v: 1, sampleRate: 48000, samplesPerFrame: 1152, parts: segments.map((s, i) => ({ ...s, ...ranges[i] })) };
}

/** Valid segments for a duration: three inner boundaries leaving ≥ 120 s per part. */
const validArb = fc.integer({ min: 480_000, max: 3_600_000 }).chain((D) => {
  const slack = D - 4 * MIN_PART_MS;
  return fc
    .tuple(fc.integer({ min: 0, max: slack }), fc.integer({ min: 0, max: slack }), fc.integer({ min: 0, max: slack }))
    .map(([a, b, c]) => {
      const [x, y, z] = [a, b, c].sort((p, q) => p - q);
      const bounds: [number, number, number] = [MIN_PART_MS + x, 2 * MIN_PART_MS + y, 3 * MIN_PART_MS + z];
      return { D, segments: segmentsFromBoundaries(bounds, D) };
    });
});

/** Reference implementation of the rules (Property 13). */
function reference(segments: PartSegment[], D: number, windows: Window[][]) {
  if (segments.length !== 4) return { rule: "partition", part: 1 };
  for (let i = 0; i < 4; i++) {
    const s = segments[i];
    const ok =
      Number.isInteger(s.startMs) && Number.isInteger(s.endMs) && (i === 0 ? s.startMs === 0 : s.startMs === segments[i - 1].endMs) && s.endMs > s.startMs && (i < 3 || s.endMs === D);
    if (!ok) return { rule: "partition", part: i + 1 };
  }
  for (let i = 0; i < 4; i++) if (segments[i].endMs - segments[i].startMs < MIN_PART_MS) return { rule: "min-length", part: i + 1 };
  for (let i = 0; i < 4; i++) for (const w of windows[i] ?? []) if (w.startMs < segments[i].startMs || w.endMs > segments[i].endMs) return { rule: "evidence", part: i + 1 };
  return null;
}

describe("validateSegments", () => {
  // Feature: new-tests-articles-listening-parts, Property 13: Segment validation matches the rules
  it("accepts exactly the valid partitions and reports the first violated rule", () => {
    const segArb = fc.integer({ min: 480_000, max: 3_600_000 }).chain((D) =>
      fc.record({
        D: fc.constant(D),
        bounds: fc.array(fc.integer({ min: -1000, max: D + 1000 }), { minLength: 2, maxLength: 4 }),
        jitter: fc.array(fc.integer({ min: -2, max: 2 }), { minLength: 5, maxLength: 5 }),
        windows: fc.array(fc.array(fc.tuple(fc.integer({ min: 0, max: D }), fc.integer({ min: 1, max: 60_000 })), { maxLength: 3 }), { minLength: 4, maxLength: 4 }),
      }),
    );
    fc.assert(
      fc.property(segArb, ({ D, bounds, jitter, windows }) => {
        const cuts = [0, ...bounds.sort((a, b) => a - b), D];
        const segments = cuts.slice(0, -1).map((s, i) => ({ startMs: s + (i > 0 && jitter[i] === 2 ? 1 : 0), endMs: cuts[i + 1] }));
        const wins = windows.map((ws) => ws.map(([s, len]) => ({ startMs: s, endMs: Math.min(D, s + len) })));
        expect(validateSegments(segments, { durationMs: D, windowsByPart: wins })).toEqual(reference(segments, D, wins));
      }),
      { numRuns: 200 },
    );
    fc.assert(
      fc.property(validArb, ({ D, segments }) => {
        expect(validateSegments(segments, { durationMs: D, windowsByPart: [[], [], [], []] })).toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it("allows exactly 120 000 ms and refuses 119 999 ms", () => {
    const D = 480_000;
    expect(validateSegments(segmentsFromBoundaries([120_000, 240_000, 360_000], D), { durationMs: D, windowsByPart: [] })).toBeNull();
    expect(validateSegments(segmentsFromBoundaries([119_999, 240_000, 360_000], D), { durationMs: D, windowsByPart: [] })).toEqual({ rule: "min-length", part: 1 });
  });
});

function input(segments: PartSegment[], D: number, over: Partial<SegmentSaveInput> = {}): SegmentSaveInput {
  const s = stored(segments, D);
  return {
    revision: 0,
    confirm: true,
    actorId: "staff-1",
    segments,
    ranges: s.parts.map(({ frameStart, frameEnd, byteStart, byteEnd }) => ({ frameStart, frameEnd, byteStart, byteEnd })),
    sampleRate: 48000,
    samplesPerFrame: 1152,
    fileSha256: SHA,
    recording: { sha256: SHA, durationMs: D, bytes: null },
    windowsByPart: [[], [], [], []],
    ...over,
  };
}

describe("applySegmentSave", () => {
  const now = new Date("2026-11-02T10:00:00Z");

  // Feature: new-tests-articles-listening-parts, Property 14: Segment save transitions
  it("rejects invalid input unchanged, verifies confirmed saves and lapses on a moved unconfirmed save", () => {
    fc.assert(
      fc.property(validArb, fc.integer({ min: 1, max: 5000 }), fc.boolean(), ({ D, segments }, shift, confirm) => {
        const first = applySegmentSave(null, input(segments, D), now);
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        expect(first.next.verifiedById).toBe("staff-1");
        expect(first.next.verifiedAt).toEqual(now);
        // Invalid: Part 1 shorter than 2 minutes.
        const bad = segmentsFromBoundaries([MIN_PART_MS - 1, segments[1].endMs, segments[2].endMs], D);
        expect(applySegmentSave(first.next, input(bad, D, { revision: 1 }), now)).toMatchObject({ ok: false, reason: "invalid" });
        // Moving a boundary while it still leaves valid parts.
        const b1 = segments[0].endMs + shift;
        if (b1 > segments[1].endMs - MIN_PART_MS) return;
        const moved = segmentsFromBoundaries([b1, segments[1].endMs, segments[2].endMs], D);
        const second = applySegmentSave(first.next, input(moved, D, { revision: 1, confirm, actorId: "staff-2" }), now);
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(second.verified).toBe(confirm);
        expect(second.next.revision).toBe(2);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 17: Stale revisions are rejected
  it("accepts a save only with the stored revision and increments it by one", () => {
    fc.assert(
      fc.property(validArb, fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 8 }), ({ D, segments }, revisions) => {
        let rec: SegmentRecordLike | null = null;
        for (const r of revisions) {
          const before = rec;
          const out = applySegmentSave(rec, input(segments, D, { revision: r }), now);
          if (r === (before?.revision ?? 0)) {
            expect(out.ok).toBe(true);
            if (out.ok) {
              expect(out.next.revision).toBe(r + 1);
              rec = out.next;
            }
          } else {
            expect(out).toEqual({ ok: false, reason: "conflict" });
            expect(rec).toBe(before);
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it("refuses an index of another recording", () => {
    const D = 1_500_000;
    const segs = segmentsFromBoundaries([400_000, 800_000, 1_200_000], D);
    expect(applySegmentSave(null, input(segs, D, { fileSha256: "b".repeat(64) }), now)).toEqual({ ok: false, reason: "recording" });
  });
});

function paper(D: number, sha = SHA): Pick<ExamListeningTest, "recordingSha256" | "recordingDurationMs" | "parts" | "evidenceWindows"> {
  return { recordingSha256: sha, recordingDurationMs: D, parts: [0, 1, 2, 3].map(() => ({ id: "p", title: "", context: "", speakers: [], script: [], groups: [] })), evidenceWindows: {} };
}

describe("isVerified", () => {
  // Feature: new-tests-articles-listening-parts, Property 15: Verification is bound to the recording
  it("holds only for a verified record of the paper's current recording", () => {
    fc.assert(
      fc.property(validArb, fc.constantFrom("absent", "candidates", "unverified", "verified"), fc.boolean(), fc.boolean(), ({ D, segments }, state, otherSha, otherDuration) => {
        const record: SegmentRecordLike | null =
          state === "absent"
            ? null
            : {
                recordingSha256: otherSha ? "c".repeat(64) : SHA,
                durationMs: otherDuration ? D + 1 : D,
                segments: state === "candidates" ? null : stored(segments, D),
                verifiedAt: state === "verified" ? new Date() : null,
                verifiedById: state === "verified" ? "u" : null,
                revision: 1,
              };
        const expected = state === "verified" && !otherSha && !otherDuration;
        expect(isVerified(record, paper(D))).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

describe("boundary block values", () => {
  // Feature: new-tests-articles-listening-parts, Property 21: The boundary block shows saved, then candidate, then empty values
  it("shows saved segments, else candidates, else empty inner boundaries", () => {
    fc.assert(
      fc.property(validArb, fc.boolean(), fc.boolean(), fc.boolean(), ({ D, segments }, hasSaved, hasCandidates, verified) => {
        const record: SegmentRecordLike | null = hasSaved
          ? { recordingSha256: SHA, durationMs: D, segments: stored(segments, D), verifiedAt: verified ? new Date() : null, verifiedById: verified ? "u" : null, revision: 3 }
          : null;
        const candidates = hasCandidates ? [{ boundary: 1 as const, ms: 300_000, method: "pause" as const }, null, { boundary: 3 as const, ms: D - 200_000, method: "evidence" as const }] : null;
        const v = boundaryValues(record, candidates, D);
        if (hasSaved) {
          expect(v.source).toBe("saved");
          expect(v.boundaries).toEqual([segments[0].endMs, segments[1].endMs, segments[2].endMs]);
          expect(v.verified).toBe(verified);
        } else if (hasCandidates) {
          expect(v).toEqual({ source: "candidates", boundaries: [300_000, null, D - 200_000], verified: false });
        } else expect(v).toEqual({ source: "empty", boundaries: [null, null, null], verified: false });
      }),
      { numRuns: 100 },
    );
  });
});

describe("clock text", () => {
  // Feature: new-tests-articles-listening-parts, Property 22: Clock text round trip
  it("round-trips tenths and rejects anything else", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 35_999 }), (tenths) => {
        expect(parseClock(formatClock(tenths * 100))).toBe(tenths * 100);
      }),
      { numRuns: 200 },
    );
    fc.assert(
      fc.property(fc.string({ maxLength: 10 }), (s) => {
        const ok = /^\d{2}:[0-5]\d\.\d$/.test(s.trim());
        expect(parseClock(s) === null).toBe(!ok);
      }),
      { numRuns: 200 },
    );
    expect(parseClock("06:42.3")).toBe(402_300);
    expect(formatClock(402_300)).toBe("06:42.3");
    for (const bad of ["6:42.3", "06:60.0", "06:42", "06:42.34", "aa:bb.c", ""]) expect(parseClock(bad)).toBeNull();
  });
});

describe("segment ranges and clips", () => {
  // Feature: new-tests-articles-listening-parts, Property 23: Frame-aligned part clips
  it("gives contiguous frame/byte ranges within one frame of each segment", () => {
    fc.assert(
      fc.property(validArb, fc.array(fc.integer({ min: 96, max: 1441 }), { minLength: 1, maxLength: 16 }), ({ D, segments }, lens) => {
        const frames = Math.round(D / FRAME_MS);
        const idx = fakeIndex(frames, (i) => lens[i % lens.length]);
        const ranges = segmentRanges(idx, segments);
        expect(ranges[0].frameStart).toBe(0);
        expect(ranges[3].frameEnd).toBe(frames);
        for (let i = 0; i < 4; i++) {
          const r = ranges[i];
          if (i > 0) {
            expect(r.frameStart).toBe(ranges[i - 1].frameEnd);
            expect(r.byteStart).toBe(ranges[i - 1].byteEnd);
          }
          expect(r.byteStart).toBe(idx.offsets[r.frameStart]);
          expect(r.byteEnd).toBe(idx.offsets[r.frameEnd]);
          expect(Math.abs(r.frameStart * FRAME_MS - segments[i].startMs)).toBeLessThanOrEqual(FRAME_MS);
          const len = (r.frameEnd - r.frameStart) * FRAME_MS;
          expect(Math.abs(len - (segments[i].endMs - segments[i].startMs))).toBeLessThanOrEqual(FRAME_MS + 1);
        }
        expect(checkRanges(stored(segments, D), { bytes: null, durationMs: D })).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("builds a clip with exactly the segment's frames from real bytes", () => {
    const frames = Array.from({ length: 30_000 }, (_, i) => silentFrame(FORMAT, 1 + (i % 3), 0));
    const total = frames.reduce((n, f) => n + f.length, 0);
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const f of frames) {
      bytes.set(f, at);
      at += f.length;
    }
    const idx = indexMp3(bytes);
    const D = idx.durationMs;
    const segs = segmentsFromBoundaries([150_000, 300_000, 500_000], D);
    for (const r of segmentRanges(idx, segs)) {
      const clip = buildClip(bytes.subarray(r.byteStart, r.byteEnd), r.frameEnd - r.frameStart, FORMAT);
      expect(clip).not.toBeNull();
      expect(indexMp3(clip!).frames).toBe(r.frameEnd - r.frameStart);
      expect(Math.abs(clip!.length - (r.byteEnd - r.byteStart))).toBeLessThanOrEqual(1024);
    }
  });
});

describe("part playback helpers", () => {
  // Feature: new-tests-articles-listening-parts, Property 24: Part playback positions stay inside the segment
  it("resumes up to 3 s before a saved position inside the segment, else at 0", () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_PART_MS, max: 900_000 }), fc.option(fc.integer({ min: -5000, max: 1_000_000 }), { nil: null }), (L, saved) => {
        const r = resumeInSegment(saved, L);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(Math.max(0, L - 250));
        if (saved != null && saved > 0 && saved < L - 250) {
          expect(r).toBeGreaterThanOrEqual(saved - 3000);
          expect(r).toBeLessThanOrEqual(saved);
        } else expect(r).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it("gives ceil(length / 60 s) + 1 practice minutes", () => {
    expect(partPracticeMinutes({ startMs: 0, endMs: 361_200 })).toBe(8);
    expect(partPracticeMinutes({ startMs: 0, endMs: 360_000 })).toBe(7);
  });
});
