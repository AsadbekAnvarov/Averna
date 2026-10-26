/** "Who needs help today" — the pure ranking (docs/elegance-roadmap.md, idea 10). */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MAX_REASONS,
  NEEDS_HELP_RULES,
  messageTemplate,
  needsHelpRow,
  rankNeedsHelp,
  reasonsOf,
  type StudentSignals,
} from "@/lib/teacher/needs-help";

const calm = (over: Partial<StudentSignals> = {}): StudentSignals => ({
  id: "s1",
  userId: "u1",
  name: "Aziza Karimova",
  group: "IELTS 6.5",
  missedHomework: 0,
  daysInactive: 1,
  brokenStreak: 0,
  fallingSkills: [],
  forecast: null,
  weakKind: null,
  absences: 0,
  openReports: 0,
  waitingReview: null,
  ...over,
});

const SKILLS = ["Reading", "Listening", "Writing", "Speaking"];

/** Any mix of signals, around and across every threshold. */
const signalsArb = (id: fc.Arbitrary<string>): fc.Arbitrary<StudentSignals> =>
  fc.record({
    id,
    userId: fc.string({ minLength: 1, maxLength: 6 }),
    name: fc.constantFrom("Ali", "Aziza Karimova", "bobur", "Dilnoza", "Ali", "Zarina Usmonova"),
    group: fc.constantFrom("A", "B"),
    missedHomework: fc.integer({ min: 0, max: 7 }),
    daysInactive: fc.option(fc.integer({ min: 0, max: 40 }), { nil: null }),
    neverActive: fc.boolean(),
    brokenStreak: fc.integer({ min: 0, max: 40 }),
    fallingSkills: fc.subarray(SKILLS),
    forecast: fc.option(
      fc.record({ now: fc.integer({ min: 6, max: 18 }).map((x) => x / 2), target: fc.integer({ min: 10, max: 18 }).map((x) => x / 2) }),
      { nil: null }
    ),
    weakKind: fc.option(
      fc.integer({ min: 0, max: 5 }).map((wrong) => ({ kind: "matching-headings", label: "Matching headings", wrong, of: 5 })),
      { nil: null }
    ),
    absences: fc.integer({ min: 0, max: 6 }),
    openReports: fc.integer({ min: 0, max: 4 }),
    waitingReview: fc.option(
      fc.record({
        count: fc.integer({ min: 1, max: 6 }),
        oldestDays: fc.integer({ min: 0, max: 20 }),
        testId: fc.constant("test-123456"),
        skill: fc.constantFrom("WRITING" as const, "SPEAKING" as const),
      }),
      { nil: null }
    ),
  });

const classArb = fc.uniqueArray(signalsArb(fc.string({ minLength: 1, maxLength: 8 })), { selector: (s) => s.id, maxLength: 25 });

describe("rankNeedsHelp — properties", () => {
  it("lists exactly the students with at least one reason, each with 1–3 reasons", () => {
    fc.assert(
      fc.property(classArb, (students) => {
        const rows = rankNeedsHelp(students);
        const listed = new Set(rows.map((r) => r.id));
        for (const s of students) expect(listed.has(s.id)).toBe(reasonsOf(s).length > 0);
        for (const r of rows) {
          expect(r.reasons.length).toBeGreaterThanOrEqual(1);
          expect(r.reasons.length).toBeLessThanOrEqual(MAX_REASONS);
        }
      })
    );
  });

  it("is deterministic and doesn't depend on the order students were read in", () => {
    fc.assert(
      fc.property(classArb, fc.integer(), (students, seed) => {
        const shuffled = [...students]
          .map((s, i) => ({ s, k: Math.sin(seed + i * 7919) }))
          .sort((a, b) => a.k - b.k)
          .map(({ s }) => s);
        const a = rankNeedsHelp(students);
        expect(rankNeedsHelp(shuffled)).toEqual(a);
        expect(rankNeedsHelp(students)).toEqual(a);
        // Sorted: score high first; ties by name (case-blind), then id.
        const key = (n: string) => n.toLocaleLowerCase("en");
        for (let i = 1; i < a.length; i++) {
          const p = a[i - 1];
          const q = a[i];
          const ok = p.score > q.score || (p.score === q.score && (key(p.name) < key(q.name) || (key(p.name) === key(q.name) && p.id < q.id)));
          expect(ok).toBe(true);
        }
      })
    );
  });

  it("the score never drops when any one signal gets worse", () => {
    const score = (s: StudentSignals) => needsHelpRow(s)?.score ?? 0;
    const worse: [string, (s: StudentSignals, n: number) => StudentSignals][] = [
      ["missed homework", (s, n) => ({ ...s, missedHomework: s.missedHomework + n })],
      ["inactivity", (s, n) => ({ ...s, daysInactive: (s.daysInactive ?? 0) + n })],
      ["broken streak", (s, n) => ({ ...s, brokenStreak: s.brokenStreak + n })],
      ["absences", (s, n) => ({ ...s, absences: s.absences + n })],
      ["reports", (s, n) => ({ ...s, openReports: s.openReports + n })],
      ["mistakes", (s, n) => ({ ...s, weakKind: { kind: "tfng", label: "True / False / Not Given", wrong: Math.min(5, (s.weakKind?.wrong ?? 0) + n), of: 5 } })],
      ["falling skills", (s) => ({ ...s, fallingSkills: Array.from(new Set([...s.fallingSkills, "Reading"])) })],
      ["target gap", (s, n) => ({ ...s, forecast: s.forecast ? { ...s.forecast, now: Math.max(0, s.forecast.now - n / 2) } : s.forecast })],
      [
        "review wait",
        (s, n) => ({ ...s, waitingReview: s.waitingReview ? { ...s.waitingReview, oldestDays: s.waitingReview.oldestDays + n, count: s.waitingReview.count + 1 } : s.waitingReview }),
      ],
    ];
    fc.assert(
      fc.property(signalsArb(fc.constant("x")), fc.integer({ min: 0, max: 10 }), fc.constantFrom(...worse), (s, n, [, step]) => {
        const after = step(s, n);
        expect(score(after)).toBeGreaterThanOrEqual(score(s));
        if (needsHelpRow(s)) expect(needsHelpRow(after)).not.toBeNull();
      })
    );
  });
});

