/** "Show me where": the evidence locator behind the Reading / Listening result pages. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  evidenceSeconds,
  hearFrom,
  locateEvidence,
  partEvidence,
  quotedSegments,
  sentences,
  type EvidenceQuery,
} from "@/lib/review/evidence";
import { LISTENING_SEED, READING_SEED } from "@/lib/ielts/content";
import type { GradeItem, ListeningPart, ReadingPart } from "@/lib/ielts/types";

// Passage words and query words never share a stem.
const TEXT_WORDS = [
  "amber", "basil", "cedar", "delta", "ember", "fable", "gamut", "haven", "ivory", "jasper", "kelp", "lumen",
  "maple", "nectar", "onyx", "pebble", "quartz", "raven", "sable", "tundra", "umber", "velvet", "willow", "farm's", "it’s",
];
const QUERY_WORDS = ["orbit", "prism", "quill", "rustle", "spire", "thicket", "urchin", "vortex", "wicker", "yarrow", "zinnia", "cobalt"];
const PHRASE_WORDS = ["zircon", "quasar", "nebula", "photon"];

const textWord = fc.constantFrom(...TEXT_WORDS);
const queryWord = fc.constantFrom(...QUERY_WORDS);
const sentenceWords = fc.array(textWord, { minLength: 3, maxLength: 10 });
const queryText = fc.array(queryWord, { minLength: 0, maxLength: 8 }).map((w) => w.join(" "));

/** Sentences → paragraphs (each a run of sentences), remembering where every sentence sits. */
function build(paras: string[][][]) {
  const texts: string[] = [];
  const where: { p: number; start: number; end: number }[] = [];
  paras.forEach((sents, p) => {
    let t = "";
    for (const words of sents) {
      if (t) t += " ";
      const s = `${words.join(" ")}.`;
      where.push({ p, start: t.length, end: t.length + s.length });
      t += s;
    }
    texts.push(t);
  });
  return { texts, where };
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

describe("locateEvidence — properties", () => {
  it("picks the one sentence holding the exact answer phrase, whatever else overlaps", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(sentenceWords, { minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 3 }),
        fc.array(fc.constantFrom(...PHRASE_WORDS), { minLength: 1, maxLength: 2 }),
        fc.nat(),
        fc.nat(),
        fc.array(textWord, { maxLength: 12 }),
        (paras, phrase, pick, at, noise) => {
          const copy = paras.map((s) => s.map((w) => [...w]));
          const flat = copy.flat();
          const k = pick % flat.length;
          flat[k].splice(at % (flat[k].length + 1), 0, ...phrase);
          const { texts, where } = build(copy);
          // The explanation and question share words with other sentences: the phrase still wins.
          const span = locateEvidence(texts, { answers: [phrase.join(" ")], explanation: noise.join(" "), question: noise.slice(0, 4).join(" ") });
          expect(span).not.toBeNull();
          expect({ p: span!.paragraphIndex, start: span!.start, end: span!.end }).toEqual(where[k]);
        }
      )
    );
  });

  it("always finds a planted quote despite whitespace, quote-mark and case noise", () => {
    const noisy = (q: string, flips: boolean[], spaces: string[]) =>
      Array.from(q)
        .map((c, i) => {
          if (c === " ") return spaces[i % spaces.length];
          if (c === "'") return flips[i % flips.length] ? "’" : "'";
          if (c === "’") return flips[i % flips.length] ? "'" : "‘";
          return flips[i % flips.length] ? c.toUpperCase() : c;
        })
        .join("");
    fc.assert(
      fc.property(
        fc.array(fc.array(sentenceWords, { minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 3 }),
        fc.nat(),
        fc.nat(),
        fc.integer({ min: 2, max: 6 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 7 }),
        fc.array(fc.constantFrom(" ", "  ", "\n", " \t ", "\u00a0"), { minLength: 1, maxLength: 5 }),
        (paras, pick, from, len, flips, spaces) => {
          const { texts } = build(paras);
          const words = paras.flat()[pick % paras.flat().length];
          const s = from % words.length;
          const quote = words.slice(s, s + len).join(" ");
          const span = locateEvidence(texts, { quotes: [`  ${noisy(quote, flips, spaces)} `] });
          expect(span).not.toBeNull();
          expect(span!.source).toBe("quote");
          expect(norm(texts[span!.paragraphIndex].slice(span!.start, span!.end))).toContain(norm(quote));
        }
      )
    );
  });

  it("never returns a span outside the text", () => {
    const anyText = fc.oneof(fc.lorem({ maxCount: 6, mode: "sentences" }), fc.string({ maxLength: 80 }), fc.constant(""));
    const anyQuery: fc.Arbitrary<EvidenceQuery> = fc.record({
      quotes: fc.array(fc.oneof(fc.lorem({ maxCount: 4 }), fc.string({ maxLength: 20 })), { maxLength: 2 }),
      answers: fc.array(fc.oneof(fc.lorem({ maxCount: 2 }), fc.string({ maxLength: 10 })), { maxLength: 2 }),
      explanation: fc.lorem({ maxCount: 12 }),
      question: fc.oneof(fc.lorem({ maxCount: 8 }), fc.string({ maxLength: 30 })),
      hints: fc.array(fc.lorem({ maxCount: 5 }), { maxLength: 2 }),
    });
    fc.assert(
      fc.property(fc.array(anyText, { maxLength: 5 }), anyQuery, (texts, q) => {
        const span = locateEvidence(texts, q);
        if (!span) return;
        expect(span.paragraphIndex).toBeGreaterThanOrEqual(0);
        expect(span.paragraphIndex).toBeLessThan(texts.length);
        expect(span.start).toBeGreaterThanOrEqual(0);
        expect(span.end).toBeGreaterThan(span.start);
        expect(span.end).toBeLessThanOrEqual(texts[span.paragraphIndex].length);
      })
    );
  });

  it("returns null when nothing in the text relates to the question", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(sentenceWords, { minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 3 }),
        fc.array(queryText, { maxLength: 2 }),
        queryText,
        queryText,
        (paras, answers, explanation, question) => {
          const { texts } = build(paras);
          expect(locateEvidence(texts, { quotes: answers, answers, explanation, question, hints: [question] })).toBeNull();
        }
      )
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(sentenceWords, { minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 3 }),
        fc.array(textWord, { maxLength: 10 }),
        (paras, hint) => {
          const { texts } = build(paras);
          const q = { explanation: hint.join(" "), question: hint.slice(0, 3).join(" ") };
          expect(locateEvidence(texts, q)).toEqual(locateEvidence([...texts], { ...q }));
        }
      )
    );
  });
});

