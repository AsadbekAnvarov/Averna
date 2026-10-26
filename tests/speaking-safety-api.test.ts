/** /api/speaking/report and /api/speaking/block (docs/peer-speaking.md, Phase C). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  db: {
    student: { findUnique: vi.fn() },
    speakingRoom: { findUnique: vi.fn(), updateMany: vi.fn() },
    speakingReport: { findFirst: vi.fn(), create: vi.fn() },
    speakingBlock: { upsert: vi.fn() },
    speakingQueue: { deleteMany: vi.fn() },
    speakingSignal: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: m.limit }));

import { POST as REPORT } from "@/app/api/speaking/report/route";
import { POST as BLOCK } from "@/app/api/speaking/block/route";
import { pickPartner, type WaitingEntry } from "@/lib/speaking/matching";
import { buildPeerContent } from "@/lib/speaking/peer-content";
import { advance, currentPhase, initialSessionState } from "@/lib/speaking/session";

const base = initialSessionState(buildPeerContent("debate", 6, () => 0.3), "A", { A: 6, B: 6 });
const live = advance(advance(advance(base, "ready", "A", 0), "ready", "B", 0), "start", "A", Date.now() - 30_000);
const room = (over: Record<string, unknown> = {}) => ({
  id: "room-1",
  topic: "t",
  format: "debate",
  status: "ACTIVE",
  state: live,
  version: 4,
  studentAId: "st-a",
  studentAName: "Aziza",
  studentBId: "st-b",
  studentBName: "Bek",
  ...over,
});
const req = (path: string, body: unknown, origin = "https://averna.test") =>
  new Request(`https://averna.test${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-b", role: "STUDENT" } });
  m.limit.mockResolvedValue({ ok: true });
  m.db.student.findUnique.mockResolvedValue({ id: "st-b" });
  m.db.speakingRoom.findUnique.mockResolvedValue(room());
  m.db.speakingRoom.updateMany.mockResolvedValue({ count: 1 });
  m.db.speakingReport.findFirst.mockResolvedValue(null);
  m.db.speakingReport.create.mockResolvedValue({});
  m.db.speakingBlock.upsert.mockResolvedValue({});
  m.db.speakingQueue.deleteMany.mockResolvedValue({ count: 0 });
  m.db.speakingSignal.deleteMany.mockResolvedValue({ count: 0 });
});

describe("POST /api/speaking/report", () => {
  it("files a report about the partner, for members only", async () => {
    const res = await REPORT(req("/api/speaking/report", { roomId: "room-1", reason: "harassment", note: "  rude words " }));
    expect(res.status).toBe(200);
    expect(m.db.speakingReport.create).toHaveBeenCalledWith({
      data: { roomId: "room-1", reporterId: "st-b", reportedId: "st-a", reason: "harassment", note: "rude words" },
    });
    expect(m.limit).toHaveBeenCalledWith([{ key: "speaking-report:st-b", limit: 5, seconds: 86400 }]);

    m.db.student.findUnique.mockResolvedValue({ id: "st-x" });
    expect((await REPORT(req("/api/speaking/report", { roomId: "room-1", reason: "other" }))).status).toBe(403);
    expect(m.db.speakingReport.create).toHaveBeenCalledTimes(1);
  });

  it("validates the reason and note, and refuses cross-site posts", async () => {
    expect((await REPORT(req("/api/speaking/report", { roomId: "room-1", reason: "spam" }))).status).toBe(400);
    expect((await REPORT(req("/api/speaking/report", { roomId: "room-1", reason: "other", note: "x".repeat(301) }))).status).toBe(400);
    expect((await REPORT(req("/api/speaking/report", { roomId: "room-1", reason: "other" }, "https://evil.test"))).status).toBe(403);
    expect(m.db.speakingReport.create).not.toHaveBeenCalled();
  });

  it("keeps one OPEN report per reporter per room", async () => {
    m.db.speakingReport.findFirst.mockResolvedValue({ id: "rep-1" });
    const res = await REPORT(req("/api/speaking/report", { roomId: "room-1", reason: "no-show" }));
    expect(res.status).toBe(409);
    expect(m.db.speakingReport.findFirst.mock.calls[0][0].where).toEqual({ roomId: "room-1", reporterId: "st-b", status: "OPEN" });
    expect(m.db.speakingReport.create).not.toHaveBeenCalled();
  });

  it("is rate-limited to 5 a day", async () => {
    let used = 0;
    m.limit.mockImplementation(async () => (++used <= 5 ? { ok: true } : { ok: false, retryAfterSeconds: 3600 }));
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await REPORT(req("/api/speaking/report", { roomId: "room-1", reason: "other" }))).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
    expect(m.db.speakingReport.create).toHaveBeenCalledTimes(5);
  });
});

describe("POST /api/speaking/block", () => {
  it("blocks the partner and ends an ACTIVE room through the state machine", async () => {
    const res = await BLOCK(req("/api/speaking/block", { roomId: "room-1" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(m.db.speakingBlock.upsert).toHaveBeenCalledWith({
      where: { blockerId_blockedId: { blockerId: "st-b", blockedId: "st-a" } },
      create: { blockerId: "st-b", blockedId: "st-a" },
      update: {},
    });
    const write = m.db.speakingRoom.updateMany.mock.calls[0][0];
    expect(write.where).toEqual({ id: "room-1", version: 4, status: "ACTIVE" });
    expect(write.data).toMatchObject({ status: "ENDED", version: 5, state: { endedBy: "B" } });
    expect(currentPhase(write.data.state).kind).toBe("done");
    expect(write.data.state.timedMs).toBeGreaterThanOrEqual(30_000);
    expect(body).toMatchObject({ ok: true, version: 5, state: { endedBy: "B" } });
    expect(m.db.speakingSignal.deleteMany).toHaveBeenCalledWith({ where: { roomId: "room-1" } });
    expect(m.db.speakingQueue.deleteMany).toHaveBeenCalledWith({ where: { roomId: "room-1" } });
  });

  it("retries once when another write won, and leaves ENDED rooms alone", async () => {
    m.db.speakingRoom.updateMany.mockResolvedValueOnce({ count: 0 });
    m.db.speakingRoom.findUnique.mockResolvedValueOnce(room()).mockResolvedValueOnce(room({ version: 5, state: advance(live, "next", "A", Date.now()) }));
    await BLOCK(req("/api/speaking/block", { roomId: "room-1" }));
    expect(m.db.speakingRoom.updateMany).toHaveBeenCalledTimes(2);
    expect(m.db.speakingRoom.updateMany.mock.calls[1][0].where.version).toBe(5);

    m.db.speakingRoom.updateMany.mockClear();
    m.db.speakingRoom.findUnique.mockResolvedValue(room({ status: "ENDED", state: advance(live, "end", "A", Date.now()) }));
    const body = await (await BLOCK(req("/api/speaking/block", { roomId: "room-1" }))).json();
    expect(body).toEqual({ ok: true });
    expect(m.db.speakingRoom.updateMany).not.toHaveBeenCalled();
  });

  it("members only", async () => {
    m.db.student.findUnique.mockResolvedValue({ id: "st-x" });
    expect((await BLOCK(req("/api/speaking/block", { roomId: "room-1" }))).status).toBe(403);
    expect((await BLOCK(req("/api/speaking/block", { roomId: "bad id" }))).status).toBe(400);
    expect(m.db.speakingBlock.upsert).not.toHaveBeenCalled();
  });

  it("the block row it writes keeps matching from ever pairing the two (either direction)", () => {
    const now = 1_000_000;
    const entry = (id: string, studentId: string, level: number): WaitingEntry => ({
      id,
      studentId,
      groupId: null,
      level,
      format: "debate",
      joinedAt: now - 5000,
      lastSeenAt: now,
    });
    const blocks = [{ blockerId: "st-b", blockedId: "st-a" }]; // as written above
    const a = entry("q-a", "st-a", 6);
    const b = entry("q-b", "st-b", 6);
    const c = entry("q-c", "st-c", 8.5);
    const ctx = { blocks, recentPartners: {} };
    expect(pickPartner(a, [b], ctx, now)).toBeNull();
    expect(pickPartner(b, [a], ctx, now)).toBeNull();
    expect(pickPartner(a, [b, { ...c, level: 6.5 }], ctx, now)?.studentId).toBe("st-c");
  });
});
