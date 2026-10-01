/**
 * Study-activity heatmap (lib/dashboard/heatmap.ts): Tashkent days, Monday–Sunday columns.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildHeatmap, heatLevel, heatmapRange, HEATMAP_WEEKS } from "@/lib/dashboard/heatmap";
import { tashkentDateKey, tashkentWeekday } from "@/lib/utils";

const DAY = 86_400_000;

const dateArb = fc.date({
  min: new Date("2000-01-01T00:00:00Z"),
  max: new Date("2100-01-01T00:00:00Z"),
  noInvalidDate: true,
});

/** `now` plus activity times around it: some before `from`, some after `now`. */
const inputArb = dateArb.chain((now) =>
  fc
    .array(fc.integer({ min: -100 * DAY, max: 10 * DAY }), { maxLength: 60 })
    .map((offsets) => ({ now, times: offsets.map((o) => new Date(now.getTime() + o)) })),
);

const keyMs = (key: string) => new Date(`${key}T00:00:00+05:00`).getTime();

describe("buildHeatmap", () => {
  it("12 Monday-first columns of 7 consecutive Tashkent days, one `today`, future cells empty", () => {
    fc.assert(
      fc.property(inputArb, ({ now, times }) => {
        const { weeks } = buildHeatmap(times, now);
        expect(weeks).toHaveLength(HEATMAP_WEEKS);
        for (const week of weeks) {
          expect(week).toHaveLength(7);
          expect(tashkentWeekday(new Date(keyMs(week[0].key)))).toBe(1);
        }

        const cells = weeks.flat();
        for (let i = 1; i < cells.length; i++) {
          expect(keyMs(cells[i].key) - keyMs(cells[i - 1].key)).toBe(DAY);
        }

        const todayIdx = cells.findIndex((c) => c.today);
        expect(cells.filter((c) => c.today)).toHaveLength(1);
        expect(cells[todayIdx].key).toBe(tashkentDateKey(now));
        cells.forEach((c, i) => {
          expect(c.future).toBe(i > todayIdx);
          if (c.future) expect(c.count).toBe(0);
        });
      }),
      { numRuns: 200 },
    );
  }, 20_000);

  it("counts every time within [from, now] exactly once", () => {
    fc.assert(
      fc.property(inputArb, ({ now, times }) => {
        const { from } = heatmapRange(now);
        const { weeks, activeDays, total } = buildHeatmap(times, now);
        const cells = weeks.flat();
        const inRange = times.filter((t) => t.getTime() >= from.getTime() && t.getTime() <= now.getTime());
        expect(total).toBe(inRange.length);
        expect(cells.reduce((s, c) => s + c.count, 0)).toBe(total);
        expect(activeDays).toBe(cells.filter((c) => c.count > 0).length);
        for (const c of cells) expect(c.level).toBe(heatLevel(c.count));
      }),
      { numRuns: 200 },
    );
  }, 20_000);

  it("example: 01:30 on Monday in Tashkent (still Sunday in UTC) is counted on Monday", () => {
    const now = new Date("2026-10-06T07:00:00Z");
    const { weeks, total } = buildHeatmap([new Date("2026-10-04T20:30:00Z")], now);
    const cells = weeks.flat();
    expect(total).toBe(1);
    expect(cells.find((c) => c.key === "2026-10-05")?.count).toBe(1);
    expect(cells.find((c) => c.key === "2026-10-04")?.count).toBe(0);
    // Monday 5 Oct starts the last column.
    expect(weeks[HEATMAP_WEEKS - 1][0].key).toBe("2026-10-05");
  });

  it("range: `from` is the Monday 11 weeks before this week's Monday", () => {
    const { from, weekStarts } = heatmapRange(new Date("2026-10-06T07:00:00Z"));
    expect(from.getTime()).toBe(new Date("2026-07-20T00:00:00+05:00").getTime());
    expect(weekStarts).toHaveLength(HEATMAP_WEEKS);
    expect(weekStarts[HEATMAP_WEEKS - 1].getTime()).toBe(new Date("2026-10-05T00:00:00+05:00").getTime());
  });
});

describe("heatLevel", () => {
  it("boundaries", () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(-3)).toBe(0);
    expect(heatLevel(Number.NaN)).toBe(0);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(2)).toBe(2);
    expect(heatLevel(3)).toBe(2);
    expect(heatLevel(4)).toBe(3);
    expect(heatLevel(100)).toBe(3);
  });
});
