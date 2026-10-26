import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const fn = () => vi.fn();
  const db = {
    student: { findUnique: fn() },
    speakingQueue: { findUnique: fn(), upsert: fn(), update: fn(), findMany: fn(), deleteMany: fn(), updateMany: fn() },
    speakingRoom: { findUnique: fn(), findMany: fn(), create: fn() },
    speakingBlock: { findMany: fn() },
    speakingReport: { count: fn() },
    iELTSTest: { findFirst: fn() },
    placementAttempt: { findFirst: fn() },
    $transaction: fn(),
  };
  return { auth: vi.fn(), limit: vi.fn(), db };
});
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: m.limit }));

import { DELETE, GET, POST } from "@/app/api/speaking/match/route";

const URL_ = "https://averna.test/api/speaking/match";
const post = (body: unknown, origin = "https://averna.test") =>
  new Request(URL_, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

const NOW = Date.now();
const row = (over: Record<string, unknown> = {}) => ({
  id: "q-me",
  studentId: "st-me",
  studentName: "Aziza",
  roomId: null,
  topic: null,
  format: "quick",
  level: 6,
  groupId: "g1",
  createdAt: new Date(NOW),
  lastSeenAt: new Date(NOW),
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-me", role: "STUDENT" } });
  m.limit.mockResolvedValue({ ok: true });
  m.db.student.findUnique.mockResolvedValue({ id: "st-me", groupId: "g1", level: "B2", targetBand: "7", user: { name: "Aziza Karimova" } });
  m.db.speakingReport.count.mockResolvedValue(0);
  m.db.iELTSTest.findFirst.mockResolvedValue(null);
  m.db.placementAttempt.findFirst.mockResolvedValue(null);
  m.db.speakingQueue.findUnique.mockResolvedValue(null);
  m.db.speakingQueue.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => row(create));
  m.db.speakingQueue.deleteMany.mockResolvedValue({ count: 0 });
  m.db.speakingQueue.findMany.mockResolvedValue([]);
  m.db.speakingQueue.updateMany.mockResolvedValue({ count: 1 });
  m.db.speakingRoom.findMany.mockResolvedValue([]);
  m.db.speakingRoom.create.mockResolvedValue({});
  m.db.speakingBlock.findMany.mockResolvedValue([]);
  m.db.$transaction.mockImplementation(async (fn: (tx: typeof m.db) => Promise<unknown>) => fn(m.db));
});

describe("/api/speaking/match", () => {
  it("rejects cross-site joins before identity, signed-out callers and non-students", async () => {
    expect((await POST(post({ format: "quick" }, "https://evil.test"))).status).toBe(403);
    expect(m.auth).not.toHaveBeenCalled();
    m.auth.mockResolvedValueOnce(null);
    expect((await POST(post({ format: "quick" }))).status).toBe(401);
    m.auth.mockResolvedValueOnce({ user: { id: "u-t", role: "TEACHER" } });
    expect((await POST(post({ format: "quick" }))).status).toBe(403);
    expect(m.db.speakingQueue.upsert).not.toHaveBeenCalled();
  });

  it("validates the format and rate-limits joins to 6 per minute per student", async () => {
    expect((await POST(post({ format: "karaoke" }))).status).toBe(400);
    m.limit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 20 });
    expect((await POST(post({ format: "quick" }))).status).toBe(429);
    expect(m.limit).toHaveBeenCalledWith([{ key: "speaking-match:st-me", limit: 6, seconds: 60 }]);
    expect(m.db.speakingQueue.upsert).not.toHaveBeenCalled();
  });

  it("pauses students with two open reports", async () => {
    m.db.speakingReport.count.mockResolvedValue(2);
    const res = await POST(post({ format: "quick" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "paused", error: expect.stringContaining("Peer speaking is paused") });
    expect(m.db.speakingQueue.upsert).not.toHaveBeenCalled();
  });

  it("joins with level and first name, then claims a fresh partner and creates the room", async () => {
    const partner = row({ id: "q-p", studentId: "st-p", studentName: "Bek", level: 6.5, groupId: "g2", createdAt: new Date(NOW - 30_000) });
    m.db.speakingQueue.findMany.mockResolvedValue([partner]);
    const res = await POST(post({ format: "quick" }));
    const body = await res.json();
    expect(body).toMatchObject({ status: "matched", roomId: expect.any(String) });

    const join = m.db.speakingQueue.upsert.mock.calls[0][0];
    expect(join.create).toMatchObject({ studentId: "st-me", studentName: "Aziza", format: "quick", level: 6, groupId: "g1", roomId: null });

    // Both rows claimed only while unmatched (race-safe), partner only while fresh.
    const claims = m.db.speakingQueue.updateMany.mock.calls.map((c) => c[0]);
    expect(claims).toHaveLength(2);
    for (const c of claims) expect(c.where).toMatchObject({ roomId: null, format: "quick" });
    expect(claims.find((c) => c.where.id === "q-p").where.lastSeenAt).toBeDefined();

    const room = m.db.speakingRoom.create.mock.calls[0][0].data;
    expect(room).toMatchObject({ id: body.roomId, format: "quick", version: 0, studentAId: "st-p", studentAName: "Bek", studentBId: "st-me", studentBName: "Aziza" });
    expect(room.state).toMatchObject({ v: 1, format: "quick", phase: 0, levels: { A: 6.5, B: 6 } });
    expect(room.level).toBe(6.5);
  });

  it("stays waiting when another student claims the partner first", async () => {
    m.db.speakingQueue.findMany.mockResolvedValue([row({ id: "q-p", studentId: "st-p", createdAt: new Date(NOW - 5000) })]);
    m.db.speakingQueue.updateMany.mockResolvedValueOnce({ count: 0 });
    const body = await (await POST(post({ format: "quick" }))).json();
    expect(body.status).toBe("waiting");
    expect(m.db.speakingRoom.create).not.toHaveBeenCalled();
  });

  it("polls as a heartbeat, cleans up stale entries and suggests alternatives after a minute", async () => {
    const waitingRow = row({ createdAt: new Date(NOW - 61_000), lastSeenAt: new Date(NOW - 3000) });
    m.db.speakingQueue.findUnique.mockResolvedValue(waitingRow);
    m.db.speakingQueue.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...waitingRow, ...data }));
    const body = await (await GET()).json();
    expect(m.db.speakingQueue.update.mock.calls[0][0]).toMatchObject({ where: { id: "q-me" }, data: { lastSeenAt: expect.any(Date) } });
    expect(m.db.speakingQueue.deleteMany).toHaveBeenCalled();
    expect(body).toMatchObject({ status: "waiting", suggestAlternatives: true, lookingNow: 0 });
    expect(body.waitingSec).toBeGreaterThanOrEqual(61);
  });

  it("reports idle presence without joining, and leaves only an unmatched entry", async () => {
    m.db.speakingQueue.findMany.mockResolvedValue([{ format: "exam" }, { format: "debate" }]);
    expect(await (await GET()).json()).toMatchObject({ status: "idle", lookingNow: 2 });
    expect(m.db.speakingQueue.update).not.toHaveBeenCalled();
    const res = await DELETE(new Request(URL_, { method: "DELETE", headers: { origin: "https://averna.test" } }));
    expect(res.status).toBe(200);
    expect(m.db.speakingQueue.deleteMany).toHaveBeenCalledWith({ where: { studentId: "st-me", roomId: null } });
  });
});
