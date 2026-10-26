/**
 * POST /api/speaking/session/[roomId]: XP when both rounds are finished (docs/peer-speaking.md, Phase B).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  awardXp: vi.fn(),
  findAward: vi.fn(),
  db: {
    student: { findUnique: vi.fn() },
    speakingRoom: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
    speakingQueue: { deleteMany: vi.fn() },
    speakingSignal: { deleteMany: vi.fn() },
    activityLog: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/engine/xp-engine", () => ({
  awardXp: m.awardXp,
  findAward: m.findAward,
  BUDGETED_ACTIONS: ["SPEAKING_SESSION_COMPLETED"],
}));

import { GET, POST } from "@/app/api/speaking/session/[roomId]/route";
import { buildPeerContent } from "@/lib/speaking/peer-content";
import { advance, initialSessionState, phasePlan, type PeerSessionState } from "@/lib/speaking/session";
import { XP_CONFIG } from "@/lib/engine/progression/config";

const ctx = () => ({ params: Promise.resolve({ roomId: "room-1" }) });
const URL_ = "https://averna.test/api/speaking/session/room-1";
const post = (body: unknown) =>
  new Request(URL_, { method: "POST", headers: { origin: "https://averna.test", "content-type": "application/json" }, body: JSON.stringify(body) });

const base = initialSessionState(buildPeerContent("quick", 6, () => 0.4), "A", { A: 6, B: 5.5 });
/**
 * Walk the session to the last timed phase of round 2 (one `next` from done), spending
 * `share` of each phase's timer (the last phase's timer started 10 min ago, so it counts in full).
 */
function lastPhase(share = 1): PeerSessionState {
  let t = Date.now() - 60 * 60_000;
  let s = advance(advance(base, "ready", "A", t), "ready", "B", t);
  const plan = phasePlan(s);
  while (s.phase < plan.length - 2) {
    const p = plan[s.phase];
    const by = p.kind === "timed" ? p.lead! : (plan[s.phase + 1].lead ?? "A");
    if (p.kind === "timed") t += p.durationSec * 1000 * share;
    if (s.phase === plan.length - 3) t = Date.now() - 10 * 60_000;
    s = advance(s, p.kind === "timed" ? "skip" : "start", by, t);
  }
  return s;
}
const peerLog = (roomId: string) => ({ points: 25, details: { kind: "peer", roomId } });
const room = (state: PeerSessionState) => ({
  id: "room-1",
  topic: "Cue card",
  format: "quick",
  status: "ACTIVE",
  state,
  version: 9,
  studentAId: "st-a",
  studentAName: "Aziza",
  studentBId: "st-b",
  studentBName: "Bek",
  createdAt: new Date(Date.now() - 10 * 60_000),
});

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-b", role: "STUDENT" } });
  m.db.student.findUnique.mockResolvedValue({ id: "st-b" });
  m.db.speakingRoom.updateMany.mockResolvedValue({ count: 1 });
  m.db.speakingQueue.deleteMany.mockResolvedValue({ count: 2 });
  m.db.speakingSignal.deleteMany.mockResolvedValue({ count: 5 });
  m.db.speakingRoom.count.mockResolvedValue(0);
  m.db.activityLog.findMany.mockResolvedValue([]);
  m.db.activityLog.create.mockReturnValue({ kind: "activity-log-write" });
  m.awardXp.mockImplementation(async (input: { amount: number }) => ({ applied: true, amount: input.amount, duplicate: false }));
});

