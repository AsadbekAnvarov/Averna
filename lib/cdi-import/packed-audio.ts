/**
 * Embedded recordings of the source files, decoded byte for byte:
 * - tests 1–2: a base64 data URI;
 * - tests 3–6: gzip packed as "utf8-seven-bit" text in a script element —
 *   7-bit groups as characters, the code points 0, 13 and 60 escaped as one
 *   character ≥ 128 that carries the escaped value's index and the next group.
 */

import { gunzipSync } from "zlib";

const FORBIDDEN = [0, 13, 60];

export class PackedAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackedAudioError";
  }
}

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function decodeBase64(text: string): Uint8Array {
  const t = text.trim();
  if (!t || t.length % 4 !== 0 || !B64.test(t)) throw new PackedAudioError("The recording is not valid base64.");
  return new Uint8Array(Buffer.from(t, "base64"));
}

/** "data:audio/mpeg;base64,…" → bytes. */
export function decodeBase64DataUri(uri: string): Uint8Array {
  const at = uri.indexOf(";base64,");
  if (!uri.startsWith("data:") || at < 0) throw new PackedAudioError("Not a base64 data URI.");
  return decodeBase64(uri.slice(at + 8));
}

export function decodeUtf8SevenBit(text: string, length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0) throw new PackedAudioError("Invalid packed length.");
  const out = new Uint8Array(length);
  let buffer = 0;
  let bits = 0;
  let pos = 0;
  const put = (v: number) => {
    buffer = ((buffer << 7) | v) & 0x7fff;
    bits += 7;
    if (bits >= 8) {
      bits -= 8;
      if (pos < length) out[pos++] = (buffer >>> bits) & 255;
    }
  };
  for (let i = 0; i < text.length; i++) {
    const p = text.charCodeAt(i);
    if (p < 128) {
      if (FORBIDDEN.includes(p)) throw new PackedAudioError("Invalid packed recording (forbidden character).");
      put(p);
    } else {
      const packed = p - 128;
      const escaped = packed >>> 7;
      if (escaped >= FORBIDDEN.length) throw new PackedAudioError("Invalid packed recording escape.");
      put(FORBIDDEN[escaped]);
      put(packed & 127);
    }
  }
  if (pos !== length) throw new PackedAudioError("Incomplete packed recording.");
  return out;
}

/** Inverse of decodeUtf8SevenBit (fixtures and round-trip checks). */
export function encodeUtf8SevenBit(bytes: Uint8Array): string {
  const values: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const b of bytes) {
    buffer = ((buffer << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 7) {
      bits -= 7;
      values.push((buffer >>> bits) & 127);
    }
  }
  if (bits > 0) values.push((buffer << (7 - bits)) & 127);
  let out = "";
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const k = FORBIDDEN.indexOf(v);
    if (k < 0) {
      out += String.fromCharCode(v);
      continue;
    }
    const next = i + 1 < values.length ? values[++i] : 0;
    out += String.fromCharCode(128 + (k << 7) + next);
  }
  return out;
}

/** The packed script → the original bytes (gunzip + length checks). */
export function unpackEmbeddedAudio(p: { text: string; compressedBytes: number; originalBytes: number }): Uint8Array {
  const gz = decodeUtf8SevenBit(p.text, p.compressedBytes);
  let raw: Buffer;
  try {
    raw = gunzipSync(gz);
  } catch {
    throw new PackedAudioError("The packed recording does not decompress (gzip).");
  }
  if (raw.length !== p.originalBytes) throw new PackedAudioError(`The unpacked recording has ${raw.length} bytes, not the declared ${p.originalBytes}.`);
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.length);
}
