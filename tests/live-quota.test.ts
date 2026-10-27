/** Live speaking partner — cost limits and quota maths (docs/elegance-roadmap.md, idea 3). */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  HARD_STOP_GRACE_SECONDS,
  MAX_CALL_SECONDS_CEILING,
  MIN_CALL_SECONDS,
  capExceeded,
  liveLimits,
  remainingSeconds,
  reservationSeconds,
  settleSeconds,
  usedSeconds,
  type LiveLimits,
} from "@/lib/realtime/limits";
import { tashkentDateKey, tashkentDayStart } from "@/lib/utils";

describe("liveLimits (env)", () => {
  it("defaults to 10 min per student, 240 s per call and 300 min for everyone", () => {
    expect(liveLimits({})).toEqual({ studentSecondsPerDay: 600, maxCallSeconds: 240, globalSecondsPerDay: 18_000 });
  });

  it("keeps a call short enough for the after() hard stop inside the 300 s function default", () => {
    expect(MAX_CALL_SECONDS_CEILING + HARD_STOP_GRACE_SECONDS).toBeLessThan(300);
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.integer({ min: -10_000, max: 100_000 }).map(String), fc.double().map(String)), (raw) => {
        const l = liveLimits({ REALTIME_MAX_CALL_SECONDS: raw });
        return l.maxCallSeconds >= 60 && l.maxCallSeconds <= MAX_CALL_SECONDS_CEILING;
      }),
    );
    expect(liveLimits({ REALTIME_MAX_CALL_SECONDS: "1000" }).maxCallSeconds).toBe(270);
    expect(liveLimits({ REALTIME_MAX_CALL_SECONDS: "abc" }).maxCallSeconds).toBe(240);
    expect(liveLimits({ REALTIME_STUDENT_MINUTES_PER_DAY: "4", REALTIME_DAILY_MINUTES_CAP: "60" })).toMatchObject({ studentSecondsPerDay: 240, globalSecondsPerDay: 3600 });
  });
});

describe("settleSeconds", () => {
  it("is the server's elapsed time, rounded up, within 0…the reservation", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 270 }), fc.integer({ min: 0, max: 1e12 }), fc.integer({ min: -60_000, max: 1_000_000 }), (reserved, start, dt) => {
        const s = settleSeconds(reserved, start, start + dt);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(reserved);
        if (dt >= 0 && Math.ceil(dt / 1000) <= reserved) expect(s).toBe(Math.ceil(dt / 1000));
      }),
    );
  });
});

describe("Tashkent day boundary", () => {
  it("counts only today's rows (Tashkent midnight = 19:00 UTC)", () => {
    const now = new Date("2026-10-20T19:30:00Z"); // 00:30 on 21 Oct in Tashkent
    const since = tashkentDayStart(now);
    expect(since.toISOString()).toBe("2026-10-20T19:00:00.000Z");
    const rows = [
      { studentId: "a", createdAt: new Date("2026-10-20T18:59:59Z"), seconds: 200 }, // 23:59:59 yesterday
      { studentId: "a", createdAt: new Date("2026-10-20T19:00:00Z"), seconds: 40 }, // 00:00 today
      { studentId: "b", createdAt: new Date("2026-10-20T19:10:00Z"), seconds: 60 },
    ];
    expect(usedSeconds(rows, since, "a")).toBe(40);
    expect(usedSeconds(rows, since)).toBe(100);
    expect(tashkentDateKey(rows[0].createdAt)).not.toBe(tashkentDateKey(rows[1].createdAt));
  });
});

// ---------------------------------------------------------------------------
// The start / end algorithm under arbitrary interleavings
// ---------------------------------------------------------------------------

interface Row {
  id: number;
  student: string;
  createdAt: number;
  reserved: number;
  seconds: number;
  /** The start request's own clock (it counts with this, like the route). */
  requestNow: number;
  state: "pending" | "open" | "ended";
}

type Action =
  | { kind: "begin"; student: string; dt: number }
  | { kind: "confirm"; pick: number; dt: number }
  | { kind: "end"; pick: number; dt: number };

