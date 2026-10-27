/**
 * Pronunciation map for a live call — honest by design (docs/elegance-roadmap.md, idea 3).
 * Pure and client-safe.
 *
 * Clarity: the Realtime API's input transcription can return per-token logprobs of
 * the STUDENT's speech (session `include: ["item.input_audio_transcription.logprobs"]`).
 * A word's clarity is the LOWEST exp(logprob) of the tokens that make it up — how sure
 * the speech recogniser was about its weakest part. It is not a phonetic test: a noisy
 * room or an unusual word lowers it too, and the copy says so.
 *
 * Rules:
 *  - a word is "unclear" below UNCLEAR_BELOW;
 *  - names, numbers, fillers and short function words are never flagged (nor tipped);
 *  - only words that also appear in the turn's transcript count (the map can't show
 *    a word the student never sees);
 *  - words are deduplicated (lowest score, with a count) and every list stops at 12;
 *  - no logprobs at all → no unclear words, only the sound tips.
 *
 * Sound tips: simple spelling heuristics plus small curated lists for sounds many
 * Uzbek and Russian speakers find hard (th, w vs v, final -ng, short vs long vowels,
 * word stress). They are tips, not errors.
 */
import type { LiveTurn } from "./stats";

export const UNCLEAR_BELOW = 0.5;
export const MAP_LIMIT = 12;

export type SoundTipKind = "stress" | "vowel" | "th" | "w-v" | "ng";

export interface SoundTip {
  kind: SoundTipKind;
  label: string;
  detail: string;
}

export interface WordClarity {
  /** Lower-case word as written in the transcript. */
  word: string;
  /** 0–1: the recogniser's confidence in the word's weakest token. */
  score: number;
  /** How often the student said it. */
  count: number;
  tip: SoundTip | null;
}

export interface PractiseWord {
  word: string;
  /** Null for a tip-only word (no score, or a clear one). */
  score: number | null;
  unclear: boolean;
  tip: SoundTip | null;
}

export interface PronunciationMap {
  /** At least one student turn came with logprobs. */
  hasLogprobs: boolean;
  /** Unclear words, least clear first (≤ 12). */
  unclear: WordClarity[];
  /** "Words to practise": unclear words first, then sound tips (≤ 12). */
  practise: PractiseWord[];
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Lower case, curly apostrophes straightened. */
export const normWord = (w: string) => w.toLowerCase().replace(/’/g, "'");

/** The words of a text, normalised. */
export function wordsOf(text: string): string[] {
  return Array.from((text || "").matchAll(WORD_RE), (m) => normWord(m[0]));
}

const FILLER_WORDS = new Set(["um", "umm", "uh", "uhm", "er", "erm", "hmm", "mm", "mhm", "ah", "oh", "eh", "like", "basically", "actually", "literally", "okay", "ok", "yeah"]);

const FUNCTION_WORDS = new Set([
  "about", "above", "after", "again", "also", "always", "among", "another", "around", "because", "been", "before", "being", "below",
  "between", "both", "but", "could", "does", "doing", "done", "down", "during", "each", "either", "else", "even", "ever", "every",
  "from", "have", "having", "here", "hers", "herself", "himself", "into", "itself", "just", "maybe", "might", "mine", "more", "most",
  "much", "must", "myself", "never", "next", "often", "only", "onto", "other", "ours", "over", "same", "should", "since", "some",
  "such", "than", "that", "that's", "their", "theirs", "them", "then", "there", "there's", "these", "they", "they're", "this", "those",
  "though", "through", "till", "under", "until", "upon", "very", "want", "well", "were", "what", "what's", "when", "where", "which",
  "while", "whom", "whose", "will", "with", "within", "without", "would", "yours", "yourself", "i'm", "i've", "i'd", "i'll", "it's",
  "don't", "didn't", "doesn't", "isn't", "wasn't", "aren't", "can't", "won't", "you're", "we're", "let's", "really", "thing", "things",
  "something", "anything", "nothing", "everything", "someone", "anyone", "everyone", "kind", "sort", "yes",
]);

const NUMBER_WORDS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
  "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety", "hundred", "thousand", "million", "billion", "first", "second", "third", "half", "dozen",
]);

export type IgnoredKind = "name" | "number" | "filler" | "function";

