/**
 * lib/speaking/fluency.ts — words, fillers and pace for the opt-in own-speech captions.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { countFillers, countWords, FILLERS, topFillers, wordsPerMinute } from "@/lib/speaking/fluency";

/** Words that are never fillers and never change how a following filler is read. */
const NEUTRAL = ["the", "cat", "sat", "on", "mat", "today", "school", "friends", "weekend", "travel", "beautiful", "quickly", "because", "family", "city", "river"];
const word = fc.constantFrom(...NEUTRAL);
const filler = fc.constantFrom(...FILLERS);
const punct = fc.constantFrom(" ", ", ", " — ", ". ", "… ");

describe("countFillers / countWords", () => {
  it("property: counts exactly the fillers inserted between ordinary words", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.array(word, { maxLength: 4 }), fc.option(filler, { nil: null }), punct), { maxLength: 30 }), (parts) => {
        let text = "";
        let inserted = 0;
        let words = 0;
        for (const [ws, f, p] of parts) {
          text += ws.join(" ") + p;
          words += ws.length;
          if (f) {
            text += (inserted % 2 ? f.toUpperCase() : f) + p;
            inserted += 1;
            words += f.split(" ").length;
          }
        }
        const c = countFillers(text);
        expect(c.total).toBe(inserted);
        expect(Object.values(c.by).reduce((a, b) => a + (b ?? 0), 0)).toBe(inserted);
        expect(countWords(text)).toBe(words);
      }),
    );
  });

  it("property: no fillers in text made of ordinary words", () => {
    fc.assert(
      fc.property(fc.array(word, { maxLength: 50 }), (ws) => {
        expect(countFillers(ws.join(" ")).total).toBe(0);
      }),
    );
  });

  it("reads 'like' and 'you know' in context", () => {
    expect(countFillers("I like football and it looks like rain").total).toBe(0);
    expect(countFillers("It was, like, really good. Um, I mean, basically fine.").by).toEqual({ like: 1, um: 1, "i mean": 1, basically: 1 });
    expect(countFillers("Do you know the answer?").total).toBe(0);
    expect(countFillers("You know, it's fine, you know").by).toEqual({ "you know": 2 });
    expect(countWords("Don't stop — it's 2 o'clock")).toBe(5);
    expect(topFillers(countFillers("um uh um like um"))).toEqual([
      ["um", 3],
      ["like", 1],
      ["uh", 1],
    ]);
  });
});

describe("wordsPerMinute", () => {
  it("is words per minute of speaking time, null under 15 s", () => {
    expect(wordsPerMinute(150, 60_000)).toBe(150);
    expect(wordsPerMinute(60, 30_000)).toBe(120);
    expect(wordsPerMinute(40, 14_999)).toBeNull();
    expect(wordsPerMinute(10, Number.NaN)).toBeNull();
  });

  it("property: never negative, and doubling the time halves the pace (± rounding)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 15_000, max: 3_600_000 }), (w, ms) => {
        const a = wordsPerMinute(w, ms)!;
        const b = wordsPerMinute(w, ms * 2)!;
        expect(a).toBeGreaterThanOrEqual(0);
        expect(Math.abs(a / 2 - b)).toBeLessThanOrEqual(1);
      }),
    );
  });
});
