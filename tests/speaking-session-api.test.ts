import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    student: { findUnique: vi.fn() },
    speakingRoom: { findUnique: vi.fn(), updateMany: vi.fn() },
    speakingQueue: { deleteMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));

import { GET, POST } from "@/app/api/speaking/session/[roomId]/route";
import { buildPeerContent } from "@/lib/speaking/peer-content";
import { advance, initialSessionState } from "@/lib/speaking/session";

const ctx = (roomId = "room-1") => ({ params: Promise.resolve({ roomId }) });
const URL_ = "https://averna.test/api/speaking/session/room-1";
const post = (body: unknown) =>
  new Request(URL_, { method: "POST", headers: { origin: "https://averna.test", "content-type": "application/json" }, body: JSON.stringify(body) });

const state = initialSessionState(buildPeerContent("quick", 6, () => 0.4), "A", { A: 6, B: 5.5 });
const room = (over: Record<string, unknown> = {}) => ({
  id: "room-1",
  topic: "Cue card",
  format: "quick",
  status: "ACTIVE",
  state,
  version: 3,
  studentAId: "st-a",
  studentAName: "Aziza",
  studentBId: "st-b",
  studentBName: "Bek",
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-b", role: "STUDENT" } });
  m.db.student.findUnique.mockResolvedValue({ id: "st-b" });
  m.db.speakingRoom.findUnique.mockResolvedValue(room());
  m.db.speakingRoom.updateMany.mockResolvedValue({ count: 1 });
  m.db.speakingQueue.deleteMany.mockResolvedValue({ count: 2 });
});

describe("/api/speaking/session/[roomId]", () => {
  it("shows the session to members only, with first names and levels", async () => {
    const res = await GET(new Request(URL_), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      version: 3,
      format: "quick",
      me: { seat: "B", firstName: "Bek", level: 5.5 },
      partner: { seat: "A", firstName: "Aziza", level: 6 },
      state: { phase: 0 },
    });
    m.db.student.findUnique.mockResolvedValueOnce({ id: "st-x" });
    expect((await GET(new Request(URL_), ctx())).status).toBe(403);
    m.auth.mockResolvedValueOnce(null);
    expect((await GET(new Request(URL_), ctx())).status).toBe(401);
    expect((await GET(new Request(URL_), ctx("bad id!"))).status).toBe(400);
  });

  it("returns 409 with the latest state on a stale version", async () => {
    const res = await POST(post({ action: "ready", version: 2 }), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ version: 3, state: { phase: 0 } });
    expect(m.db.speakingRoom.updateMany).not.toHaveBeenCalled();
  });

  it("applies an allowed action with optimistic concurrency and bumps the version", async () => {
    const res = await POST(post({ action: "ready", version: 3 }), ctx());
    expect(await res.json()).toMatchObject({ changed: true, version: 4, state: { ready: { A: false, B: true } } });
    expect(m.db.speakingRoom.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "room-1", version: 3, status: "ACTIVE" }, data: { version: 4 } });
  });

  it("treats a disallowed action as a no-op without writing", async () => {
    const res = await POST(post({ action: "start", version: 3 }), ctx());
    expect(await res.json()).toMatchObject({ changed: false, version: 3 });
    expect(m.db.speakingRoom.updateMany).not.toHaveBeenCalled();
    expect((await POST(post({ action: "teleport", version: 3 }), ctx())).status).toBe(400);
  });

  it("ends the room for both and clears their queue entries", async () => {
    const started = advance(advance(advance(state, "ready", "A", 1), "ready", "B", 1), "start", "A", 2);
    m.db.speakingRoom.findUnique.mockResolvedValue(room({ state: started }));
    const body = await (await POST(post({ action: "end", version: 3 }), ctx())).json();
    expect(body).toMatchObject({ changed: true, version: 4, state: { endedBy: "B" } });
    expect(m.db.speakingRoom.updateMany.mock.calls[0][0].data).toMatchObject({ status: "ENDED", endedAt: expect.any(Date) });
    expect(m.db.speakingQueue.deleteMany).toHaveBeenCalledWith({ where: { roomId: "room-1" } });
  });

  it("returns 409 when another write won the race", async () => {
    m.db.speakingRoom.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await POST(post({ action: "ready", version: 3 }), ctx())).status).toBe(409);
  });
});
