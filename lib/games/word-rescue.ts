/**
 * Word Rescue — pure game logic (no React).
 *
 * A gentle hangman: the definition is the clue, six balloons are the lives.
 * Right letters fill the blanks, wrong ones pop a balloon. A round is 5 words.
 */
import { DECKS, type Deck, type Flashcard } from "@/lib/flashcards-data";
import { mulberry32, shuffleWith } from "@/lib/games/rng";
import { PLAIN_WORD, letterCount, uniqueCards } from "@/lib/games/words";

export const RESCUE_LIVES = 6;
export const RESCUE_ROUND = 5;
/** Longest single word that still fits a 320 px phone as letter slots. */
export const RESCUE_MAX_TOKEN = 12;
export const RESCUE_STORAGE_KEY = "averna_game_rescue_v1";
export const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

/** Letters, spaces, hyphens and apostrophes only; 3+ letters; each word fits a phone. */
export function isRescueWord(word: string): boolean {
  const w = word.trim();
  if (!PLAIN_WORD.test(w) || letterCount(w) < 3) return false;
  return w.split(/[ '-]/).every((t) => t.length <= RESCUE_MAX_TOKEN);
}

export function rescuePool(decks: readonly Deck[] = DECKS): Flashcard[] {
  return uniqueCards(decks).filter((c) => isRescueWord(c.word));
}

/** A seeded round of `n` distinct words. */
export function dealRescue(seed: number, pool: readonly Flashcard[] = rescuePool(), n = RESCUE_ROUND): Flashcard[] {
  return shuffleWith(pool, mulberry32(seed)).slice(0, n);
}

export type RescueEvent = { type: "hit"; letter: string; count: number } | { type: "miss"; letter: string };

export interface RescueState {
  answer: string;
  /** Lower-case letters guessed so far, in order. */
  guessed: string[];
  lives: number;
  last: RescueEvent | null;
}

export function newRescue(answer: string, lives = RESCUE_LIVES): RescueState {
  return { answer, guessed: [], lives, last: null };
}

/** The distinct lower-case letters of the answer. */
export function answerLetters(answer: string): Set<string> {
  return new Set((answer.toLowerCase().match(/[a-z]/g) ?? []) as string[]);
}

export function isRescueWon(state: RescueState): boolean {
  const letters = answerLetters(state.answer);
  return letters.size > 0 && [...letters].every((l) => state.guessed.includes(l));
}

export function isRescueLost(state: RescueState): boolean {
  return state.lives <= 0;
}

export function isRescueOver(state: RescueState): boolean {
  return isRescueWon(state) || isRescueLost(state);
}

/**
 * Guess one letter (case-insensitive). Repeated letters, non-letters and
 * guesses after the word is over are no-ops (the same state is returned).
 */
export function guessLetter(state: RescueState, input: string): RescueState {
  const letter = input.toLowerCase();
  if (!/^[a-z]$/.test(letter) || state.guessed.includes(letter) || isRescueOver(state)) return state;
  const guessed = [...state.guessed, letter];
  const count = (state.answer.toLowerCase().match(new RegExp(letter, "g")) ?? []).length;
  if (count > 0) return { ...state, guessed, last: { type: "hit", letter, count } };
  return { ...state, guessed, lives: state.lives - 1, last: { type: "miss", letter } };
}

export interface LetterSlot {
  /** The character as written in the answer. */
  char: string;
  /** A–Z letter (spaces, hyphens and apostrophes are shown automatically). */
  isLetter: boolean;
  revealed: boolean;
}

export function letterSlots(answer: string, guessed: readonly string[]): LetterSlot[] {
  return [...answer].map((char) => {
    const isLetter = /[A-Za-z]/.test(char);
    return { char, isLetter, revealed: !isLetter || guessed.includes(char.toLowerCase()) };
  });
}

/** Points for a rescued word: 10, +2 per balloon left, +2 per word of streak beyond the first. */
export function rescuePoints(livesLeft: number, streak: number): number {
  return Math.max(0, 10 + 2 * Math.max(0, livesLeft) + 2 * Math.max(0, streak - 1));
}

// ---- A round of 5 words ----

export interface RescueRun {
  words: Flashcard[];
  /** Index of the next word to play (words settled so far). */
  index: number;
  score: number;
  streak: number;
  bestStreak: number;
  rescued: number;
}

export function startRun(words: Flashcard[]): RescueRun {
  return { words, index: 0, score: 0, streak: 0, bestStreak: 0, rescued: 0 };
}

/** Settle the current word and move the round on by one. */
export function settleWord(run: RescueRun, won: boolean, livesLeft: number): RescueRun {
  if (run.index >= run.words.length) return run;
  const streak = won ? run.streak + 1 : 0;
  return {
    ...run,
    index: run.index + 1,
    score: run.score + (won ? rescuePoints(livesLeft, streak) : 0),
    streak,
    bestStreak: Math.max(run.bestStreak, streak),
    rescued: run.rescued + (won ? 1 : 0),
  };
}

export function isRunOver(run: RescueRun): boolean {
  return run.index >= run.words.length;
}

export interface RescueStore {
  bestScore: number;
  bestStreak: number;
}
