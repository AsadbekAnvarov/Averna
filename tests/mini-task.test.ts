/** One-button mini task: mistakes by type and the pure builder (docs/elegance-roadmap.md, idea 10). */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { kindStats, parseItems, refineKind, type AttemptItems } from "@/lib/teacher/kind-stats";
import { buildMiniTask, miniTaskMinutes, type MiniCatalogEntry, type MiniTaskInput } from "@/lib/teacher/mini-task";
import { partKey } from "@/lib/review/practice-by-type";
import type { PracticeKind } from "@/lib/ielts/types";

const reading = (id: string, kinds: PracticeKind[][], extra: Partial<MiniCatalogEntry> = {}): MiniCatalogEntry => ({
  id,
  skill: "READING",
  title: `Reading ${id}`,
  questions: kinds.length * 13,
  timeLimit: 60,
  parts: kinds.length,
  partInfo: kinds.map((k, i) => ({ title: `Passage ${i + 1}`, from: i * 13 + 1, to: i * 13 + 13, kinds: k })),
  ...extra,
});
const listening = (id: string, kinds: PracticeKind[][], extra: Partial<MiniCatalogEntry> = {}): MiniCatalogEntry => ({
  id,
  skill: "LISTENING",
  title: `Listening ${id}`,
  questions: kinds.length * 10,
  timeLimit: 32,
  parts: kinds.length,
  partInfo: kinds.map((k, i) => ({ title: `Part ${i + 1}`, from: i * 10 + 1, to: i * 10 + 10, kinds: k })),
  ...extra,
});

const headingsStat = { skill: "READING" as const, kind: "matching-headings" as const, label: "Matching headings", wrong: 4, of: 5 };
const base = (over: Partial<MiniTaskInput> = {}): MiniTaskInput => ({
  stats: [headingsStat],
  fallbackSkill: null,
  catalog: {
    READING: [reading("r1", [["matching-headings", "tfng"], ["mcq"], ["gap"]]), reading("r2", [["gap"], ["matching-headings"], ["ynng"]])],
    LISTENING: [listening("l1", [["gap"], ["mcq"], ["matching"], ["gap"]])],
  },
  done: { READING: new Set(), LISTENING: new Set() },
  todayKey: "2026-10-26",
  ...over,
});

describe("kindStats", () => {
  it("counts the last 5 questions of each type, newest attempts first, and splits matching by the paper", () => {
    const lookup = () => ({ partInfo: [{ title: "P1", from: 1, to: 13, kinds: ["matching-headings", "tfng"] as PracticeKind[] }] });
    const newest: AttemptItems = {
      skill: "READING",
      examId: "r1",
      items: [1, 2, 3, 4].map((n) => ({ n, kind: "matching", correct: n === 1 })),
    };
    const older: AttemptItems = { skill: "READING", examId: "r1", items: [1, 2, 3].map((n) => ({ n, kind: "matching", correct: false })) };
    const stats = kindStats([newest, older], lookup);
    // 4 newest (3 wrong) + 1 of the older (wrong) = 4 of 5.
    expect(stats[0]).toEqual({ skill: "READING", kind: "matching-headings", label: "Matching headings", wrong: 4, of: 5 });
    expect(refineKind("matching", 20, lookup())).toBe("matching");
    expect(refineKind("nope", 1, null)).toBeNull();
  });

  it("reads the SQL projection of graded items", () => {
    expect(parseItems([[3, "tfng", false], [4, "gap", true], ["x", "gap", true], { n: 5, kind: "mcq", correct: true }])).toEqual([
      { n: 3, kind: "tfng", correct: false },
      { n: 4, kind: "gap", correct: true },
      { n: 5, kind: "mcq", correct: true },
    ]);
    expect(parseItems(null)).toEqual([]);
  });
});

