import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canPractiseParts, listeningCardModel, resolvePracticePart, WHOLE_UNVERIFIED_NOTE } from "@/lib/ielts/parts";
import { scopeOptions, toLibraryObjective } from "@/lib/homework/library-shared";
import { pickPracticePart } from "@/lib/review/practice-by-type";
import { toClientListening } from "@/lib/ielts/sanitize";
import { LISTENING_SEED } from "@/lib/ielts/content";
import type { ExamListeningTest, ExamTestSummary } from "@/lib/ielts/types";

function summary(over: Partial<ExamTestSummary> = {}): ExamTestSummary {
  return {
    id: "cdi-v10-listening-03",
    skill: "LISTENING",
    title: "Volume 10 · Listening Test 3",
    description: "Averna CDI · Listening",
    difficulty: "Medium",
    questions: 40,
    parts: 4,
    partInfo: [1, 2, 3, 4].map((n) => ({ title: n === 2 ? `Part ${n}` : `Topic ${n}`, from: (n - 1) * 10 + 1, to: n * 10, kinds: ["gap"] })),
    timeLimit: 32,
    kinds: ["gap"],
    full: true,
    source: "imported",
    ...over,
  };
}

const modeArb = fc.constantFrom("per-part", "whole-verified", "whole-unverified", "single");
function summaryFor(mode: string): ExamTestSummary {
  if (mode === "single") return summary({ partInfo: [{ title: "Part 1", from: 1, to: 10 }], parts: 1, questions: 10, full: false, recordingMode: undefined });
  if (mode === "per-part") return summary({ recordingMode: undefined });
  if (mode === "whole-verified") {
    return summary({ recordingMode: "whole", splittable: true, partInfo: summary().partInfo.map((p, i) => ({ ...p, durationMs: 300_000 + i * 61_200 })) });
  }
  return summary({ recordingMode: "whole", splittable: false });
}

