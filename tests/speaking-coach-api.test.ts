/** POST /api/speaking/coach — opt-in AI coach on own captions (docs/peer-speaking.md, Phase C). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  hasOpenAI: vi.fn(),
  coach: vi.fn(),
  db: { student: { findUnique: vi.fn() }, speakingRoom: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: m.limit }));
vi.mock("@/lib/ai", () => ({ hasOpenAI: m.hasOpenAI, coachPeerSpeaking: m.coach }));

import { POST } from "@/app/api/speaking/coach/route";
import { AI_LIMITS } from "@/lib/engine/ai-guard";

const SECRET = "my grandmother lives in Samarkand and she cooks plov every Friday for the whole family";
const transcript = `${SECRET} ${"and I think that travelling is really good for young people because they learn a lot ".repeat(3)}`;
const result = {
  bandEstimate: { low: 5.5, high: 6 },
  strengths: ["Clear examples", "Good linking"],
  improvements: [
    { point: "Vary verbs", original: "is really good", rewrite: "is genuinely valuable" },
    { point: "Extend", original: "they learn a lot", rewrite: "they pick up a great deal" },
    { point: "Tenses", original: "she cooks", rewrite: "she has always cooked" },
  ],
  vocabularyUpgrades: [
    { instead: "good", try: "beneficial" },
    { instead: "a lot", try: "a great deal" },
    { instead: "think", try: "believe" },
  ],
};
const body = (over: Record<string, unknown> = {}) => ({ roomId: "room-1", consent: true, transcript, stats: { words: 60, wpm: 118, fillers: 2 }, ...over });
const req = (b: unknown) =>
  new Request("https://averna.test/api/speaking/coach", { method: "POST", headers: { origin: "https://averna.test", "content-type": "application/json" }, body: JSON.stringify(b) });

let spies: { mock: { calls: unknown[][] }; mockRestore: () => void }[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-a", role: "STUDENT" } });
  m.db.student.findUnique.mockResolvedValue({ id: "st-a" });
  m.db.speakingRoom.findUnique.mockResolvedValue({ id: "room-1", status: "ENDED", state: null, version: 1, studentAId: "st-a", studentAName: "A", studentBId: "st-b", studentBName: "B", topic: "t", format: "quick" });
  m.hasOpenAI.mockReturnValue(true);
  m.coach.mockResolvedValue(result);
  m.limit.mockResolvedValue({ ok: true });
  spies = (["log", "info", "warn", "error", "debug"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => undefined));
});
afterEach(() => spies.forEach((s) => s.mockRestore()));

const logged = () =>
  spies
    .flatMap((s) => s.mock.calls)
    .map((args) => args.map((a: unknown) => (a instanceof Error ? `${a.name} ${a.message}` : (JSON.stringify(a) ?? String(a)))).join(" "));

describe("POST /api/speaking/coach", () => {
  it("returns the coach result for a member who consented", async () => {
    const res = await POST(req(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);
    expect(m.coach).toHaveBeenCalledWith(transcript.trim(), { words: 60, wpm: 118, fillers: 2 });
  });

  it("requires the consent flag, AI, membership and enough words", async () => {
    expect((await POST(req(body({ consent: undefined })))).status).toBe(400);
    expect((await POST(req(body({ consent: "yes" })))).status).toBe(400);
    expect((await POST(req(body({ transcript: "too short to coach" })))).status).toBe(400);
    expect((await POST(req(body({ transcript: "word ".repeat(1300) })))).status).toBe(400); // > 6000 chars
    m.hasOpenAI.mockReturnValue(false);
    expect((await POST(req(body()))).status).toBe(503);
    m.hasOpenAI.mockReturnValue(true);
    m.db.student.findUnique.mockResolvedValue({ id: "st-x" });
    expect((await POST(req(body()))).status).toBe(403);
    expect(m.coach).not.toHaveBeenCalled();
  });

  it("is limited to 3 a day per student", async () => {
    expect(AI_LIMITS["peer-coach"]).toEqual({ perHour: 3, perDay: 3 });
    let used = 0;
    m.limit.mockImplementation(async () => (++used <= 3 ? { ok: true } : { ok: false, retryAfterSeconds: 60 }));
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await POST(req(body()))).status);
    expect(codes).toEqual([200, 200, 200, 429]);
    expect(m.coach).toHaveBeenCalledTimes(3);
    const keys = m.limit.mock.calls[0][0].map((p: { key: string }) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["ai:peer-coach:u-a:day"]));
  });

  it("answers with a friendly message on AI failure and never logs the transcript", async () => {
    m.coach.mockResolvedValueOnce(null);
    const res = await POST(req(body()));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/couldn't answer/);

    m.coach.mockRejectedValueOnce(new Error(`boom: ${SECRET}`));
    expect((await POST(req(body()))).status).toBe(503);
    await POST(req(body({ consent: false })));

    const all = logged().join("\n");
    expect(all).not.toContain("Samarkand");
    expect(all).not.toContain("travelling");
  });
});

describe("parsePeerCoach", () => {
  it("normalises the band range and trims the lists", async () => {
    const { parsePeerCoach } = await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
    const out = parsePeerCoach({
      bandLow: 6.7,
      bandHigh: 5.2,
      strengths: ["a", "b", "c"],
      improvements: [...result.improvements, { point: "extra", original: "x", rewrite: "y" }],
      vocabularyUpgrades: [...result.vocabularyUpgrades, { instead: "big", try: "huge" }],
    })!;
    expect(out.bandEstimate).toEqual({ low: 5, high: 6 });
    expect(out.strengths).toHaveLength(2);
    expect(out.improvements).toHaveLength(3);
    expect(out.vocabularyUpgrades).toHaveLength(3);
    expect(parsePeerCoach({ bandLow: "x", bandHigh: 6, strengths: ["a"], improvements: result.improvements })).toBeNull();
    expect(parsePeerCoach({ bandLow: 6, bandHigh: 6, strengths: [], improvements: [] })).toBeNull();
  });
});
