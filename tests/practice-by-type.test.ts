/** "Practise this type": mistakes grouped by question type and the part picked to practise each. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  isDone,
  mistakesByKind,
  partKey,
  pickPracticePart,
  practiseLabel,
  type CatalogEntry,
  type PickInput,
} from "@/lib/review/practice-by-type";
import { practiceKindOf } from "@/lib/ielts/format";
import type { GradeItem, PracticeKind } from "@/lib/ielts/types";

const KINDS: PracticeKind[] = ["tfng", "ynng", "mcq", "mcq-multi", "matching", "matching-headings", "matching-information", "gap", "gap-box"];
const kindArb = fc.constantFrom(...KINDS);
const skillArb = fc.constantFrom("READING" as const, "LISTENING" as const);

const catalogArb: fc.Arbitrary<CatalogEntry[]> = fc
  .array(
    fc.record({
      skill: skillArb,
      whole: fc.boolean(),
      parts: fc.array(fc.uniqueArray(kindArb, { maxLength: 3 }), { minLength: 1, maxLength: 4 }),
    }),
    { minLength: 1, maxLength: 6 }
  )
  .map((tests) =>
    tests.map((t, i) => ({
      id: `t${i}`,
      skill: t.skill,
      title: `Test ${i}`,
      recordingMode: t.whole && t.skill === "LISTENING" ? ("whole" as const) : undefined,
      partInfo: t.parts.map((kinds, p) => ({ title: `Part ${p + 1}`, from: p * 10 + 1, to: p * 10 + 10, kinds })),
    }))
  );

const inputArb: fc.Arbitrary<PickInput> = catalogArb.chain((catalog) => {
  const keys = catalog.flatMap((t) => [t.id, ...t.partInfo.map((_, i) => partKey(t.id, i))]);
  return fc.record({
    kind: kindArb,
    skill: skillArb,
    currentTestId: fc.constantFrom(...catalog.map((t) => t.id), "elsewhere"),
    catalog: fc.constant(catalog),
    done: fc.subarray(keys).map((k) => new Set(k)),
  });
});

const isWhole = (t: CatalogEntry) => t.recordingMode === "whole" || t.partInfo.length <= 1;
const options = (input: PickInput) =>
  input.catalog
    .filter((t) => t.skill === input.skill)
    .flatMap((t) =>
      t.partInfo.flatMap((p, i) => (p.kinds?.includes(input.kind) ? [{ t, part: isWhole(t) ? null : i }] : []))
    );

describe("pickPracticePart — properties", () => {
  it("picks a part of the same skill that contains the type (null only when none has it)", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const pick = pickPracticePart(input);
        const opts = options(input);
        if (!opts.length) {
          expect(pick).toBeNull();
          return;
        }
        expect(pick).not.toBeNull();
        const t = input.catalog.find((x) => x.id === pick!.testId)!;
        expect(t.skill).toBe(input.skill);
        if (pick!.part == null) {
          expect(isWhole(t)).toBe(true);
          expect(t.partInfo.some((p) => p.kinds?.includes(input.kind))).toBe(true);
        } else expect(t.partInfo[pick!.part].kinds).toContain(input.kind);
      })
    );
  });

  it("never picks the same test when another test has the type", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const pick = pickPracticePart(input);
        if (options(input).some((o) => o.t.id !== input.currentTestId)) expect(pick!.testId).not.toBe(input.currentTestId);
      })
    );
  });

  it("prefers a part the student hasn't done", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const pick = pickPracticePart(input);
        const others = options(input).filter((o) => o.t.id !== input.currentTestId);
        if (others.some((o) => !isDone(input.done, o.t.id, o.part ?? 0))) {
          expect(isDone(input.done, pick!.testId, pick!.part ?? 0)).toBe(false);
        }
      })
    );
  });

  it("is stable: the same input gives the same pick, the first eligible in catalog order", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const a = pickPracticePart(input);
        expect(pickPracticePart({ ...input, catalog: [...input.catalog], done: new Set(input.done) })).toEqual(a);
        const fresh = options(input).find((o) => o.t.id !== input.currentTestId && !isDone(input.done, o.t.id, o.part ?? 0));
        if (fresh) expect(a).toMatchObject({ testId: fresh.t.id, part: fresh.part });
      })
    );
  });
});

describe("mistakes by type", () => {
  const item = (n: number, kind: GradeItem["kind"], correct: boolean): GradeItem => ({ n, kind, correct, given: correct ? "x" : "", expected: "x", accepted: ["x"] });

  it("counts wrong and blank answers per type, most mistakes first, paper order on ties", () => {
    const items = [item(1, "matching", false), item(2, "matching", false), item(3, "tfng", false), item(4, "matching", true), item(5, "gap", true), item(6, "gap", false)];
    const rows = mistakesByKind(items, (it) => (it.kind === "matching" ? "matching-headings" : it.kind));
    expect(rows).toEqual([
      { kind: "matching-headings", wrong: 2, total: 3 },
      { kind: "tfng", wrong: 1, total: 1 },
      { kind: "gap", wrong: 1, total: 2 },
    ]);
    expect(mistakesByKind([item(1, "mcq", true)])).toEqual([]);
  });

  it("names matching tasks from their options and labels the practice link", () => {
    expect(practiceKindOf({ kind: "matching", options: [{ key: "i", text: "A" }, { key: "ii", text: "B" }] })).toBe("matching-headings");
    expect(practiceKindOf({ kind: "matching", options: [{ key: "A", text: "Paragraph A" }, { key: "B", text: "Paragraph B" }] })).toBe("matching-information");
    expect(practiceKindOf({ kind: "matching", options: [{ key: "A", text: "Tomas Reyer" }] })).toBe("matching");
    expect(practiceKindOf({ kind: "tfng" })).toBe("tfng");
    expect(practiseLabel("matching-headings")).toBe("Practise matching headings");
    expect(practiseLabel("tfng")).toBe("Practise True / False / Not Given");
  });
});