describe("evidence helpers", () => {
  it("splits sentences without breaking on abbreviations or decimals", () => {
    const t = "Dr. Lee measured 2.5 metres. It grew! Did it? Yes.";
    expect(sentences(t).map((r) => t.slice(r.start, r.end))).toEqual(["Dr. Lee measured 2.5 metres.", "It grew!", "Did it?", "Yes."]);
  });

  it("reads quoted segments from explanations (apostrophes and ellipses inside)", () => {
    expect(quotedSegments("Paragraph B: Cassani’s ‘garden tower’ had ‘a fundamental flaw’, and ‘all … foundered on the same problem’.")).toEqual([
      "garden tower",
      "a fundamental flaw",
      "foundered on the same problem",
    ]);
    expect(quotedSegments("Owen says, “I’m a paramedic, so I work for the ambulance service.”")).toEqual([
      "I’m a paramedic, so I work for the ambulance service.",
    ]);
    expect(quotedSegments("No quotes here.")).toEqual([]);
  });

  it("times the evidence from the recording timeline and leads in by 2 s", () => {
    const timeline = [
      { i: -1, startMs: 0, endMs: 5000 },
      { i: 0, startMs: 5000, endMs: 9000 },
      { i: 1, startMs: 10_000, endMs: 20_000 },
    ];
    expect(evidenceSeconds(timeline, { paragraphIndex: 1, start: 50, end: 80, source: "derived" }, 100)).toBe(15);
    expect(evidenceSeconds(timeline, { paragraphIndex: 4, start: 0, end: 5, source: "derived" }, 10)).toBeNull();
    expect(hearFrom(15)).toBe(13);
    expect(hearFrom(1)).toBe(0);
  });
});

describe("partEvidence on the built-in papers", () => {
  const allWrong = (part: ReadingPart | ListeningPart) =>
    new Map<number, GradeItem>(
      part.groups.flatMap((g) => g.questions.map((q) => [q.n, { n: q.n, kind: g.kind, correct: false, given: "", expected: q.answer[0] ?? "", accepted: q.answer }] as const))
    );

  it("points Reading 1, question 8 at Cassani’s calculation in paragraph B", () => {
    const part = READING_SEED.find((t) => t.id === "averna-reading-01")!.parts[0];
    const span = partEvidence(part, allWrong(part))[8];
    expect(span).toBeDefined();
    expect(span.paragraphIndex).toBe(1);
    expect(part.paragraphs[1].text.slice(span.start, span.end)).toContain("calculated that a single tower could feed around two thousand residents");
  });

  it("finds evidence for most questions and never for a correct one", () => {
    let total = 0;
    let found = 0;
    for (const t of [...READING_SEED, ...LISTENING_SEED]) {
      for (const part of t.parts) {
        const items = allWrong(part);
        const ev = partEvidence(part, items);
        total += items.size;
        found += Object.keys(ev).length;
        const right = new Map([...items].map(([n, it]) => [n, { ...it, correct: true }]));
        expect(partEvidence(part, right)).toEqual({});
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(found / total).toBeGreaterThan(0.8);
  });
});