describe("rankNeedsHelp — examples", () => {
  it("no reason, no row: the calm student isn't listed", () => {
    expect(rankNeedsHelp([calm()])).toEqual([]);
    expect(rankNeedsHelp([])).toEqual([]);
  });

  it("writes short human reasons, heaviest first, at most three", () => {
    const row = needsHelpRow(
      calm({
        daysInactive: 6,
        missedHomework: 2,
        weakKind: { kind: "matching-headings", label: "Matching headings", wrong: 4, of: 5 },
        fallingSkills: ["Listening"],
      })
    )!;
    expect(row.reasons.map((r) => r.text)).toEqual(["Missed 2 homework", "No activity for 6 days", "Matching headings: 4 of 5 wrong"]);
    const falling = needsHelpRow(calm({ fallingSkills: ["Listening"] }))!;
    expect(falling.reasons.map((r) => r.text)).toEqual(["Listening trend falling"]);
    expect(falling.action.kind).toBe("mini-task");
  });

  it("thresholds: 3 quiet days, 2 wrong of 5, a 2-day streak and a half-band gap are not reasons", () => {
    expect(
      reasonsOf(
        calm({
          daysInactive: NEEDS_HELP_RULES.inactiveDays - 1,
          weakKind: { kind: "gap", label: "Completion", wrong: 2, of: 5 },
          brokenStreak: 2,
          forecast: { now: 6.5, target: 7 },
          waitingReview: { count: 1, oldestDays: 1, testId: "test-123456", skill: "WRITING" },
        })
      )
    ).toEqual([]);
  });

  it("suggests the next step that fits the top reason", () => {
    expect(needsHelpRow(calm({ openReports: 1 }))!.action).toEqual({ kind: "reports", label: "See report", href: "/teacher/speaking" });
    expect(needsHelpRow(calm({ waitingReview: { count: 1, oldestDays: 3, testId: "abc-123456", skill: "WRITING" } }))!.action).toEqual({
      kind: "review",
      label: "Review",
      href: "/teacher/reviews/abc-123456",
    });
    expect(needsHelpRow(calm({ missedHomework: 1 }))!.action.kind).toBe("message");
  });

  it("drafts an editable first message from the student-facing reasons only", () => {
    const s = calm({ daysInactive: 6, openReports: 1 });
    const row = needsHelpRow(s)!;
    expect(row.messageDraft).toMatch(/^Hi Aziza, I noticed you haven't practised for 6 days\./);
    expect(row.messageDraft).not.toMatch(/report/i);
    expect(messageTemplate(calm(), [], { kind: "message", label: "Message" })).toMatch(/^Hi Aziza, Is everything OK\?/);
  });

  it("orders equal scores by name, then id", () => {
    const rows = rankNeedsHelp([
      calm({ id: "b", name: "Zarina", missedHomework: 1 }),
      calm({ id: "c", name: "ali", missedHomework: 1 }),
      calm({ id: "a", name: "Ali", missedHomework: 1 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });
});
