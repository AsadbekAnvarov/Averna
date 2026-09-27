/**
 * In-text dictionary — the pure, isomorphic half (no imports, no I/O).
 *
 * Shared by the server (lib/dictionary.ts, app/api/dictionary/**) and the
 * browser (components/dictionary/**, the "My words" flashcard deck):
 *   - normalizeWord: what counts as a lookup (1–3 English words, ≤ 40 chars);
 *   - parseAiEntry / parseFreeEntry / coerceEntry: every entry that reaches the
 *     cache or the UI goes through the same strict shape and caps;
 *   - sentenceAround / sanitizeContext / orderSensesForContext: the optional
 *     context sentence only ever changes the ORDER of senses;
 *   - small helpers for the student's translation language, SRS item keys and
 *     highlighting the headword inside an example.
 */

export type DictLang = "uz" | "ru";
export const DICT_LANGS: readonly DictLang[] = ["uz", "ru"];

export const DICT_LANG_LABEL: Record<DictLang, { short: string; name: string; native: string }> = {
  uz: { short: "UZ", name: "Uzbek", native: "Oʻzbekcha" },
  ru: { short: "RU", name: "Russian", native: "Русский" },
};

export function isDictLang(x: unknown): x is DictLang {
  return x === "uz" || x === "ru";
}

export interface DictSense {
  /** Simple English, at most 20 words. */
  definition: string;
  /** In the target language; "" when unavailable (free dictionary). */
  translation: string;
  /** One English sentence using the headword; may be "". */
  example: string;
}

export interface DictEntry {
  headword: string;
  lemma: string;
  /** Part of speech in English ("noun", "phrasal verb" …); may be "". */
  pos: string;
  /** British IPA between slashes; may be "". */
  ipa: string;
  /** 1–3 senses, most common first. */
  senses: DictSense[];
  note?: string;
}

export type DictSource = "ai" | "free";

/** GET /api/dictionary */
export interface LookupResponse {
  /** Normalised lookup key (lower case). */
  word: string;
  /** Translation language of this entry. */
  lang: DictLang;
  entry: DictEntry;
  source: DictSource;
  /** False when the entry carries no translations (free dictionary fallback). */
  translated: boolean;
  /** Already in the student's "My words". */
  saved: boolean;
  /** The viewer has a student profile (only students keep a word list). */
  canSave: boolean;
}

/** One saved word, as listed by GET /api/dictionary/words. */
export interface SavedWord {
  word: string;
  itemKey: string;
  /** Null when the cached entry is gone (the card still reviews by its headword). */
  entry: DictEntry | null;
  /** Language of `entry`'s translations. */
  lang: DictLang | null;
  addedAt: number;
  /** Server SRS state (epoch ms for dueAt). */
  dueAt: number;
  reps: number;
  interval: number;
  lapses: number;
  ease: number;
}

