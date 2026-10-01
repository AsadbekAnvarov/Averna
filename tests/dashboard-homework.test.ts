/**
 * Student dashboard homework: overdue / upcoming counts and display order.
 * Property tests (fast-check) plus a few examples.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_OVERDUE_DAYS,
  homeworkCounts,
  orderDashboardHomework,
  overdueWindowStart,
} from "@/lib/dashboard/homework";

const DAY = 86_400_000;
const NUM_RUNS = 200;

type Row = { id: number; dueDate: Date | string };

const nowArb = fc.date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2030-01-01T00:00:00Z"), noInvalidDate: true });

/** Offset (ms) of a deadline from `now`: wide range, coarse days (to force equal dues) and the window edges. */
const offsetArb = fc.oneof(
  fc.integer({ min: -45 * DAY, max: 45 * DAY }),
  fc.integer({ min: -35, max: 5 }).map((d) => d * DAY),
  fc.constantFrom(-DASHBOARD_OVERDUE_DAYS * DAY, -DASHBOARD_OVERDUE_DAYS * DAY - 1, -1, 0, 1),
);

/** A due date: a Date, an ISO string, or an unparsable string. */
const dueSpecArb = fc.oneof(
  { weight: 4, arbitrary: offsetArb.map((o) => ({ kind: "date" as const, o })) },
  { weight: 2, arbitrary: offsetArb.map((o) => ({ kind: "iso" as const, o })) },
  { weight: 1, arbitrary: fc.constantFrom("not a date", "", "2024-13-45").map((s) => ({ kind: "bad" as const, s })) },
);

const toRows = (now: Date, specs: Array<{ kind: "date" | "iso"; o: number } | { kind: "bad"; s: string }>): Row[] =>
  specs.map((spec, id) => {
    if (spec.kind === "bad") return { id, dueDate: spec.s };
    const d = new Date(now.getTime() + spec.o);
    return { id, dueDate: spec.kind === "date" ? d : d.toISOString() };
  });

const dueMs = (r: Row) => new Date(r.dueDate).getTime();

const scenario = fc
  .tuple(nowArb, fc.array(dueSpecArb, { maxLength: 30 }))
  .map(([now, specs]) => ({ now, rows: toRows(now, specs) }));

describe("homeworkCounts", () => {
  it("overdue + upcoming equals the number of rows inside the window; overdue iff fromMs <= due < now", () => {
    fc.assert(
      fc.property(scenario, ({ now, rows }) => {
        const fromMs = overdueWindowStart(now).getTime();
        const nowMs = now.getTime();
        const valid = rows.map(dueMs).filter((d) => !Number.isNaN(d));
        const inWindow = valid.filter((d) => d >= fromMs);
        const { overdue, upcoming } = homeworkCounts(rows, now);
        expect(overdue + upcoming).toBe(inWindow.length);
        expect(overdue).toBe(inWindow.filter((d) => d < nowMs).length);
        expect(upcoming).toBe(inWindow.filter((d) => d >= nowMs).length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("ignores invalid dates", () => {
    fc.assert(
      fc.property(scenario, fc.array(fc.constantFrom("nope", "", "2024-02-30T99:99"), { maxLength: 5 }), ({ now, rows }, bad) => {
        const withBad = [...rows, ...bad.map((s) => ({ dueDate: s }))];
        expect(homeworkCounts(withBad, now)).toEqual(homeworkCounts(rows, now));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("examples: window edges and an empty list", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const at = (ms: number) => ({ dueDate: new Date(now.getTime() + ms) });
    expect(homeworkCounts([], now)).toEqual({ overdue: 0, upcoming: 0 });
    expect(
      homeworkCounts(
        [
          at(-30 * DAY), // exactly at the window start: still overdue
          at(-30 * DAY - 1), // just outside: dropped
          at(-1), // overdue by 1 ms
          at(0), // due right now: upcoming
          at(3 * DAY),
          { dueDate: "garbage" },
        ],
        now,
      ),
    ).toEqual({ overdue: 2, upcoming: 2 });
  });
});

describe("orderDashboardHomework", () => {
  it("returns exactly the in-window rows, sorted by due, stable, overdue before upcoming", () => {
    fc.assert(
      fc.property(scenario, ({ now, rows }) => {
        const fromMs = overdueWindowStart(now).getTime();
        const nowMs = now.getTime();
        const out = orderDashboardHomework(rows, now);

        // Same multiset as the in-window rows (ids are unique, so compare sorted ids).
        const expectedIds = rows
          .filter((r) => {
            const d = dueMs(r);
            return !Number.isNaN(d) && d >= fromMs;
          })
          .map((r) => r.id);
        expect(out.map((r) => r.id).sort((a, b) => a - b)).toEqual(expectedIds);
        // Every output element is one of the input objects.
        for (const r of out) expect(rows).toContain(r);

        for (let i = 1; i < out.length; i++) {
          const prev = dueMs(out[i - 1]);
          const cur = dueMs(out[i]);
          // Non-decreasing deadlines.
          expect(prev).toBeLessThanOrEqual(cur);
          // Stable: equal deadlines keep their input order.
          if (prev === cur) expect(out[i - 1].id).toBeLessThan(out[i].id);
        }

        // Overdue rows all come before upcoming rows.
        const firstUpcoming = out.findIndex((r) => dueMs(r) >= nowMs);
        if (firstUpcoming !== -1) {
          for (const r of out.slice(firstUpcoming)) expect(dueMs(r)).toBeGreaterThanOrEqual(nowMs);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("example: most overdue first, then upcoming by deadline; old and invalid rows dropped", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const rows = [
      { id: "soon", dueDate: new Date(now.getTime() + DAY) },
      { id: "late2", dueDate: new Date(now.getTime() - 2 * DAY) },
      { id: "ancient", dueDate: new Date(now.getTime() - 40 * DAY) },
      { id: "later", dueDate: new Date(now.getTime() + 5 * DAY).toISOString() },
      { id: "late10", dueDate: new Date(now.getTime() - 10 * DAY) },
      { id: "bad", dueDate: "not a date" },
      { id: "soonTwin", dueDate: new Date(now.getTime() + DAY) },
    ];
    expect(orderDashboardHomework(rows, now).map((r) => r.id)).toEqual(["late10", "late2", "soon", "soonTwin", "later"]);
  });

  it("does not mutate its input", () => {
    const now = new Date("2026-05-10T12:00:00Z");
    const rows = [{ dueDate: new Date(now.getTime() + DAY) }, { dueDate: new Date(now.getTime() - DAY) }];
    const copy = [...rows];
    orderDashboardHomework(rows, now);
    expect(rows).toEqual(copy);
  });
});
