/** Daily Session planner (lib/session/daily-plan.ts) — properties + a few examples. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildDailyPlan,
  parseSessionLength,
  SESSION_LENGTHS,
  SPEAKING_ITEM,
  withSessionFrom,
  type DailyPlanInput,
  type FocusTasks,
  type SkillFact,
  type TodayActivity,
} from "@/lib/session/daily-plan";
import type { SkillKey } from "@/lib/engine/progression/config";

const SKILLS: SkillKey[] = ["READING", "LISTENING", "WRITING", "SPEAKING"];
const LABEL: Record<SkillKey, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };
const DAY = "2026-05-12";
const NOW = Date.parse("2026-05-12T09:00:00+05:00");
const H = 3_600_000;

/** The task sizes the server always supplies (lib/session/load.ts). */
const TASKS: FocusTasks = {
  READING: [{ title: "Reading Passage 2 — Bees", href: "/learning/reading/cdi-1?part=1", minutes: 20 }],
  LISTENING: [{ title: "Listening Part 3 — Campus", href: "/learning/listening/cdi-2?part=2", minutes: 10 }],
  WRITING: [{ title: "Writing Task 1 — report", href: "/learning/writing/task1", minutes: 20 }],
  SPEAKING: [SPEAKING_ITEM, { title: "Full Speaking test — Set 4", href: "/learning/speaking-test/set-4", minutes: 14 }],
};

const skillArb: fc.Arbitrary<SkillFact[]> = fc.tuple(
  ...SKILLS.map((skill) =>
    fc.record({
      sessions: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 40 })),
      recentAvg: fc.integer({ min: 30, max: 90 }).map((n) => n / 10),
      daysSince: fc.option(fc.integer({ min: 0, max: 30 }), { nil: null }),
    }).map((r) => ({ skill, label: LABEL[skill], sessions: r.sessions, recentAvg: r.sessions ? r.recentAvg : 0, daysSince: r.sessions ? r.daysSince : null }))
  )
);

const activityArb: fc.Arbitrary<TodayActivity> = fc.oneof(
  fc.record({ action: fc.constant("SRS_REVIEW"), count: fc.integer({ min: 1, max: 20 }) }),
  fc.record({ action: fc.constant("WARMUP_COMPLETED") }),
  fc.record({ action: fc.constant("IELTS_TEST_COMPLETED"), module: fc.constantFrom(...SKILLS), score: fc.constantFrom(0, 5.5, 6.5) }),
  fc.record({ action: fc.constant("HOMEWORK_SUBMITTED"), homeworkId: fc.constantFrom("hw-1", "hw-2") }),
  fc.record({ action: fc.constant("SPEAKING_SESSION_COMPLETED"), kind: fc.constantFrom("peer", null) }),
  fc.record({ action: fc.constant("DAILY_CHALLENGE") }),
  fc.record({ action: fc.constantFrom("BADGE", "LOGIN", "MISSION_COMPLETED") })
);

const inputArb: fc.Arbitrary<DailyPlanInput> = fc.record({
  dayKey: fc.constantFrom(DAY, "2026-05-13", "2026-12-31"),
  now: fc.constant(NOW),
  seed: fc.nat(),
  targetBand: fc.integer({ min: 50, max: 85 }).map((n) => n / 10),
  dueWords: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 80 })),
  homework: fc.option(
    fc.record({
      id: fc.constant("hw-1"),
      title: fc.constant("Unit 4 essay"),
      dueAt: fc.integer({ min: -10 * 24, max: 10 * 24 }).map((h) => new Date(NOW + h * H + 1).toISOString()),
    }),
    { nil: null }
  ),
  homeworkDoneToday: fc.constantFrom([], [{ id: "hw-2", title: "Listening homework" }]),
  skills: skillArb,
  tasks: fc.constant(TASKS),
  activities: fc.array(activityArb, { maxLength: 6 }),
  minutes: fc.constantFrom(...SESSION_LENGTHS),
  examDate: fc.option(fc.constantFrom("2026-05-20", "2026-09-01", "2025-01-01"), { nil: null }),
});

const isOverdue = (i: DailyPlanInput) => !!i.homework && Date.parse(i.homework.dueAt) < i.now;