const STUDENTS = ["a", "b", "c"];
const limitsArb: fc.Arbitrary<LiveLimits> = fc.record({
  studentSecondsPerDay: fc.integer({ min: 60, max: 900 }),
  maxCallSeconds: fc.integer({ min: 60, max: 270 }),
  globalSecondsPerDay: fc.integer({ min: 60, max: 1500 }),
});
const actionArb: fc.Arbitrary<Action> = fc.oneof(
  fc.record({ kind: fc.constant("begin" as const), student: fc.constantFrom(...STUDENTS), dt: fc.integer({ min: 0, max: 400_000 }) }),
  fc.record({ kind: fc.constant("confirm" as const), pick: fc.nat(), dt: fc.integer({ min: 0, max: 3_000 }) }),
  fc.record({ kind: fc.constant("end" as const), pick: fc.nat(), dt: fc.integer({ min: 0, max: 300_000 }) }),
);
// Start a little before a Tashkent midnight so some runs cross it.
const startArb = fc.integer({ min: 0, max: 3 * 3600_000 }).map((back) => Date.parse("2026-10-20T19:00:00Z") - back);

const usage = (rows: Row[], now: number, student: string) => {
  const live = rows.map((r) => ({ studentId: r.student, createdAt: r.createdAt, seconds: r.seconds }));
  const since = tashkentDayStart(new Date(now));
  return { student: usedSeconds(live, since, student), global: usedSeconds(live, since) };
};

describe("reserve → count again → roll back (no locks)", () => {
  it("never lets admitted calls exceed the per-student or global cap of any Tashkent day, and settling never adds usage", () => {
    fc.assert(
      fc.property(limitsArb, startArb, fc.array(actionArb, { minLength: 1, maxLength: 80 }), (limits, t0, actions) => {
        let now = t0;
        let nextId = 1;
        let rows: Row[] = [];
        for (const a of actions) {
          now += a.dt;
          if (a.kind === "begin") {
            // Pre-check: size the reservation from what is used now.
            const u = usage(rows, now, a.student);
            const reserve = reservationSeconds(limits, u.student, u.global);
            if (reserve < MIN_CALL_SECONDS) continue;
            expect(reserve).toBeLessThanOrEqual(limits.maxCallSeconds);
            rows.push({ id: nextId++, student: a.student, createdAt: now, reserved: reserve, seconds: reserve, requestNow: now, state: "pending" });
          } else if (a.kind === "confirm") {
            const pending = rows.filter((r) => r.state === "pending");
            if (!pending.length) continue;
            const row = pending[a.pick % pending.length];
            // Count again WITH the reservation (and whatever else was inserted meanwhile).
            const u = usage(rows, row.requestNow, row.student);
            if (capExceeded(limits, u.student, u.global)) rows = rows.filter((r) => r.id !== row.id);
            else row.state = "open";
          } else {
            const open = rows.filter((r) => r.state === "open");
            if (!open.length) continue;
            const row = open[a.pick % open.length];
            const before = row.seconds;
            row.seconds = Math.min(row.seconds, settleSeconds(row.reserved, row.requestNow, now));
            row.state = "ended";
            expect(row.seconds).toBeLessThanOrEqual(before);
            expect(row.seconds).toBeLessThanOrEqual(row.reserved);
          }
          // Invariant over ADMITTED calls (open or settled), per Tashkent day.
          const admitted = rows.filter((r) => r.state !== "pending");
          const byDay = new Map<string, Row[]>();
          for (const r of admitted) {
            const k = tashkentDateKey(new Date(r.createdAt));
            byDay.set(k, [...(byDay.get(k) ?? []), r]);
          }
          for (const dayRows of byDay.values()) {
            const total = dayRows.reduce((s, r) => s + r.seconds, 0);
            expect(total).toBeLessThanOrEqual(limits.globalSecondsPerDay);
            for (const s of STUDENTS) {
              expect(dayRows.filter((r) => r.student === s).reduce((n, r) => n + r.seconds, 0)).toBeLessThanOrEqual(limits.studentSecondsPerDay);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("sizes a call to what is left and refuses below 30 s", () => {
    const l: LiveLimits = { studentSecondsPerDay: 600, maxCallSeconds: 240, globalSecondsPerDay: 18_000 };
    expect(reservationSeconds(l, 0, 0)).toBe(240);
    expect(reservationSeconds(l, 450, 0)).toBe(150);
    expect(reservationSeconds(l, 590, 0)).toBeLessThan(MIN_CALL_SECONDS);
    expect(reservationSeconds(l, 0, 17_990)).toBe(10);
    expect(remainingSeconds(l, 700, 0)).toBe(0);
    expect(capExceeded(l, 601, 0)).toBe("student");
    expect(capExceeded(l, 600, 18_001)).toBe("global");
    expect(capExceeded(l, 600, 18_000)).toBeNull();
  });
});
