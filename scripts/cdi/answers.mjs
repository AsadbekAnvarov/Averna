/**
 * Answer-key helpers for the CDI importer (plain ESM, no dependencies) — also
 * imported by tests/cdi-content.test.ts.
 *
 * CDI keys come as a string ("fibre / fiber", "A or B") or as an array of
 * accepted spellings that often repeats the same word in different case
 * ("Station", "station", "STATION"). exam-v2 wants a clean list of accepted
 * spellings; grading is case-insensitive, and optional words stay in the
 * "(the) river bank" form.
 */

/**
 * Split one CDI answer string into its alternatives.
 *   "fibre / fiber" → ["fibre", "fiber"]
 *   "fibre/fiber"   → ["fibre", "fiber"]   (slash between letters only, so "1/2" stays)
 *   "car or bus"    → ["car", "bus"]
 * @param {string} raw
 * @returns {string[]}
 */
export function splitAlternatives(raw) {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return [];
  return s
    .split(/\s+\/\s+|(?<=\p{L})\/(?=\p{L})|\s+or\s+/iu)
    .map((x) => x.trim().replace(/^[,;]+|[,;.]+$/g, "").trim())
    .filter(Boolean);
}

/**
 * Normalise a CDI key (string or array of strings) into exam-v2 accepted answers:
 * alternatives split, trimmed, de-duplicated case-insensitively (first spelling wins).
 * @param {unknown} raw
 * @param {{ split?: boolean }} [opts] split "/" and "or" alternatives (default true)
 * @returns {string[]}
 */
export function answerList(raw, opts = {}) {
  const split = opts.split !== false;
  const items = (Array.isArray(raw) ? raw : [raw]).filter((x) => x != null && String(x).trim() !== "");
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const parts = split ? splitAlternatives(String(item)) : [String(item).replace(/\s+/g, " ").trim()];
    for (const p of parts) {
      const k = p.toLowerCase();
      if (!p || seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

/**
 * Real-audio Listening parts have no `speakers` / `script` (the recording is
 * the source), which validateListeningPart rejects ("speakers must be a
 * non-empty list", "script is missing or too short"). For validation only,
 * the transcript stands in for the script, so every other rule — including
 * "gap answer appears in the script" — still runs against the real words.
 * @template {{ parts: { speakers: unknown[]; script: unknown[]; transcript?: string }[] }} T
 * @param {T} test
 * @returns {T}
 */
export function listeningForValidation(test) {
  return {
    ...test,
    parts: test.parts.map((p) => ({
      ...p,
      speakers: p.speakers.length ? p.speakers : [{ name: "Speaker", gender: "female" }],
      script: p.script.length
        ? p.script
        : String(p.transcript ?? "")
            .split("\n")
            .filter(Boolean)
            .map((line) => ({ speaker: "Speaker", text: line })),
    })),
  };
}
