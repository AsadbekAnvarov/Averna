/**
 * "Show me where" — find the sentence of a Reading passage or Listening
 * transcript that answers a question, so a result page can highlight it.
 *
 * Two sources, in order:
 *   1. Explicit quotes: the question's evidence quote(s) — on this stack the
 *      ‘…’ / “…” segments of the explanation ("Paragraph C: lamps ‘radiated so
 *      much heat …’"). Found despite whitespace, quote-mark and case noise,
 *      with a punctuation-blind and then a token-overlap fallback.
 *   2. Derived: every sentence is scored by the accepted answer appearing as an
 *      exact phrase (dominant), then by the content words it shares with the
 *      explanation, the question and the accepted option (stop-words removed,
 *      light stemming, rarer words weigh more). Below the threshold → null:
 *      better no pointer than a random sentence.
 *
 * Pure and dependency-free. Transcripts contain every gap answer, so Listening
 * callers run this on the server, after submission only (result pages).
 */

import type { ExamGroup, ExamQuestion, GradeItem, ListeningPart, ReadingPart } from "@/lib/ielts/types";

export interface EvidenceSpan {
  /** Index into the texts: a paragraph (Reading) or a script line (Listening). */
  paragraphIndex: number;
  /** [start, end) character offsets into that text. */
  start: number;
  end: number;
  source: "quote" | "derived";
}

export interface EvidenceQuery {
  /** Explicit evidence quotes, tried first (e.g. quotedSegments(explanation)). */
  quotes?: string[];
  /** Accepted answers expected verbatim in the text (gap answers); "(the) river bank" marks optional words. */
  answers?: string[];
  explanation?: string;
  /** Statement / stem / the template line around the gap. */
  question?: string;
  /** More hint text, e.g. the text of the accepted option. */
  hints?: string[];
  /** Paragraph labels aligned with the texts ("A", "B" …) for "Paragraph C" references. */
  labels?: (string | undefined)[];
}

// ---------------------------------------------------------------------------
// Normalisation with an index map back to the original text
// ---------------------------------------------------------------------------