describe("buildDailyPlan — properties", () => {
  it("has 2–4 steps whose estimates total within ±40% of the chosen length", () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const p = buildDailyPlan(i);
        expect(p.steps.length).toBeGreaterThanOrEqual(2);
        expect(p.steps.length).toBeLessThanOrEqual(4);
        expect(p.totalMinutes).toBe(p.steps.reduce((a, s) => a + s.estMinutes, 0));
        expect(p.totalMinutes).toBeGreaterThanOrEqual(i.minutes * 0.6);
        expect(p.totalMinutes).toBeLessThanOrEqual(i.minutes * 1.4);
      }),
      { numRuns: 400 }
    );
  });

  it("always includes overdue homework, before the focus", () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        fc.pre(isOverdue(i));
        const p = buildDailyPlan(i);
        const idx = p.steps.findIndex((s) => s.id === `homework-${i.homework!.id}`);
        expect(idx).toBeGreaterThanOrEqual(0);
        const focus = p.steps.findIndex((s) => s.kind === "focus");
        if (focus >= 0) expect(idx).toBeLessThan(focus);
      }),
      { numRuns: 300 }
    );
  });

  it("never repeats a step kind, starts with the warm-up, and only adds a bonus at 20 min", () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const p = buildDailyPlan(i);
        const kinds = p.steps.map((s) => s.kind);
        expect(new Set(kinds).size).toBe(kinds.length);
        expect(kinds[0]).toBe("warmup");
        if (i.minutes !== 20) expect(kinds).not.toContain("bonus");
        for (const s of p.steps) expect(s.href).toMatch(/[?&]from=session$/);
      }),
      { numRuns: 300 }
    );
  });

  it("marks steps done only from matching activities", () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const p = buildDailyPlan(i);
        const none = buildDailyPlan({ ...i, activities: [] });
        // Without activity nothing is done…
        expect(none.steps.every((s) => !s.done)).toBe(true);
        // …and each done flag has its own evidence.
        for (const s of p.steps.filter((x) => x.done)) {
          const a = i.activities;
          if (s.id === "warmup-review") expect(a.some((x) => x.action === "SRS_REVIEW")).toBe(true);
          else if (s.id === "warmup-60s") expect(a.some((x) => x.action === "WARMUP_COMPLETED")).toBe(true);
          else if (s.kind === "homework") expect(a.some((x) => x.action === "HOMEWORK_SUBMITTED" && `homework-${x.homeworkId}` === s.id)).toBe(true);
          else if (s.kind === "focus")
            expect(
              a.some(
                (x) =>
                  (x.action === "IELTS_TEST_COMPLETED" && x.module === s.skill && x.score !== 0) ||
                  (s.skill === "SPEAKING" && x.action === "SPEAKING_SESSION_COMPLETED")
              )
            ).toBe(true);
          else if (s.id === "bonus-partner") expect(a.some((x) => x.action === "SPEAKING_SESSION_COMPLETED" && x.kind === "peer")).toBe(true);
          else if (s.id === "bonus-challenge") expect(a.some((x) => x.action === "DAILY_CHALLENGE")).toBe(true);
        }
      }),
      { numRuns: 300 }
    );
  });

  it("is deterministic for the same input and day", () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        expect(buildDailyPlan(structuredClone(i))).toEqual(buildDailyPlan(i));
      }),
      { numRuns: 200 }
    );
  });

  it("targets the first undone step with Continue", () => {
    fc.assert(
      fc.property(inputArb, (i) => {
        const p = buildDailyPlan(i);
        const first = p.steps.find((s) => !s.done) ?? null;
        expect(p.next).toEqual(first);
        expect(p.allDone).toBe(first === null);
        expect(p.doneCount).toBe(p.steps.filter((s) => s.done).length);
      }),
      { numRuns: 200 }
    );
  });
});

describe("buildDailyPlan — examples", () => {
  const base: DailyPlanInput = {
    dayKey: DAY,
    now: NOW,
    seed: 7,
    targetBand: 7,
    dueWords: 12,
    homework: null,
    homeworkDoneToday: [],
    skills: SKILLS.map((skill) => ({ skill, label: LABEL[skill], sessions: 5, recentAvg: skill === "LISTENING" ? 6.5 : 7, daysSince: 1 })),
    tasks: TASKS,
    activities: [],
    minutes: 10,
  };

  it("10 min: due words, then the weakest skill's part with an honest reason", () => {
    const p = buildDailyPlan(base);
    expect(p.steps.map((s) => s.id)).toEqual(["warmup-review", "focus-listening"]);
    expect(p.steps[0].title).toBe("Review 10 due words");
    expect(p.steps[1].why).toBe("Your Listening is 0.5 below your 7.0 target.");
    expect(p.steps[1].href).toBe("/learning/listening/cdi-2?part=2&from=session");
  });

  it("no due words → the 60-second warm-up; Reading at 10 min gives way and says why", () => {
    const skills = base.skills.map((s) => (s.skill === "READING" ? { ...s, recentAvg: 5 } : s));
    const p = buildDailyPlan({ ...base, dueWords: 0, skills });
    expect(p.steps[0].id).toBe("warmup-60s");
    expect(p.steps[1].skill).toBe("LISTENING");
    expect(p.steps[1].why).toMatch(/^Reading needs 20 min — choose 20 min for it\./);
    expect(buildDailyPlan({ ...base, dueWords: 0, skills, minutes: 20 }).steps[1].skill).toBe("READING");
  });

  it("overdue homework takes the 5-minute session; done when submitted", () => {
    const homework = { id: "hw-1", title: "Unit 4 essay", dueAt: new Date(NOW - 26 * H).toISOString() };
    const p = buildDailyPlan({ ...base, minutes: 5, homework });
    expect(p.steps.map((s) => s.kind)).toEqual(["warmup", "homework"]);
    expect(p.steps[1].why).toMatch(/Overdue/);
    const done = buildDailyPlan({ ...base, minutes: 5, homework, activities: [{ action: "HOMEWORK_SUBMITTED", homeworkId: "hw-1" }] });
    expect(done.steps[1].done).toBe(true);
    expect(done.next?.kind).toBe("warmup");
  });

  it("20 min: a speaking-partner bonus when the focus is not Speaking", () => {
    const p = buildDailyPlan({ ...base, minutes: 20 });
    expect(p.steps.map((s) => s.id)).toEqual(["warmup-review", "focus-listening", "bonus-partner"]);
  });

  it("all done → no Continue target", () => {
    const p = buildDailyPlan({
      ...base,
      activities: [
        { action: "SRS_REVIEW", count: 10 },
        { action: "IELTS_TEST_COMPLETED", module: "LISTENING", score: 6 },
      ],
    });
    expect(p.allDone).toBe(true);
    expect(p.next).toBeNull();
  });

  it("helpers", () => {
    expect(withSessionFrom("/flashcards")).toBe("/flashcards?from=session");
    expect(withSessionFrom("/learning/reading/x?part=1")).toBe("/learning/reading/x?part=1&from=session");
    expect(parseSessionLength("20")).toBe(20);
    expect(parseSessionLength("7")).toBe(10);
    expect(parseSessionLength(null)).toBe(10);
  });
});
