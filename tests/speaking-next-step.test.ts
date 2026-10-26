/** "Your next step" and the feedback presets (docs/peer-speaking.md, Phase C). */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CRITERIA, STRENGTHS, TIPS, checkNote, hasContactInfo, packTip, unpackTip, type Ratings } from "@/lib/speaking/feedback-presets";
import { averageRatings, nextStepFor, ratingTrend } from "@/lib/speaking/next-step";

const r = (fluency: number, lexical: number, grammar: number, pronunciation: number): Ratings => ({ fluency, lexical, grammar, pronunciation });

describe("nextStepFor", () => {
  it("picks the weakest criterion and links an existing page", () => {
    expect(nextStepFor(r(4, 4, 2, 5))).toMatchObject({ criterion: "grammar", href: "/grammar" });
    expect(nextStepFor(r(4, 2, 3, 5))).toMatchObject({ criterion: "lexical", href: "/flashcards" });
    expect(nextStepFor(r(5, 4, 4, 3))).toMatchObject({ criterion: "pronunciation", href: "/learning/pronunciation" });
    expect(nextStepFor(r(2, 4, 4, 4))).toMatchObject({ criterion: "fluency", href: "/learning/speaking/solo" });
    for (const href of ["/grammar", "/flashcards", "/learning/pronunciation", "/learning/speaking/solo"]) {
      expect(existsSync(join(process.cwd(), "app", ...href.split("/").filter(Boolean), "page.tsx"))).toBe(true);
    }
  });

  it("breaks ties in IELTS order and returns null without data", () => {
    expect(nextStepFor(r(3, 3, 3, 3))?.criterion).toBe("fluency");
    expect(nextStepFor(r(4, 3, 3, 4))?.criterion).toBe("lexical");
    expect(nextStepFor(null)).toBeNull();
    expect(nextStepFor(null, { words: 10, wpm: 50, fillers: 5 })).toBeNull(); // too few words to judge
  });

  it("uses own caption stats: many fillers or a slow pace point to fluency", () => {
    const own = { words: 200, wpm: 130, fillers: 20 };
    const step = nextStepFor(r(4, 3.5, 4, 4), own)!;
    expect(step.criterion).toBe("fluency");
    expect(step.text).toContain("20 fillers in 200 words");
    expect(nextStepFor(null, { words: 120, wpm: 80, fillers: 1 })).toMatchObject({ criterion: "fluency" });
    expect(nextStepFor(null, { words: 120, wpm: 80, fillers: 1 })!.text).toContain("80 words a minute");
    expect(nextStepFor(r(4, 3, 4, 4), { words: 200, wpm: 140, fillers: 2 })!.criterion).toBe("lexical");
  });

  /** **Validates: Requirements Phase C §1 — next step is always the (adjusted) weakest criterion** */
  it("always returns a criterion with the lowest score (property)", () => {
    const rating = fc.integer({ min: 1, max: 5 });
    fc.assert(
      fc.property(rating, rating, rating, rating, (a, b, c, d) => {
        const rr = r(a, b, c, d);
        const step = nextStepFor(rr)!;
        expect(rr[step.criterion]).toBe(Math.min(a, b, c, d));
      }),
    );
  });

  it("averages and trends ratings", () => {
    expect(averageRatings([r(4, 2, 3, 5), r(2, 4, 3, 5)])).toEqual(r(3, 3, 3, 5));
    expect(averageRatings([])).toBeNull();
    const trend = ratingTrend([r(5, 3, 3, 2), r(5, 3, 3, 2), r(3, 3, 3, 4), r(3, 3, 3, 4)])!;
    expect(trend).toEqual({ fluency: "up", lexical: "flat", grammar: "flat", pronunciation: "down" });
    expect(ratingTrend([r(1, 1, 1, 1)])).toBeNull();
  });
});

describe("feedback presets", () => {
  it("has ~8 strengths and ~10 tips covering all four criteria", () => {
    expect(STRENGTHS).toHaveLength(8);
    expect(TIPS).toHaveLength(10);
    for (const c of CRITERIA) {
      expect(STRENGTHS.some((s) => s.criterion === c)).toBe(true);
      expect(TIPS.some((t) => t.criterion === c)).toBe(true);
    }
    expect(new Set([...STRENGTHS, ...TIPS].map((p) => p.id)).size).toBe(18);
  });

  it("rejects links, e-mails, handles and phone numbers in the note", () => {
    for (const bad of ["see https://x.io", "www.site.com", "write me at bek@mail.uz", "my insta @bek_2009", "call +998 90 123 45 67", "t.me/bek", "averna.uz"]) {
      expect(hasContactInfo(bad)).toBe(true);
      expect(checkNote(bad).ok).toBe(false);
    }
    for (const ok of ["Great examples about your hometown!", "You spoke for 2 minutes in Part 2", "Try 3 linking words"]) {
      expect(checkNote(ok)).toEqual({ ok: true, note: ok });
    }
    expect(checkNote("  spaced   out  ")).toEqual({ ok: true, note: "spaced out" });
    expect(checkNote("x".repeat(141)).ok).toBe(false);
    expect(checkNote("")).toEqual({ ok: true, note: null });
  });

  it("packs a tip id and a note into the tip column and back", () => {
    expect(unpackTip(packTip("slow-down", "Nice!"))).toEqual({ tipId: "slow-down", note: "Nice!" });
    expect(unpackTip(packTip(null, "Only a note | with a bar"))).toEqual({ tipId: null, note: "Only a note | with a bar" });
    expect(unpackTip(packTip("articles", null))).toEqual({ tipId: "articles", note: null });
    expect(packTip(null, null)).toBeNull();
  });
});
