/**
 * Memory Match — pure game logic (no React).
 *
 * A board of 6 pairs: each pair is a word card and its short-definition card.
 * The board for a day comes from a seeded pick of one deck, so everyone sees
 * the same layout; "New board" just uses a random seed.
 */
import { DECKS, type Deck, type Flashcard } from "@/lib/flashcards-data";
import { mulberry32, shuffleWith, type Rng } from "@/lib/games/rng";
import { shortMeaning } from "@/lib/games/words";

export const MEMORY_PAIRS = 6;
/** How long two non-matching cards stay face up before flipping back. */
export const MEMORY_FLIP_BACK_MS = 900;
/** Longest definition that still fits a phone-sized card. */
export const MEMORY_MAX_MEANING = 48;
export const MEMORY_STORAGE_KEY = "averna_game_memory_v1";

export type MemoryKind = "word" | "meaning";

export interface MemoryCard {
  /** Unique on the board: `${pairId}-w` (word) or `${pairId}-m` (meaning). */
  id: string;
  pairId: number;
  kind: MemoryKind;
  text: string;
}

export interface MemoryDeal {
  deck: { id: string; name: string; emoji: string };
  pairs: Flashcard[];
  cards: MemoryCard[];
}

export type MemoryEvent =
  | { type: "open"; index: number }
  | { type: "match"; pairId: number }
  | { type: "miss"; indexes: [number, number] };

export interface MemoryState {
  cards: MemoryCard[];
  /** Indexes of face-up, not-yet-matched cards (0, 1 or 2). */
  open: number[];
  /** pairIds that have been matched. */
  matched: number[];
  /** One move = one pair of cards turned over. */
  moves: number;
  last: MemoryEvent | null;
}

/** Cards that fit the board: unique words and meanings, definitions short enough. */
export function memoryCandidates(cards: readonly Flashcard[]): Flashcard[] {
  const words = new Set<string>();
  const meanings = new Set<string>();
  const out: Flashcard[] = [];
  for (const c of cards) {
    const w = c.word.trim().toLowerCase();
    const m = shortMeaning(c.meaning).toLowerCase();
    if (!w || !m || m.length > MEMORY_MAX_MEANING || words.has(w) || meanings.has(m)) continue;
    words.add(w);
    meanings.add(m);
    out.push(c);
  }
  return out;
}

/** The 2 × pairs cards for these flashcards, in pair order (not shuffled). */
export function memoryCardsFor(pairs: readonly Flashcard[]): MemoryCard[] {
  return pairs.flatMap((c, pairId): MemoryCard[] => [
    { id: `${pairId}-w`, pairId, kind: "word", text: c.word },
    { id: `${pairId}-m`, pairId, kind: "meaning", text: shortMeaning(c.meaning) },
  ]);
}

/** Pick `pairs` flashcards and lay their cards out in a seeded random order. */
export function dealMemoryCards(pool: readonly Flashcard[], rnd: Rng, pairs = MEMORY_PAIRS): { pairs: Flashcard[]; cards: MemoryCard[] } {
  const chosen = shuffleWith(memoryCandidates(pool), rnd).slice(0, pairs);
  return { pairs: chosen, cards: shuffleWith(memoryCardsFor(chosen), rnd) };
}

/**
 * The board for a seed: a seeded deck (with enough short definitions), then a
 * seeded pick of its cards and a seeded layout.
 */
export function dealMemory(seed: number, decks: readonly Deck[] = DECKS, pairs = MEMORY_PAIRS): MemoryDeal {
  const rnd = mulberry32(seed);
  const usable = decks.filter((d) => memoryCandidates(d.cards).length >= pairs);
  if (usable.length > 0) {
    const deck = usable[Math.floor(rnd() * usable.length)];
    return { deck: { id: deck.id, name: deck.name, emoji: deck.emoji }, ...dealMemoryCards(deck.cards, rnd, pairs) };
  }
  // Tiny decks (tests, future content): mix everything.
  return { deck: { id: "all", name: "Mixed words", emoji: "🌐" }, ...dealMemoryCards(decks.flatMap((d) => d.cards), rnd, pairs) };
}

export function initMemory(cards: MemoryCard[]): MemoryState {
  return { cards, open: [], matched: [], moves: 0, last: null };
}

export function pairCount(state: MemoryState): number {
  return new Set(state.cards.map((c) => c.pairId)).size;
}

export function isMatched(state: MemoryState, index: number): boolean {
  const card = state.cards[index];
  return !!card && state.matched.includes(card.pairId);
}

export function isFaceUp(state: MemoryState, index: number): boolean {
  return state.open.includes(index) || isMatched(state, index);
}

/** Two unmatched cards are showing: the board waits for them to flip back. */
export function isLocked(state: MemoryState): boolean {
  return state.open.length >= 2;
}

/**
 * Turn a card over. Ignored (same state returned) when the index is invalid,
 * the card is already face up or matched, or two cards are waiting to flip back.
 */
export function flipCard(state: MemoryState, index: number): MemoryState {
  if (!Number.isInteger(index) || index < 0 || index >= state.cards.length) return state;
  if (isLocked(state) || isFaceUp(state, index)) return state;

  if (state.open.length === 0) {
    return { ...state, open: [index], last: { type: "open", index } };
  }

  const first = state.open[0];
  const a = state.cards[first];
  const b = state.cards[index];
  const moves = state.moves + 1;
  if (a.pairId === b.pairId && a.kind !== b.kind) {
    return { ...state, open: [], matched: [...state.matched, a.pairId], moves, last: { type: "match", pairId: a.pairId } };
  }
  return { ...state, open: [first, index], moves, last: { type: "miss", indexes: [first, index] } };
}

/** Flip two non-matching cards back down (no-op otherwise). */
export function closeOpen(state: MemoryState): MemoryState {
  return state.open.length === 2 ? { ...state, open: [] } : state;
}

export function isMemoryWon(state: MemoryState): boolean {
  const total = pairCount(state);
  return total > 0 && new Set(state.matched).size === total;
}

// ---- Best scores (fewest moves per day and board size) ----

export interface MemoryBest {
  moves: number;
  ms: number;
}
export interface MemoryStore {
  best: Record<string, MemoryBest>;
}

export function memoryBestKey(dateKey: string, pairs = MEMORY_PAIRS): string {
  return `${dateKey}:${pairs}`;
}

/** Record a finished board; fewer moves wins, then the faster time. Keeps 30 days. */
export function recordMemoryBest(store: MemoryStore, key: string, result: MemoryBest): { store: MemoryStore; isNewBest: boolean } {
  const prev = store.best?.[key];
  const isNewBest = !prev || result.moves < prev.moves || (result.moves === prev.moves && result.ms < prev.ms);
  if (!isNewBest) return { store, isNewBest };
  const best = { ...(store.best ?? {}), [key]: result };
  const keys = Object.keys(best).sort();
  while (keys.length > 30) delete best[keys.shift()!];
  return { store: { best }, isNewBest };
}