describe("practice part resolution", () => {
  // Feature: new-tests-articles-listening-parts, Property 25: Practice part resolution
  it("gives the part index only for an integer in range on a splittable paper", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -3, max: 6 }), fc.integer({ min: -3, max: 6 }).map(String), fc.constantFrom("abc", "", "1.5", " 2 ", null, undefined)),
        fc.integer({ min: 1, max: 4 }),
        fc.boolean(),
        (raw, parts, splittable) => {
          const test = { parts: Array.from({ length: parts }, () => ({})) };
          const got = resolvePracticePart(test, raw, splittable);
          const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\s*\d+\s*$/.test(raw) ? Number(raw) : NaN;
          const expected = splittable && parts > 1 && Number.isInteger(n) && n >= 0 && n < parts ? n : null;
          expect(got).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("Listening card model", () => {
  // Feature: new-tests-articles-listening-parts, Property 29: Listening card model
  it("shows part links only for papers that can practise parts", () => {
    fc.assert(
      fc.property(modeArb, (mode) => {
        const s = summaryFor(mode);
        const m = listeningCardModel(s);
        expect(m.cta.href).toBe(`/learning/listening/${encodeURIComponent(s.id)}`);
        expect(m.cta.href).not.toContain("part=");
        if (mode === "per-part" || mode === "whole-verified") {
          expect(m.label).toBe("Parts · practise one at a time");
          m.rows.forEach((r, i) => {
            expect(r.title).toBe(`Practise Part ${i + 1}`);
            expect(r.href).toBe(`${m.cta.href}?part=${i}`);
            expect(r.detail).toContain(`Questions ${i * 10 + 1}–${i * 10 + 10}`);
            if (i === 1) expect(r.detail).not.toContain("Part 2");
            else expect(r.detail).toContain(`Topic ${i + 1}`);
          });
          if (mode === "whole-verified") m.rows.forEach((r, i) => expect(r.detail).toContain(`${Math.ceil((300_000 + i * 61_200) / 60000) + 1} min`));
          expect(m.note).toBeNull();
        } else if (mode === "whole-unverified") {
          expect(m.label).toBe("One complete recording · Parts 1–4");
          m.rows.forEach((r) => {
            expect(r.href).toBeUndefined();
            expect(r.detail).not.toMatch(/min/);
          });
          expect(m.note).toBe(WHOLE_UNVERIFIED_NOTE);
        } else {
          expect(m.rows.every((r) => !r.href)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("gives 8 min for a 6:01.2 part and 7 min for a 6:00.0 part", () => {
    const s = summary({ recordingMode: "whole", splittable: true, partInfo: summary().partInfo.map((p, i) => ({ ...p, durationMs: i === 0 ? 361_200 : 360_000 })) });
    const m = listeningCardModel(s);
    expect(m.rows[0].detail).toContain("8 min");
    expect(m.rows[1].detail).toContain("7 min");
  });
});

describe("homework scopes", () => {
  // Feature: new-tests-articles-listening-parts, Property 30: Homework scope options
  it("offers parts exactly when the paper can practise parts", () => {
    fc.assert(
      fc.property(modeArb, (mode) => {
        const s = summaryFor(mode);
        const opts = scopeOptions("LISTENING", toLibraryObjective(s));
        expect(opts[0]).toMatchObject({ part: null, label: "Full test" });
        expect(opts.length).toBe(canPractiseParts(s) ? 1 + s.partInfo.length : 1);
      }),
      { numRuns: 50 },
    );
  });

  it("keeps Reading at Full test + Passage 1–3 with 13/13/14 questions and 20 min", () => {
    const reading = summary({
      skill: "READING",
      timeLimit: 60,
      parts: 3,
      recordingMode: undefined,
      partInfo: [
        { title: "A", from: 1, to: 13 },
        { title: "B", from: 14, to: 26 },
        { title: "C", from: 27, to: 40 },
      ],
    });
    const opts = scopeOptions("READING", toLibraryObjective(reading));
    expect(opts.map((o) => o.label)).toEqual(["Full test", "Passage 1", "Passage 2", "Passage 3"]);
    expect(opts.slice(1).map((o) => o.questions)).toEqual([13, 13, 14]);
    expect(opts.slice(1).every((o) => o.minutes === 20)).toBe(true);
  });
});

describe("practice picker", () => {
  // Feature: new-tests-articles-listening-parts, Property 31: The practice picker and the mini task only split splittable papers
  it("never returns a part of a paper that can't practise parts", () => {
    fc.assert(
      fc.property(fc.array(modeArb, { minLength: 1, maxLength: 5 }), fc.array(fc.string({ maxLength: 4 }), { maxLength: 4 }), (modes, done) => {
        const catalog = modes.map((m, i) => ({ ...summaryFor(m), id: `t${i}` }));
        const pick = pickPracticePart({ kind: "gap", skill: "LISTENING", currentTestId: "none", catalog, done: new Set(done) });
        if (!pick) return;
        const t = catalog.find((c) => c.id === pick.testId)!;
        if (!canPractiseParts(t)) expect(pick.part).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});

describe("client payloads", () => {
  // Feature: new-tests-articles-listening-parts, Property 32: Client payloads contain no keys or transcript data
  it("strips answers, explanations, answer markers and evidence windows", () => {
    const base = LISTENING_SEED[0];
    fc.assert(
      fc.property(fc.option(fc.integer({ min: 0, max: base.parts.length - 1 }), { nil: undefined }), (part) => {
        const t: ExamListeningTest = {
          ...base,
          evidenceWindows: { "1": { startMs: 1000, endMs: 5000 } },
          parts: base.parts.map((p) => ({ ...p, script: p.script.map((l) => ({ ...l, marks: [{ n: [1], start: 0, end: 3 }] })) })),
        };
        const json = JSON.stringify(toClientListening(t, part));
        expect(json).not.toMatch(/"answer"|"explanation"|"evidenceWindows"|"marks"/);
      }),
      { numRuns: 30 },
    );
  });
});
