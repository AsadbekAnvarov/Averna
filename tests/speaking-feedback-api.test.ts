/** /api/speaking/feedback — give-to-get peer feedback (docs/peer-speaking.md, Phase C). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    student: { findUnique: vi.fn() },
    speakingRoom: { findUnique: vi.fn() },
    speakingPeerFeedback: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));

import { GET, POST } from "@/app/api/speaking/feedback/route";
import { buildPeerContent } from "@/lib/speaking/peer-content";
import { advance, initialSessionState, type PeerSessionState } from "@/lib/speaking/session";

const base = initialSessionState(buildPeerContent("conversation", 6, () => 0.3), "A", { A: 6, B: 6 });
const lobbyEnded = advance(base, "end", "A", 10);
const started = advance(advance(advance(base, "ready", "A", 0), "ready", "B", 0), "start", "A", 1000);
const endedEarly = advance(started, "end", "B", 61_000);

const room = (state: PeerSessionState, status = "ENDED") => ({
  id: "room-1",
  topic: "t",
  format: "conversation",
  status,
  state,
  version: 5,
  studentAId: "st-a",
  studentAName: "Aziza",
  studentBId: "st-b",
  studentBName: "Bek",
});

const URL_ = "https://averna.test/api/speaking/feedback";
const post = (body: unknown) =>
  new Request(URL_, { method: "POST", headers: { origin: "https://averna.test", "content-type": "application/json" }, body: JSON.stringify(body) });
const get = () => new NextRequest(`${URL_}?roomId=room-1`);
const good = { roomId: "room-1", fluency: 4, lexical: 3, grammar: 5, pronunciation: 2, strength: "linked-ideas", tip: "word-stress" };
const row = (over: Record<string, unknown> = {}) => ({ fluency: 4, lexical: 3, grammar: 5, pronunciation: 2, strength: null, tip: null, createdAt: new Date(1000), ...over });

/** Feedback rows by giver id. */
let rows: Record<string, ReturnType<typeof row> | null>;

beforeEach(() => {
  vi.resetAllMocks();
  rows = { "st-a": null, "st-b": null };
  m.auth.mockResolvedValue({ user: { id: "u-a", role: "STUDENT" } });
  m.db.student.findUnique.mockResolvedValue({ id: "st-a" });
  m.db.speakingRoom.findUnique.mockResolvedValue(room(endedEarly));
  m.db.speakingPeerFeedback.findUnique.mockImplementation(async ({ where }: { where: { roomId_fromStudentId: { fromStudentId: string } } }) => rows[where.roomId_fromStudentId.fromStudentId] ?? null);
  m.db.speakingPeerFeedback.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    rows[data.fromStudentId as string] = row(data);
    return data;
  });
});

describe("/api/speaking/feedback", () => {
  it("locks the partner's feedback until I send mine (give to get)", async () => {
    rows["st-b"] = row({ fluency: 2, strength: "clear-voice", tip: "extend-answers|Great hometown story" });
    let body = await (await GET(get())).json();
    expect(body).toEqual({ allowed: true, mine: null, received: { locked: true, partnerSubmitted: true } });
    expect(JSON.stringify(body)).not.toContain("hometown");

    body = await (await POST(post(good))).json();
    expect(body.mine).toMatchObject({ fluency: 4, strength: { id: "linked-ideas" }, tip: { id: "word-stress" }, note: null });
    expect(body.received).toMatchObject({ fluency: 2, strength: { id: "clear-voice" }, tip: { id: "extend-answers" }, note: "Great hometown story" });
    expect(m.db.speakingPeerFeedback.create.mock.calls[0][0].data).toMatchObject({ roomId: "room-1", fromStudentId: "st-a", toStudentId: "st-b" });
  });

  it("before the partner has sent theirs, received is null after mine", async () => {
    const body = await (await POST(post(good))).json();
    expect(body.received).toBeNull();
    expect(body.mine).toBeTruthy();
  });

  it("only once per room", async () => {
    m.db.speakingPeerFeedback.create.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    const res = await POST(post(good));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already/);
  });

  it("validates ratings, presets and the note (no links, e-mails or phone numbers)", async () => {
    const bad = [
      { ...good, fluency: 0 },
      { ...good, grammar: 6 },
      { ...good, lexical: 3.5 },
      { ...good, pronunciation: undefined },
      { ...good, strength: "made-up" },
      { ...good, tip: "word-stress|hack" },
      { ...good, note: "follow me https://insta.com/bek" },
      { ...good, note: "text me +998 90 123 45 67" },
      { ...good, note: "bek@mail.uz" },
      { ...good, note: "x".repeat(141) },
    ];
    for (const b of bad) expect((await POST(post(b))).status).toBe(400);
    expect(m.db.speakingPeerFeedback.create).not.toHaveBeenCalled();

    expect((await POST(post({ ...good, note: "  Great   examples! " }))).status).toBe(200);
    expect(m.db.speakingPeerFeedback.create.mock.calls[0][0].data.tip).toBe("word-stress|Great examples!");
  });

  it("is open only for ENDED rooms whose first timed phase started, for members only", async () => {
    m.db.speakingRoom.findUnique.mockResolvedValue(room(lobbyEnded));
    expect((await POST(post(good))).status).toBe(409);
    expect((await (await GET(get())).json()).allowed).toBe(false);

    m.db.speakingRoom.findUnique.mockResolvedValue(room(started, "ACTIVE"));
    expect((await POST(post(good))).status).toBe(409);

    m.db.speakingRoom.findUnique.mockResolvedValue(room(endedEarly));
    m.db.student.findUnique.mockResolvedValue({ id: "st-x" });
    expect((await POST(post(good))).status).toBe(403);
    expect((await GET(get())).status).toBe(403);
    m.auth.mockResolvedValue(null);
    expect((await POST(post(good))).status).toBe(401);
    expect(m.db.speakingPeerFeedback.create).not.toHaveBeenCalled();
  });

  it("rejects cross-site posts", async () => {
    const req = new Request(URL_, { method: "POST", headers: { origin: "https://evil.test", "content-type": "application/json" }, body: JSON.stringify(good) });
    expect((await POST(req)).status).toBe(403);
  });
});