/**
 * Why a word is never flagged or tipped, or null. `raw` is the word as written (for
 * names: capitalised mid-sentence, or an all-caps abbreviation); `sentenceStart` says
 * whether it opens a sentence (a capital there is ordinary).
 */
export function ignoredKind(raw: string, sentenceStart: boolean): IgnoredKind | null {
  const w = normWord(raw);
  if (/\p{N}/u.test(w) || NUMBER_WORDS.has(w)) return "number";
  if (FILLER_WORDS.has(w)) return "filler";
  if (w.replace(/['’-]/g, "").length <= 3 || FUNCTION_WORDS.has(w)) return "function";
  if (/^\p{Lu}{2,}$/u.test(raw)) return "name";
  if (/^\p{Lu}/u.test(raw) && !sentenceStart) return "name";
  return null;
}

// ---------------------------------------------------------------------------
// Sound tips
// ---------------------------------------------------------------------------

/** Common multi-syllable words whose stress learners often move. */
const STRESS: Record<string, string> = {
  photograph: "PHO-to-graph", photography: "pho-TOG-ra-phy", photographer: "pho-TOG-ra-pher", comfortable: "COMF-ta-ble",
  vegetable: "VEG-ta-ble", vegetables: "VEG-ta-bles", interesting: "IN-tres-ting", environment: "en-VI-ron-ment",
  economy: "e-CON-o-my", economic: "e-co-NOM-ic", important: "im-POR-tant", information: "in-for-MA-tion",
  technology: "tech-NOL-o-gy", university: "u-ni-VER-si-ty", education: "ed-u-CA-tion", communication: "com-mu-ni-CA-tion",
  necessary: "NEC-es-sar-y", advertisement: "ad-VER-tise-ment", hotel: "ho-TEL", develop: "de-VEL-op",
  development: "de-VEL-op-ment", family: "FAM-i-ly", different: "DIF-frent", difference: "DIF-frence", opportunity: "op-por-TU-ni-ty",
  particular: "par-TIC-u-lar", experience: "ex-PE-ri-ence", government: "GOV-ern-ment", success: "suc-CESS", successful: "suc-CESS-ful",
  history: "HIS-to-ry", industry: "IN-dus-try", career: "ca-REER", percent: "per-CENT", problem: "PROB-lem", record: "REC-ord (noun) · re-CORD (verb)",
  present: "PRES-ent (noun) · pre-SENT (verb)", increase: "IN-crease (noun) · in-CREASE (verb)", popular: "POP-u-lar",
  television: "TEL-e-vi-sion", traditional: "tra-DI-tion-al", tradition: "tra-DI-tion", culture: "CUL-ture", activity: "ac-TIV-i-ty",
  activities: "ac-TIV-i-ties", decision: "de-CI-sion", restaurant: "RES-trant", chocolate: "CHOC-lit", favourite: "FA-vrit",
  favorite: "FA-vrit", banana: "ba-NA-na", event: "e-VENT", events: "e-VENTS", relax: "re-LAX", prefer: "pre-FER", hobby: "HOB-by",
  hobbies: "HOB-bies", answer: "AN-swer", question: "QUES-tion", children: "CHIL-dren", future: "FU-ture", communicate: "com-MU-ni-cate",
};

/** Short vs long vowels (and the ɜː / ɔː pair) — the word, then its partner. */
const VOWEL_PAIRS: [string, string, string][] = [
  ["ship", "sheep", "ɪ / iː"], ["sheep", "ship", "iː / ɪ"], ["live", "leave", "ɪ / iː"], ["leave", "live", "iː / ɪ"],
  ["fill", "feel", "ɪ / iː"], ["feel", "fill", "iː / ɪ"], ["still", "steal", "ɪ / iː"], ["seat", "sit", "iː / ɪ"],
  ["heat", "hit", "iː / ɪ"], ["beat", "bit", "iː / ɪ"], ["sleep", "slip", "iː / ɪ"], ["feet", "fit", "iː / ɪ"],
  ["full", "fool", "ʊ / uː"], ["fool", "full", "uː / ʊ"], ["pull", "pool", "ʊ / uː"], ["pool", "pull", "uː / ʊ"],
  ["look", "Luke", "ʊ / uː"], ["good", "food", "ʊ / uː"], ["food", "good", "uː / ʊ"], ["book", "boot", "ʊ / uː"],
  ["work", "walk", "ɜː / ɔː"], ["walk", "work", "ɔː / ɜː"], ["word", "ward", "ɜː / ɔː"], ["birth", "bath", "ɜː / ɑː"],
  ["cheap", "chip", "iː / ɪ"], ["reach", "rich", "iː / ɪ"], ["people", "pupil", "iː / juː"], ["these", "this", "iː / ɪ"],
  ["green", "grin", "iː / ɪ"], ["team", "Tim", "iː / ɪ"], ["week", "wick", "iː / ɪ"], ["sport", "spot", "ɔː / ɒ"],
];
const VOWEL = new Map(VOWEL_PAIRS.map(([w, other, ipa]) => [w, { other, ipa }]));

const TIP_TEXT: Record<Exclude<SoundTipKind, "stress" | "vowel">, Omit<SoundTip, "kind">> = {
  th: { label: "th sound", detail: "Put the tip of your tongue lightly between your teeth: θ as in think, ð as in mother. Not s, t, z or d." },
  "w-v": { label: "w or v", detail: "w: round your lips, teeth apart (we, world). v: top teeth touch the lower lip (very, video)." },
  ng: { label: "Final -ng", detail: "End with the ng sound in your nose, and don't add a hard g or k after it: sing, not sing-g." },
};

/** The sound tip for a (non-ignored) word, or null. Priority: stress, vowel, th, w/v, -ng. */
export function soundTipFor(word: string): SoundTip | null {
  const w = normWord(word);
  if (STRESS[w]) return { kind: "stress", label: "Word stress", detail: `Say it: ${STRESS[w]}.` };
  const v = VOWEL.get(w);
  if (v) return { kind: "vowel", label: "Short or long vowel", detail: `${w} vs ${v.other} (${v.ipa}): make the vowel length clear.` };
  if (w.includes("th")) return { kind: "th", ...TIP_TEXT.th };
  // A spoken w: at the start (not the silent "wr", not "who…" with its h sound) or after t / s / d / k / g / b.
  if ((/^w/.test(w) && !/^(who|wr)/.test(w)) || w.includes("v") || /[bdgkst]w/.test(w)) return { kind: "w-v", ...TIP_TEXT["w-v"] };
  if (/ngs?$/.test(w)) return { kind: "ng", ...TIP_TEXT.ng };
  return null;
}

// ---------------------------------------------------------------------------
// Tokens → words
// ---------------------------------------------------------------------------

interface ScoredWord {
  raw: string;
  word: string;
  score: number | null;
  sentenceStart: boolean;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Whether the text before `index` ends a sentence (or is empty). */
function startsSentence(text: string, index: number): boolean {
  const before = text.slice(0, index).trimEnd();
  return before === "" || /[.!?…]["'”’)]*$/.test(before);
}

/** Words of one turn with their clarity (null without usable logprobs). */
function scoreTurn(turn: LiveTurn): ScoredWord[] {
  const tokens = (Array.isArray(turn.logprobs) ? turn.logprobs : []).filter(
    (t) => t && typeof t.token === "string" && typeof t.logprob === "number" && !Number.isNaN(t.logprob),
  );
  if (!tokens.length) {
    return Array.from(turn.text.matchAll(WORD_RE), (m) => ({
      raw: m[0],
      word: normWord(m[0]),
      score: null,
      sentenceStart: startsSentence(turn.text, m.index ?? 0),
    }));
  }
  // Character spans of the tokens in their own concatenation.
  const joined = tokens.map((t) => t.token).join("");
  const spans: { from: number; to: number; p: number }[] = [];
  let at = 0;
  for (const t of tokens) {
    spans.push({ from: at, to: at + t.token.length, p: clamp01(Math.exp(Math.min(0, t.logprob))) });
    at += t.token.length;
  }
  const out: ScoredWord[] = [];
  let k = 0;
  for (const m of joined.matchAll(WORD_RE)) {
    const from = m.index ?? 0;
    const to = from + m[0].length;
    while (k < spans.length && spans[k].to <= from) k++;
    let p = 1;
    for (let j = k; j < spans.length && spans[j].from < to; j++) p = Math.min(p, spans[j].p);
    out.push({ raw: m[0], word: normWord(m[0]), score: p, sentenceStart: startsSentence(joined, from) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

const TIP_ORDER: Record<SoundTipKind, number> = { stress: 0, vowel: 1, th: 2, "w-v": 3, ng: 4 };
/** Two decimals, rounded DOWN so a word under the threshold never displays as at it. */
const score2 = (s: number) => Math.floor(clamp01(s) * 100) / 100;

export function buildPronunciationMap(turns: readonly LiveTurn[]): PronunciationMap {
  const mine = turns.filter((t) => t.who === "me" && typeof t.text === "string" && t.text.trim());
  const hasLogprobs = mine.some((t) => Array.isArray(t.logprobs) && t.logprobs.some((x) => x && typeof x.token === "string" && Number.isFinite(x.logprob)));
  const scored = new Map<string, { score: number; count: number }>();
  const tipped = new Map<string, { tip: SoundTip; order: number }>();
  let order = 0;
  for (const turn of mine) {
    const visible = new Set(wordsOf(turn.text));
    // Names and capitals come from the transcript itself (the tokens may differ in case).
    const ignoredHere = new Set(
      Array.from(turn.text.matchAll(WORD_RE))
        .filter((m) => ignoredKind(m[0], startsSentence(turn.text, m.index ?? 0)) !== null)
        .map((m) => normWord(m[0])),
    );
    for (const w of scoreTurn(turn)) {
      if (!visible.has(w.word) || ignoredHere.has(w.word) || ignoredKind(w.raw, w.sentenceStart)) continue;
      if (w.score != null) {
        const prev = scored.get(w.word);
        scored.set(w.word, { score: prev ? Math.min(prev.score, w.score) : w.score, count: (prev?.count ?? 0) + 1 });
      }
      if (!tipped.has(w.word)) {
        const tip = soundTipFor(w.word);
        if (tip) tipped.set(w.word, { tip, order: order++ });
      }
    }
  }

  const unclear: WordClarity[] = hasLogprobs
    ? [...scored.entries()]
        .filter(([, s]) => s.score < UNCLEAR_BELOW)
        .sort((a, b) => a[1].score - b[1].score || a[0].localeCompare(b[0]))
        .slice(0, MAP_LIMIT)
        .map(([word, s]) => ({ word, score: score2(s.score), count: s.count, tip: tipped.get(word)?.tip ?? null }))
    : [];

  const practise: PractiseWord[] = unclear.map((u) => ({ word: u.word, score: u.score, unclear: true, tip: u.tip }));
  const taken = new Set(practise.map((p) => p.word));
  const tipOnly = [...tipped.entries()]
    .filter(([w]) => !taken.has(w))
    .sort((a, b) => TIP_ORDER[a[1].tip.kind] - TIP_ORDER[b[1].tip.kind] || a[1].order - b[1].order);
  for (const [word, t] of tipOnly) {
    if (practise.length >= MAP_LIMIT) break;
    const s = scored.get(word);
    practise.push({ word, score: hasLogprobs && s ? score2(s.score) : null, unclear: false, tip: t.tip });
  }
  return { hasLogprobs, unclear, practise };
}

/** Transcript pieces for display: words (flagged when unclear) and the text between them. */
export function markTranscript(text: string, unclear: ReadonlySet<string>): { text: string; unclear: boolean }[] {
  const out: { text: string; unclear: boolean }[] = [];
  let at = 0;
  for (const m of (text || "").matchAll(WORD_RE)) {
    const from = m.index ?? 0;
    if (from > at) out.push({ text: text.slice(at, from), unclear: false });
    out.push({ text: m[0], unclear: unclear.has(normWord(m[0])) });
    at = from + m[0].length;
  }
  if (at < (text || "").length) out.push({ text: text.slice(at), unclear: false });
  return out;
}

/** "Say it" check: did the recogniser hear the target word (a plural or 's counts)? */
export function wordHeard(target: string, heard: string): boolean {
  const t = normWord(target).trim();
  if (!t) return false;
  return wordsOf(heard).some((w) => w === t || w === `${t}s` || w === `${t}'s` || (t.endsWith("s") && w === t.slice(0, -1)));
}