describe("peer speaking XP", () => {
  it("awards SPEAKING_SESSION_COMPLETED to both students once the second round finishes", async () => {
    const s = lastPhase();
    m.db.speakingRoom.findUnique.mockResolvedValue(room(s));
    const lead = phasePlan(s)[s.phase].lead!; // round 2 examiner = B
    m.db.student.findUnique.mockResolvedValue({ id: lead === "A" ? "st-a" : "st-b" });
    const res = await POST(post({ action: "next", version: 9 }), ctx());
    const body = await res.json();
    expect(body).toMatchObject({ changed: true, version: 10, state: { endedBy: null }, xp: XP_CONFIG.peerSpeaking.quick });

    expect(m.awardXp).toHaveBeenCalledTimes(2);
    const calls = m.awardXp.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.studentId).sort()).toEqual(["st-a", "st-b"]);
    for (const c of calls) {
      expect(c.idempotencyKey).toBe(`peer-speaking:room-1:${c.studentId}`);
      expect(c.amount).toBe(XP_CONFIG.peerSpeaking.quick);
      expect(c.skipLog).toBe(true);
      expect(c.atomicWith).toHaveLength(1);
    }
    expect(m.db.activityLog.create.mock.calls.map((c) => c[0].data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ studentId: "st-a", action: "SPEAKING_SESSION_COMPLETED", points: XP_CONFIG.peerSpeaking.quick }),
        expect.objectContaining({ studentId: "st-b", action: "SPEAKING_SESSION_COMPLETED" }),
      ]),
    );
  });

  it("respects the daily budget", async () => {
    const s = lastPhase();
    m.db.speakingRoom.findUnique.mockResolvedValue(room(s));
    m.db.activityLog.findMany.mockResolvedValue([{ points: 900 }]); // above the hard limit: ×0.2
    const body = await (await POST(post({ action: "skip", version: 9 }), ctx())).json();
    expect(body.xp).toBe(Math.round(XP_CONFIG.peerSpeaking.quick * 0.2));
  });

  it("gives nothing when a student ends the session early (any round)", async () => {
    for (const s of [advance(advance(advance(base, "ready", "A", 1), "ready", "B", 1), "start", "A", 2), lastPhase()]) {
      m.awardXp.mockClear();
      m.db.speakingRoom.findUnique.mockResolvedValue(room(s));
      const body = await (await POST(post({ action: "end", version: 9 }), ctx())).json();
      expect(body).toMatchObject({ changed: true, state: { endedBy: "B" } });
      expect(body.xp).toBeUndefined();
      expect(m.awardXp).not.toHaveBeenCalled();
    }
  });

  it("returns the original amount on a repeat award, and GET shows the caller's XP after a natural finish", async () => {
    const s = lastPhase();
    m.db.speakingRoom.findUnique.mockResolvedValue(room(s));
    m.awardXp.mockResolvedValue({ applied: false, amount: 0, duplicate: true });
    m.findAward.mockResolvedValue({ amount: 22 });
    expect((await (await POST(post({ action: "skip", version: 9 }), ctx())).json()).xp).toBe(22);

    const done = advance(s, "skip", phasePlan(s)[s.phase].lead!, 3);
    m.db.speakingRoom.findUnique.mockResolvedValue({ ...room(done), status: "ENDED", version: 10 });
    m.findAward.mockResolvedValue({ amount: 25 });
    const view = await (await GET(new Request(URL_), ctx())).json();
    expect(view).toMatchObject({ xp: 25, me: { seat: "B" }, status: "ENDED" });
    expect(m.findAward).toHaveBeenLastCalledWith("st-b", "peer-speaking:room-1:st-b");
  });

  it("deletes the room's signals and queue rows at the done transition", async () => {
    m.db.speakingRoom.findUnique.mockResolvedValue(room(lastPhase()));
    await POST(post({ action: "end", version: 9 }), ctx());
    expect(m.db.speakingSignal.deleteMany).toHaveBeenCalledWith({ where: { roomId: "room-1" } });
    expect(m.db.speakingQueue.deleteMany).toHaveBeenCalledWith({ where: { roomId: "room-1" } });
  });

  it("holds XP back when less than half the timed duration was spent, and says why", async () => {
    const s = lastPhase(0.1);
    // Only the last phase ran in full: far below 50% of the plan.
    m.db.speakingRoom.findUnique.mockResolvedValue(room({ ...s, timedMs: 0, startAt: Date.now() - 1000 }));
    const body = await (await POST(post({ action: "skip", version: 9 }), ctx())).json();
    expect(body).toMatchObject({ xp: 0, xpHold: "unfinished", state: { xpHold: { A: "unfinished", B: "unfinished" } } });
    expect(m.awardXp).not.toHaveBeenCalled();
  });

  it("pays a pair at most once per day, and a student at most 3 times per day", async () => {
    const s = lastPhase();
    m.db.speakingRoom.findUnique.mockResolvedValue(room(s));
    m.db.activityLog.findMany.mockResolvedValue([peerLog("room-0")]);
    m.db.speakingRoom.count.mockResolvedValue(1); // room-0 was with the same partner
    let body = await (await POST(post({ action: "skip", version: 9 }), ctx())).json();
    expect(body).toMatchObject({ xp: 0, xpHold: "pair" });
    expect(m.awardXp).not.toHaveBeenCalled();

    m.db.activityLog.findMany.mockResolvedValue([peerLog("r1"), peerLog("r2"), peerLog("r3")]);
    m.db.speakingRoom.count.mockResolvedValue(0);
    body = await (await POST(post({ action: "skip", version: 9 }), ctx())).json();
    expect(body).toMatchObject({ xp: 0, xpHold: "daily" });
    expect(m.awardXp).not.toHaveBeenCalled();

    // The same room's own log (a repeat) never counts against it.
    m.db.activityLog.findMany.mockResolvedValue([peerLog("room-1"), peerLog("r1")]);
    body = await (await POST(post({ action: "skip", version: 9 }), ctx())).json();
    expect(body.xpHold).toBeNull();
    expect(m.awardXp).toHaveBeenCalledTimes(2);
  });

  it("GET reports the stored hold for the caller's seat", async () => {
    const s = lastPhase();
    const done = { ...advance(s, "skip", phasePlan(s)[s.phase].lead!, Date.now()), xpHold: { B: "daily" as const } };
    m.db.speakingRoom.findUnique.mockResolvedValue({ ...room(done), status: "ENDED", version: 10 });
    m.findAward.mockResolvedValue(null);
    const view = await (await GET(new Request(URL_), ctx())).json();
    expect(view).toMatchObject({ xp: null, xpHold: "daily" });
  });
});
