// @vitest-environment node
import { readFileSync } from "node:fs";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findUnique: vi.fn(), listening: vi.fn(), reading: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { generatedTest: { findUnique: m.findUnique } } }));
vi.mock("@/lib/ielts/catalog", () => ({
  getListeningExam: m.listening,
  getReadingExam: m.reading,
  listeningFromRow: (r: { id: string; data: unknown }) => ({ ...(r.data as object), id: r.id }),
  readingFromRow: (r: { id: string; data: unknown }) => ({ ...(r.data as object), id: r.id }),
}));

import { getListeningExamForAttempt, getReadingExamForAttempt } from "@/lib/ielts/catalog-attempt";
import { compareTestTitles } from "@/lib/ielts/catalog-order";
import { summarizeListening } from "@/lib/ielts/format";
import { isFullObjective } from "@/lib/ielts/mock-library";
import { capacity } from "@/lib/group-mock/rules";
import { validateListeningTest } from "@/lib/ielts/validate";
import type { ExamListeningTest } from "@/lib/ielts/types";

beforeEach(() => vi.clearAllMocks());

describe("Volume 10 papers in Mock and Group Mock", () => {
  it("lets a section of an unpublished paper finish and be graded (3.8, 17.10)", async () => {
    m.listening.mockResolvedValue(null);
    m.reading.mockResolvedValue(null);
    m.findUnique.mockResolvedValue({ id: "cdi-v10-listening-03", module: "LISTENING", data: { title: "x" } });
    expect(await getListeningExamForAttempt("cdi-v10-listening-03")).toMatchObject({ id: "cdi-v10-listening-03" });
    m.findUnique.mockResolvedValue({ id: "cdi-v10-reading-02", module: "READING", data: {} });
    expect(await getReadingExamForAttempt("cdi-v10-reading-02")).toMatchObject({ id: "cdi-v10-reading-02" });
    // A row of another module is never returned.
    m.findUnique.mockResolvedValue({ id: "x", module: "WRITING", data: {} });
    expect(await getListeningExamForAttempt("x")).toBeNull();
    // The mock's section loading, timing and grading use the attempt resolvers; new picks don't.
    const mock = readFileSync("lib/ielts/mock.ts", "utf8");
    expect(mock.match(/getListeningExamForAttempt\(papers\.listening\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(mock).toMatch(/getReadingExamForAttempt\(papers\.reading\)/);
    expect(mock).not.toMatch(/\bgetListeningExam\(/);
  });

  // Feature: new-tests-articles-listening-parts, Property 33: Mock eligibility and preference
  it("treats a paper as full exactly with 40 unique numbers 1–40 in the right number of parts", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 45 }), { minLength: 30, maxLength: 45 }), fc.integer({ min: 3, max: 4 }), (nums, parts) => {
        const size = Math.ceil(nums.length / parts);
        const test = { parts: Array.from({ length: parts }, (_, i) => ({ groups: [{ questions: nums.slice(i * size, (i + 1) * size).map((n) => ({ n })) }] })) };
        const sorted = [...nums].sort((a, b) => a - b);
        const ok = nums.length === 40 && sorted.every((n, i) => n === i + 1);
        expect(isFullObjective(test as never, parts)).toBe(ok);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 34: Durations and the Group Mock pool
  it("gives ceil((D + 2 min) / 1 min) library minutes and capacity min(…, 30)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 60_000, max: 3_600_000 }), fc.array(fc.nat(40), { minLength: 4, maxLength: 4 }), (D, [l, r, t1, t2]) => {
        const paper = { format: "exam-v2", skill: "LISTENING", id: "x", title: "x", description: "x", difficulty: "Medium", source: "imported", parts: [], recordingMode: "whole", recordingDurationMs: D, recordingSha256: "a".repeat(64) } as unknown as ExamListeningTest;
        expect(summarizeListening(paper).timeLimit).toBe(Math.ceil((D + 120_000) / 60_000));
        const pool = { listening: Array.from({ length: l }, (_, i) => ({ id: `l${i}`, milliseconds: D + 120_000 })), reading: Array(r).fill("r"), task1: Array(t1).fill("a"), task2: Array(t2).fill("b") };
        expect(capacity(pool)).toBe(Math.min(l, r, t1, t2, 30));
      }),
      { numRuns: 100 },
    );
  });

  // Feature: new-tests-articles-listening-parts, Property 35: Library order
  it("orders Volume 10 papers naturally: Test 2 before Test 10", () => {
    fc.assert(
      fc.property(fc.shuffledSubarray(Array.from({ length: 12 }, (_, i) => i + 1), { minLength: 2 }), (ns) => {
        const list = ns.map((n) => ({ id: `cdi-v10-reading-${String(n).padStart(2, "0")}`, title: `Volume 10 · Reading Test ${n}` }));
        const sorted = [...list].sort(compareTestTitles).map((x) => Number(x.title.split(" ").pop()));
        expect(sorted).toEqual([...ns].sort((a, b) => a - b));
      }),
      { numRuns: 100 },
    );
  });

  it("accepts the source's speaker labels only for a supplied whole recording (validate.ts)", () => {
    const part = (n: number) => ({
      id: `p${n}`,
      title: `Topic ${n}`,
      context: `Topic ${n}`,
      speakers: [],
      script: [{ speaker: "WOMAN", text: "Hello there." }],
      groups: [{ kind: "gap", instructions: "Complete the notes below.", wordLimit: 1, template: Array.from({ length: 10 }, (_, i) => `- a [[${n * 10 + i + 1}]]`).join("\n"), questions: Array.from({ length: 10 }, (_, i) => ({ n: n * 10 + i + 1, answer: ["x"] })) }],
    });
    const base = { format: "exam-v2", skill: "LISTENING", id: "cdi-v10-listening-09", title: "t", description: "d", difficulty: "Medium", source: "imported", parts: [0, 1, 2, 3].map(part) };
    const whole = validateListeningTest({ ...base, recordingMode: "whole", recordingDurationMs: 1000, recordingSha256: "a".repeat(64) }, { requireFull: true });
    expect(whole.errors.filter((e) => /speaker/.test(e))).toEqual([]);
    const voiced = validateListeningTest(base, { requireFull: true });
    expect(voiced.errors.some((e) => /speaker/.test(e))).toBe(true);
  });
});
