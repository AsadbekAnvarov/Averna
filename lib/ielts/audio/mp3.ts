/**
 * MPEG audio frame surgery for the pre-rendered Listening audio — no decoder,
 * no re-encoding, no dependencies.
 *
 * parseMp3   one encoded clip (e.g. an OpenAI text-to-speech response) → its
 *            MPEG-1/2/2.5 Layer III audio frames. Skips ID3v2 at the start,
 *            ID3v1 / APEv2 at the end and junk between frames; drops the
 *            Xing / Info / VBRI / LAME header frames (they describe ONE clip),
 *            and leading frames of a cut stream that need bit-reservoir bytes
 *            from before the clip (joined after silence they would click).
 * Mp3Assembler  joins clips and silences into one stream:
 *            - silence = generated silent frames with the stream's version /
 *              sample rate / channel mode and a valid bitrate: 4-byte header
 *              (protection bit set → no CRC), all-zero side info and main data,
 *              which every decoder plays as digital silence; frame count =
 *              round(seconds × sampleRate / samplesPerFrame);
 *            - clips with another sample rate or channel layout are refused
 *              (a decoder can't switch mid-stream);
 *            - finish() prepends a Xing ("Info" when the stream is CBR) frame
 *              with the exact frame count, byte count and a 100-entry TOC, so
 *              duration and seeking are right in every browser (iOS Safari
 *              otherwise guesses the duration from the first frame).
 *
 * Silence uses the most common bitrate of the speech by default, so a CBR
 * input stays CBR (seeking by byte offset is then exact everywhere) at the cost
 * of a few hundred KB per part; "min" makes silence almost free instead.
 */

export type MpegVersion = 1 | 2 | 25; // 25 = MPEG-2.5

const VERSION_BITS: Record<MpegVersion, number> = { 1: 0b11, 2: 0b10, 25: 0b00 };
const SAMPLE_RATES: Record<MpegVersion, number[]> = {
  1: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  25: [11025, 12000, 8000],
};
/** Layer III bitrates in kbps by index (0 = free format and 15 = invalid are never accepted). */
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

/** Xing flags: frame count, byte count, TOC. */
const XING_FLAGS = 0x0001 | 0x0002 | 0x0004;
/** "Xing" + flags + frames + bytes + TOC(100) + quality: bytes the tag needs after the side info. */
const XING_TAG_BYTES = 120;

export class Mp3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Mp3Error";
  }
}

export interface Mp3FrameHeader {
  version: MpegVersion;
  /** A CRC-16 follows the header (protection bit 0). */
  crc: boolean;
  bitrateIndex: number;
  bitrateKbps: number;
  sampleRateIndex: number;
  sampleRate: number;
  padding: 0 | 1;
  /** 0 stereo, 1 joint stereo, 2 dual channel, 3 mono. */
  channelMode: number;
  channels: 1 | 2;
  samplesPerFrame: number;
  /** Whole frame, header included. */
  frameLength: number;
  sideInfoLength: number;
}

/** The stream a frame belongs to (what must not change between joined clips). */
export interface Mp3Format {
  version: MpegVersion;
  sampleRate: number;
  sampleRateIndex: number;
  channels: 1 | 2;
  channelMode: number;
  samplesPerFrame: number;
  sideInfoLength: number;
  /** Low nibble of header byte 3 (copyright / original / emphasis), copied into generated frames. */
  flags: number;
}

export interface ParsedMp3 {
  format: Mp3Format;
  /** Audio frames (views into the input — no copies). */
  frames: Uint8Array[];
  /** What was skipped: "id3v2", "id3v1", "ape", "xing", "info", "vbri", "lame", "truncated". */
  skipped: string[];
  /** Bytes between frames that weren't part of any frame. */
  junkBytes: number;
}

function bitrateTable(version: MpegVersion): number[] {
  return version === 1 ? BITRATES_V1 : BITRATES_V2;
}

function frameLengthFor(version: MpegVersion, sampleRate: number, bitrateIndex: number, padding: 0 | 1): number {
  const kbps = bitrateTable(version)[bitrateIndex];
  return Math.floor(((version === 1 ? 144000 : 72000) * kbps) / sampleRate) + padding;
}

function sideInfoFor(version: MpegVersion, channels: 1 | 2): number {
  return version === 1 ? (channels === 1 ? 17 : 32) : channels === 1 ? 9 : 17;
}

