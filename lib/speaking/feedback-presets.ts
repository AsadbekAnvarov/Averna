/**
 * Peer feedback after a session (docs/peer-speaking.md, Phase C). Pure and client-safe.
 * Students rate their partner 1–5 on the four IELTS Speaking criteria, pick one strength
 * and one tip from preset chips, and may add one short free-text line.
 *
 * Storage (SpeakingPeerFeedback): `strength` = a strength id; `tip` = packTip(tipId, note)
 * — "<tipId>", "<tipId>|<note>" or "|<note>" (ids never contain "|").
 */

export const CRITERIA = ["fluency", "lexical", "grammar", "pronunciation"] as const;
export type Criterion = (typeof CRITERIA)[number];

export const CRITERION_INFO: Record<Criterion, { title: string; hint: string; levels: [string, string, string, string, string] }> = {
  fluency: {
    title: "Fluency",
    hint: "Kept talking, ideas linked",
    levels: ["Long pauses, hard to follow", "Often stopped", "Some pauses, mostly clear", "Smooth with few pauses", "Natural and easy to follow"],
  },
  lexical: {
    title: "Vocabulary",
    hint: "Range and precision of words",
    levels: ["Very basic words", "Repeated the same words", "Enough words for the topic", "Good range, some less common words", "Wide, precise vocabulary"],
  },
  grammar: {
    title: "Grammar",
    hint: "Accuracy and variety of sentences",
    levels: ["Errors made it hard to understand", "Many errors", "Some errors, meaning clear", "Mostly accurate, some complex sentences", "Accurate and varied"],
  },
  pronunciation: {
    title: "Pronunciation",
    hint: "Easy to understand",
    levels: ["Very hard to understand", "Often hard to understand", "Mostly understandable", "Clear, with good stress", "Very clear and natural"],
  },
};

export interface Preset {
  id: string;
  label: string;
  criterion: Criterion;
}

export const STRENGTHS: Preset[] = [
  { id: "kept-going", label: "Kept talking without long pauses", criterion: "fluency" },
  { id: "linked-ideas", label: "Linked ideas clearly", criterion: "fluency" },
  { id: "good-examples", label: "Gave good examples", criterion: "fluency" },
  { id: "rich-words", label: "Used interesting words", criterion: "lexical" },
  { id: "paraphrased", label: "Explained words they didn't know", criterion: "lexical" },
  { id: "complex-sentences", label: "Used complex sentences", criterion: "grammar" },
  { id: "accurate-tenses", label: "Used tenses accurately", criterion: "grammar" },
  { id: "clear-voice", label: "Clear and easy to understand", criterion: "pronunciation" },
];

export const TIPS: Preset[] = [
  { id: "extend-answers", label: "Give longer answers with a reason", criterion: "fluency" },
  { id: "fewer-fillers", label: "Use fewer fillers (um, like)", criterion: "fluency" },
  { id: "use-linkers", label: "Use linking words (however, because)", criterion: "fluency" },
  { id: "vary-words", label: "Avoid repeating the same words", criterion: "lexical" },
  { id: "topic-words", label: "Learn more words for this topic", criterion: "lexical" },
  { id: "check-tenses", label: "Check past and present tenses", criterion: "grammar" },
  { id: "articles", label: "Watch articles (a, an, the)", criterion: "grammar" },
  { id: "complex-structures", label: "Try if-clauses and relative clauses", criterion: "grammar" },
  { id: "slow-down", label: "Slow down a little", criterion: "pronunciation" },
  { id: "word-stress", label: "Stress key words more clearly", criterion: "pronunciation" },
];

export const NOTE_MAX = 140;

const byId = (list: Preset[], id: string | null | undefined) => (id ? (list.find((p) => p.id === id) ?? null) : null);
export const strengthById = (id: string | null | undefined) => byId(STRENGTHS, id);
export const tipById = (id: string | null | undefined) => byId(TIPS, id);

/** Links, e-mail addresses, @handles and phone numbers aren't allowed (no contact swapping). */
const CONTACT_PATTERNS = [
  /\bhttps?:\/\//i,
  /\bwww\./i,
  /\b[a-z0-9-]+\.(?:com|net|org|uz|ru|io|ly|gg|app|link|info|biz)\b/i,
  /\bt\.me\b/i,
  /[^\s@]+@[^\s@]+\.[^\s@]+/,
  /(?:^|\s)@[a-z0-9_]{3,}/i,
  /(?:\+?\d[\s().-]*){7,}/,
];

export const hasContactInfo = (text: string): boolean => CONTACT_PATTERNS.some((re) => re.test(text));

export type NoteCheck = { ok: true; note: string | null } | { ok: false; error: string };

/** Trim and check the optional free-text line. */
export function checkNote(raw: unknown): NoteCheck {
  if (raw === undefined || raw === null) return { ok: true, note: null };
  if (typeof raw !== "string") return { ok: false, error: "The note must be text." };
  const note = raw.replace(/\s+/g, " ").trim();
  if (!note) return { ok: true, note: null };
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` };
  if (hasContactInfo(note)) return { ok: false, error: "Please don't share links, e-mails or phone numbers." };
  return { ok: true, note };
}

export function packTip(tipId: string | null, note: string | null): string | null {
  if (!tipId && !note) return null;
  return note ? `${tipId ?? ""}|${note}` : tipId;
}

export function unpackTip(raw: string | null | undefined): { tipId: string | null; note: string | null } {
  if (!raw) return { tipId: null, note: null };
  const i = raw.indexOf("|");
  if (i < 0) return { tipId: raw, note: null };
  return { tipId: raw.slice(0, i) || null, note: raw.slice(i + 1) || null };
}

export const isRating = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

export type Ratings = Record<Criterion, number>;

/** What the feedback API returns for one direction. */
export interface FeedbackDto extends Ratings {
  strength: { id: string; label: string } | null;
  tip: { id: string; label: string } | null;
  note: string | null;
  createdAt: number;
}

export function feedbackDto(row: Ratings & { strength: string | null; tip: string | null; createdAt: Date }): FeedbackDto {
  const s = strengthById(row.strength);
  const { tipId, note } = unpackTip(row.tip);
  const t = tipById(tipId);
  return {
    fluency: row.fluency,
    lexical: row.lexical,
    grammar: row.grammar,
    pronunciation: row.pronunciation,
    strength: s ? { id: s.id, label: s.label } : null,
    tip: t ? { id: t.id, label: t.label } : null,
    note,
    createdAt: row.createdAt.getTime(),
  };
}
