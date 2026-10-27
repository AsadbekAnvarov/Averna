/** Live speaking partner — the honest pronunciation map (docs/elegance-roadmap.md, idea 3). */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MAP_LIMIT,
  UNCLEAR_BELOW,
  buildPronunciationMap,
  ignoredKind,
  markTranscript,
  soundTipFor,
  wordHeard,
  wordsOf,
} from "@/lib/realtime/pronunciation-map";
import type { LiveLogprob, LiveTurn } from "@/lib/realtime/stats";

// Generators: transcripts made of content words plus the categories that must never be flagged.
const CONTENT = [
  "weather", "photography", "comfortable", "environment", "beautiful", "village", "brother", "thinking", "travelling", "winter",
  "morning", "vegetables", "university", "language", "teacher", "holiday", "football", "cooking", "dancing", "festival",
  "mountains", "friendly", "quickly", "library", "sheep", "leave", "pool", "walk", "between", "picture",
];
const NAMES = ["Tashkent", "Samarkand", "Aziz", "Madina", "London", "IELTS"];
const NUMBERS = ["twenty", "2024", "three", "15", "hundred"];
const FILLERS = ["um", "uh", "like", "hmm", "actually"];
const FUNCTION = ["the", "and", "but", "with", "that", "they", "because", "would", "about", "very"];

type Tok = { text: string; kind: "content" | "name" | "number" | "filler" | "function" };
const tokArb: fc.Arbitrary<Tok> = fc.oneof(
  { weight: 5, arbitrary: fc.constantFrom(...CONTENT).map((text) => ({ text, kind: "content" as const })) },
  { weight: 1, arbitrary: fc.constantFrom(...NAMES).map((text) => ({ text, kind: "name" as const })) },
  { weight: 1, arbitrary: fc.constantFrom(...NUMBERS).map((text) => ({ text, kind: "number" as const })) },
  { weight: 1, arbitrary: fc.constantFrom(...FILLERS).map((text) => ({ text, kind: "filler" as const })) },
  { weight: 2, arbitrary: fc.constantFrom(...FUNCTION).map((text) => ({ text, kind: "function" as const })) },
);

/** One student turn: "I think" + tokens, with realistic BPE-ish tokens (leading spaces, words split in two). */
const turnArb: fc.Arbitrary<{ turn: LiveTurn; toks: Tok[] }> = fc
  .record({
    toks: fc.array(tokArb, { minLength: 1, maxLength: 14 }),
    probs: fc.array(fc.double({ min: -8, max: 0, noNaN: true }), { minLength: 40, maxLength: 40 }),
    split: fc.array(fc.boolean(), { minLength: 20, maxLength: 20 }),
    withLogprobs: fc.boolean(),
    id: fc.uuid(),
  })
  .map(({ toks, probs, split, withLogprobs, id }) => {
    const words = ["I", "think", ...toks.map((t) => t.text)];
    const text = `${words.join(" ")}.`;
    const logprobs: LiveLogprob[] = [];
    let p = 0;
    words.forEach((w, i) => {
      const lead = i === 0 ? "" : " ";
      if (split[i % split.length] && w.length > 4) {
        logprobs.push({ token: lead + w.slice(0, 3), logprob: probs[p++ % probs.length] });
        logprobs.push({ token: w.slice(3), logprob: probs[p++ % probs.length] });
      } else logprobs.push({ token: lead + w, logprob: probs[p++ % probs.length] });
    });
    logprobs.push({ token: ".", logprob: -0.01 });
    return { turn: { id, who: "me" as const, text, logprobs: withLogprobs ? logprobs : null }, toks };
  });

const aiTurn: LiveTurn = { id: "ai-1", who: "ai", text: "That sounds wonderful, photography is a lovely hobby.", logprobs: [{ token: "photography", logprob: -9 }] };

describe("buildPronunciationMap — properties", () => {
  it("≤ 12 words, flagged words appear in the transcript, scores in [0,1], ignored categories never flagged, deterministic", () => {
    fc.assert(
      fc.property(fc.array(turnArb, { minLength: 1, maxLength: 6 }), (items) => {
        const turns = [aiTurn, ...items.map((i) => i.turn)];
        const map = buildPronunciationMap(turns);
        expect(map.unclear.length).toBeLessThanOrEqual(MAP_LIMIT);
        expect(map.practise.length).toBeLessThanOrEqual(MAP_LIMIT);
        const transcriptWords = new Set(items.flatMap((i) => wordsOf(i.turn.text)));
        const never = new Set(items.flatMap((i) => i.toks.filter((t) => t.kind !== "content").map((t) => t.text.toLowerCase())).concat(["i"]));
        for (const u of map.unclear) {
          expect(transcriptWords.has(u.word)).toBe(true);
          expect(u.score).toBeGreaterThanOrEqual(0);
          expect(u.score).toBeLessThanOrEqual(1);
          expect(u.score).toBeLessThan(UNCLEAR_BELOW);
          expect(never.has(u.word)).toBe(false);
        }
        for (const p of map.practise) {
          expect(transcriptWords.has(p.word)).toBe(true);
          expect(never.has(p.word)).toBe(false);
          if (p.score != null) expect(p.score >= 0 && p.score <= 1).toBe(true);
        }
        expect(new Set(map.practise.map((p) => p.word)).size).toBe(map.practise.length);
        // Deterministic.
        expect(buildPronunciationMap(JSON.parse(JSON.stringify(turns)) as LiveTurn[])).toEqual(map);
      }),
      { numRuns: 300 },
    );
  });

  it("without logprobs: no unclear words, only sound tips", () => {
    fc.assert(
      fc.property(fc.array(turnArb, { minLength: 1, maxLength: 5 }), (items) => {
        const map = buildPronunciationMap(items.map((i) => ({ ...i.turn, logprobs: null })));
        expect(map.hasLogprobs).toBe(false);
        expect(map.unclear).toEqual([]);
        for (const p of map.practise) {
          expect(p.unclear).toBe(false);
          expect(p.score).toBeNull();
          expect(p.tip).not.toBeNull();
        }
      }),
    );
  });
});

