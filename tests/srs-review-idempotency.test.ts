/**
 * POST /api/srs/review with queued offline grades (idea 7): each grade carries a client id and
 * the moment it was made; sending the same grades again schedules nothing twice, an older
 * grade loses to the server state, and online reviews (no moment) work as before.
 * The database is an in-memory ledger, so the assertions are about the stored state.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { studentId: string; itemKey: string; source: string; ease: number; interval: number; reps: number; lapses: number; dueAt: Date; lastReviewedAt: Date };

const m = vi.hoisted(() => {
  const rows = new Map<string, Row>();
  const logs: { action: string; details: unknown; points: number; createdAt: Date }[] = [];
  return {
    rows,
    logs,
    awardXp: vi.fn(),
    advanceStreak: vi.fn(async () => null),
    recordLearningEvent: vi.fn(async () => null),
    settleProgression: vi.fn(async () => null),
    db: {
      student: { findUnique: vi.fn(async () => ({ id: "st-1" })) },
      mistakeEntry: { findMany: vi.fn(async () => []) },
      reviewItem: {
        findUnique: vi.fn(async ({ where }: { where: { studentId_itemKey: { studentId: string; itemKey: string } } }) => {
          const k = where.studentId_itemKey;
          return rows.get(`${k.studentId}:${k.itemKey}`) ?? null;
        }),
        upsert: vi.fn(async ({ where, create, update }: { where: { studentId_itemKey: { studentId: string; itemKey: string } }; create: Row; update: Partial<Row> }) => {
          const k = `${where.studentId_itemKey.studentId}:${where.studentId_itemKey.itemKey}`;
          const prev = rows.get(k);
          rows.set(k, prev ? { ...prev, ...update } : { ...create });
        }),
      },
      activityLog: {
        findMany: vi.fn(async () => logs.map((l) => ({ points: l.points, details: l.details }))),
        create: vi.fn(async ({ data }: { data: { action: string; details: unknown; points: number } }) => {
          logs.push({ ...data, createdAt: new Date() });
        }),
      },
    },
  };
});

vi.mock("@/lib/security/same-origin", () => ({ trustedMutation: () => true }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ id: "u-1" }) }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/engine/xp-engine", () => ({ awardXp: m.awardXp, advanceStreak: m.advanceStreak }));
vi.mock("@/lib/engine/learning-dna", () => ({ recordLearningEvent: m.recordLearningEvent }));
vi.mock("@/lib/engine/progression/service", () => ({ settleProgression: m.settleProgression }));

import { POST } from "@/app/api/srs/review/route";
import { schedule } from "@/lib/srs";

const DAY = 86_400_000;
const post = (body: unknown) =>
  POST(new Request("https://averna.test/api/srs/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as never);
const ledger = () =>
  Object.fromEntries([...m.rows.values()].map((r) => [r.itemKey, { ease: r.ease, interval: r.interval, reps: r.reps, lapses: r.lapses, due: r.dueAt.getTime(), last: r.lastReviewedAt.getTime() }]));

beforeEach(() => {
  m.rows.clear();
  m.logs.length = 0;
  vi.clearAllMocks();
});

describe("POST /api/srs/review — queued grades", () => {
  const t0 = Date.now() - 3 * DAY;
  const queue = [
    { itemKey: "abundant", rating: "good", source: "vocab", clientId: "c-0000000001", reviewedAt: t0 },
    { itemKey: "scarce", rating: "again", source: "vocab", clientId: "c-0000000002", reviewedAt: t0 + 1000 },
    { itemKey: "abundant", rating: "easy", source: "vocab", clientId: "c-0000000003", reviewedAt: t0 + 2 * DAY },
  ];

  it("schedules each grade as of its moment, and a replayed queue changes nothing (no double scheduling)", async () => {
    const first = await (await post({ reviews: queue })).json();
    expect(first.results.map((r: { clientId: string; status: string }) => [r.clientId, r.status])).toEqual([
      ["c-0000000001", "applied"],
      ["c-0000000002", "applied"],
      ["c-0000000003", "applied"],
    ]);
    const after = ledger();
    const expected = schedule(schedule(undefined, "good", t0), "easy", t0 + 2 * DAY);
    expect(after.abundant).toEqual({ ...expected, last: t0 + 2 * DAY });
    expect(after.scarce.last).toBe(t0 + 1000);
    expect(m.logs).toHaveLength(1);
    expect(m.recordLearningEvent).toHaveBeenCalledTimes(1);

    const replay = await (await post({ reviews: queue })).json();
    expect(replay.results.map((r: { status: string }) => r.status)).toEqual(["stale", "duplicate", "duplicate"]);
    expect(replay.xp).toBe(0);
    expect(ledger()).toEqual(after);
    // Nothing else counted twice either: no second activity row, XP award or Learning DNA event.
    expect(m.logs).toHaveLength(1);
    expect(m.recordLearningEvent).toHaveBeenCalledTimes(1);
  });

  it("ignores the same client id twice in one request", async () => {
    const res = await (await post({ reviews: [queue[0], queue[0]] })).json();
    expect(res.results.map((r: { status: string }) => r.status)).toEqual(["applied", "duplicate"]);
    expect(ledger().abundant.reps).toBe(1);
  });

  it("server wins: a grade older than the card's last (online) review is not applied, and its state comes back", async () => {
    await post({ itemKey: "abundant", rating: "good", source: "vocab" }); // online, now
    const before = ledger();
    const res = await (await post({ reviews: [queue[0]] })).json();
    expect(res.results[0].status).toBe("stale");
    expect(res.results[0].state).toEqual({ ease: before.abundant.ease, interval: before.abundant.interval, due: before.abundant.due, reps: 1, lapses: 0 });
    expect(ledger()).toEqual(before);
  });

  it("refuses a moment in the future without touching the card", async () => {
    const res = await (await post({ reviews: [{ ...queue[0], reviewedAt: Date.now() + 2 * 60 * 60 * 1000 }] })).json();
    expect(res.results[0].status).toBe("invalid");
    expect(m.rows.size).toBe(0);
  });

  it("keeps online reviews (no client id, no moment) exactly as before", async () => {
    const res = await post({ itemKey: "abundant", rating: "good", source: "vocab" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ itemKey: "abundant", status: "applied" });
    expect(ledger().abundant.reps).toBe(1);
    const again = await (await post({ itemKey: "abundant", rating: "good", source: "vocab" })).json();
    expect(again.results[0].status).toBe("applied");
    expect(ledger().abundant.reps).toBe(2);
  });
});