const CHAR_MAP: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u02bc": "'", "\u02bb": "'", "`": "'", "\u00b4": "'", "\u2032": "'",
  "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u2033": '"', "\u00ab": '"', "\u00bb": '"',
  "\u2013": "-", "\u2014": "-", "\u2011": "-", "\u2212": "-", "\u2026": "...",
};

const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

interface Normalised {
  text: string;
  /** map[i] = index in the source of normalised character i. */
  map: number[];
}

/**
 * Lower-case, unify quote marks and dashes, collapse whitespace (trimmed).
 * `loose` also turns every non letter/digit into a space (punctuation-blind).
 */
function normalise(src: string, loose = false): Normalised {
  let text = "";
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const mapped = CHAR_MAP[ch] ?? ch.toLowerCase();
    for (let k = 0; k < mapped.length; k++) {
      const c = mapped[k];
      const blank = SPACE.test(c) || (loose && !WORD_CHAR.test(c));
      if (blank) {
        if (text.length) pendingSpace = true;
        continue;
      }
      if (pendingSpace) {
        text += " ";
        map.push(i);
        pendingSpace = false;
      }
      text += c;
      map.push(i);
    }
  }
  return { text, map };
}

const isWordAt = (s: string, i: number) => i >= 0 && i < s.length && WORD_CHAR.test(s[i]);

/** First occurrence of `needle` in `hay` that starts and ends on word boundaries, or -1. */
function indexOfWord(hay: string, needle: string): number {
  if (!needle) return -1;
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = WORD_CHAR.test(needle[0]) && isWordAt(hay, at - 1);
    const after = WORD_CHAR.test(needle[needle.length - 1]) && isWordAt(hay, at + needle.length);
    if (!before && !after) return at;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Sentences
// ---------------------------------------------------------------------------

export interface Range {
  start: number;
  end: number;
}

const ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "prof", "st", "e.g", "i.e", "vs", "approx", "fig"]);

/** Sentence ranges of a text ([start, end), trimmed). Never empty for a non-blank text. */
export function sentences(text: string): Range[] {
  const out: Range[] = [];
  const re = /[.!?\u2026]+["'\u2019\u201d)\]]*(?=\s+|$)/g;
  let start = 0;
  for (const m of text.matchAll(re)) {
    const end = (m.index ?? 0) + m[0].length;
    const word = /([\p{L}.]+)[.]$/u.exec(text.slice(Math.max(0, end - 8), end));
    if (m[0] === "." && word && ABBREVIATIONS.has(word[1].toLowerCase())) continue;
    push(out, text, start, end);
    start = end;
  }
  push(out, text, start, text.length);
  return out;
}

function push(out: Range[], text: string, from: number, to: number) {
  let s = from;
  let e = to;
  while (s < e && SPACE.test(text[s])) s++;
  while (e > s && SPACE.test(text[e - 1])) e--;
  if (e > s) out.push({ start: s, end: e });
}

// ---------------------------------------------------------------------------
// Explicit quotes
// ---------------------------------------------------------------------------

/**
 * The quoted segments of an explanation (‘…’, “…”, "…"), split at ellipses.
 * An apostrophe inside a word (farm’s) doesn't close a ‘…’ quote. Segments with
 * fewer than 4 letters are dropped (too short to point anywhere).
 */
export function quotedSegments(text: string | undefined | null): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re =
    /\u2018((?:[^\u2018\u2019]|\u2019(?=\p{L}))+)\u2019|\u201c([^\u201c\u201d]+)\u201d|"([^"]+)"|(?<!\p{L})'((?:[^']|'(?=\p{L}))+)'(?!\p{L})/gu;
  for (const m of text.matchAll(re)) {
    const seg = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    for (const piece of seg.split(/\u2026|\.{3}/)) {
      const p = piece.trim().replace(/^[,;:\s]+|[,;:\s]+$/g, "");
      if ((p.match(/\p{L}/gu) ?? []).length >= 4) out.push(p);
    }
  }
  return out;
}

/** Where `quote` occurs in the texts (first occurrence), or null. Exact (normalised), then punctuation-blind. */
export function findQuote(texts: readonly string[], quote: string): { paragraphIndex: number; start: number; end: number } | null {
  for (const loose of [false, true]) {
    const q = normalise(quote, loose).text;
    if (!q) continue;
    for (let p = 0; p < texts.length; p++) {
      const n = normalise(texts[p] ?? "", loose);
      const at = indexOfWord(n.text, q);
      if (at >= 0) return { paragraphIndex: p, start: n.map[at], end: n.map[at + q.length - 1] + 1 };
    }
  }
  return null;
}

/** The sentences of `text` overlapping [start, end) as one range. */
function coveringSentences(sents: Range[], start: number, end: number): { first: number; last: number } {
  let first = -1;
  let last = -1;
  sents.forEach((s, k) => {
    if (s.end > start && s.start < end) {
      if (first < 0) first = k;
      last = k;
    }
  });
  if (first < 0) {
    // The quote sits in whitespace between sentences (cannot happen for a word match), so point at the nearest one.
    const k = Math.max(0, sents.findIndex((s) => s.start >= start));
    return { first: k, last: k };
  }
  return { first, last };
}

const words = (s: string) => normalise(s, true).text.split(" ").filter(Boolean);

function fromQuotes(texts: readonly string[], quotes: string[]): EvidenceSpan | null {
  const found = quotes
    .map((q) => ({ q, at: findQuote(texts, q) }))
    .filter((x): x is { q: string; at: NonNullable<ReturnType<typeof findQuote>> } => x.at !== null);

  if (found.length) {
    // The longest (most specific) quote anchors the span; others in the same paragraph join it when close.
    const primary = [...found].sort((a, b) => b.q.length - a.q.length)[0];
    const p = primary.at.paragraphIndex;
    const sents = sentences(texts[p]);
    const anchor = coveringSentences(sents, primary.at.start, primary.at.end);
    let { first, last } = anchor;
    for (const f of found) {
      if (f.at.paragraphIndex !== p) continue;
      const c = coveringSentences(sents, f.at.start, f.at.end);
      const lo = Math.min(first, c.first);
      const hi = Math.max(last, c.last);
      if (hi - lo + 1 <= 3) {
        first = lo;
        last = hi;
      }
    }
    return { paragraphIndex: p, start: sents[first].start, end: sents[last].end, source: "quote" };
  }

  // Fuzzy: a sentence holding at least 75 % of a (3+ word) quote's words.
  let best: { p: number; s: Range; share: number } | null = null;
  for (const q of quotes) {
    const qw = new Set(words(q));
    if (qw.size < 3) continue;
    texts.forEach((t, p) => {
      for (const s of sentences(t ?? "")) {
        const sw = new Set(words(t.slice(s.start, s.end)));
        let hit = 0;
        qw.forEach((w) => {
          if (sw.has(w)) hit++;
        });
        const share = hit / qw.size;
        if (share >= 0.75 && (!best || share > best.share)) best = { p, s, share };
      }
    });
  }
  const b = best as { p: number; s: Range; share: number } | null;
  return b ? { paragraphIndex: b.p, start: b.s.start, end: b.s.end, source: "quote" } : null;
}

// ---------------------------------------------------------------------------
// Derived: score sentences
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between both but by can " +
    "could did do does doing down during each few for from further had has have having he her here hers herself him himself his how " +
    "i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out " +
    "over own same she should so some such than that the their theirs them themselves then there these they this those through to " +
    "too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves " +
    "s t d ll m re ve one two three may might must shall many much said says say according passage paragraph text writer author " +
    "speaker question answer statement true false given yes correct information mentioned states stated"
  ).split(" ")
);

/** Light, consistent stemming: plurals, -ing, -ed, -ly and a final -e. */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ly")) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Content stems of a text (stop-words and 1–2 letter words removed; numbers kept). */
export function contentStems(text: string): string[] {
  return words(text)
    .map((w) => w.replace(/'/g, ""))
    .filter((w) => w && !STOP_WORDS.has(w) && (w.length > 2 || /^\d+$/.test(w)))
    .map(stem);
}

/** "(the) river bank" → ["the river bank", "river bank"]. */
function answerVariants(answer: string): string[] {
  const keep = answer.replace(/[()]/g, " ");
  const drop = answer.replace(/\([^)]*\)/g, " ");
  return Array.from(new Set([keep, drop].map((v) => normalise(v, true).text).filter((v) => v.length >= 2 || /\d/.test(v))));
}

const PARA_REF = /\bparagraphs?\s+([A-Z])\b/;
const PARA_NUM = /\bparagraphs?\s+(\d{1,2})\b/i;
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
const PARA_ORD = new RegExp(`\\b(${ORDINALS.join("|")}|last|final)\\s+paragraph\\b`, "i");

/**
 * The paragraph a text points at: "Paragraph C" (by label), "Paragraph 6" or
 * "the sixth / last paragraph" (by position among the non-empty texts).
 */
function referencedParagraph(
  sources: (string | undefined)[],
  labels: (string | undefined)[] | undefined,
  texts: readonly string[]
): number | null {
  const filled = texts.map((t, i) => (t && t.trim() ? i : -1)).filter((i) => i >= 0);
  for (const s of sources) {
    if (!s) continue;
    const byLabel = labels?.some(Boolean) ? PARA_REF.exec(s.replace(/\bParagraph/g, "paragraph")) : null;
    if (byLabel) {
      const k = labels!.findIndex((l) => l?.trim().toUpperCase() === byLabel[1]);
      if (k >= 0) return k;
    }
    const num = PARA_NUM.exec(s);
    if (num && filled[Number(num[1]) - 1] != null) return filled[Number(num[1]) - 1];
    const ord = PARA_ORD.exec(s);
    if (ord) {
      const w = ord[1].toLowerCase();
      const k = w === "last" || w === "final" ? filled.length - 1 : ORDINALS.indexOf(w);
      if (k >= 0 && filled[k] != null) return filled[k];
    }
  }
  return null;
}

/** A sentence needs this many distinct shared content words … */
const MIN_SHARED = 2;
/** … and this much weight (rarer words weigh more) to count as evidence. */
const MIN_SCORE = 3;

interface Scored {
  p: number;
  s: Range;
  phrase: number;
  inRef: boolean;
  score: number;
  order: number;
}

function derive(texts: readonly string[], q: EvidenceQuery): EvidenceSpan | null {
  const all: { p: number; s: Range; loose: string; stems: Set<string> }[] = [];
  texts.forEach((t, p) => {
    for (const s of sentences(t ?? "")) {
      const piece = t.slice(s.start, s.end);
      all.push({ p, s, loose: ` ${normalise(piece, true).text} `, stems: new Set(contentStems(piece)) });
    }
  });
  if (!all.length) return null;

  const phrases = (q.answers ?? []).flatMap(answerVariants);
  const hintStems = new Set([q.explanation, q.question, ...(q.hints ?? [])].flatMap((h) => (h ? contentStems(h) : [])));
  const df = new Map<string, number>();
  for (const x of all) x.stems.forEach((st) => hintStems.has(st) && df.set(st, (df.get(st) ?? 0) + 1));
  // Named by the answer / question (matching headings / information): the evidence must be in that paragraph.
  const named = referencedParagraph([...(q.hints ?? []), q.question], q.labels, texts);
  // Named by the explanation only: preferred, not required.
  const ref = named ?? referencedParagraph([q.explanation], q.labels, texts);

  const scored: Scored[] = all.map((x, order) => {
    const phrase = phrases.filter((ph) => x.loose.includes(` ${ph} `)).length;
    let score = 0;
    let shared = 0;
    x.stems.forEach((st) => {
      const d = df.get(st);
      if (!d) return;
      shared++;
      score += Math.log(1 + all.length / d);
    });
    return { p: x.p, s: x.s, phrase, inRef: ref === x.p, score: shared >= MIN_SHARED ? score : 0, order };
  });

  const candidates = scored.filter((c) => (c.phrase > 0 || c.score >= MIN_SCORE) && (named == null || c.p === named));
  if (candidates.length) {
    candidates.sort(
      (a, b) => b.phrase - a.phrase || Number(b.inRef) - Number(a.inRef) || b.score - a.score || a.order - b.order
    );
    const c = candidates[0];
    return { paragraphIndex: c.p, start: c.s.start, end: c.s.end, source: "derived" };
  }

  // Nothing scored inside the named paragraph: the paragraph itself is the evidence.
  if (named != null) {
    const sents = sentences(texts[named] ?? "");
    if (sents.length) return { paragraphIndex: named, start: sents[0].start, end: sents[sents.length - 1].end, source: "derived" };
  }
  return null;
}

/** The evidence for one question in `texts`, or null when nothing clears the bar. Deterministic. */
export function locateEvidence(texts: readonly string[], query: EvidenceQuery): EvidenceSpan | null {
  if (!texts.some((t) => t && t.trim())) return null;
  const quotes = (query.quotes ?? []).filter((x) => x && x.trim());
  return (quotes.length ? fromQuotes(texts, quotes) : null) ?? derive(texts, query);
}

// ---------------------------------------------------------------------------
// Exam parts → evidence per question (result pages, server side)
// ---------------------------------------------------------------------------

const isNarrator = (speaker: string) => speaker.trim().toLowerCase() === "narrator";

/** The texts evidence is located in: paragraphs, or script lines (Narrator announcements blanked, indices kept). */
export function evidenceTexts(part: ReadingPart | ListeningPart): { texts: string[]; labels?: (string | undefined)[] } {
  if ("paragraphs" in part) return { texts: part.paragraphs.map((p) => p.text ?? ""), labels: part.paragraphs.map((p) => p.label) };
  return { texts: part.script.map((l) => (l && typeof l.text === "string" && !isNarrator(l.speaker ?? "") ? l.text : "")) };
}

function optionTexts(group: ExamGroup, q: ExamQuestion, keys: string[]): string[] {
  const lower = keys.map((k) => k.toLowerCase());
  const pool = [...(q.options ?? []), ...(group.options ?? [])];
  return pool.filter((o) => lower.includes(o.key.toLowerCase())).map((o) => o.text);
}

/** The template line holding [[n]] (gap / gap-box notes, tables, summaries). */
function templateLine(group: ExamGroup, n: number): string | undefined {
  return group.template?.split(/\r?\n/).find((l) => l.includes(`[[${n}]]`));
}

const stripGaps = (s: string | undefined) => (s ? s.replace(/\[\[\d+\]\]/g, " ") : undefined);

/** The query for one question of a group. */
export function questionQuery(group: ExamGroup, q: ExamQuestion, item?: GradeItem): EvidenceQuery {
  const explanation = q.explanation ?? item?.explanation;
  const keys = q.answer?.length ? q.answer : item?.accepted ?? [];
  const question = [stripGaps(q.text), stripGaps(templateLine(group, q.n)), group.kind === "mcq-multi" ? group.title : undefined]
    .filter(Boolean)
    .join(" ");
  const base: EvidenceQuery = { quotes: quotedSegments(explanation), explanation, question };
  if (group.kind === "gap") return { ...base, answers: keys };
  if (group.kind === "tfng" || group.kind === "ynng") return base;
  return { ...base, hints: optionTexts(group, q, keys) };
}

/**
 * Evidence for every question of a part the student didn't get right (wrong or
 * blank). Keyed by question number; questions without convincing evidence are absent.
 */
export function partEvidence(part: ReadingPart | ListeningPart, items: Map<number, GradeItem>): Record<number, EvidenceSpan> {
  const { texts, labels } = evidenceTexts(part);
  const out: Record<number, EvidenceSpan> = {};
  for (const g of part.groups) {
    for (const q of g.questions) {
      const it = items.get(q.n);
      if (it?.correct) continue;
      const span = locateEvidence(texts, { ...questionQuery(g, q, it), labels });
      if (span) out[q.n] = span;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Listening: when the evidence is heard
// ---------------------------------------------------------------------------

/** Seconds of lead-in before the evidence when playing it ("Hear it"). */
export const HEAR_LEAD_SECONDS = 2;

/**
 * When the evidence starts in a part's recording (seconds), from the
 * recording's timeline (one entry per script line, i = line index): the line's
 * start plus the evidence's share of the line. Null without a timeline entry.
 */
export function evidenceSeconds(
  timeline: readonly { i: number; startMs: number; endMs: number }[] | undefined,
  span: EvidenceSpan,
  lineLength: number
): number | null {
  const e = timeline?.find((x) => x.i === span.paragraphIndex);
  if (!e || !Number.isFinite(e.startMs)) return null;
  const share = lineLength > 0 ? Math.min(1, Math.max(0, span.start / lineLength)) : 0;
  const len = Number.isFinite(e.endMs) && e.endMs > e.startMs ? e.endMs - e.startMs : 0;
  return Math.round(e.startMs + len * share) / 1000;
}

/** Where "Hear it" starts playing: the evidence time minus the lead-in, never before 0. */
export function hearFrom(seconds: number): number {
  return Math.max(0, seconds - HEAR_LEAD_SECONDS);
}
