/** The offline storage budget (lib/offline/storage-cap.ts, idea 7): 150 MB cap and the browser quota. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { OFFLINE_CAP_BYTES } from "@/lib/offline/constants";
import { checkSave, formatBytes, QUOTA_SHARE, totalBytes } from "@/lib/offline/storage-cap";

const MB = 1024 * 1024;

describe("checkSave", () => {
  it("allows a save up to the cap and refuses one past it", () => {
    expect(OFFLINE_CAP_BYTES).toBe(150 * MB);
    expect(checkSave({ usedBytes: 140 * MB, addBytes: 10 * MB })).toMatchObject({ ok: true, reason: null, afterBytes: 150 * MB });
    expect(checkSave({ usedBytes: 140 * MB, addBytes: 10 * MB + 1 })).toMatchObject({ ok: false, reason: "cap" });
  });

  it("counts a replaced copy of the same pack only once", () => {
    expect(checkSave({ usedBytes: 149 * MB, addBytes: 9 * MB, replacingBytes: 8 * MB }).ok).toBe(true);
  });

  it("refuses when the browser's quota would be over 90 % full", () => {
    expect(checkSave({ usedBytes: 0, addBytes: 5 * MB, quota: 50 * MB, usage: 41 * MB })).toMatchObject({ ok: false, reason: "quota" });
    expect(checkSave({ usedBytes: 0, addBytes: 5 * MB, quota: 50 * MB, usage: 30 * MB }).ok).toBe(true);
    expect(checkSave({ usedBytes: 0, addBytes: 5 * MB }).ok).toBe(true); // no estimate: the cap alone
  });

  it("treats bad numbers as zero", () => {
    expect(checkSave({ usedBytes: Number.NaN, addBytes: -5 }).afterBytes).toBe(0);
    expect(totalBytes([{ bytes: 10 }, { bytes: Number.NaN }, { bytes: -3 }, { bytes: 5 }])).toBe(15);
  });

  const bytes = fc.integer({ min: 0, max: 400 * MB });
  it("property: an allowed save never leaves the packs over the cap", () => {
    fc.assert(
      fc.property(bytes, bytes, fc.integer({ min: 0, max: 50 * MB }), (used, add, replacing) => {
        const r = checkSave({ usedBytes: used, addBytes: add, replacingBytes: Math.min(replacing, used) });
        return !r.ok || r.afterBytes <= OFFLINE_CAP_BYTES;
      }),
      { numRuns: 500 },
    );
  });

  it("property: an allowed save never fills the browser quota past 90 %", () => {
    fc.assert(
      fc.property(bytes, fc.integer({ min: 1, max: 2_000 * MB }), fc.integer({ min: 0, max: 2_000 * MB }), (add, quota, usage) => {
        const r = checkSave({ usedBytes: 0, addBytes: add, quota, usage });
        return !r.ok || usage + add <= quota * QUOTA_SHARE;
      }),
      { numRuns: 500 },
    );
  });

  it("property: a smaller pack is allowed whenever a bigger one is (monotonic)", () => {
    fc.assert(
      fc.property(bytes, bytes, bytes, (used, a, b) => {
        const [small, big] = a <= b ? [a, b] : [b, a];
        return !checkSave({ usedBytes: used, addBytes: big }).ok || checkSave({ usedBytes: used, addBytes: small }).ok;
      }),
      { numRuns: 300 },
    );
  });
});

describe("formatBytes", () => {
  it("reads like a phone's storage screen", () => {
    expect(formatBytes(0)).toBe("0 KB");
    expect(formatBytes(300)).toBe("1 KB");
    expect(formatBytes(640 * 1024)).toBe("640 KB");
    expect(formatBytes(4.24 * MB)).toBe("4.2 MB");
    expect(formatBytes(150 * MB)).toBe("150 MB");
  });
});
