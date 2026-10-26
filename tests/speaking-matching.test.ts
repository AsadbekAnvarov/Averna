import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  FRESH_MS,
  GAP_STEP_MS,
  PEER_FORMATS,
  allowedGap,
  isBlocked,
  pickPartner,
  recentPartnersOf,
  type MatchContext,
  type WaitingEntry,
} from "@/lib/speaking/matching";
import { cefrForBand, parseLevelText, resolvePeerLevel } from "@/lib/speaking/level";

const NOW = 10_000_000;
const band = fc.integer({ min: 6, max: 18 }).map((n) => n / 2); // 3.0 … 9.0
const ids = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

const entryArb = (studentId: fc.Arbitrary<string>) =>
  fc.record({
    studentId,
    groupId: fc.constantFrom<string | null>("g1", "g2", null),
    level: band,
    format: fc.constantFrom(...PEER_FORMATS),
    waitMs: fc.integer({ min: 0, max: 300_000 }),
    seenAgoMs: fc.integer({ min: 0, max: 40_000 }),
  });

const toEntry = (e: { studentId: string; groupId: string | null; level: number; format: WaitingEntry["format"]; waitMs: number; seenAgoMs: number }, i: number): WaitingEntry => ({
  id: `q-${e.studentId}-${i}`,
  studentId: e.studentId,
  groupId: e.groupId,
  level: e.level,
  format: e.format,
  joinedAt: NOW - e.waitMs,
  lastSeenAt: NOW - Math.min(e.seenAgoMs, e.waitMs),
});

const scenario = fc
  .record({
    me: entryArb(fc.constant("me")),
    others: fc.array(entryArb(fc.constantFrom(...ids, "me")), { maxLength: 10 }),
    blocks: fc.array(fc.record({ blockerId: fc.constantFrom("me", ...ids), blockedId: fc.constantFrom("me", ...ids) }), { maxLength: 4 }),
    recent: fc.subarray(ids, { maxLength: 3 }),
  })
  .map(({ me, others, blocks, recent }) => ({
    me: { ...toEntry(me, 0), lastSeenAt: NOW },
    candidates: others.map((o, i) => toEntry(o, i + 1)),
    ctx: { blocks, recentPartners: { me: recent } } as MatchContext,
  }));

describe("pickPartner (property)", () => {
  /** **Validates: Requirements design §3 — never self, blocked, stale or another format; always inside the allowed gap** */
  it("never picks self, a blocked pair, a stale entry or another format", () => {
    fc.assert(
      fc.property(scenario, ({ me, candidates, ctx }) => {
        const p = pickPartner(me, candidates, ctx, NOW);
        if (!p) return;
        expect(p.studentId).not.toBe(me.studentId);
        expect(isBlocked(ctx, me.studentId, p.studentId)).toBe(false);
        expect(NOW - p.lastSeenAt).toBeLessThanOrEqual(FRESH_MS);
        expect(p.format).toBe(me.format);
        expect(Math.abs(p.level - me.level)).toBeLessThanOrEqual(allowedGap(me, p, NOW));
      }),
    );
  });

  /** **Validates: Requirements design §3 — the allowed gap widens with the older waiter's wait** */
  it("widens the level gap as the older of the two waits", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 600_000 }), fc.integer({ min: 0, max: 600_000 }), fc.integer({ min: 0, max: 600_000 }), (a, b, extra) => {
        const x = { joinedAt: NOW - a };
        const y = { joinedAt: NOW - b };
        expect(allowedGap(x, y, NOW)).toBe(allowedGap(y, x, NOW));
        expect(allowedGap(x, y, NOW + extra)).toBeGreaterThanOrEqual(allowedGap(x, y, NOW));
        expect(allowedGap(x, y, NOW)).toBe(0.5 + 0.5 * Math.floor(Math.max(a, b) / GAP_STEP_MS));
      }),
    );
  });

  /** **Validates: Requirements design §3 — recent partners only when no one else qualifies** */
  it("avoids recent partners whenever another eligible partner exists", () => {
    fc.assert(
      fc.property(scenario, ({ me, candidates, ctx }) => {
        const p = pickPartner(me, candidates, ctx, NOW);
        if (!p || !ctx.recentPartners.me.includes(p.studentId)) return;
        // A recent partner was chosen, so every non-recent candidate must be ineligible.
        const others = candidates.filter((c) => !ctx.recentPartners.me.includes(c.studentId));
        expect(pickPartner(me, others, ctx, NOW)).toBeNull();
      }),
    );
  });

  /** **Validates: Requirements design §3 — deterministic regardless of candidate order** */
  it("is deterministic: the order of candidates does not matter", () => {
    fc.assert(
      fc.property(scenario, fc.integer(), ({ me, candidates, ctx }, seed) => {
        const shuffled = [...candidates].sort((a, b) => ((a.id.charCodeAt(a.id.length - 1) * seed) % 7) - ((b.id.charCodeAt(b.id.length - 1) * seed) % 7));
        expect(pickPartner(me, shuffled, ctx, NOW)?.id ?? null).toBe(pickPartner(me, candidates, ctx, NOW)?.id ?? null);
        expect(pickPartner(me, [...candidates].reverse(), ctx, NOW)?.id ?? null).toBe(pickPartner(me, candidates, ctx, NOW)?.id ?? null);
      }),
    );
  });

  /** **Validates: Requirements design §3 — among equals the oldest waiter is served first** */
  it("serves the oldest waiter first among otherwise equal candidates", () => {
    fc.assert(
      fc.property(band, fc.array(fc.integer({ min: 0, max: 15_000 }), { minLength: 2, maxLength: 6 }), fc.constantFrom<string | null>("g1", "g2", null), (level, waits, groupId) => {
        const me: WaitingEntry = { id: "q-me", studentId: "me", groupId: "g0", level, format: "quick", joinedAt: NOW, lastSeenAt: NOW };
        const cands: WaitingEntry[] = waits.map((w, i) => ({ id: `q${i}`, studentId: `s${i}`, groupId, level, format: "quick", joinedAt: NOW - w, lastSeenAt: NOW }));
        const p = pickPartner(me, cands, { blocks: [], recentPartners: {} }, NOW)!;
        const oldest = Math.min(...cands.map((c) => c.joinedAt));
        expect(p.joinedAt).toBe(oldest);
        expect(p.id).toBe(cands.filter((c) => c.joinedAt === oldest).map((c) => c.id).sort()[0]);
      }),
    );
  });
});

