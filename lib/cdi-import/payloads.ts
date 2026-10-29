/**
 * Large embedded data is cut out of the source HTML by plain string search
 * (no regular expression over 40 MB) before the HTML is parsed: base64 data
 * URIs (MP3 / PNG) and the packed recording script. Each payload is replaced
 * by "cdi-payload://<n>" and kept as a string; the parsed HTML is then ~1 MB.
 */

export interface Payload {
  kind: "data-uri" | "packed-script";
  /** data-uri: the MIME type ("audio/mpeg", "image/png"). */
  mime?: string;
  /** data-uri: the base64 text; packed-script: the script text. */
  text: string;
  /** packed-script: the script element's attributes. */
  attrs?: Record<string, string>;
}

export interface PayloadResult {
  html: string;
  payloads: Payload[];
}

export const PAYLOAD_PREFIX = "cdi-payload://";

function isB64(c: number): boolean {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47 || c === 61;
}

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  // Simple attribute scan: name="value" / name='value' / name=value.
  while (i < tag.length) {
    const eq = tag.indexOf("=", i);
    if (eq < 0) break;
    let s = eq - 1;
    while (s >= 0 && tag[s] === " ") s--;
    let e = s;
    while (s >= 0 && /[A-Za-z0-9_:-]/.test(tag[s])) s--;
    const name = tag.slice(s + 1, e + 1).toLowerCase();
    let v = eq + 1;
    while (tag[v] === " ") v++;
    const q = tag[v];
    let value: string;
    if (q === '"' || q === "'") {
      const end = tag.indexOf(q, v + 1);
      value = tag.slice(v + 1, end < 0 ? tag.length : end);
      i = end < 0 ? tag.length : end + 1;
    } else {
      let end = v;
      while (end < tag.length && !/[\s>]/.test(tag[end])) end++;
      value = tag.slice(v, end);
      i = end;
    }
    if (name) out[name] = value;
  }
  return out;
}

const PACKED_TAG = 'id="embeddedAudioData"';

/** Replace every base64 data URI of `html` by a payload reference. */
function cutDataUris(html: string, payloads: Payload[]): string {
  let out = "";
  let i = 0;
  for (;;) {
    const b = html.indexOf(";base64,", i);
    if (b < 0) break;
    const start = html.lastIndexOf("data:", b);
    const mime = start >= i ? html.slice(start + 5, b) : "";
    if (start < i || !/^[a-z]+\/[a-z0-9.+-]+$/i.test(mime)) {
      out += html.slice(i, b + 8);
      i = b + 8;
      continue;
    }
    let e = b + 8;
    while (e < html.length && isB64(html.charCodeAt(e))) e++;
    payloads.push({ kind: "data-uri", mime: mime.toLowerCase(), text: html.slice(b + 8, e) });
    out += html.slice(i, start) + `${PAYLOAD_PREFIX}${payloads.length - 1}`;
    i = e;
  }
  return out + html.slice(i);
}

export function extractPayloads(html: string): PayloadResult {
  const payloads: Payload[] = [];
  // The packed recording script (tests 3–6) first: its text is not base64.
  const at = html.indexOf(PACKED_TAG);
  if (at >= 0) {
    const open = html.lastIndexOf("<script", at);
    const gt = html.indexOf(">", at);
    const close = gt > 0 ? html.indexOf("</script>", gt) : -1;
    if (open >= 0 && close > gt) {
      payloads.push({ kind: "packed-script", text: html.slice(gt + 1, close), attrs: attrsOf(html.slice(open + 7, gt)) });
      const before = cutDataUris(html.slice(0, gt + 1), payloads);
      const after = cutDataUris(html.slice(close), payloads);
      return { html: `${before}${PAYLOAD_PREFIX}0${after}`, payloads };
    }
  }
  return { html: cutDataUris(html, payloads), payloads };
}

/** The payload index of a "cdi-payload://<n>" reference, or null. */
export function payloadRef(value: string | null | undefined): number | null {
  if (!value || !value.startsWith(PAYLOAD_PREFIX)) return null;
  const n = Number(value.slice(PAYLOAD_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}
