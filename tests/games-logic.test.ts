/**
 * Pure logic of the Play-tab word games (lib/games/**): seeded RNG, Memory
 * Match, Word Rescue and Word Scramble. Property-based with fast-check.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DECKS } from "@/lib/flashcards-data";
import { dailySeed, mulberry32, shuffleWith } from "@/lib/games/rng";
import { PLAIN_WORD, blankWord, shortMeaning } from "@/lib/games/words";
import {
  MEMORY_PAIRS,
  closeOpen,
  dealMemory,
  flipCard,
  initMemory,
  isFaceUp,
  isMemoryWon,
  memoryCardsFor,
  recordMemoryBest,
} from "@/lib/games/memory-match";
import {
  ALPHABET,
  RESCUE_LIVES,
  RESCUE_ROUND,
  dealRescue,
  guessLetter,
  isRescueLost,
  isRescueOver,
  isRescueWon,
  letterSlots,
  newRescue,
  rescuePool,
  rescuePoints,
  settleWord,
  startRun,
} from "@/lib/games/word-rescue";
import {
  SCRAMBLE_BASE_POINTS,
  applyHint,
  backspace,
  builtWord,
  canScramble,
  dealScramble,
  hintsLeft,
  newScramble,
  placeTile,
  reshuffle,
  returnTile,
  scramblePoints,
  scramblePool,
  scrambleTiles,
  trayTiles,
  typeLetter,
  type ScrambleState,
} from "@/lib/games/word-scramble";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const sorted = (s: string) => [...s].sort().join("");

describe("seeded RNG", () => {
  it("the same seed always gives the same sequence, in [0, 1)", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const a = mulberry32(seed);
        const b = mulberry32(seed);
        for (let i = 0; i < 25; i++) {
          const x = a();
          expect(x).toBe(b());
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
        }
      }),
    );
  });

  it("a seeded shuffle is a deterministic permutation that leaves its input alone", () => {
    fc.assert(
      fc.property(seedArb, fc.array(fc.integer(), { maxLength: 30 }), (seed, items) => {
        const copy = [...items];
        const once = shuffleWith(items, mulberry32(seed));
        expect(shuffleWith(items, mulberry32(seed))).toEqual(once);
        expect([...once].sort((x, y) => x - y)).toEqual([...items].sort((x, y) => x - y));
        expect(items).toEqual(copy);
      }),
    );
  });

  it("the daily seed is stable for a day and differs between games", () => {
    expect(dailySeed("2025-03-01", "memory-match")).toBe(dailySeed("2025-03-01", "memory-match"));
    expect(dailySeed("2025-03-01", "memory-match")).not.toBe(dailySeed("2025-03-02", "memory-match"));
    expect(dailySeed("2025-03-01", "memory-match")).not.toBe(dailySeed("2025-03-01", "word-rescue"));
  });
});

describe("Memory Match", () => {
  // Some words sit in two decks with different meanings, so match the exact flashcard.
  const realCards = new Set(DECKS.flatMap((d) => d.cards).map((c) => `${c.word}\u0000${c.meaning}`));

  it("a deal has exactly 6 pairs; every word sits with its own definition; the layout is a permutation", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const deal = dealMemory(seed);
        expect(deal.pairs).toHaveLength(MEMORY_PAIRS);
        expect(deal.cards).toHaveLength(MEMORY_PAIRS * 2);
        expect(new Set(deal.pairs.map((p) => p.word.toLowerCase())).size).toBe(MEMORY_PAIRS);
        deal.pairs.forEach((pair, pairId) => {
          expect(realCards.has(`${pair.word}\u0000${pair.meaning}`)).toBe(true);
          const cards = deal.cards.filter((c) => c.pairId === pairId);
          expect(cards.map((c) => c.kind).sort()).toEqual(["meaning", "word"]);
          expect(cards.find((c) => c.kind === "word")!.text).toBe(pair.word);
          expect(cards.find((c) => c.kind === "meaning")!.text).toBe(shortMeaning(pair.meaning));
        });
        const ids = (cs: { id: string }[]) => cs.map((c) => c.id).sort();
        expect(ids(deal.cards)).toEqual(ids(memoryCardsFor(deal.pairs)));
        expect(dealMemory(seed)).toEqual(deal);
      }),
    );
  });

  it("a matched pair stays matched, and the board is won exactly when every pair is matched", () => {
    fc.assert(
      fc.property(seedArb, fc.array(fc.integer({ min: -1, max: 12 }), { maxLength: 120 }), (seed, taps) => {
        let s = initMemory(dealMemory(seed).cards);
        for (const i of taps) {
          const before = s.matched;
          s = flipCard(s, i);
          if (s.open.length === 2) s = closeOpen(s);
          for (const pairId of before) expect(s.matched).toContain(pairId);
          s.cards.forEach((c, at) => {
            if (s.matched.includes(c.pairId)) expect(isFaceUp(s, at)).toBe(true);
          });
          expect(isMemoryWon(s)).toBe(new Set(s.matched).size === MEMORY_PAIRS);
        }
      }),
    );
  });

  it("a wrong pair costs a move and flips back; clearing the board pair by pair takes 6 moves", () => {
    const deal = dealMemory(42);
    const at = (pairId: number, kind: "word" | "meaning") => deal.cards.findIndex((c) => c.pairId === pairId && c.kind === kind);
    let s = initMemory(deal.cards);
    s = flipCard(s, at(0, "word"));
    s = flipCard(s, at(1, "meaning"));
    expect(s.last?.type).toBe("miss");
    expect(s.moves).toBe(1);
    expect(flipCard(s, at(2, "word"))).toBe(s); // locked until they flip back
    s = closeOpen(s);
    expect(s.open).toEqual([]);
    for (let p = 0; p < MEMORY_PAIRS; p++) {
      expect(isMemoryWon(s)).toBe(false);
      s = flipCard(flipCard(s, at(p, "word")), at(p, "meaning"));
      expect(s.last).toEqual({ type: "match", pairId: p });
    }
    expect(isMemoryWon(s)).toBe(true);
    expect(s.moves).toBe(MEMORY_PAIRS + 1);
  });

  it("the best keeps the fewest moves (then the faster time)", () => {
    let store = { best: {} };
    ({ store } = recordMemoryBest(store, "2025-03-01:6", { moves: 10, ms: 50_000 }));
    expect(recordMemoryBest(store, "2025-03-01:6", { moves: 11, ms: 1_000 }).isNewBest).toBe(false);
    expect(recordMemoryBest(store, "2025-03-01:6", { moves: 10, ms: 40_000 }).isNewBest).toBe(true);
    expect(recordMemoryBest(store, "2025-03-01:6", { moves: 8, ms: 90_000 }).store.best).toEqual({ "2025-03-01:6": { moves: 8, ms: 90_000 } });
  });
});

describe("Word Rescue", () => {
  const answerArb = fc.stringMatching(/^[A-Za-z]{1,8}(?:[ '-][A-Za-z]{1,8}){0,2}$/);
  const letterArb = fc.constantFrom(...ALPHABET, ...ALPHABET.map((l) => l.toUpperCase()));

  it("guessed letters fill exactly the matching positions (case-insensitive); other characters show automatically", () => {
    fc.assert(
      fc.property(answerArb, fc.array(letterArb, { maxLength: 30 }), (answer, guesses) => {
        let s = newRescue(answer);
        for (const g of guesses) s = guessLetter(s, g);
        const slots = letterSlots(answer, s.guessed);
        expect(slots.map((x) => x.char).join("")).toBe(answer);
        slots.forEach((slot, i) => {
          const ch = answer[i];
          expect(slot.revealed).toBe(/[A-Za-z]/.test(ch) ? s.guessed.includes(ch.toLowerCase()) : true);
        });
      }),
    );
  });

  it("lives drop only on wrong new letters; repeated letters are no-ops; won iff all letters revealed, lost iff lives = 0", () => {
    fc.assert(
      fc.property(answerArb, fc.array(letterArb, { maxLength: 40 }), (answer, guesses) => {
        let s = newRescue(answer);
        for (const g of guesses) {
          const prev = s;
          s = guessLetter(prev, g);
          const lower = g.toLowerCase();
          if (isRescueOver(prev) || prev.guessed.includes(lower)) {
            expect(s).toBe(prev);
          } else if (answer.toLowerCase().includes(lower)) {
            expect(s.lives).toBe(prev.lives);
          } else {
            expect(s.lives).toBe(prev.lives - 1);
          }
          expect(s.lives).toBeGreaterThanOrEqual(0);
          expect(isRescueWon(s)).toBe(letterSlots(answer, s.guessed).every((x) => x.revealed));
          expect(isRescueLost(s)).toBe(s.lives === 0);
        }
      }),
    );
  });

  it("the pool only holds letters, spaces, hyphens and apostrophes; a round is 5 distinct seeded words", () => {
    const pool = rescuePool();
    expect(pool.length).toBeGreaterThan(50);
    for (const c of pool) expect(c.word).toMatch(PLAIN_WORD);
    expect(pool.some((c) => c.word.includes("é"))).toBe(false);
    fc.assert(
      fc.property(seedArb, (seed) => {
        const words = dealRescue(seed);
        expect(words).toHaveLength(RESCUE_ROUND);
        expect(new Set(words.map((w) => w.word)).size).toBe(RESCUE_ROUND);
        expect(dealRescue(seed)).toEqual(words);
      }),
    );
  });

  it("scores never go negative and a popped word resets the streak", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.boolean(), fc.integer({ min: 0, max: RESCUE_LIVES })), { minLength: 5, maxLength: 5 }), (outcomes) => {
        let run = startRun(dealRescue(7));
        for (const [won, lives] of outcomes) {
          const prev = run;
          run = settleWord(run, won, lives);
          expect(run.score).toBeGreaterThanOrEqual(prev.score);
          expect(run.streak).toBe(won ? prev.streak + 1 : 0);
        }
        expect(run.index).toBe(5);
        expect(run.rescued).toBe(outcomes.filter(([w]) => w).length);
      }),
    );
    expect(rescuePoints(6, 1)).toBe(22);
    expect(rescuePoints(-3, -1)).toBeGreaterThanOrEqual(0);
  });

  it("the example clue blanks the word, including inflected forms", () => {
    expect(blankWord("Over 500 students enrolled in the new program.", "Enroll")).toEqual({ text: "Over 500 students _____ in the new program.", found: true });
    expect(blankWord("They conducted research over two years.", "Conduct research").text).toBe("They _____ over two years.");
    expect(blankWord("Electric cars aim to be emission-free.", "Emission-free").text).toBe("Electric cars aim to be _____.");
    expect(blankWord("Nothing to see here.", "Curriculum").found).toBe(false);
  });
});

describe("Word Scramble", () => {
  const wordArb = fc.stringMatching(/^[A-Z]{1,10}$/);

  it("the pool is single words of 4–10 letters", () => {
    const pool = scramblePool();
    expect(pool.length).toBeGreaterThan(50);
    for (const c of pool) expect(c.word).toMatch(/^[A-Za-z]{4,10}$/);
    expect(dealScramble(3)).toEqual(dealScramble(3));
  });

  it("shuffled tiles are a permutation of the answer and never spell it when it has 2+ distinct letters", () => {
    fc.assert(
      fc.property(wordArb, seedArb, (word, seed) => {
        const tiles = scrambleTiles(word, mulberry32(seed));
        expect(sorted(tiles.map((t) => t.letter).join(""))).toBe(sorted(word));
        expect(tiles.map((t) => t.id).sort((a, b) => a - b)).toEqual([...word].map((_, i) => i));
        if (canScramble(word)) expect(tiles.map((t) => t.letter).join("")).not.toBe(word);
      }),
    );
  });

  type Op = { kind: "place" | "return" | "type" | "back" | "hint" | "shuffle"; n: number; letter: string };
  const opArb: fc.Arbitrary<Op> = fc.record({
    kind: fc.constantFrom("place", "return", "type", "back", "hint", "shuffle"),
    n: fc.integer({ min: 0, max: 11 }),
    letter: fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  });
  const step = (s: ScrambleState, op: Op, rnd: () => number): ScrambleState => {
    switch (op.kind) {
      case "place":
        return placeTile(s, op.n);
      case "return":
        return returnTile(s, s.placed[op.n % Math.max(1, s.placed.length)] ?? op.n);
      case "type":
        return typeLetter(s, op.letter);
      case "back":
        return backspace(s);
      case "hint":
        return applyHint(s);
      case "shuffle":
        return reshuffle(s, rnd);
    }
  };

  it("building, returning, typing, hints and shuffles conserve the letters", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Z]{4,10}$/), seedArb, fc.array(opArb, { maxLength: 40 }), (word, seed, ops) => {
        const rnd = mulberry32(seed);
        let s = newScramble(word, rnd);
        for (const op of ops) {
          s = step(s, op, rnd);
          expect(new Set(s.placed).size).toBe(s.placed.length);
          expect(s.placed.length).toBeLessThanOrEqual(word.length);
          expect(s.locked).toBeLessThanOrEqual(s.placed.length);
          expect(sorted(builtWord(s) + trayTiles(s).map((t) => t.letter).join(""))).toBe(sorted(word));
          expect(builtWord(s).slice(0, s.locked)).toBe(word.slice(0, s.locked));
          expect(s.hintsUsed).toBeLessThanOrEqual(3);
          expect(hintsLeft(s)).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });

  it("scoring with hints never goes negative (10, +2 per unused hint)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -5, max: 50 }), (hints) => {
        const p = scramblePoints(hints);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeGreaterThanOrEqual(SCRAMBLE_BASE_POINTS);
      }),
    );
    expect(scramblePoints(0)).toBe(16);
    expect(scramblePoints(3)).toBe(10);
  });
});