/** Parse the 4-byte Layer III frame header at `at` (null when it isn't one). */
export function readFrameHeader(b: Uint8Array, at: number): Mp3FrameHeader | null {
  if (at < 0 || at + 4 > b.length) return null;
  const b1 = b[at + 1];
  const b2 = b[at + 2];
  const b3 = b[at + 3];
  if (b[at] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const vbits = (b1 >> 3) & 0b11;
  if (vbits === 0b01 || ((b1 >> 1) & 0b11) !== 0b01) return null; // reserved version / not Layer III
  const version: MpegVersion = vbits === 0b11 ? 1 : vbits === 0b10 ? 2 : 25;
  const bitrateIndex = b2 >> 4;
  const sampleRateIndex = (b2 >> 2) & 0b11;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3 || (b3 & 0b11) === 0b10) return null;
  const sampleRate = SAMPLE_RATES[version][sampleRateIndex];
  const padding = ((b2 >> 1) & 1) as 0 | 1;
  const channelMode = b3 >> 6;
  const channels: 1 | 2 = channelMode === 3 ? 1 : 2;
  return {
    version,
    crc: (b1 & 1) === 0,
    bitrateIndex,
    bitrateKbps: bitrateTable(version)[bitrateIndex],
    sampleRateIndex,
    sampleRate,
    padding,
    channelMode,
    channels,
    samplesPerFrame: version === 1 ? 1152 : 576,
    frameLength: frameLengthFor(version, sampleRate, bitrateIndex, padding),
    sideInfoLength: sideInfoFor(version, channels),
  };
}

function formatOf(h: Mp3FrameHeader, byte3: number): Mp3Format {
  return {
    version: h.version,
    sampleRate: h.sampleRate,
    sampleRateIndex: h.sampleRateIndex,
    channels: h.channels,
    channelMode: h.channelMode,
    samplesPerFrame: h.samplesPerFrame,
    sideInfoLength: h.sideInfoLength,
    flags: byte3 & 0x0f,
  };
}

function sameStream(h: { version: MpegVersion; sampleRate: number; channels: 1 | 2 }, f: Mp3Format): boolean {
  return h.version === f.version && h.sampleRate === f.sampleRate && h.channels === f.channels;
}

export function describeFormat(f: { version: MpegVersion; sampleRate: number; channels: 1 | 2 }): string {
  const v = f.version === 25 ? "2.5" : String(f.version);
  return `MPEG-${v} Layer III, ${f.sampleRate / 1000} kHz, ${f.channels === 1 ? "mono" : "stereo"}`;
}

/** Milliseconds of audio in one frame of this stream. */
export function frameDurationMs(f: { samplesPerFrame: number; sampleRate: number }): number {
  return (f.samplesPerFrame * 1000) / f.sampleRate;
}

/** Silent frames for `seconds` of silence: round(seconds × sampleRate / samplesPerFrame). */
export function silenceFrameCount(seconds: number, f: { samplesPerFrame: number; sampleRate: number }): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round((seconds * f.sampleRate) / f.samplesPerFrame);
}

