// @vitest-environment node
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { convertSource } from "@/lib/cdi-import/pipeline";
import { checkKey } from "@/lib/cdi-import/key-check";
import { identifySource } from "@/lib/cdi-import/source-files";
import { nonWhitespace } from "@/lib/cdi-import/text";
import type { ExamReadingTest } from "@/lib/ielts/types";
import { readingSource } from "./fixtures/cdi-v10/build";

const BASE = "https://example.github.io/averna-cdi-audio/";
const run = (file: string, html: string) => convertSource({ file, bytes: new TextEncoder().encode(html), mediaBase: BASE });

describe("Volume 10 Reading conversion", () => {
  it("converts every group kind and scores the source key 40/40 (1.4–1.6, 1.12)", async () => {
    const { html } = readingSource(3);
    const r = await run("Volume 10 test 2 reading.html", html);
    expect(r.errors).toEqual([]);
    expect(r.included).toBe(true);
    const paper = r.paper as ExamReadingTest;
    expect(paper.parts.map((p) => p.groups.map((g) => g.kind))).toEqual([
      ["tfng", "matching", "gap"],
      ["matching", "mcq", "gap-box"],
      ["ynng", "mcq-multi", "gap", "matching"],
    ]);
    expect(r.key).toMatchObject({ first: 40, last: 40, total: 40, missed: [] });
    // Explanations are never invented (1.2).
    expect(paper.parts.flatMap((p) => p.groups.flatMap((g) => g.questions)).every((q) => q.explanation === undefined)).toBe(true);
    // Reuse and the limit come from the source (1.12).
    expect(paper.parts[0].groups[1].allowReuse).toBe(true);
    expect(paper.parts[0].groups[2]).toMatchObject({ wordLimit: 2, answerRule: "NO MORE THAN TWO WORDS" });
    // mcq-multi: the same sorted letters on every question.
    const multi = paper.parts[2].groups[1];
    expect(multi.questions.map((q) => q.answer)).toEqual([["B", "D"], ["B", "D"]]);
    // Paragraph labels as in the source, digits included (1.3).
    expect(paper.parts[1].paragraphs.map((p) => p.label)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("keeps the A–J word box without I and warns (1.9)", async () => {
    const r = await run("Volume 10 test 2 reading.html", readingSource(4).html);
    const box = (r.paper as ExamReadingTest).parts[1].groups[2];
    expect(box.options!.map((o) => o.key)).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "J"]);
    expect(r.warnings.some((w) => /A–J/.test(w.message) && w.file === "Volume 10 test 2 reading.html" && w.questions?.includes(21))).toBe(true);
  });

  it("never carries the source's interface (timer, Telegram, buttons) into the paper (18.5)", async () => {
    const r = await run("Volume 10 test 1 reading.html", readingSource(5).html);
    const json = JSON.stringify(r.paper);
    expect(json).not.toMatch(/t\.me|IELTS_Volume|Check Answers|Review|60:00/);
  });

  it("excludes a paper with 39 key numbers or no correctAnswers (1.10, 1.11)", async () => {
    const missing = await run("Volume 10 test 3 reading.html", readingSource(6, { dropQuestion: 17 }).html);
    expect(missing.included).toBe(false);
    expect(missing.errors.some((e) => e.questions?.includes(17))).toBe(true);
    const noKey = await run("Volume 10 test 3 reading.html", readingSource(6, { noKey: true }).html);
    expect(noKey.included).toBe(false);
    expect(noKey.errors[0].message).toMatch(/correctAnswers/);
  });

  // Feature: new-tests-articles-listening-parts, Property 1: Converted paper structure and provenance
  it("names the paper from the file and records its provenance", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 99 }), fc.constantFrom("Volume 10 test N reading.html", "vol 10 Test N Reading.html", "VOLUME 10 reading test N.html"), async (n, pattern) => {
        const file = pattern.replace("N", String(n));
        const id = identifySource(file)!;
        expect(id).toEqual({ skill: "READING", number: n, id: `cdi-v10-reading-${String(n).padStart(2, "0")}` });
        const bytes = new TextEncoder().encode(readingSource(n).html);
        const r = await convertSource({ file, bytes, mediaBase: BASE });
        const p = r.paper as ExamReadingTest;
        expect(p.title).toBe(`Volume 10 · Reading Test ${n}`);
        expect(p).toMatchObject({ difficulty: "Medium", source: "imported", timeLimit: 60 });
        expect(p.imported).toMatchObject({ provider: "user-supplied-cdi", file });
        expect(p.imported!.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(p.parts.map((x) => x.groups.flatMap((g) => g.questions.map((q) => q.n)))).toEqual([
          Array.from({ length: 13 }, (_, i) => i + 1),
          Array.from({ length: 13 }, (_, i) => i + 14),
          Array.from({ length: 14 }, (_, i) => i + 27),
        ]);
      }),
      { numRuns: 20 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 4: The source key scores 40 of 40 and altered keys are reported
  it("reports exactly the questions whose key was altered", async () => {
    const { html, key } = readingSource(8);
    const r = await run("Volume 10 test 8 reading.html", html);
    const paper = r.paper as ExamReadingTest;
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(fc.integer({ min: 1, max: 40 }).filter((n) => n !== 31 && n !== 32), { minLength: 1, maxLength: 6 }), async (bad) => {
        const altered = { ...key };
        for (const n of bad) altered[n] = "zzz-wrong";
        const k = checkKey(paper, altered);
        expect(k.missed).toEqual([...bad].sort((a, b) => a - b));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 5: Passage and instruction text is preserved
  it("keeps passage text and instructions character for character (entities, quotes, tags)", async () => {
    const extra = " “Quoted” – dash &amp; café <em>inline</em>";
    const r = await run("Volume 10 test 9 reading.html", readingSource(9, { extraText: extra }).html);
    const p = (r.paper as ExamReadingTest).parts[2].paragraphs[0].text;
    expect(nonWhitespace(p)).toContain(nonWhitespace("“Quoted” – dash & café inline"));
    const g = (r.paper as ExamReadingTest).parts[0].groups[0];
    expect(nonWhitespace(g.instructions)).toBe(nonWhitespace("Do the following statements agree with the information given in Reading Passage 1? Choose TRUE, FALSE or NOT GIVEN."));
  });
});
