/**
 * Frame index of a whole MP3 recording, and frame-exact clips of it.
 *
 * Shared by the offline importer (durations and boundary candidates), the
 * Audio_Manager (staff build the index in the browser when they confirm part
 * boundaries) and the Listening runner (one part plays as a clip built from a
 * Range request). No decoder and no dependencies.
 *
 * Unlike parseMp3 (which prepares clips for joining after silence), indexMp3
 * keeps the leading frames that borrow bit-reservoir bytes: the recording is
 * played as one stream, so every audio frame counts and durationMs is the sum
 * of all audio frame durations. Encoder tag frames (Xing / Info / VBRI / LAME)
 * are not audio, as in players.
 */

import { Mp3Assembler, Mp3Error, readFrameHeader, tagOf, type Mp3Format } from "./mp3";

export interface Mp3Index {
  format: Mp3Format;
  /** Byte offset of the first audio frame (after ID3v2 and any encoder tag frame). */
  firstFrameOffset: number;
  /** Start of every audio frame; offsets[frames] = end of the last frame. */
  offsets: Uint32Array;
  frames: number;
  /** samplesPerFrame × 1000 / sampleRate. */
  frameMs: number;
  /** round(frames × samplesPerFrame × 1000 / sampleRate). */
  durationMs: number;
  /** Bytes between frames that weren't part of any frame. */
  junkBytes: number;
}

function ascii(b: Uint8Array, at: number, text: string): boolean {
  if (at < 0 || at + text.length > b.length) return false;
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

function syncsafe(b: Uint8Array, at: number): number {
  let v = 0;
  for (let i = 0; i < 4; i++) {
    const x = b[at + i];
    if (x === undefined || x & 0x80) return -1;
    v = v * 128 + x;
  }
  return v;
}

function u32le(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

/** [start, end) of the stream without ID3v2 at the start and ID3v1 / APEv2 at the end. */
function streamBounds(input: Uint8Array): { start: number; end: number } {
  let start = 0;
  let end = input.length;
  while (end - start >= 10 && ascii(input, start, "ID3") && input[start + 3] !== 0xff && input[start + 4] !== 0xff) {
    const size = syncsafe(input, start + 6);
    if (size < 0) break;
    const footer = input[start + 5] & 0x10 ? 10 : 0;
    start = Math.min(end, start + 10 + size + footer);
  }
  if (end - start >= 128 && ascii(input, end - 128, "TAG")) end -= 128;
  if (end - start >= 32 && ascii(input, end - 32, "APETAGEX")) {
    const size = u32le(input, end - 32 + 12);
    const total = size + (u32le(input, end - 32 + 20) & 0x80000000 ? 32 : 0);
    if (size >= 32 && total <= end - start) end -= total;
  }
  return { start, end };
}

function formatOf(b: Uint8Array, at: number): Mp3Format {
  const h = readFrameHeader(b, at)!;
  return {
    version: h.version,
    sampleRate: h.sampleRate,
    sampleRateIndex: h.sampleRateIndex,
    channels: h.channels,
    channelMode: h.channelMode,
    samplesPerFrame: h.samplesPerFrame,
    sideInfoLength: h.sideInfoLength,
    flags: b[at + 3] & 0x0f,
  };
}

function same(h: { version: number; sampleRate: number; channels: number }, f: Mp3Format | null): boolean {
  return !f || (h.version === f.version && h.sampleRate === f.sampleRate && h.channels === f.channels);
}

interface Scan {
  format: Mp3Format | null;
  starts: number[];
  end: number;
  junk: number;
}

/** Walk the frames of [start, end); `skipTag` drops an encoder tag frame before the first audio frame. */
function scan(input: Uint8Array, start: number, end: number, skipTag: boolean, known: Mp3Format | null): Scan {
  const starts: number[] = [];
  let format = known;
  let pos = start;
  let junk = 0;
  let synced = false;
  let last = start;
  while (pos + 4 <= end) {
    const h = readFrameHeader(input, pos);
    if (!h || !same(h, format)) {
      pos += 1;
      junk += 1;
      synced = false;
      continue;
    }
    if (pos + h.frameLength > end) {
      if (synced && starts.length) {
        junk += end - pos;
        break;
      }
      pos += 1;
      junk += 1;
      continue;
    }
    if (!synced) {
      const next = pos + h.frameLength;
      if (next + 4 <= end) {
        const h2 = readFrameHeader(input, next);
        if (!h2 || !same(h2, format ?? formatOf(input, pos))) {
          pos += 1;
          junk += 1;
          continue;
        }
      }
    }
    if (skipTag && !starts.length && tagOf(input, pos, h)) {
      pos += h.frameLength;
      synced = true;
      continue;
    }
    if (!format) format = formatOf(input, pos);
    starts.push(pos);
    pos += h.frameLength;
    last = pos;
    synced = true;
  }
  return { format, starts, end: last, junk };
}

/** Index every audio frame of a recording. Throws Mp3Error when there are none. */
export function indexMp3(bytes: Uint8Array): Mp3Index {
  const { start, end } = streamBounds(bytes);
  const s = scan(bytes, start, end, true, null);
  if (!s.format || !s.starts.length) throw new Mp3Error("No MPEG Layer III audio frames found.");
  const frames = s.starts.length;
  const offsets = new Uint32Array(frames + 1);
  for (let i = 0; i < frames; i++) offsets[i] = s.starts[i];
  offsets[frames] = s.end;
  const f = s.format;
  return {
    format: f,
    firstFrameOffset: s.starts[0],
    offsets,
    frames,
    frameMs: (f.samplesPerFrame * 1000) / f.sampleRate,
    durationMs: Math.round((frames * f.samplesPerFrame * 1000) / f.sampleRate),
    junkBytes: s.junk,
  };
}

/** The audio frames of a byte range cut at frame starts (leading reservoir frames kept). */
export function framesInRange(bytes: Uint8Array, format: Mp3Format): Uint8Array[] {
  const s = scan(bytes, 0, bytes.length, false, format);
  return s.starts.map((at) => {
    const h = readFrameHeader(bytes, at)!;
    return bytes.subarray(at, at + h.frameLength);
  });
}

/**
 * A playable clip (Info/Xing header frame + the frames) from the bytes of one
 * segment, or null when the frame count isn't the expected one (the host sent
 * other bytes, or the recording changed).
 */
export function buildClip(bytes: Uint8Array, expectedFrames: number, format: Mp3Format): Uint8Array | null {
  try {
    const frames = framesInRange(bytes, format);
    if (!frames.length || frames.length !== expectedFrames) return null;
    const asm = new Mp3Assembler(format);
    asm.addClip({ format, frames });
    return asm.finish().bytes;
  } catch {
    return null;
  }
}

/** The MPEG format of a segment, rebuilt from the values stored with it (no bytes needed). */
export function formatFromSegment(seg: { sampleRate: number; samplesPerFrame: number }, firstFrame: Uint8Array): Mp3Format | null {
  const h = readFrameHeader(firstFrame, 0);
  if (!h || h.sampleRate !== seg.sampleRate || h.samplesPerFrame !== seg.samplesPerFrame) return null;
  return formatOf(firstFrame, 0);
}