function ascii(b: Uint8Array, at: number, text: string): boolean {
  if (at < 0 || at + text.length > b.length) return false;
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

function u32le(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

function u32be(b: Uint8Array, at: number): number {
  return ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
}

function putU32be(b: Uint8Array, at: number, v: number): void {
  b[at] = (v >>> 24) & 0xff;
  b[at + 1] = (v >>> 16) & 0xff;
  b[at + 2] = (v >>> 8) & 0xff;
  b[at + 3] = v & 0xff;
}

/** ID3v2 size: four 7-bit bytes. -1 when malformed. */
function syncsafe(b: Uint8Array, at: number): number {
  let v = 0;
  for (let i = 0; i < 4; i++) {
    const x = b[at + i];
    if (x === undefined || x & 0x80) return -1;
    v = v * 128 + x;
  }
  return v;
}

/** Offsets (from the frame start) where a Xing / Info / LAME tag can sit. */
function tagOffsets(h: Mp3FrameHeader): number[] {
  const base = 4 + h.sideInfoLength;
  return h.crc ? [base, base + 2] : [base];
}

/** Bit-reservoir back-pointer: bytes of main data this frame takes from EARLIER frames. */
function mainDataBegin(b: Uint8Array, at: number, h: Mp3FrameHeader): number {
  const s = at + 4 + (h.crc ? 2 : 0);
  return h.version === 1 ? (b[s] << 1) | (b[s + 1] >> 7) : b[s];
}

/** A clip's first frames that borrow data from before the clip are dropped — at most this many (~0.5 s). */
const MAX_LEADING_DROPS = 20;

/** A header frame of an encoder (not audio): "xing" | "info" | "lame" | "vbri", else null. */
function tagOf(b: Uint8Array, at: number, h: Mp3FrameHeader): string | null {
  for (const o of tagOffsets(h)) {
    if (o + 4 > h.frameLength) continue;
    if (ascii(b, at + o, "Xing")) return "xing";
    if (ascii(b, at + o, "Info")) return "info";
    if (ascii(b, at + o, "LAME")) return "lame";
  }
  if (40 <= h.frameLength && ascii(b, at + 36, "VBRI")) return "vbri";
  return null;
}

/** One encoded clip → its audio frames. Throws Mp3Error when there are none. */
export function parseMp3(input: Uint8Array): ParsedMp3 {
  let start = 0;
  let end = input.length;
  const skipped: string[] = [];

  // ID3v2 at the start (some files carry more than one).
  while (end - start >= 10 && ascii(input, start, "ID3") && input[start + 3] !== 0xff && input[start + 4] !== 0xff) {
    const size = syncsafe(input, start + 6);
    if (size < 0) break;
    const footer = input[start + 5] & 0x10 ? 10 : 0;
    start = Math.min(end, start + 10 + size + footer);
    skipped.push("id3v2");
  }
  // ID3v1 ("TAG", 128 bytes) is the very last thing; an APEv2 tag sits just before it.
  if (end - start >= 128 && ascii(input, end - 128, "TAG")) {
    end -= 128;
    skipped.push("id3v1");
  }
  if (end - start >= 32 && ascii(input, end - 32, "APETAGEX")) {
    const size = u32le(input, end - 32 + 12);
    const total = size + (u32le(input, end - 32 + 20) & 0x80000000 ? 32 : 0);
    if (size >= 32 && total <= end - start) {
      end -= total;
      skipped.push("ape");
    }
  }

  const frames: Uint8Array[] = [];
  let format: Mp3Format | null = null;
  let pos = start;
  let junk = 0;
  /** The previous frame ended exactly here (no resync needed). */
  let synced = false;
  let leadingDrops = 0;
  while (pos + 4 <= end) {
    const h = readFrameHeader(input, pos);
    if (!h || (format && !sameStream(h, format))) {
      pos += 1;
      junk += 1;
      synced = false;
      continue;
    }
    if (pos + h.frameLength > end) {
      if (synced && frames.length) {
        // The stream was cut off inside its last frame.
        skipped.push("truncated");
        junk += end - pos;
        break;
      }
      pos += 1;
      junk += 1;
      continue;
    }
    if (!synced) {
      // After junk (or at the start) a "frame" is only trusted when the next header lines up too.
      const next = pos + h.frameLength;
      if (next + 4 <= end) {
        const h2 = readFrameHeader(input, next);
        if (!h2 || !sameStream(h2, format ?? formatOf(h, input[pos + 3]))) {
          pos += 1;
          junk += 1;
          continue;
        }
      }
    }
    if (!frames.length) {
      const tag = tagOf(input, pos, h);
      // A first audio frame whose data starts in earlier frames can't be decoded (nothing came
      // before it); after a join it would read our silence as its data — a click. Encoders start
      // streams at 0, so this only drops a few ms of a cut stream.
      const borrows = !tag && leadingDrops < MAX_LEADING_DROPS && mainDataBegin(input, pos, h) > 0;
      if (tag || borrows) {
        skipped.push(tag ?? "reservoir");
        if (borrows) leadingDrops += 1;
        pos += h.frameLength;
        synced = true;
        continue;
      }
    }
    if (!format) format = formatOf(h, input[pos + 3]);
    frames.push(input.subarray(pos, pos + h.frameLength));
    pos += h.frameLength;
    synced = true;
  }
  if (!format || !frames.length) throw new Mp3Error("No MPEG Layer III audio frames found.");
  return { format, frames, skipped, junkBytes: junk };
}

function writeHeader(b: Uint8Array, f: Mp3Format, bitrateIndex: number, padding: 0 | 1): void {
  b[0] = 0xff;
  b[1] = 0xe0 | (VERSION_BITS[f.version] << 3) | (0b01 << 1) | 1; // Layer III, protection bit set = no CRC
  b[2] = (bitrateIndex << 4) | (f.sampleRateIndex << 2) | (padding << 1);
  b[3] = (f.channelMode << 6) | (f.flags & 0x0f); // mode extension 0
}

/** One silent frame: header + all-zero side info and main data. */
export function silentFrame(f: Mp3Format, bitrateIndex: number, padding: 0 | 1 = 0): Uint8Array {
  if (bitrateIndex < 1 || bitrateIndex > 14) throw new Mp3Error(`Invalid bitrate index ${bitrateIndex}.`);
  const frame = new Uint8Array(frameLengthFor(f.version, f.sampleRate, bitrateIndex, padding));
  writeHeader(frame, f, bitrateIndex, padding);
  return frame;
}

/** Silent frames with the padding cadence of a real encoder (keeps the average bitrate exact at 44.1 / 22.05 / 11.025 kHz). */
class SilenceSource {
  private readonly frames: [Uint8Array, Uint8Array];
  private readonly fraction: number;
  private acc = 0;

  constructor(f: Mp3Format, bitrateIndex: number) {
    const exact = ((f.version === 1 ? 144000 : 72000) * bitrateTable(f.version)[bitrateIndex]) / f.sampleRate;
    this.fraction = exact - Math.floor(exact);
    this.frames = [silentFrame(f, bitrateIndex, 0), silentFrame(f, bitrateIndex, 1)];
  }

  next(): Uint8Array {
    if (this.fraction < 1e-9) return this.frames[0];
    this.acc += this.fraction;
    if (this.acc >= 1 - 1e-9) {
      this.acc -= 1;
      return this.frames[1];
    }
    return this.frames[0];
  }
}

type Piece = { frames: Uint8Array[] } | { silence: number };

export interface AssembleOptions {
  /** Bitrate of generated silence: "match" (default) = the speech's most common bitrate; "min"; or kbps. */
  silenceBitrate?: "match" | "min" | number;
}

export interface AssembledMp3 {
  bytes: Uint8Array;
  /** Audio frames (the Xing/Info frame excluded). */
  frames: number;
  durationMs: number;
  /** "Info" when every audio frame has the same bitrate (CBR), else "Xing". */
  tag: "Xing" | "Info";
  silenceKbps: number;
  /** Most common bitrate of the joined clips. */
  audioKbps: number | null;
  xingFrameLength: number;
}

/** Joins clips and silences into one MP3 stream (see the file comment). */
export class Mp3Assembler {
  readonly format: Mp3Format;
  private readonly pieces: Piece[] = [];
  private count = 0;
  /** Bitrate index → audio frames (generated silence not counted). */
  private readonly bitrates = new Map<number, number>();

  constructor(format: Mp3Format) {
    this.format = format;
  }

  /** Frames so far = index of the next frame. */
  get frameCount(): number {
    return this.count;
  }

  /** Time (ms, rounded) at the start of frame `frame`. */
  msAt(frame: number): number {
    return Math.round((frame * this.format.samplesPerFrame * 1000) / this.format.sampleRate);
  }

  addClip(clip: { format: Mp3Format; frames: Uint8Array[] }): { start: number; end: number } {
    const f = clip.format;
    if (f.version !== this.format.version || f.sampleRate !== this.format.sampleRate) {
      throw new Mp3Error(`Can't join ${describeFormat(f)} audio to ${describeFormat(this.format)}: the sample rate differs.`);
    }
    if (f.channels !== this.format.channels) {
      throw new Mp3Error(`Can't join ${describeFormat(f)} audio to ${describeFormat(this.format)}: the channel mode differs.`);
    }
    for (const fr of clip.frames) {
      const h = readFrameHeader(fr, 0);
      if (!h || !sameStream(h, this.format) || h.frameLength !== fr.length) throw new Mp3Error("The clip contains an invalid frame.");
      this.bitrates.set(h.bitrateIndex, (this.bitrates.get(h.bitrateIndex) ?? 0) + 1);
    }
    const start = this.count;
    if (clip.frames.length) {
      this.pieces.push({ frames: clip.frames });
      this.count += clip.frames.length;
    }
    return { start, end: this.count };
  }

  addSilence(seconds: number): { start: number; end: number } {
    const n = silenceFrameCount(seconds, this.format);
    const start = this.count;
    if (n > 0) {
      this.pieces.push({ silence: n });
      this.count += n;
    }
    return { start, end: this.count };
  }

  finish(opts: AssembleOptions = {}): AssembledMp3 {
    const f = this.format;
    const n = this.count;
    if (n === 0) throw new Mp3Error("Nothing to write.");
    const table = bitrateTable(f.version);

    // The speech's most common bitrate (ties → the lower one).
    let audioIndex: number | null = null;
    let most = 0;
    for (const [idx, c] of Array.from(this.bitrates.entries())) {
      if (c > most || (c === most && audioIndex !== null && idx < audioIndex)) {
        most = c;
        audioIndex = idx;
      }
    }
    let silenceIndex: number;
    const pref = opts.silenceBitrate ?? "match";
    if (typeof pref === "number") {
      silenceIndex = table.indexOf(pref);
      if (silenceIndex < 1) throw new Mp3Error(`${pref} kbps is not a valid bitrate for ${describeFormat(f)}.`);
    } else {
      silenceIndex = pref === "min" || audioIndex === null ? 1 : audioIndex;
    }

    // Every frame in order (silence frames are shared templates).
    const silence = new SilenceSource(f, silenceIndex);
    const all: Uint8Array[] = new Array(n);
    let k = 0;
    let cbr = true;
    let firstIndex = -1;
    for (const p of this.pieces) {
      if ("frames" in p) {
        for (const fr of p.frames) {
          all[k++] = fr;
          const idx = fr[2] >> 4;
          if (firstIndex < 0) firstIndex = idx;
          else if (idx !== firstIndex) cbr = false;
        }
      } else {
        for (let s = 0; s < p.silence; s++) all[k++] = silence.next();
        if (firstIndex < 0) firstIndex = silenceIndex;
        else if (silenceIndex !== firstIndex) cbr = false;
      }
    }

    // The Xing frame: the silence bitrate when the tag fits, else the smallest bitrate that holds it.
    const need = 4 + f.sideInfoLength + XING_TAG_BYTES;
    let xingIndex = silenceIndex;
    if (frameLengthFor(f.version, f.sampleRate, xingIndex, 0) < need) {
      xingIndex = 1;
      while (xingIndex < 14 && frameLengthFor(f.version, f.sampleRate, xingIndex, 0) < need) xingIndex += 1;
    }
    const xingLength = frameLengthFor(f.version, f.sampleRate, xingIndex, 0);

    const offsets = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) offsets[i + 1] = offsets[i] + all[i].length;
    const total = xingLength + offsets[n];
    if (total > 0xffffffff) throw new Mp3Error("The file is too large for a Xing header.");

    // TOC entry p: the byte position (as 1/256 of the file) where p % of the duration starts.
    const toc = new Uint8Array(100);
    for (let p = 0; p < 100; p++) {
      const frame = Math.floor((p * n) / 100);
      toc[p] = Math.min(255, Math.floor(((xingLength + offsets[frame]) * 256) / total));
    }

    const out = new Uint8Array(total);
    writeHeader(out, f, xingIndex, 0);
    const tag = cbr ? "Info" : "Xing";
    const o = 4 + f.sideInfoLength;
    for (let i = 0; i < 4; i++) out[o + i] = tag.charCodeAt(i);
    putU32be(out, o + 4, XING_FLAGS);
    putU32be(out, o + 8, n);
    putU32be(out, o + 12, total);
    out.set(toc, o + 16);
    let at = xingLength;
    for (let i = 0; i < n; i++) {
      out.set(all[i], at);
      at += all[i].length;
    }

    const kbps = (idx: number | null) => (idx === null ? null : table[idx]);
    return {
      bytes: out,
      frames: n,
      durationMs: this.msAt(n),
      tag,
      silenceKbps: table[silenceIndex],
      audioKbps: kbps(audioIndex),
      xingFrameLength: xingLength,
    };
  }
}

export interface XingHeader {
  tag: "Xing" | "Info";
  frames: number | null;
  bytes: number | null;
  toc: number[] | null;
  /** Length of the header frame itself. */
  frameLength: number;
}

/** Read the Xing / Info header of a file's first frame (null when there is none). */
export function readXingHeader(b: Uint8Array): XingHeader | null {
  const h = readFrameHeader(b, 0);
  if (!h) return null;
  for (const o of tagOffsets(h)) {
    const tag = ascii(b, o, "Xing") ? "Xing" : ascii(b, o, "Info") ? "Info" : null;
    if (!tag || o + 8 > b.length) continue;
    const flags = u32be(b, o + 4);
    let p = o + 8;
    const frames = flags & 1 ? u32be(b, p) : null;
    if (flags & 1) p += 4;
    const bytes = flags & 2 ? u32be(b, p) : null;
    if (flags & 2) p += 4;
    const toc = flags & 4 && p + 100 <= b.length ? Array.from(b.subarray(p, p + 100)) : null;
    return { tag, frames, bytes, toc, frameLength: h.frameLength };
  }
  return null;
}
