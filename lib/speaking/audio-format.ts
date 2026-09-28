/**
 * What kind of audio file an upload really is, read from its first bytes. The
 * stored content type and file extension come from here — never from what the
 * browser claims — so the public Blob store only ever serves real audio.
 *
 * Pure and client-safe.
 */

export type AudioContainer = "webm" | "mp4" | "ogg" | "wav" | "mpeg" | "flac";

export interface AudioFormat {
  container: AudioContainer;
  /** Content type the file is stored and served with. */
  mime: string;
  /** Extension for the stored file and the transcription upload. */
  ext: string;
}

const FORMATS: Record<AudioContainer, AudioFormat> = {
  webm: { container: "webm", mime: "audio/webm", ext: "webm" },
  mp4: { container: "mp4", mime: "audio/mp4", ext: "mp4" },
  ogg: { container: "ogg", mime: "audio/ogg", ext: "ogg" },
  wav: { container: "wav", mime: "audio/wav", ext: "wav" },
  mpeg: { container: "mpeg", mime: "audio/mpeg", ext: "mp3" },
  flac: { container: "flac", mime: "audio/flac", ext: "flac" },
};

function ascii(b: Uint8Array, at: number, len: number): string {
  let s = "";
  for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

/** The container of an audio file from its first 12+ bytes, or null when it isn't a supported audio file. */
export function sniffAudio(head: Uint8Array): AudioFormat | null {
  if (!head || head.length < 12) return null;
  // EBML header — WebM / Matroska (Chrome, Edge, Firefox, newer Safari).
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return FORMATS.webm;
  // ISO base media — MP4 / M4A (Safari on iPhone, iPad and Mac).
  if (ascii(head, 4, 4) === "ftyp") return FORMATS.mp4;
  if (ascii(head, 0, 4) === "OggS") return FORMATS.ogg;
  if (ascii(head, 0, 4) === "RIFF" && ascii(head, 8, 4) === "WAVE") return FORMATS.wav;
  if (ascii(head, 0, 4) === "fLaC") return FORMATS.flac;
  // MP3: an ID3 tag, or an MPEG audio frame (sync bits, layer ≠ 0 — which excludes raw ADTS AAC).
  if (ascii(head, 0, 3) === "ID3" || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0 && ((head[1] >> 1) & 0x03) !== 0)) return FORMATS.mpeg;
  return null;
}

/** File extension for a MediaRecorder MIME type ("audio/webm;codecs=opus" → "webm"). */
export function extensionForMime(mime: string): string {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  if (base.endsWith("/mp4") || base.endsWith("/m4a") || base.endsWith("/x-m4a") || base.endsWith("/aac")) return "mp4";
  if (base.endsWith("/ogg")) return "ogg";
  if (base.endsWith("/wav") || base.endsWith("/x-wav")) return "wav";
  if (base.endsWith("/mpeg") || base.endsWith("/mp3")) return "mp3";
  return "webm";
}
