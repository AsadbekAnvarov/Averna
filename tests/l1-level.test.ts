/** Who sees native-language hints: lib/l1/level.ts (docs/elegance-roadmap.md, idea 8). */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { levelWantsHints, parseLevel, shouldShowL1Hints, suggestL1 } from "@/lib/l1/level";
import { PREF_VALUES } from "@/lib/comfort/prefs";

describe("parseLevel", () => {
  it.each([
    ["A2", { cefr: "A2" }],
    ["b1", { cefr: "B1" }],
    ["B1+", { cefr: "B1" }],
    ["CEFR B2", { cefr: "B2" }],
    ["A2–B1", { cefr: "A2" }],
    ["Elementary", { cefr: "A2" }],
    ["Pre-Intermediate", { cefr: "A2" }],
    ["pre intermediate", { cefr: "A2" }],
    ["Intermediate", { cefr: "B1" }],
    ["Upper-Intermediate", { cefr: "B2" }],
    ["Advanced", { cefr: "C1" }],
    ["Beginner", { cefr: "A1" }],
    ["4.5", { band: 4.5 }],
    ["5", { band: 5 }],
    ["IELTS 5,5", { band: 5.5 }],
    ["Band 6.5", { band: 6.5 }],
  ])("%s → %o", (input, expected) => {
    expect(parseLevel(input)).toEqual(expected);
  });

  it.each(["", "   ", "unknown", "Group 12", "10", "lab1", "—", "x".repeat(200)])("junk %j → null", (input) => {
    expect(parseLevel(input)).toBeNull();
  });

  it("never throws and only returns a CEFR code or a 0–9 band", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)), (s) => {
        const p = parseLevel(s);
        if (p === null) return;
        if ("cefr" in p) expect(["A1", "A2", "B1", "B2", "C1", "C2"]).toContain(p.cefr);
        else expect(p.band >= 0 && p.band <= 9).toBe(true);
      })
    );
  });
});

describe("shouldShowL1Hints", () => {
  it("is off when no language is chosen, whatever the level", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PREF_VALUES.l1When), fc.option(fc.string()), (l1When, level) => {
        expect(shouldShowL1Hints({ l1: "off", l1When }, level)).toBe(false);
      })
    );
  });

  it("with Always, shows for every level", () => {
    fc.assert(
      fc.property(fc.constantFrom("uz", "ru" as const), fc.option(fc.string()), (l1, level) => {
        expect(shouldShowL1Hints({ l1, l1When: "always" }, level)).toBe(true);
      })
    );
  });

  it("at my level: A1–B1, band ≤ 5.0 and unknown levels show; B2+ and band > 5 do not", () => {
    const show = (level: string | null) => shouldShowL1Hints({ l1: "uz", l1When: "level" }, level);
    for (const l of ["A1", "A2", "B1", "Elementary", "Pre-Intermediate", "Intermediate", "4.5", "5", "5.0", null, "", "who knows"]) expect(show(l), String(l)).toBe(true);
    for (const l of ["B2", "C1", "C2", "Upper-Intermediate", "Advanced", "5.5", "6", "7.5"]) expect(show(l), l).toBe(false);
  });

  it("matches levelWantsHints for any band", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 18 }), (half) => {
        const band = half / 2;
        expect(shouldShowL1Hints({ l1: "ru", l1When: "level" }, String(band))).toBe(band <= 5);
        expect(levelWantsHints(String(band))).toBe(band <= 5);
      })
    );
  });
});

describe("suggestL1", () => {
  it.each([
    ["Uzbek", "uz"],
    ["oʻzbek", "uz"],
    ["O'zbek tili", "uz"],
    ["узбекский", "uz"],
    ["Russian", "ru"],
    ["русский", "ru"],
    ["ru", "ru"],
    ["English", null],
    ["", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(suggestL1(input)).toBe(expected);
  });
});