describe("buildPronunciationMap — examples", () => {
  it("scores a word by its weakest token, dedupes and keeps the lowest score", () => {
    const turns: LiveTurn[] = [
      { id: "1", who: "me", text: "I love photography.", logprobs: [{ token: "I", logprob: -0.01 }, { token: " love", logprob: -0.02 }, { token: " photo", logprob: -0.05 }, { token: "graphy", logprob: -2 }, { token: ".", logprob: 0 }] },
      { id: "2", who: "me", text: "Photography is fun.", logprobs: [{ token: "Photo", logprob: -1 }, { token: "graphy", logprob: -0.01 }, { token: " is", logprob: 0 }, { token: " fun", logprob: 0 }, { token: ".", logprob: 0 }] },
    ];
    const map = buildPronunciationMap(turns);
    expect(map.hasLogprobs).toBe(true);
    expect(map.unclear).toHaveLength(1);
    expect(map.unclear[0]).toMatchObject({ word: "photography", count: 2, score: Math.floor(Math.exp(-2) * 100) / 100 });
    expect(map.unclear[0].tip?.kind).toBe("stress");
    expect(map.practise[0]).toMatchObject({ word: "photography", unclear: true });
  });

  it("ignores the partner's words", () => {
    expect(buildPronunciationMap([aiTurn])).toEqual({ hasLogprobs: false, unclear: [], practise: [] });
  });

  it("never flags a mid-sentence name, even when the recogniser was unsure", () => {
    const map = buildPronunciationMap([
      { id: "1", who: "me", text: "I live in Samarkand now.", logprobs: [{ token: "I", logprob: 0 }, { token: " live", logprob: 0 }, { token: " in", logprob: 0 }, { token: " Samarkand", logprob: -5 }, { token: " now", logprob: 0 }, { token: ".", logprob: 0 }] },
    ]);
    expect(map.unclear).toEqual([]);
  });

  it("tags sounds many Uzbek and Russian speakers find hard, as tips", () => {
    expect(soundTipFor("weather")?.kind).toBe("th");
    expect(soundTipFor("village")?.kind).toBe("w-v");
    expect(soundTipFor("winter")?.kind).toBe("w-v");
    expect(soundTipFor("write")).toBeNull();
    expect(soundTipFor("morning")?.kind).toBe("ng");
    expect(soundTipFor("sheep")?.detail).toMatch(/ship/);
    expect(soundTipFor("comfortable")?.detail).toMatch(/COMF-ta-ble/);
    expect(soundTipFor("table")).toBeNull();
  });

  it("knows which words are ignored", () => {
    expect(ignoredKind("Aziz", false)).toBe("name");
    expect(ignoredKind("Weather", true)).toBeNull();
    expect(ignoredKind("IELTS", true)).toBe("name");
    expect(ignoredKind("2024", false)).toBe("number");
    expect(ignoredKind("twenty", false)).toBe("number");
    expect(ignoredKind("um", false)).toBe("filler");
    expect(ignoredKind("the", false)).toBe("function");
    expect(ignoredKind("because", false)).toBe("function");
  });
});

describe("markTranscript / wordHeard", () => {
  it("keeps the text intact and marks only unclear words", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), (text) => {
        const parts = markTranscript(text, new Set(["weather"]));
        return parts.map((p) => p.text).join("") === text;
      }),
    );
    const parts = markTranscript("The weather, Weather!", new Set(["weather"]));
    expect(parts.filter((p) => p.unclear).map((p) => p.text)).toEqual(["weather", "Weather"]);
  });

  it("accepts the word (and its plural) but not another word", () => {
    expect(wordHeard("sheep", "Sheep.")).toBe(true);
    expect(wordHeard("vegetable", "vegetables")).toBe(true);
    expect(wordHeard("sheep", "ship")).toBe(false);
    expect(wordHeard("", "anything")).toBe(false);
  });
});
