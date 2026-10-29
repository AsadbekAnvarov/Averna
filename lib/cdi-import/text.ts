/** Text helpers of the importer. */

/** The non-whitespace characters of a text, in order (what "same text" means in the requirements). */
export function nonWhitespace(text: string): string {
  return text.replace(/\s+/g, "");
}

export function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

const NUMBER_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** "NO MORE THAN TWO WORDS AND/OR A NUMBER" → { words: 2, number: true }; null when the text has no limit. */
export function parseWordLimit(text: string): { words: number; number: boolean } | null {
  const t = text.toUpperCase();
  const m = /\b(ONE|TWO|THREE|FOUR|FIVE|\d)\s+WORDS?\b/.exec(t);
  const numberOnly = /\bA NUMBER\b/.test(t) && !m;
  if (!m && !numberOnly) return null;
  const words = m ? (NUMBER_WORDS[m[1]] ?? Number(m[1])) : 0;
  return { words, number: /AND\s*\/\s*OR\s+A\s+NUMBER|OR\s+A\s+NUMBER|AND\s+A\s+NUMBER|\bA NUMBER\b/.test(t) };
}

/** "Questions 14–26" / "Questions 1-10" / "Question 5" → range; null otherwise. */
export function questionRange(text: string): { from: number; to: number } | null {
  const t = collapse(text);
  const m = /^Questions?\s+(\d{1,2})(?:\s*(?:[–—-]|to|and)\s*(\d{1,2}))?$/i.exec(t);
  if (!m) return null;
  const from = Number(m[1]);
  const to = m[2] ? Number(m[2]) : from;
  return to >= from ? { from, to } : null;
}

export function rangeText(from: number, to: number): string {
  return from === to ? `Question ${from}` : `Questions ${from}–${to}`;
}