describe("buildMiniTask", () => {
  it("targets the weakest type with one unseen part, due tomorrow at 20:00", () => {
    const t = buildMiniTask(base())!;
    expect(t).toMatchObject({
      skill: "READING",
      contentKind: "READING",
      contentId: "r1",
      contentPart: 0,
      kind: "matching-headings",
      title: "Mini task: Matching headings",
      reason: "Matching headings: 4 of the last 5 wrong",
      fresh: true,
      minutes: 20,
      questions: 13,
      dueDate: "2026-10-27T20:00",
    });
    expect(t.summary).toBe("Matching headings · 1 part · ~20 min · due tomorrow");
  });

  it("skips a part the student already did when another part has the type", () => {
    const t = buildMiniTask(base({ done: { READING: new Set([partKey("r1", 0)]), LISTENING: new Set() } }))!;
    expect([t.contentId, t.contentPart, t.fresh]).toEqual(["r2", 1, true]);
  });

  it("falls back gracefully: no mistakes → a fresh part of the weaker skill; empty catalog → null", () => {
    const t = buildMiniTask(base({ stats: [], fallbackSkill: "LISTENING" }))!;
    expect(t).toMatchObject({ skill: "LISTENING", contentId: "l1", contentPart: 0, kind: null, title: "Mini task: Listening" });
    expect(t.reason).toBe("Listening is the weaker skill right now");
    expect(t.minutes).toBe(miniTaskMinutes(base().catalog.LISTENING[0], 0));
    expect(buildMiniTask(base({ stats: [], catalog: { READING: [], LISTENING: [] } }))).toBeNull();
  });

  it("estimates minutes from the paper: a Reading passage 20, a Listening part ~8, a whole recording its length", () => {
    const l = listening("l2", [["gap"], ["mcq"], ["gap"], ["mcq"]], { timeLimit: 30 });
    expect(miniTaskMinutes(l, 1)).toBe(8);
    expect(miniTaskMinutes(reading("r9", [["tfng"], ["gap"], ["mcq"]]), 2)).toBe(20);
    expect(miniTaskMinutes({ ...l, recordingMode: "whole" }, null)).toBe(30);
  });

  // ---- properties ----
  const KINDS: PracticeKind[] = ["tfng", "ynng", "mcq", "gap", "matching-headings", "matching-information"];
  const catalogArb = fc.array(fc.array(fc.subarray(KINDS, { minLength: 1 }), { minLength: 1, maxLength: 4 }), { maxLength: 5 }).map((papers) =>
    papers.map((kinds, i) => reading(`p${i}`, kinds))
  );
  const inputArb = fc
    .record({
      catalog: catalogArb,
      kind: fc.constantFrom(...KINDS),
      wrong: fc.integer({ min: 1, max: 5 }),
      doneMask: fc.array(fc.boolean(), { minLength: 20, maxLength: 20 }),
    })
    .map(({ catalog, kind, wrong, doneMask }) => {
      const done = new Set<string>();
      let k = 0;
      for (const p of catalog) p.partInfo.forEach((_, i) => doneMask[k++ % 20] && done.add(partKey(p.id, i)));
      return base({
        stats: [{ skill: "READING", kind, label: kind, wrong, of: 5 }],
        catalog: { READING: catalog, LISTENING: [] },
        done: { READING: done, LISTENING: new Set() },
      });
    });

  it("is deterministic for the same input", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        expect(buildMiniTask(input)).toEqual(buildMiniTask(input));
      })
    );
  });

  it("never picks a part already done while an unseen part with the type exists", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const kind = input.stats[0].kind;
        const freshExists = input.catalog.READING.some((p) => p.partInfo.some((info, i) => info.kinds?.includes(kind) && !input.done.READING.has(partKey(p.id, i))));
        const t = buildMiniTask(input);
        if (freshExists) {
          expect(t).not.toBeNull();
          expect(t!.fresh).toBe(true);
          expect(t!.kind).toBe(kind);
          expect(input.done.READING.has(partKey(t!.contentId, t!.contentPart ?? 0))).toBe(false);
        }
        // A task always names a real part of a real paper, with a positive length.
        if (t) {
          const paper = input.catalog.READING.find((p) => p.id === t.contentId)!;
          expect(paper).toBeTruthy();
          expect(t.minutes).toBeGreaterThan(0);
          if (t.contentPart != null) expect(t.contentPart).toBeLessThan(paper.partInfo.length);
        } else {
          expect(input.catalog.READING.length).toBe(0);
        }
      })
    );
  });
});
