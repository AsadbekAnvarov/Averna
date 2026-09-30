/**
 * Phone month view of the student / teacher calendars (B11, task 5.8).
 * **Validates: Requirements 2.16**
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildDayItems, daysInMonthOf, parseSelectedDay, type DayItem, type WeeklyItem } from "@/lib/calendar-days";

const label = fc.string({ minLength: 1, maxLength: 12 });
const weeklyItem: fc.Arbitrary<WeeklyItem> = fc.record({
  kind: fc.constantFrom("lesson" as const, "tutoring" as const),
  weekday: fc.integer({ min: 0, max: 6 }),
  label,
});

const sortItems = (xs: DayItem[]) => [...xs].sort((a, b) => (a.kind + a.label).localeCompare(b.kind + b.label));

describe("buildDayItems", () => {
  it("example: a Monday lesson, a Friday slot and one homework in March 2025", () => {
    const items = buildDayItems({
      year: 2025,
      month: 2, // March 2025: the 3rd is a Monday
      weekly: [
        { kind: "lesson", weekday: 1, label: "IELTS B2" },
        { kind: "tutoring", weekday: 5, label: "18:00–19:00" },
      ],
      homework: [
        { due: new Date(2025, 2, 3, 23, 59), label: "Essay 1" },
        { due: new Date(2025, 3, 3), label: "Next month" },
      ],
    });
    expect(Object.keys(items)).toHaveLength(31);
    expect(items[3]).toEqual([
      { kind: "lesson", label: "IELTS B2" },
      { kind: "homework", label: "Essay 1" },
    ]);
    expect(items[7]).toEqual([{ kind: "tutoring", label: "18:00–19:00" }]);
    expect(items[4]).toEqual([]);
  });

  it("property: day d lists exactly the weekly items of its weekday and the homework due that day", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1990, max: 2100 }),
        fc.integer({ min: 0, max: 11 }),
        fc.array(weeklyItem, { maxLength: 12 }),
        fc.array(
          fc.record({
            // within the month and a little around it (other months must be ignored)
            offset: fc.integer({ min: -5, max: 36 }),
            hour: fc.integer({ min: 0, max: 23 }),
            label,
          }),
          { maxLength: 15 }
        ),
        (year, month, weekly, hw) => {
          const homework = hw.map((h) => ({ due: new Date(year, month, h.offset, h.hour), label: h.label }));
          const items = buildDayItems({ year, month, weekly, homework });
          const days = daysInMonthOf(year, month);
          expect(Object.keys(items).map(Number).sort((a, b) => a - b)).toEqual(
            Array.from({ length: days }, (_, i) => i + 1)
          );
          for (let d = 1; d <= days; d++) {
            const wd = new Date(year, month, d).getDay();
            const expected: DayItem[] = [
              ...weekly.filter((w) => w.weekday === wd).map((w) => ({ kind: w.kind, label: w.label })),
              ...homework
                .filter((h) => h.due.getFullYear() === year && h.due.getMonth() === month && h.due.getDate() === d)
                .map((h) => ({ kind: "homework" as const, label: h.label })),
            ];
            expect(sortItems(items[d])).toEqual(sortItems(expected));
          }
        }
      ),
      { numRuns: 150 }
    );
  });
});

describe("parseSelectedDay", () => {
  it("examples", () => {
    expect(parseSelectedDay("12", 31, 5)).toBe(12);
    expect(parseSelectedDay(undefined, 31, 5)).toBe(5);
    expect(parseSelectedDay(undefined, 30, -1)).toBe(1);
    expect(parseSelectedDay("31", 28, -1)).toBe(28);
    expect(parseSelectedDay("0", 28, 10)).toBe(1);
    expect(parseSelectedDay("abc", 30, 10)).toBe(10);
    expect(parseSelectedDay("-3", 30, -1)).toBe(1);
  });

  it("property: always a day of the month, for any input", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.integer({ min: -100, max: 1000 }).map(String),
          fc.string({ maxLength: 8 }),
          fc.array(fc.string({ maxLength: 4 }), { maxLength: 3 })
        ),
        fc.constantFrom(28, 29, 30, 31),
        fc.integer({ min: -1, max: 40 }),
        (d, daysInMonth, todayDay) => {
          const day = parseSelectedDay(d, daysInMonth, todayDay);
          expect(Number.isInteger(day)).toBe(true);
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(daysInMonth);
          const raw = Array.isArray(d) ? d[0] : d;
          if (raw !== undefined && /^\d+$/.test(raw.trim())) {
            expect(day).toBe(Math.min(daysInMonth, Math.max(1, Number.parseInt(raw, 10))));
          }
        }
      ),
      { numRuns: 300 }
    );
  });
});
