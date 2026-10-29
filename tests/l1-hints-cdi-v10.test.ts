import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { l1Hint } from "@/lib/l1/hints";

/** Instruction lines of the 14 Volume 10 papers (from the importer's dry run: instructions only, no keys or content). */
const FIXTURE = JSON.parse(readFileSync("tests/fixtures/cdi-v10-instructions.json", "utf8")) as { id: string; skill: string; lines: string[] }[];
const LINES = FIXTURE.flatMap((p) => p.lines);
const HEADERS = LINES.filter((l) => /^Questions? \d/.test(l));

describe("L1 hints for the Volume 10 papers", () => {
  it("has the fixture shape: 14 papers, ids and skills, instruction lines only (21.4)", () => {
    expect(FIXTURE.map((p) => p.id)).toEqual([
      ...Array.from({ length: 6 }, (_, i) => `cdi-v10-listening-0${i + 1}`),
      ...Array.from({ length: 8 }, (_, i) => `cdi-v10-reading-0${i + 1}`),
    ]);
    for (const p of FIXTURE) {
      expect(["READING", "LISTENING"]).toContain(p.skill);
      expect(p.lines.length).toBeGreaterThan(3);
      expect(Object.keys(p).sort()).toEqual(["id", "lines", "skill"]);
    }
    // No question stems (they end with "?") and no answer data.
    expect(LINES.some((l) => l.trim().endsWith("?"))).toBe(false);
  });

  it("covers at least 90 % of the lines in each language and every Questions N–M header (21.1)", () => {
    for (const lang of ["uz", "ru"] as const) {
      const covered = LINES.filter((l) => l1Hint(l, lang) != null).length;
      expect(covered / LINES.length).toBeGreaterThanOrEqual(0.9);
      expect(HEADERS.every((h) => l1Hint(h, lang) != null)).toBe(true);
    }
  });

  // Feature: new-tests-articles-listening-parts, Property 43: L1 hints are exact or absent
  it("copies numbers, ranges and letters verbatim, keeps TRUE/FALSE/NOT GIVEN in English, and is null for an unknown sentence", () => {
    const range = fc.tuple(fc.integer({ min: 1, max: 30 }), fc.integer({ min: 1, max: 10 })).map(([a, d]) => `${a}–${a + d}`);
    const letter = fc.integer({ min: 2, max: 9 }).map((n) => `A–${String.fromCharCode(65 + n)}`);
    const line = fc.oneof(
      fc.tuple(letter, range).map(([l, r]) => ({ text: `Choose the correct letter, ${l}, for questions ${r}.`, tokens: [l, r] })),
      fc.tuple(fc.constantFrom("FIVE", "TWO", "THREE"), letter, range).map(([n, l, r]) => ({ text: `Choose ${n} correct answers, ${l}, next to questions ${r}.`, tokens: [l, r] })),
      range.map((r) => ({ text: `Questions ${r}`, tokens: [r] })),
      fc.constant({ text: "Choose TRUE, FALSE or NOT GIVEN.", tokens: ["TRUE", "FALSE", "NOT GIVEN"] }),
      fc.constant({ text: "Choose YES, NO or NOT GIVEN.", tokens: ["YES", "NO", "NOT GIVEN"] }),
      fc.constant({ text: "Write ONE WORD OR A NUMBER for each answer.", tokens: [] }),
      fc.constant({ text: "Do the following statements agree with the information given in Reading Passage 2?", tokens: ["Reading Passage 2"] }),
    );
    fc.assert(
      fc.property(line, (l) => {
        for (const lang of ["uz", "ru"] as const) {
          const h = l1Hint(l.text, lang);
          expect(h).not.toBeNull();
          for (const t of l.tokens) expect(h).toContain(t);
          expect(l1Hint(`${l.text} The zebra plays the trombone at midnight.`, lang)).toBeNull();
        }
      }),
      { numRuns: 150 },
    );
  });
});