describe("pickPartner (examples)", () => {
  const base: WaitingEntry = { id: "q-me", studentId: "me", groupId: "g1", level: 6, format: "exam", joinedAt: NOW, lastSeenAt: NOW };
  const c = (id: string, over: Partial<WaitingEntry>): WaitingEntry => ({ ...base, id: `q-${id}`, studentId: id, ...over });
  const none: MatchContext = { blocks: [], recentPartners: {} };

  it("prefers the closest level, then a different group", () => {
    const p = pickPartner(base, [c("far", { level: 6.5 }), c("same", { level: 6 }), c("other-group", { level: 6, groupId: "g2" })], none, NOW);
    expect(p?.studentId).toBe("other-group");
  });

  it("waits for a wider gap instead of matching a far level at once", () => {
    const far = c("far", { level: 7.5, joinedAt: NOW });
    expect(pickPartner(base, [far], none, NOW)).toBeNull();
    // 40 s later the older waiter has widened the search to 1.5 bands.
    const later = NOW + 40_000;
    expect(pickPartner({ ...base, lastSeenAt: later }, [{ ...far, lastSeenAt: later }], none, later)?.studentId).toBe("far");
  });

  it("honours blocks in both directions and falls back to a recent partner", () => {
    expect(pickPartner(base, [c("x", {})], { blocks: [{ blockerId: "x", blockedId: "me" }], recentPartners: {} }, NOW)).toBeNull();
    expect(pickPartner(base, [c("x", {})], { blocks: [], recentPartners: { x: ["me"] } }, NOW)?.studentId).toBe("x");
    expect(pickPartner(base, [c("x", {}), c("y", { level: 6.5 })], { blocks: [], recentPartners: { me: ["x"] } }, NOW)?.studentId).toBe("y");
  });

  it("lists the last three partners, newest first", () => {
    const rooms = [
      { studentAId: "me", studentBId: "a" },
      { studentAId: "b", studentBId: "me" },
      { studentAId: "x", studentBId: "y" },
      { studentAId: "me", studentBId: "c" },
      { studentAId: "me", studentBId: "d" },
    ];
    expect(recentPartnersOf("me", rooms)).toEqual(["a", "b", "c"]);
  });
});

describe("peer level", () => {
  it("uses the best available source and clamps to 3.0–9.0 in half bands", () => {
    expect(resolvePeerLevel({ speakingBand: 6.3, placementBand: 5, levelText: "C1" })).toEqual({ band: 6.5, cefr: "B2", source: "speaking-test" });
    expect(resolvePeerLevel({ placementBand: 4.5, levelText: "C1" })).toMatchObject({ band: 4.5, source: "placement" });
    expect(resolvePeerLevel({ levelText: "Oʻrta (B1)" })).toMatchObject({ band: 4.5, cefr: "B1", source: "profile" });
    expect(resolvePeerLevel({ levelText: "IELTS 7.0" })).toMatchObject({ band: 7, source: "profile" });
    expect(resolvePeerLevel({ targetBand: "7.0" })).toMatchObject({ band: 6, source: "target" });
    expect(resolvePeerLevel({ levelText: "Beginner", targetBand: null })).toMatchObject({ band: 5, source: "default" });
    expect(resolvePeerLevel({ speakingBand: 1 })).toMatchObject({ band: 3 });
    expect(parseLevelText("")).toBeNull();
    expect(cefrForBand(5.5)).toBe("B2");
  });
});