export interface MyWordsResponse {
  words: SavedWord[];
  lang: DictLang;
  canSave: boolean;
  limit: number;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const MAX_WORD_CHARS = 40;
export const MAX_PHRASE_WORDS = 3;
export const MAX_CONTEXT_CHARS = 300;
/** Raw input beyond this is rejected before any work (a 1–3 word selection is far shorter). */
const MAX_RAW_CHARS = 200;
export const MAX_SENSES = 3;
export const MAX_DEFINITION_WORDS = 20;
const MAX_EXAMPLE_WORDS = 25;
const MAX_NOTE_WORDS = 25;
const MAX_TRANSLATION_CHARS = 80;
const MAX_HEADWORD_CHARS = 60;
const MAX_IPA_CHARS = 60;
const MAX_POS_CHARS = 24;
/** Saved words per student. */
export const MAX_SAVED_WORDS = 1000;

// ---------------------------------------------------------------------------
// Word normaliser
// ---------------------------------------------------------------------------

/** Curly / modifier apostrophes → ' (U+2018/2019/201B, ʼ ʻ, backtick, acute, prime). */
const APOSTROPHES = /[\u2018\u2019\u201B\u02BC\u02BB\u0060\u00B4\u2032]/g;
/** Unicode hyphens → "-". */
const HYPHENS = /[\u2010\u2011]/g;
/** Dashes, ellipsis, middle dot and slashes separate words. */
const SEPARATORS = /[\u2012-\u2015\u2212\u2026\u00B7/\\|]/g;
/** Anything that is not a letter, mark, digit, apostrophe or hyphen separates words. */
const NON_WORD = /[^\p{L}\p{M}\p{N}'-]+/gu;
/** One Latin-script word; hyphens / apostrophes only between letters (well-being, don't, rock'n'roll). */
const TOKEN_RE = /^\p{Script=Latin}+(?:['-]\p{Script=Latin}+)*$/u;
/** "'s" forms that are contractions (or dictionary phrases), not possessives. */
const KEEP_APOSTROPHE_S = new Set([
  "it's", "he's", "she's", "that's", "what's", "there's", "here's", "where's", "who's", "how's", "let's", "one's",
]);

function tokens(raw: string): string[] {
  return raw
    .normalize("NFKC")
    .replace(APOSTROPHES, "'")
    .replace(HYPHENS, "-")
    .replace(SEPARATORS, " ")
    .replace(NON_WORD, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter(Boolean);
}

/**
 * The cache / lookup key for a selection: lower case, punctuation stripped,
 * letters + inner hyphens / apostrophes only, a possessive "'s" dropped
 * (government's → government), at most 3 words and 40 characters. Returns
 * null for anything else (numbers, symbols, long selections, other scripts).
 */
export function normalizeWord(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_RAW_CHARS) return null;
  const parts = tokens(raw);
  if (parts.length === 0 || parts.length > MAX_PHRASE_WORDS) return null;
  const out: string[] = [];
  for (const part of parts) {
    let t = part.toLowerCase();
    if (!TOKEN_RE.test(t)) return null;
    if (t.endsWith("'s") && t.length >= 5 && !KEEP_APOSTROPHE_S.has(t)) t = t.slice(0, -2);
    out.push(t);
  }
  const word = out.join(" ");
  return word.length <= MAX_WORD_CHARS ? word : null;
}

/** Number of words in a selection as the normaliser sees them (0 when there are none). */
export function lookupWordCount(raw: string): number {
  return typeof raw === "string" && raw.length <= MAX_RAW_CHARS ? tokens(raw).length : 0;
}

// ---------------------------------------------------------------------------
// Context sentence
// ---------------------------------------------------------------------------

const SENTENCE_END = /[.!?]/;
const WS = /\s/;
const AFTER_END = /[\s"'”’)\]]/;

/**
 * The sentence around [start, end) of `text` (split at . ! ? followed by a
 * space, and at line breaks), whitespace-collapsed. Longer than `max` → a
 * window of whole words centred on the selection.
 */
export function sentenceAround(text: string, start: number, end: number, max: number = MAX_CONTEXT_CHARS): string {
  if (typeof text !== "string" || !text) return "";
  const len = text.length;
  const s = Math.max(0, Math.min(len, Math.floor(start) || 0));
  const e = Math.max(s, Math.min(len, Math.floor(end) || 0));

  let a = s;
  while (a > 0) {
    const ch = text[a - 1];
    if (ch === "\n") break;
    if (SENTENCE_END.test(ch) && a < len && WS.test(text[a])) break;
    a--;
  }
  let b = Math.max(s, e - 1);
  while (b < len) {
    const ch = text[b];
    if (ch === "\n") break;
    if (SENTENCE_END.test(ch) && (b + 1 >= len || AFTER_END.test(text[b + 1]))) {
      b++;
      break;
    }
    b++;
  }
  b = Math.max(b, e);

  const whole = text.slice(a, b).replace(/\s+/g, " ").trim();
  if (whole.length <= max) return whole;

  const room = Math.max(0, max - (e - s));
  let from = Math.max(a, s - Math.floor(room / 2));
  const to = Math.min(b, from + max);
  from = Math.max(a, to - max);
  let win = text.slice(from, to);
  if (from > a) win = win.replace(/^\S*\s+/, "");
  if (to < b) win = win.replace(/\s+\S*$/, "");
  return win.replace(/\s+/g, " ").trim();
}

/**
 * Validate a client-supplied context sentence: control characters removed,
 * whitespace collapsed, capped, and kept only when it actually contains the
 * looked-up word (anything else is not a context and is dropped).
 */
export function sanitizeContext(raw: unknown, word: string): string | null {
  if (typeof raw !== "string" || !word) return null;
  let c = raw
    .slice(0, 1000)
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!c) return null;
  if (c.length > MAX_CONTEXT_CHARS) c = c.slice(0, MAX_CONTEXT_CHARS).replace(/\s+\S*$/, "");
  const first = word.split(" ")[0];
  const hay = c.toLowerCase().replace(APOSTROPHES, "'");
  return first && hay.includes(first) ? c : null;
}

// ---------------------------------------------------------------------------
// Entry shape
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObj(x: unknown): x is Obj {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/** Plain text only: tags, markdown emphasis and control characters removed, whitespace collapsed, capped. */
export function cleanText(x: unknown, maxChars: number): string {
  if (typeof x !== "string") return "";
  const s = x
    .replace(/<[^>]{0,80}>/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/[\u0000-\u001F\u007F-\u009F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > maxChars ? `${s.slice(0, maxChars - 1).replace(/\s+\S*$/, "")}…` : s;
}

/** At most `n` words (an ellipsis marks a cut). */
export function capWords(s: string, n: number): string {
  const words = s.split(" ").filter(Boolean);
  if (words.length <= n) return s;
  return `${words.slice(0, n).join(" ").replace(/[,;:.\-–—]+$/, "")}…`;
}

const POS_ALIASES: Record<string, string> = {
  n: "noun",
  "n.": "noun",
  v: "verb",
  "v.": "verb",
  vb: "verb",
  adj: "adjective",
  "adj.": "adjective",
  adv: "adverb",
  "adv.": "adverb",
  prep: "preposition",
  conj: "conjunction",
  pron: "pronoun",
  det: "determiner",
  interj: "exclamation",
  interjection: "exclamation",
  "phr v": "phrasal verb",
  "phrasal-verb": "phrasal verb",
};

function cleanPos(x: unknown): string {
  const p = cleanText(x, 40).toLowerCase();
  const mapped = POS_ALIASES[p] ?? p;
  return mapped.length <= MAX_POS_CHARS ? mapped : "";
}

/** "/ˈbæŋk/" — the first variant only, always between slashes (or brackets). */
export function cleanIpa(x: unknown): string {
  let s = cleanText(x, 120).replace(/^["']+|["']+$/g, "");
  if (!s) return "";
  const variant = s.match(/[/[][^/\]]+[/\]]/);
  if (variant) s = variant[0];
  else s = `/${s.replace(/^[/[]+|[/\]]+$/g, "").trim()}/`;
  if (s === "//" || s.length > MAX_IPA_CHARS) return "";
  return s;
}

/** Shared normalisation for AI output, free-dictionary output and cached rows. */
function normalizeEntry(o: Obj, fallbackWord: string, senseList: unknown[]): { entry: DictEntry; kept: number[] } {
  const key = normalizeWord(fallbackWord) ?? "";
  let headword = cleanText(o.headword, MAX_HEADWORD_CHARS) || fallbackWord;
  // A headword must be the looked-up word (or one of its forms), never something unrelated.
  const hk = normalizeWord(headword);
  if (key && (!hk || (hk !== key && hk.slice(0, 2) !== key.slice(0, 2)))) headword = fallbackWord;
  const lemma = cleanText(o.lemma, MAX_HEADWORD_CHARS) || headword;

  const senses: DictSense[] = [];
  const kept: number[] = [];
  const seen = new Set<string>();
  senseList.forEach((raw, i) => {
    if (senses.length >= MAX_SENSES || !isObj(raw)) return;
    const definition = capWords(cleanText(raw.definition, 240), MAX_DEFINITION_WORDS);
    if (!definition) return;
    const dedupe = definition.toLowerCase();
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    senses.push({
      definition,
      translation: cleanText(raw.translation, MAX_TRANSLATION_CHARS),
      example: capWords(cleanText(raw.example, 220), MAX_EXAMPLE_WORDS),
    });
    kept.push(i);
  });

  const entry: DictEntry = { headword, lemma, pos: cleanPos(o.pos), ipa: cleanIpa(o.ipa), senses };
  const note = capWords(cleanText(o.note, 200), MAX_NOTE_WORDS);
  if (note) entry.note = note;
  return { entry, kept };
}

export type AiParse =
  | { ok: true; entry: DictEntry; /** Index (into entry.senses) of the sense used in the context, when the model said so. */ contextSense: number | null }
  | { ok: false; reason: "malformed" | "empty" };

/** JSON text from the model → object (tolerates code fences / chatter around one JSON object). */
function parseJsonObject(raw: unknown): Obj | null {
  if (isObj(raw)) return raw;
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  s = s.slice(a, b + 1);
  try {
    const parsed: unknown = JSON.parse(s);
    return isObj(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The model's JSON (string or object) → a strict DictEntry. "empty" = the model
 * says it is not an English word (no usable senses); "malformed" = not the
 * requested shape at all. `contextSense` is kept out of the entry: it depends
 * on one request's context and must never be cached.
 */
export function parseAiEntry(raw: unknown, word: string): AiParse {
  const o = parseJsonObject(raw);
  if (!o) return { ok: false, reason: "malformed" };
  if (!Array.isArray(o.senses)) return { ok: false, reason: "malformed" };
  const { entry, kept } = normalizeEntry(o, word, o.senses);
  if (entry.senses.length === 0) return { ok: false, reason: "empty" };
  const cs = typeof o.contextSense === "number" && Number.isInteger(o.contextSense) ? kept.indexOf(o.contextSense) : -1;
  return { ok: true, entry, contextSense: cs >= 0 ? cs : null };
}

/**
 * dictionaryapi.dev response → DictEntry (English only: translations are "").
 * Senses come from the first part of speech (the entry has one `pos`); the
 * British pronunciation is preferred.
 */
export function parseFreeEntry(raw: unknown, word: string): DictEntry | null {
  if (!Array.isArray(raw)) return null;
  const first = raw.find((e): e is Obj => isObj(e) && Array.isArray(e.meanings) && e.meanings.length > 0);
  if (!first) return null;
  const meanings = (first.meanings as unknown[]).filter(
    (m): m is Obj => isObj(m) && Array.isArray(m.definitions) && m.definitions.length > 0
  );
  const meaning = meanings[0];
  if (!meaning) return null;

  const phonetics = Array.isArray(first.phonetics) ? first.phonetics.filter(isObj) : [];
  const withText = phonetics.filter((p) => typeof p.text === "string" && p.text.trim());
  const uk = withText.find((p) => typeof p.audio === "string" && /-uk\.mp3$/i.test(p.audio));
  const ipa =
    (uk?.text as string | undefined) ??
    (typeof first.phonetic === "string" && first.phonetic.trim() ? first.phonetic : undefined) ??
    (withText[0]?.text as string | undefined) ??
    "";

  const senseList = (meaning.definitions as unknown[]).map((d) =>
    isObj(d) ? { definition: d.definition, translation: "", example: d.example } : null
  );
  const { entry } = normalizeEntry(
    { headword: first.word, lemma: first.word, pos: meaning.partOfSpeech, ipa },
    word,
    senseList
  );
  return entry.senses.length ? entry : null;
}

/** A cached row's `data` → DictEntry, or null when it isn't one (then the cache is refreshed). */
export function coerceEntry(data: unknown): DictEntry | null {
  if (!isObj(data) || !Array.isArray(data.senses)) return null;
  const fallback = typeof data.headword === "string" ? data.headword : "";
  if (!fallback.trim()) return null;
  const { entry } = normalizeEntry(data, fallback, data.senses);
  return entry.senses.length ? entry : null;
}

export function hasTranslations(entry: DictEntry): boolean {
  return entry.senses.some((s) => !!s.translation);
}

/**
 * Uzbek Latin orthography for model output: oʻ / gʻ take ʻ (U+02BB), the
 * tutuq belgisi between letters is ʼ (U+02BC) — whatever apostrophe came in.
 */
export function fixUzbekApostrophes(s: string): string {
  return s
    .replace(/([oOgG])['\u2018\u2019\u0060\u02BC]/g, "$1\u02BB")
    .replace(/(\p{L})['\u2018\u2019\u0060](?=\p{L})/gu, "$1\u02BC");
}

/** The entry with its translations in proper orthography for `lang`. */
export function polishTranslations(entry: DictEntry, lang: DictLang): DictEntry {
  if (lang !== "uz") return entry;
  return { ...entry, senses: entry.senses.map((s) => ({ ...s, translation: fixUzbekApostrophes(s.translation) })) };
}

// ---------------------------------------------------------------------------
// Context → sense order
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  (
    "the and but for with from are was were been being does did done have has had having its this that these those " +
    "there their they them his her our you your not than then too very can could will would shall should may might must " +
    "just also into over under about after before between through during without within again once here when where why " +
    "how all any both each few more most other some such only own same what which who whom whose while because until " +
    "against among one two use used using thing things something someone people way make made get got very"
  ).split(" ")
);

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && (w.endsWith("ied") || w.endsWith("ies"))) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && (w.endsWith("ed") || w.endsWith("es"))) return w.slice(0, -2);
  if (w.length > 5 && w.endsWith("ly")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function contentWords(text: string, exclude: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(APOSTROPHES, "'").split(/[^\p{L}']+/u)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    const st = stem(w);
    if (!exclude.has(st)) out.add(st);
  }
  return out;
}

/** Move sense `index` to the front; the others keep their (most common first) order. */
export function moveSenseFirst(entry: DictEntry, index: number | null | undefined): DictEntry {
  if (index == null || index <= 0 || index >= entry.senses.length) return entry;
  return { ...entry, senses: [entry.senses[index], ...entry.senses.filter((_, i) => i !== index)] };
}

/**
 * Best-effort, offline: the sense whose definition + example share the most
 * content words with the context sentence goes first — only when it clearly
 * beats the current first sense. Cached entries stay in "most common first"
 * order; this only reorders one response.
 */
export function orderSensesForContext(entry: DictEntry, context: string | null | undefined, word: string): DictEntry {
  if (!context || entry.senses.length < 2) return entry;
  const exclude = new Set<string>();
  for (const w of `${word} ${entry.headword} ${entry.lemma}`.toLowerCase().split(/[^\p{L}']+/u)) if (w) exclude.add(stem(w));
  const ctx = contentWords(context, exclude);
  if (ctx.size === 0) return entry;
  const scores = entry.senses.map((s) => {
    let n = 0;
    for (const w of contentWords(`${s.definition} ${s.example}`, exclude)) if (ctx.has(w)) n++;
    return n;
  });
  let best = 0;
  scores.forEach((n, i) => {
    if (n > scores[best]) best = i;
  });
  return scores[best] > scores[0] ? moveSenseFirst(entry, best) : entry;
}

// ---------------------------------------------------------------------------
// Student language
// ---------------------------------------------------------------------------

const RU_RE = /(^|[^a-z])(ru|rus)([^a-z]|$)|russ|рус|росс/;
const UZ_RE = /(^|[^a-z])(uz|uzb)([^a-z]|$)|uzbe|o'?zbe|ozbe|ўзбе|узбе/;

/** Student.nativeLanguage (free text: "Uzbek", "oʻzbek tili", "Русский", "ru" …) → uz | ru, or null. */
export function langFromNative(native: string | null | undefined): DictLang | null {
  if (typeof native !== "string") return null;
  const s = native.normalize("NFKC").toLowerCase().replace(APOSTROPHES, "'").trim();
  if (!s) return null;
  const ru = s.search(RU_RE);
  const uz = s.search(UZ_RE);
  if (ru < 0 && uz < 0) return null;
  if (ru < 0) return "uz";
  if (uz < 0) return "ru";
  return uz <= ru ? "uz" : "ru"; // "Uzbek, Russian" → the first one named
}

/** The translation language to use when the student hasn't picked one: Uzbek unless the profile says Russian. */
export function defaultDictLang(native: string | null | undefined): DictLang {
  return langFromNative(native) ?? "uz";
}

// ---------------------------------------------------------------------------
// "My words" SRS items
// ---------------------------------------------------------------------------

export const WORD_ITEM_PREFIX = "word:";

export function wordItemKey(word: string): string {
  return `${WORD_ITEM_PREFIX}${word}`;
}

/** "word:<key>" → key (re-normalised), or null for any other item. */
export function wordFromItemKey(itemKey: string): string | null {
  if (typeof itemKey !== "string" || !itemKey.startsWith(WORD_ITEM_PREFIX)) return null;
  const key = normalizeWord(itemKey.slice(WORD_ITEM_PREFIX.length));
  return key && itemKey === wordItemKey(key) ? key : null;
}

// ---------------------------------------------------------------------------
// Headword inside an example
// ---------------------------------------------------------------------------

export interface TextPiece {
  text: string;
  hit: boolean;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split `example` around the first occurrence of the headword or one of its
 * forms (runs / running for "run", achieving for "achieve", studies for
 * "study") so it can be shown in bold or blanked out.
 */
export function markHeadword(example: string, forms: string[]): TextPiece[] {
  if (!example) return [];
  const bases = new Set<string>();
  for (const f of forms) {
    const w = (f ?? "").trim().toLowerCase();
    if (!w) continue;
    bases.add(w);
    if (w.length >= 4 && w.endsWith("e")) bases.add(w.slice(0, -1));
    if (w.length >= 4 && w.endsWith("y")) bases.add(w.slice(0, -1));
  }
  const ordered = Array.from(bases).sort((a, b) => b.length - a.length);
  for (const base of ordered) {
    const pattern = base.split(/\s+/).map(escapeRe).join("\\s+");
    // A captured prefix instead of a lookbehind: lookbehind throws on iOS Safari < 16.4.
    const re = new RegExp(`(^|[^\\p{L}'])(${pattern}[\\p{L}'-]*)`, "iu");
    const m = re.exec(example);
    if (m && m[2]) {
      const at = m.index + m[1].length;
      return [
        { text: example.slice(0, at), hit: false },
        { text: m[2], hit: true },
        { text: example.slice(at + m[2].length), hit: false },
      ].filter((p) => p.text);
    }
  }
  return [{ text: example, hit: false }];
}
