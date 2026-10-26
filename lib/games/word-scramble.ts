/**
 * Word Scramble — pure game logic (no React).
 *
 * A 60-second sprint: the definition is the clue and the word's letters are
 * shuffled tiles. Tap (or type) tiles to build the answer; a placed tile can be
 * sent back. Hints lock in the next correct letter and cost 2 points each.
 */
import { DECKS, type Deck, type Flashcard } from "@/lib/flashcards-data";
import { mulberry32, shuffleWith, type Rng } from "@/lib/games/rng";
import { uniqueCards } from "@/lib/games/words";

export const SCRAMBLE_SECONDS = 60;
export const SCRAMBLE_HINTS = 3;
export const SCRAMBLE_BASE_POINTS = 10;
export const SCRAMBLE_HINT_POINTS = 2;
export const SCRAMBLE_STORAGE_KEY = "averna_game_scramble_v1";

/** Single words of 4–10 letters, A–Z only. */
export function isScrambleWord(word: string): boolean {
  return /^[A-Za-z]{4,10}$/.test(word.trim());
}

export function scramblePool(decks: readonly Deck[] = DECKS): Flashcard[] {
  return uniqueCards(decks).filter((c) => isScrambleWord(c.word));
}

/** A seeded queue of words for one sprint. */
export function dealScramble(seed: number, pool: readonly Flashcard[] = scramblePool(), n = 40): Flashcard[] {
  return shuffleWith(pool, mulberry32(seed)).slice(0, n);
}

export interface Tile {
  id: number;
  letter: string;
}

export interface ScrambleState {
  /** Upper-case answer. */
  answer: string;
  /** Every tile, in the order shown in the tray. */
  tiles: Tile[];
  /** Tile ids placed in the answer row, in order. */
  placed: number[];
  /** Leading placed tiles fixed by hints (they can't be sent back). */
  locked: number;
  hintsUsed: number;
}

const joinTiles = (tiles: readonly Tile[]) => tiles.map((t) => t.letter).join("");

/** True when the word has at least two different letters (so it can be scrambled). */
export function canScramble(word: string): boolean {
  return new Set(word.toUpperCase()).size >= 2;
}

/**
 * Shuffle tiles so the tray never spells the answer (when that is possible).
 * If the shuffle lands on the answer, rotating by one always fixes it: a
 * rotation equals the original only when every letter is the same.
 */
export function arrangeTiles(tiles: readonly Tile[], answer: string, rnd: Rng): Tile[] {
  let out = shuffleWith(tiles, rnd);
  if (out.length > 1 && joinTiles(out) === answer && canScramble(answer)) out = [...out.slice(1), out[0]];
  return out;
}

export function scrambleTiles(word: string, rnd: Rng): Tile[] {
  const answer = word.trim().toUpperCase();
  return arrangeTiles([...answer].map((letter, id) => ({ id, letter })), answer, rnd);
}

export function newScramble(word: string, rnd: Rng): ScrambleState {
  const answer = word.trim().toUpperCase();
  return { answer, tiles: scrambleTiles(answer, rnd), placed: [], locked: 0, hintsUsed: 0 };
}

export function tileById(state: ScrambleState, id: number): Tile | undefined {
  return state.tiles.find((t) => t.id === id);
}

/** Tiles still in the tray, in tray order. */
export function trayTiles(state: ScrambleState): Tile[] {
  return state.tiles.filter((t) => !state.placed.includes(t.id));
}

export function builtWord(state: ScrambleState): string {
  return state.placed.map((id) => tileById(state, id)?.letter ?? "").join("");
}

export function isFull(state: ScrambleState): boolean {
  return state.placed.length === state.answer.length;
}

export function isSolved(state: ScrambleState): boolean {
  return isFull(state) && builtWord(state) === state.answer;
}

export function placeTile(state: ScrambleState, id: number): ScrambleState {
  if (isFull(state) || state.placed.includes(id) || !tileById(state, id)) return state;
  return { ...state, placed: [...state.placed, id] };
}

/** Send a placed tile back to the tray (hint-locked tiles stay). */
export function returnTile(state: ScrambleState, id: number): ScrambleState {
  const at = state.placed.indexOf(id);
  if (at < state.locked) return state; // not placed (-1) or locked
  return { ...state, placed: state.placed.filter((p) => p !== id) };
}

/** Typing: place the first tray tile with this letter. */
export function typeLetter(state: ScrambleState, input: string): ScrambleState {
  const letter = input.toUpperCase();
  const tile = trayTiles(state).find((t) => t.letter === letter);
  return tile ? placeTile(state, tile.id) : state;
}

/** Backspace: send the last placed (unlocked) tile back. */
export function backspace(state: ScrambleState): ScrambleState {
  if (state.placed.length <= state.locked) return state;
  return { ...state, placed: state.placed.slice(0, -1) };
}

/** Shuffle the tray again (placed tiles stay where they are). */
export function reshuffle(state: ScrambleState, rnd: Rng): ScrambleState {
  return { ...state, tiles: arrangeTiles(state.tiles, state.answer, rnd) };
}

export function maxHints(state: ScrambleState): number {
  return Math.max(0, Math.min(SCRAMBLE_HINTS, state.answer.length - 1));
}

export function hintsLeft(state: ScrambleState): number {
  return Math.max(0, maxHints(state) - state.hintsUsed);
}

/**
 * Reveal the next letter: keep the correct start of the answer row, send the
 * rest back, then lock in the next correct tile.
 */
export function applyHint(state: ScrambleState): ScrambleState {
  if (hintsLeft(state) <= 0 || isSolved(state)) return state;
  let keep = 0;
  while (keep < state.placed.length && tileById(state, state.placed[keep])?.letter === state.answer[keep]) keep++;
  const placed = state.placed.slice(0, keep);
  if (keep >= state.answer.length) return state;
  const next = state.tiles.find((t) => !placed.includes(t.id) && t.letter === state.answer[keep]);
  if (!next) return state;
  return { ...state, placed: [...placed, next.id], locked: keep + 1, hintsUsed: state.hintsUsed + 1 };
}

/** Points for a solved word: 10, +2 for every hint left unused. Never negative. */
export function scramblePoints(hintsUsed: number, hintBudget = SCRAMBLE_HINTS): number {
  const unused = Math.max(0, hintBudget - Math.max(0, hintsUsed));
  return Math.max(0, SCRAMBLE_BASE_POINTS + SCRAMBLE_HINT_POINTS * unused);
}

export interface ScrambleStore {
  bestScore: number;
  bestSolved: number;
}
