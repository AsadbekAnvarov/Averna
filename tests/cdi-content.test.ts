import fs from "node:fs";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { ExamListeningTest, ExamReadingTest } from "@/lib/ielts/types";
import type { WritingPrompt } from "@/lib/writing-data";
import { validateListeningTest, validateReadingTest } from "@/lib/ielts/validate";
import { answerList, listeningForValidation, splitAlternatives } from "../scripts/cdi/answers.mjs";

/**
 * Imported CDI content (scripts/cdi/import.mjs → lib/ielts/content/cdi/).
 *
 * Documented validator exception: CDI Listening tests use the real recording
 * (`test.audio`) and leave `speakers` / `script` empty, which
 * validateListeningPart rejects. The transcript stands in for the script
 * (listeningForValidation), and up to MAX_TRANSCRIPT_MISSES gap answers per
 * test may be written differently in the transcript ("0207 9460 385").
 */
const MAX_TRANSCRIPT_MISSES = 3;
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "lib", "ielts", "content", "cdi");
const PUBLIC = path.join(ROOT, "public");

const readDir = (sub: string) =>
  fs.existsSync(path.join(DIR, sub))
    ? fs
        .readdirSync(path.join(DIR, sub))
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(DIR, sub, f), "utf8")) }))
    : [];

const reading = readDir("reading") as { file: string; data: ExamReadingTest }[];
const listening = readDir("listening") as { file: string; data: ExamListeningTest }[];
const writingPath = path.join(DIR, "writing.json");
const writing: { task1: WritingPrompt[]; task2: WritingPrompt[] } = fs.existsSync(writingPath)
  ? JSON.parse(fs.readFileSync(writingPath, "utf8"))
  : { task1: [], task2: [] };

function numbers(test: { parts: { groups: { questions: { n: number; answer: string[] }[] }[] }[] }) {
  return test.parts.flatMap((p) => p.groups.flatMap((g) => g.questions));
}

function expectImage(src: string) {
  expect(src.startsWith("/cdi/images/")).toBe(true);
  expect(fs.existsSync(path.join(PUBLIC, ...src.split("/").filter(Boolean)))).toBe(true);
}

describe("CDI content", () => {
  it("has imported content", () => {
    expect(reading.length).toBeGreaterThan(0);
    expect(listening.length).toBeGreaterThan(0);
    expect(writing.task1.length + writing.task2.length).toBeGreaterThan(0);
  });

  it("ids are unique and match file names", () => {
    const ids = [
      ...reading.map((r) => r.data.id),
      ...listening.map((l) => l.data.id),
      ...writing.task1.map((w) => w.id),
      ...writing.task2.map((w) => w.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    for (const { file, data } of [...reading, ...listening]) expect(`${data.id}.json`).toBe(file);
  });

  it.each(reading.map((r) => [r.file, r.data] as const))("%s passes validateReadingTest", (_f, test) => {
    expect(test.source).toBe("cdi");
    const r = validateReadingTest(test, { requireFull: true });
    expect(r.errors).toEqual([]);
  });

  it.each(listening.map((l) => [l.file, l.data] as const))("%s passes validateListeningTest (transcript as script)", (_f, test) => {
    expect(test.source).toBe("cdi");
    for (const p of test.parts) {
      expect(p.speakers).toEqual([]);
      expect(p.script).toEqual([]);
      expect(typeof p.transcript).toBe("string");
    }
    const r = validateListeningTest(listeningForValidation(test), { requireFull: true });
    const misses = r.errors.filter((e) => /does not appear in the script/.test(e));
    expect(r.errors.filter((e) => !misses.includes(e))).toEqual([]);
    expect(misses.length).toBeLessThanOrEqual(MAX_TRANSCRIPT_MISSES);
  });

  it.each([...reading, ...listening].map((t) => [t.file, t.data] as const))("%s numbers 1–40, unique, ascending, each answered", (_f, test) => {
    const qs = numbers(test);
    expect(qs.map((q) => q.n)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    for (const q of qs) {
      expect(q.answer.length).toBeGreaterThanOrEqual(1);
      expect(q.answer.every((a) => typeof a === "string" && a.trim().length > 0)).toBe(true);
    }
  });

  it("listening audio points at listening-N.mp3 and group images exist", () => {
    for (const { data } of listening) {
      expect(data.audio?.file).toMatch(/^listening-\d+\.mp3$/);
      if (data.audio?.partStarts) expect(data.audio.partStarts).toHaveLength(4);
      for (const p of data.parts) for (const g of p.groups) if (g.image) expectImage(g.image.src);
    }
    for (const { data } of reading) for (const p of data.parts) for (const g of p.groups) if (g.image) expectImage(g.image.src);
  });

  it("writing prompts are complete and their pictures exist", () => {
    for (const w of writing.task1) {
      expect(w.id).toMatch(/^cdi-writing-\d{2}-t1$/);
      expect(w.imageUrl).toBeTruthy();
      expectImage(w.imageUrl!);
    }
    for (const w of [...writing.task1, ...writing.task2]) {
      expect(w.prompt.trim().length).toBeGreaterThan(20);
      expect(w.type).toBeTruthy();
    }
    for (const w of writing.task2) expect(w.id).toMatch(/^cdi-writing-\d{2}-t2$/);
  });

  it("passages and transcripts are plain text (no markup or handlers)", () => {
    const html = /<\/?[a-z][^>]*>|\bon[a-z]+\s*=/i;
    for (const { data } of reading) for (const p of data.parts) for (const para of p.paragraphs) expect(para.text).not.toMatch(html);
    for (const { data } of listening) for (const p of data.parts) expect(p.transcript ?? "").not.toMatch(html);
  });
});

describe("CDI answer splitting", () => {
  it("splits CDI alternatives and de-duplicates spellings", () => {
    expect(splitAlternatives("fibre / fiber")).toEqual(["fibre", "fiber"]);
    expect(splitAlternatives("fibre/fiber")).toEqual(["fibre", "fiber"]);
    expect(splitAlternatives("car or bus")).toEqual(["car", "bus"]);
    expect(splitAlternatives("1/2")).toEqual(["1/2"]);
    expect(answerList(["Station", "station", "STATION"])).toEqual(["Station"]);
    expect(answerList("(the) river bank")).toEqual(["(the) river bank"]);
    expect(answerList(["A", "B"], { split: false })).toEqual(["A", "B"]);
  });

  // **Validates: answer-splitting helper (scripts/cdi/answers.mjs)**
  it("property: joined alternatives split back into the same distinct list, idempotently", () => {
    const word = fc.stringMatching(/^[a-z][a-z'-]{0,8}[a-z]$/).filter((w) => w !== "or");
    const alt = fc.array(word, { minLength: 1, maxLength: 3 }).map((ws) => ws.join(" "));
    const sep = fc.constantFrom(" / ", " or ", " OR ", "  /  ");
    fc.assert(
      fc.property(fc.array(alt, { minLength: 1, maxLength: 5 }), sep, (alts, s) => {
        const out = answerList(alts.join(s));
        const expected: string[] = [];
        for (const a of alts) if (!expected.some((e) => e.toLowerCase() === a.toLowerCase())) expected.push(a);
        expect(out).toEqual(expected);
        expect(out.every((a) => a.length > 0 && a === a.trim())).toBe(true);
        expect(answerList(out)).toEqual(out);
      }),
      { numRuns: 300 }
    );
  });
});
