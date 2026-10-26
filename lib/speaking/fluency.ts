/**
 * Fluency numbers for the opt-in own-speech captions in peer rooms. Pure and client-side:
 * the transcript stays in the student's browser memory.
 *
 *   countWords       — words in a transcript
 *   countFillers     — um, uh, er, like, you know, I mean, basically, actually …
 *   wordsPerMinute   — words per minute of the student's own speaking time
 */

/** Filler words and phrases, longest first so "you know" wins over shorter matches. */
export const FILLERS = [
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "basically",
  "actually",
  "literally",
  "um",
  "umm",
  "uh",
  "uhm",
  "er",
  "erm",
  "hmm",
  "like",
] as const;
export type Filler = (typeof FILLERS)[number];

/** "like" is a verb or a comparison after these words ("I like", "looks like"), not a filler. */
const LIKE_NOT_FILLER_AFTER = new Set([
  "i", "you", "we", "they", "he", "she", "it", "people", "would", "d", "really", "also", "do", "does", "did", "dont", "doesnt",
  "didnt", "not", "look", "looks", "looked", "sound", "sounds", "seem", "seems", "feel", "feels", "felt", "just",
  "something", "anything", "nothing", "much", "more", "most", "what", "to",
]);
/** "you know" is a question after these ("do you know …?"). */
const YOU_KNOW_NOT_FILLER_AFTER = new Set(["do", "did", "dont", "didnt", "if", "what", "how", "would", "will", "can"]);

/** Lower-case word tokens (letters, digits, apostrophes dropped: "don't" → "dont"). */
export function tokens(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export const countWords = (text: string): number => tokens(text).length;

export interface FillerCount {
  total: number;
  by: Partial<Record<Filler, number>>;
}

export function countFillers(text: string): FillerCount {
  const t = tokens(text);
  const by: Partial<Record<Filler, number>> = {};
  let total = 0;
  let i = 0;
  while (i < t.length) {
    let matched: Filler | null = null;
    for (const f of FILLERS) {
      const parts = f.split(" ");
      if (parts.every((p, k) => t[i + k] === p)) {
        const prev = t[i - 1];
        if (f === "like" && prev !== undefined && LIKE_NOT_FILLER_AFTER.has(prev)) continue;
        if (f === "you know" && prev !== undefined && YOU_KNOW_NOT_FILLER_AFTER.has(prev)) continue;
        matched = f;
        break;
      }
    }
    if (matched) {
      by[matched] = (by[matched] ?? 0) + 1;
      total += 1;
      i += matched.split(" ").length;
    } else {
      i += 1;
    }
  }
  return { total, by };
}

/** Below this much speaking time WPM isn't meaningful. */
export const MIN_WPM_MS = 15_000;

/** Words per minute of speaking time, rounded; null below MIN_WPM_MS. */
export function wordsPerMinute(words: number, speakingMs: number, minMs = MIN_WPM_MS): number | null {
  if (!Number.isFinite(speakingMs) || speakingMs < minMs || words < 0) return null;
  return Math.round(words / (speakingMs / 60_000));
}

/** The most frequent fillers, e.g. [["like", 4], ["um", 2]]. */
export function topFillers(c: FillerCount, n = 3): [Filler, number][] {
  return (Object.entries(c.by) as [Filler, number][]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
}
