// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Mp3Assembler, Mp3Error, silentFrame, type Mp3Format } from "@/lib/ielts/audio/mp3";
import { buildClip, framesInRange, indexMp3 } from "@/lib/ielts/audio/mp3-index";

export const MPEG1: Mp3Format = { version: 1, sampleRate: 44100, sampleRateIndex: 0, channels: 2, channelMode: 1, samplesPerFrame: 1152, sideInfoLength: 32, flags: 0 };
export const MPEG1_48: Mp3Format = { ...MPEG1, sampleRate: 48000, sampleRateIndex: 1 };
export const MPEG2: Mp3Format = { version: 2, sampleRate: 24000, sampleRateIndex: 1, channels: 1, channelMode: 3, samplesPerFrame: 576, sideInfoLength: 9, flags: 0 };

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function id3v2(size: number): Uint8Array {
  const b = new Uint8Array(10 + size);
  b.set([0x49, 0x44, 0x33, 4, 0, 0]);
  b[6] = (size >> 21) & 0x7f;
  b[7] = (size >> 14) & 0x7f;
  b[8] = (size >> 7) & 0x7f;
  b[9] = size & 0x7f;
  return b;
}

function id3v1(): Uint8Array {
  const b = new Uint8Array(128);
  b.set([0x54, 0x41, 0x47]);
  return b;
}

const formatArb = fc.constantFrom(MPEG1, MPEG1_48, MPEG2);

/** A stream of frames with random bitrates and padding, with optional tags, Xing frame and junk. */
const streamArb = formatArb.chain((format) =>
  fc
    .record({
      frames: fc.array(fc.record({ bitrate: fc.integer({ min: 1, max: 14 }), padding: fc.constantFrom<0 | 1>(0, 1), junk: fc.integer({ min: 0, max: 3 }) }), { minLength: 3, maxLength: 60 }),
      id3: fc.option(fc.integer({ min: 0, max: 300 }), { nil: null }),
      xing: fc.boolean(),
      v1: fc.boolean(),
    })
    .map((r) => ({ ...r, format })),
);

function buildStream(s: { format: Mp3Format; frames: { bitrate: number; padding: 0 | 1; junk: number }[]; id3: number | null; xing: boolean; v1: boolean }) {
  const frames = s.frames.map((f) => silentFrame(s.format, f.bitrate, f.padding));
  const pieces: Uint8Array[] = [];
  if (s.id3 != null) pieces.push(id3v2(s.id3));
  if (s.xing) {
    // An Info/Xing tag frame: what Mp3Assembler writes in front of a stream.
    const asm = new Mp3Assembler(s.format);
    asm.addClip({ format: s.format, frames: frames.slice(0, 1) });
    const one = asm.finish().bytes;
    pieces.push(one.subarray(0, one.length - frames[0].length));
  }
  const starts: number[] = [];
  let at = pieces.reduce((n, p) => n + p.length, 0);
  // Junk between frames, as real streams have it: a frame after junk is trusted once the next
  // header lines up, so junk never sits on both sides of a frame (or right after the first one).
  const junks = s.frames.map((f) => f.junk);
  for (let i = 0; i < junks.length; i++) if (i < 2 || junks[i - 1] > 0) junks[i] = 0;
  frames.forEach((fr, i) => {
    const junk = junks[i];
    if (junk) {
      pieces.push(new Uint8Array(junk));
      at += junk;
    }
    starts.push(at);
    pieces.push(fr);
    at += fr.length;
  });
  if (s.v1) pieces.push(id3v1());
  return { bytes: concat(pieces), starts, end: at, frames };
}

describe("indexMp3", () => {
  // Feature: new-tests-articles-listening-parts, Property 11: The MP3 index measures the frame sum
  it("counts every audio frame, skips the tag frame and reports frame offsets", () => {
    fc.assert(
      fc.property(streamArb, (s) => {
        const built = buildStream(s);
        const idx = indexMp3(built.bytes);
        expect(idx.frames).toBe(built.frames.length);
        expect(Array.from(idx.offsets.subarray(0, idx.frames))).toEqual(built.starts);
        expect(idx.offsets[idx.frames]).toBe(built.end);
        expect(idx.durationMs).toBe(Math.round((built.frames.length * s.format.samplesPerFrame * 1000) / s.format.sampleRate));
        expect(idx.firstFrameOffset).toBe(built.starts[0]);
      }),
      { numRuns: 100 },
    );
  });

  it("raises Mp3Error without frames (only ID3, only junk)", () => {
    expect(() => indexMp3(id3v2(50))).toThrow(Mp3Error);
    expect(() => indexMp3(new Uint8Array(5000))).toThrow(Mp3Error);
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 400 }).map((b) => b.map((x) => x & 0x7f)), (b) => {
        expect(() => indexMp3(b)).toThrow(Mp3Error);
      }),
      { numRuns: 50 },
    );
  });
});

describe("buildClip", () => {
  it("wraps exactly the frames of a range and refuses a wrong count", () => {
    const frames = Array.from({ length: 40 }, (_, i) => silentFrame(MPEG1_48, 1 + (i % 9), 0));
    const bytes = concat(frames);
    expect(framesInRange(bytes, MPEG1_48)).toHaveLength(40);
    const clip = buildClip(bytes, 40, MPEG1_48);
    expect(clip).not.toBeNull();
    expect(indexMp3(clip!).frames).toBe(40);
    expect(clip!.length - bytes.length).toBeLessThanOrEqual(1024);
    expect(buildClip(bytes, 39, MPEG1_48)).toBeNull();
  });
});
