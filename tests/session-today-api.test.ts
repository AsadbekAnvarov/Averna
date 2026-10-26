/** GET /api/session/today — the Daily Session plan for the signed-in student. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyPlanFacts } from "@/lib/session/daily-plan";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  load: vi.fn(),
  db: { student: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/session/load", () => ({ getDailySessionData: m.load }));

import { GET } from "@/app/api/session/today/route";

const NOW = Date.parse("2026-05-12T09:00:00+05:00");
const facts: DailyPlanFacts = {
  dayKey: "2026-05-12",
  now: NOW,
  seed: 1,
  targetBand: 7,
  // All 4 due words were reviewed this morning.
  dueWords: 0,
  homework: null,
  homeworkDoneToday: [],
  skills: [
    { skill: "READING", label: "Reading", sessions: 3, recentAvg: 7, daysSince: 1 },
    { skill: "LISTENING", label: "Listening", sessions: 3, recentAvg: 6, daysSince: 1 },
    { skill: "WRITING", label: "Writing", sessions: 3, recentAvg: 7, daysSince: 1 },
    { skill: "SPEAKING", label: "Speaking", sessions: 3, recentAvg: 7, daysSince: 1 },
  ],
  tasks: {
    READING: [{ title: "Reading passage", href: "/learning/reading", minutes: 20 }],
    LISTENING: [{ title: "Listening Part 1", href: "/learning/listening/x?part=0", minutes: 10 }],
    WRITING: [{ title: "Writing Task 1", href: "/learning/writing/task1", minutes: 20 }],
    SPEAKING: [{ title: "One Speaking answer", href: "/learning/examiner", minutes: 5 }],
  },
  activities: [{ action: "SRS_REVIEW", count: 4 }],
};
const req = (q = "") => new Request(`https://averna.test/api/session/today${q}`);

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-1", role: "STUDENT" } });
  m.db.student.findUnique.mockResolvedValue({ id: "st-1" });
  m.load.mockResolvedValue({ facts, person: { firstName: "Aziz", streak: 3 } });
});

describe("GET /api/session/today", () => {
  it("returns the plan with done flags from today's activity, and the facts", async () => {
    const res = await GET(req("?minutes=10"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json();
    expect(m.db.student.findUnique).toHaveBeenCalledWith({ where: { userId: "u-1" }, select: { id: true } });
    expect(m.load).toHaveBeenCalledWith("st-1");
    expect(body.plan.minutes).toBe(10);
    expect(body.plan.steps.map((s: { id: string; done: boolean }) => [s.id, s.done])).toEqual([
      ["warmup-review", true],
      ["focus-listening", false],
    ]);
    expect(body.plan.next.id).toBe("focus-listening");
    expect(body.facts).toEqual(facts);
  });

  it("honours the length and falls back to 10 for anything else", async () => {
    expect((await (await GET(req("?minutes=20"))).json()).plan.minutes).toBe(20);
    expect((await (await GET(req("?minutes=99"))).json()).plan.minutes).toBe(10);
  });

  it("is for signed-in students only", async () => {
    m.auth.mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(401);
    m.auth.mockResolvedValueOnce({ user: { id: "u-2", role: "TEACHER" } });
    expect((await GET(req())).status).toBe(403);
    m.db.student.findUnique.mockResolvedValueOnce(null);
    expect((await GET(req())).status).toBe(404);
  });

  it("answers 503 (without details) when the data can't be read", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    m.load.mockRejectedValueOnce(new Error("db down"));
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toContain("db down");
    spy.mockRestore();
  });
});
