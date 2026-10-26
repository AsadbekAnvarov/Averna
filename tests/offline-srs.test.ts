/**
 * Offline flashcard study (idea 7): a grade made on the device schedules the card exactly
 * like the server does for the same grade (lib/offline/study.ts vs lib/srs-sync.ts), replays
 * are ignored, and a stale grade loses to the server state.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { schedule, type Rating, type SrsCardState, type SrsMap } from "@/lib/srs";
import { decideReview, replayGrades, REVIEW_CLOCK_SKEW_MS, REVIEW_MAX_AGE_MS, type ExistingReview } from "@/lib/srs-sync";
import { dueSnapshot, gradeOffline, NEW_PER_SESSION, studyQueue } from "@/lib/offline/study";
import type { OfflineCard } from "@/lib/offline/packs";

const DAY = 86_400_000;
const NOW = Date.parse("2026-05-12T09:00:00Z");
const rating = fc.constantFrom<Rating>("again", "hard", "good", "easy");
const state: fc.Arbitrary<SrsCardState> = fc.record({
  ease: fc.double({ min: 1.3, max: 3.5, noNaN: true }),
  interval: fc.integer({ min: 0, max: 400 }),
  due: fc.integer({ min: NOW - 90 * DAY, max: NOW + 90 * DAY }),
  reps: fc.integer({ min: 0, max: 30 }),
  lapses: fc.integer({ min: 0, max: 20 }),
});
const card = (key: string): OfflineCard => ({ key, word: key, meaning: `${key} meaning`, example: `${key} example`, uz: key });

describe("offline grade = server grade", () => {
  it("property: for the same card state, rating and moment, the device and the server compute the same next state", () => {
    fc.assert(
      fc.property(fc.option(state, { nil: undefined }), rating, fc.integer({ min: 0, max: 30 * DAY }), fc.integer({ min: 1, max: 10 * DAY }), (prev, r, ago, since) => {
        const at = NOW - ago;
        const lastReviewedAt = at - since; // the card's last review came before this grade
        const offline = gradeOffline(prev ? { k: prev } : {}, "k", r, at).next;
        const decision = decideReview(prev ? { state: prev, lastReviewedAt } : null, r, at, NOW);
        return decision.status === "applied" && JSON.stringify(decision.next) === JSON.stringify(offline);
      }),
      { numRuns: 500 },
    );
  });

  it("property: a whole offline session replayed on the server ends where the device ended", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 3 }), rating, fc.integer({ min: 1, max: DAY })), { minLength: 1, maxLength: 25 }), (steps) => {
        let device: SrsMap = {};
        let at = NOW - 40 * DAY;
        const queued = steps.map(([c, r, gap], i) => {
          at += gap;
          const g = { itemKey: `c${c}`, rating: r, reviewedAt: at + i };
          device = gradeOffline(device, g.itemKey, r, g.reviewedAt).srs;
          return g;
        });
        const ledger = replayGrades({}, queued, NOW);
        const again = replayGrades(ledger, queued, NOW);
        const serverStates = Object.fromEntries(Object.entries(ledger).map(([k, v]) => [k, v.state]));
        return JSON.stringify(serverStates) === JSON.stringify(device) && JSON.stringify(again) === JSON.stringify(ledger);
      }),
      { numRuns: 300 },
    );
  });
});

describe("decideReview", () => {
  const existing = (lastReviewedAt: number): ExistingReview => ({ state: schedule(undefined, "good", lastReviewedAt), lastReviewedAt });

  it("ignores a duplicate (same moment) and lets the server win over an older grade", () => {
    expect(decideReview(existing(NOW - DAY), "easy", NOW - DAY, NOW).status).toBe("duplicate");
    expect(decideReview(existing(NOW - DAY), "again", NOW - 2 * DAY, NOW).status).toBe("stale");
    expect(decideReview(existing(NOW - 2 * DAY), "good", NOW - DAY, NOW).status).toBe("applied");
  });

  it("refuses moments from the future (beyond a small clock skew) or too long ago", () => {
    expect(decideReview(null, "good", NOW + REVIEW_CLOCK_SKEW_MS + 1, NOW).status).toBe("invalid");
    expect(decideReview(null, "good", NOW + REVIEW_CLOCK_SKEW_MS, NOW).status).toBe("applied");
    expect(decideReview(null, "good", NOW - REVIEW_MAX_AGE_MS - 1, NOW).status).toBe("invalid");
    expect(decideReview(null, "good", 1.5 + NOW, NOW).status).toBe("invalid");
  });

  it("schedules an online review (no moment) now, as before", () => {
    const d = decideReview(existing(NOW + DAY), "good", undefined, NOW);
    expect(d.status).toBe("applied");
    if (d.status === "applied") expect(d.at).toBe(NOW);
  });

  it("only counts a review as due when the card was due at the grade's moment", () => {
    const e = { state: { ease: 2.5, interval: 3, due: NOW - DAY, reps: 2, lapses: 0 }, lastReviewedAt: NOW - 4 * DAY };
    const early = decideReview(e, "good", NOW - 2 * DAY, NOW);
    const late = decideReview(e, "good", NOW - DAY / 2, NOW);
    expect(early.status === "applied" && early.wasDue).toBe(false);
    expect(late.status === "applied" && late.wasDue).toBe(true);
  });
});

describe("due snapshot and study queue", () => {
  const pool = Array.from({ length: 300 }, (_, i) => card(`w${i}`));

  it("takes due cards first (most overdue first), then up to 20 new ones, at most the cap", () => {
    const srs: SrsMap = {
      w5: { ease: 2.5, interval: 1, due: NOW - 3 * DAY, reps: 1, lapses: 0 },
      w9: { ease: 2.5, interval: 1, due: NOW - 5 * DAY, reps: 1, lapses: 0 },
      w1: { ease: 2.5, interval: 9, due: NOW + 5 * DAY, reps: 3, lapses: 0 },
    };
    const snap = dueSnapshot(pool, srs, NOW, 200);
    expect(snap.slice(0, 2).map((c) => c.key)).toEqual(["w9", "w5"]);
    expect(snap.filter((c) => !srs[c.key])).toHaveLength(NEW_PER_SESSION);
    expect(snap.some((c) => c.key === "w1")).toBe(false);
  });

  it("property: never more than the cap, never a card that isn't due, no duplicates", () => {
    fc.assert(
      fc.property(fc.dictionary(fc.constantFrom(...pool.slice(0, 260).map((c) => c.key)), state), fc.integer({ min: 0, max: 250 }), (srs, max) => {
        const snap = dueSnapshot([...pool, ...pool.slice(0, 10)], srs, NOW, max);
        const keys = snap.map((c) => c.key);
        return snap.length <= max && new Set(keys).size === keys.length && snap.every((c) => !srs[c.key] || srs[c.key].due <= NOW);
      }),
      { numRuns: 200 },
    );
  });

  it("study queue of a saved pack: due and new cards only", () => {
    const cards = [card("a"), card("b"), card("c")];
    const srs: SrsMap = { b: { ease: 2.5, interval: 3, due: NOW + DAY, reps: 2, lapses: 0 } };
    expect(studyQueue(cards, srs, NOW).map((c) => c.key)).toEqual(["a", "c"]);
  });
});
