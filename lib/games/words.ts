/**
 * Word pools for the Play-tab games, built from the flashcard DECKS, plus a
 * few text helpers. Pure — no React.
 */
import { DECKS, type Deck, type Flashcard } from "@/lib/flashcards-data";

/** Every flashcard once (first occurrence of a word wins, case-insensitive). */
export function uniqueCards(decks: readonly Deck[] = DECKS): Flashcard[] {
  const seen = new Set<string>();
  const out: Flashcard[] = [];
  for (const deck of decks) {
    for (const card of deck.cards) {
      const key = card.word.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(card);
    }
  }
  return out;
}

/** Only ASCII letters, single spaces, hyphens and apostrophes between letters. */
export const PLAIN_WORD = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

/** Number of A–Z letters in a word. */
export function letterCount(word: string): number {
  return (word.match(/[A-Za-z]/g) ?? []).length;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replace every occurrence of `word` (case-insensitive, allowing inflected
 * endings like "enroll" → "enrolled") in `text` with a blank.
 */
export function blankWord(text: string, word: string, blank = "_____"): { text: string; found: boolean } {
  const tokens = word.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { text, found: false };
  const pattern = new RegExp(`\\b${tokens.map((t) => `${escapeRe(t)}[A-Za-z]*`).join("\\s+")}`, "gi");
  let found = false;
  const out = text.replace(pattern, () => {
    found = true;
    return blank;
  });
  return { text: out, found };
}

/** The meaning without its trailing full stop (cards read cleaner without it). */
export function shortMeaning(meaning: string): string {
  return meaning.trim().replace(/\.$/, "");
}

/** Read a JSON value from localStorage; any failure gives `fallback`. */
export function loadJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Write a JSON value to localStorage, ignoring quota/privacy-mode failures. */
export function saveJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
