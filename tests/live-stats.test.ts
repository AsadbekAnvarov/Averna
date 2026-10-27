/** Live speaking partner — "How it went" numbers and fallback tips (docs/elegance-roadmap.md, idea 3). */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MS_PER_WORD_ESTIMATE, fallbackTips, formatClock, liveStats, type LiveTurn } from "@/lib/realtime/stats";
import { countFillers, countWords } from "@/lib/speaking/fluency";

const WORDS = ["I", "think", "um", "like", "you", "know", "travel", "is", "great", "because", "uh", "my", "family", "really", "enjoys", "it", "er", "basically"];
const textArb = fc.array(fc.constantFrom(...WORDS), { minLength: 0, maxLength: 40 }).map((w) => w.join(" "));
const turnArb: fc.Arbitrary<LiveTurn> = fc.record({
  id: fc.uuid(),
  who: fc.constantFrom("me" as const, "ai" as const),
  text: textArb,
  speechMs: fc.option(fc.integer({ min: 0, max: 60_000 }), { nil: null }),
});

describe("liveStats — properties", () => {
  it("words, fillers and wpm come only from the student's turns and stay consistent", () => {
    fc.assert(
      fc.property(fc.array(turnArb, { maxLength: 20 }), fc.integer({ min: 0, max: 400 }), (turns, callSec) => {
        const s = liveStats(turns, callSec);
        const mine = turns.filter((t) => t.who === "me" && t.text.trim());
        const words = mine.reduce((n, t) => n + countWords(t.text), 0);
        expect(s.words).toBe(words);
        expect(s.myTurns).toBe(mine.length);
        expect(s.fillers).toBe(countFillers(mine.map((t) => t.text).join(" \n ")).total);
        expect(s.fillers).toBeLessThanOrEqual(s.words);
        // AI turns never change the student's numbers.
        expect(liveStats(mine, callSec)).toEqual(s);
        // Speaking time can't exceed the call.
        if (callSec > 0) expect(s.mySpeechSec).toBeLessThanOrEqual(callSec);
        const speechMs = mine.reduce((n, t) => n + (t.speechMs && t.speechMs > 0 ? t.speechMs : countWords(t.text) * MS_PER_WORD_ESTIMATE), 0);
        const capped = callSec > 0 ? Math.min(speechMs, callSec * 1000) : speechMs;
        if (capped < 15_000) expect(s.wpm).toBeNull();
        else expect(s.wpm).toBe(Math.round(words / (capped / 60_000)));
        if (s.longestAnswer) for (const t of mine) expect(s.longestAnswer.words).toBeGreaterThanOrEqual(countWords(t.text));
      }),
      { numRuns: 300 },
    );
  });

  it("fallback tips: always exactly 3, distinct and deterministic", () => {
    fc.assert(
      fc.property(fc.array(turnArb, { maxLength: 12 }), fc.integer({ min: 0, max: 300 }), (turns, callSec) => {
        const s = liveStats(turns, callSec);
        const tips = fallbackTips(s);
        expect(tips).toHaveLength(3);
        expect(new Set(tips).size).toBe(3);
        expect(fallbackTips(s)).toEqual(tips);
      }),
    );
  });
});

describe("liveStats — examples", () => {
  it("counts the student's words per minute over their speaking time", () => {
    const turns: LiveTurn[] = [
      { id: "a1", who: "ai", text: "What do you like doing at the weekend?" },
      { id: "m1", who: "me", text: "Um I usually go hiking with my friends because I like the mountains", speechMs: 6_000 },
      { id: "m2", who: "me", text: "and you know it is really relaxing", speechMs: 14_000 },
    ];
    const s = liveStats(turns, 120);
    expect(s.words).toBe(20);
    expect(s.mySpeechSec).toBe(20);
    expect(s.wpm).toBe(60);
    expect(s.fillers).toBe(2); // um, you know ("I like" is a verb)
    expect(s.longestAnswer?.words).toBe(13);
  });

  it("formats the clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(240)).toBe("4:00");
  });
});
