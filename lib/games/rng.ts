/**
 * Seeded randomness shared by the Play-tab word games (Memory Match, Word
 * Rescue, Word Scramble). Pure functions only — no React, no DOM.
 */

/** A source of floats in [0, 1). */
export type Rng = () => number;

/** mulberry32: a tiny, fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a string, as an unsigned integer. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Today's seed for one game: everyone gets the same board on a given Tashkent
 * day, and each game gets its own selection.
 */
export function dailySeed(dateKey: string, game: string): number {
  return hashSeed(`${dateKey}:${game}`);
}

/** A fresh, non-deterministic seed (for "New board" / "Play again"). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Seeded Fisher–Yates; returns a new array and never mutates the input. */
export function shuffleWith<T>(items: readonly T[], rnd: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
