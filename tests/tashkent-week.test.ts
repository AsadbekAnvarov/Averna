/**
 * tashkentWeekStart: Monday 00:00 (Tashkent, UTC+5, no DST) of the week containing a moment.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { tashkentDayStart, tashkentWeekStart, tashkentWeekday } from "@/lib/utils";

const WEEK = 7 * 86_400_000;

const dateArb = fc.date({
  min: new Date("2000-01-01T00:00:00Z"),
  max: new Date("2100-01-01T00:00:00Z"),
  noInvalidDate: true,
});

describe("tashkentWeekStart", () => {
  it("is a Tashkent Monday midnight at most 7 days before `now`, and idempotent", () => {
    fc.assert(
      fc.property(dateArb, (now) => {
        const start = tashkentWeekStart(now);
        expect(start.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(now.getTime() - start.getTime()).toBeLessThan(WEEK);
        expect(tashkentWeekday(start)).toBe(1);
        expect(tashkentDayStart(start).getTime()).toBe(start.getTime());
        expect(tashkentWeekStart(start).getTime()).toBe(start.getTime());
      }),
      { numRuns: 200 },
    );
  });

  it("example: Sunday 23:00 Tashkent belongs to the week that started the previous Monday", () => {
    // 2026-10-04T18:00Z = Sunday 23:00 in Tashkent.
    expect(tashkentWeekStart(new Date("2026-10-04T18:00:00Z")).getTime()).toBe(
      new Date("2026-09-28T00:00:00+05:00").getTime(),
    );
  });

  it("example: Monday 00:30 Tashkent (still Sunday in UTC) starts a new week", () => {
    // 2026-10-04T19:30Z = Monday 00:30 in Tashkent.
    expect(tashkentWeekStart(new Date("2026-10-04T19:30:00Z")).getTime()).toBe(
      new Date("2026-10-05T00:00:00+05:00").getTime(),
    );
  });
});
