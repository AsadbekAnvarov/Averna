/** Question images: PNG bytes as in the source, content-addressed paths and an English alt text. */

import { createHash } from "crypto";
import { decodeBase64 } from "./packed-audio";
import { rangeText } from "./text";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && PNG.every((b, i) => bytes[i] === b);
}

export function decodePng(base64: string): Uint8Array {
  const bytes = decodeBase64(base64);
  if (!isPng(bytes)) throw new Error("The question image is not a PNG.");
  return bytes;
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function imagePath(id: string, from: number, to: number, sha256: string): string {
  return `v10/${id}-q${from}-${to}-${sha256.slice(0, 16)}.png`;
}

export function audioPath(id: string, sha256: string): string {
  return `v10/${id}-${sha256.slice(0, 16)}.mp3`;
}

/** "Map" / "Plan" / "Diagram" from the instruction or the source alt. */
export function imageKind(instructions: string, alt: string): "Map" | "Plan" | "Diagram" {
  const t = `${instructions} ${alt}`.toLowerCase();
  if (/\bplan\b/.test(t)) return "Plan";
  if (/\bmap\b/.test(t)) return "Map";
  return "Diagram";
}

/** "<Kind> for Questions <from>–<to>. <source alt>", cut to 200 characters at a word boundary, no Cyrillic. */
export function imageAlt(kind: string, from: number, to: number, sourceAlt: string): string {
  const head = `${kind} for ${rangeText(from, to)}.`;
  const extra = sourceAlt.replace(/[\u0400-\u04FF]+/g, "").replace(/\s+/g, " ").trim();
  let alt = extra ? `${head} ${extra}` : head;
  if (alt.length > 200) {
    const cut = alt.slice(0, 200);
    const sp = cut.lastIndexOf(" ");
    alt = (sp > head.length ? cut.slice(0, sp) : cut.slice(0, 199)).replace(/[\s,;:.-]+$/, "") + "…";
    if (alt.length > 200) alt = alt.slice(0, 199) + "…";
  }
  return alt;
}
