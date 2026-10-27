/**
 * Live speaking partner routes (docs/elegance-roadmap.md, idea 3): /api/coach/live/start,
 * /end and /tips with OpenAI's Realtime API mocked at fetch, after() captured, and an
 * in-memory activity log behind the Prisma calls the store makes.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = { id: string; studentId: string; action: string; details: Record<string, unknown> | null; points: number; createdAt: Date };

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  hasOpenAI: vi.fn(),
  tips: vi.fn(),
  awardXp: vi.fn(),
  after: vi.fn(),
  rows: [] as Row[],
  /** Runs right after a row is created (simulates a concurrent request). */
  onCreate: null as null | ((row: Row) => void),
  seq: 0,
}));

function matches(row: Row, where: Record<string, unknown>): boolean {
  for (const [k, cond] of Object.entries(where)) {
    const v = (row as unknown as Record<string, unknown>)[k];
    if (k === "details") {
      const c = cond as { path: string[]; equals: unknown };
      if ((row.details ?? {})[c.path[0]] !== c.equals) return false;
    } else if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { gte?: Date; gt?: number; in?: unknown[] };
      if (c.gte && !((v as Date) >= c.gte)) return false;
      if (c.gt != null && !((v as number) > c.gt)) return false;
      if (c.in && !c.in.includes(v)) return false;
    } else if (v !== cond) return false;
  }
  return true;
}

vi.mock("@/lib/db", () => ({
  db: {
    student: { findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => (where.userId.startsWith("u-") ? { id: `s-${where.userId}`, level: "B1", targetBand: "6.5" } : null)) },
    activityLog: {
      findMany: vi.fn(async ({ where, take }: { where: Record<string, unknown>; take?: number }) => m.rows.filter((r) => matches(r, where)).slice(0, take ?? 10_000).map((r) => ({ ...r, details: r.details && { ...r.details } }))),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const r = m.rows.find((x) => matches(x, where));
        return r ? { ...r, details: r.details && { ...r.details } } : null;
      }),
      create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
        const row: Row = { id: `row-${++m.seq}`, createdAt: new Date(), ...data, details: (data.details as Row["details"]) ?? null, points: data.points ?? 0 };
        m.rows.push(row);
        m.onCreate?.(row);
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: { details: Row["details"] } }) => {
        const hit = m.rows.filter((r) => matches(r, where));
        for (const r of hit) r.details = { ...(data.details ?? {}) };
        return { count: hit.length };
      }),
      deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const before = m.rows.length;
        m.rows = m.rows.filter((r) => !matches(r, where));
        return { count: before - m.rows.length };
      }),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: m.limit }));
vi.mock("@/lib/ai", () => ({ hasOpenAI: m.hasOpenAI, liveSpeakingTips: m.tips }));
vi.mock("@/lib/speaking/peer-store", () => ({ studentPeerLevel: async () => ({ band: 5.5, cefr: "B2", source: "profile" }) }));
vi.mock("@/lib/engine/xp-engine", () => ({
  BUDGETED_ACTIONS: ["SPEAKING_SESSION_COMPLETED"],
  findAward: vi.fn(async () => null),
  awardXp: m.awardXp,
}));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: m.after }));

import { POST as start } from "@/app/api/coach/live/start/route";
import { POST as end } from "@/app/api/coach/live/end/route";
import { POST as tips } from "@/app/api/coach/live/tips/route";
import { AI_LIMITS } from "@/lib/engine/ai-guard";
import { LIVE_TOPICS } from "@/lib/realtime/topics";

const ORIGIN = "https://averna.test";
const SDP_OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=SECRET-OFFER-MARKER\r\n";
const SDP_ANSWER = "v=0\r\no=- 9 9 IN IP4 0.0.0.0\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
const TOPIC = LIVE_TOPICS.part1[0];

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${url}`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const startReq = (over: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  post("/api/coach/live/start", { sdp: SDP_OFFER, mode: "part1", topicId: TOPIC.id, ...over }, headers);

let calls = 0;
const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
  const u = String(url);
  if (u === "https://api.openai.com/v1/realtime/calls") {
    calls += 1;
    return new Response(SDP_ANSWER, { status: 201, headers: { "content-type": "application/sdp", location: `/v1/realtime/calls/rtc_call${calls}` } });
  }
  if (/\/v1\/realtime\/calls\/[^/]+\/hangup$/.test(u)) return new Response(null, { status: 200 });
  throw new Error(`unexpected fetch ${u} ${init?.method}`);
});
const hangups = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.endsWith("/hangup"));
const liveRows = () => m.rows.filter((r) => r.action === "LIVE_SPEAKING");

let spies: { mock: { calls: unknown[][] }; mockRestore: () => void }[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  m.rows = [];
  m.seq = 0;
  m.onCreate = null;
  calls = 0;
  m.auth.mockResolvedValue({ user: { id: "u-1", role: "STUDENT" } });
  m.limit.mockResolvedValue({ ok: true });
  m.hasOpenAI.mockReturnValue(true);
  m.awardXp.mockImplementation(async ({ amount }: { amount: number }) => ({ applied: true, amount, duplicate: false }));
  process.env.OPENAI_API_KEY = "sk-test-0123456789abcdefghijklmnop";
  delete process.env.REALTIME_STUDENT_MINUTES_PER_DAY;
  delete process.env.REALTIME_DAILY_MINUTES_CAP;
  delete process.env.REALTIME_MAX_CALL_SECONDS;
  vi.stubGlobal("fetch", fetchMock);
  spies = (["log", "info", "warn", "error"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => undefined));
});
afterEach(() => {
  spies.forEach((s) => s.mockRestore());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const usedRow = (studentId: string, seconds: number, state: "open" | "ended" = "ended", callId: string | null = null): Row => ({
  id: `old-${++m.seq}`,
  studentId,
  action: "LIVE_SPEAKING",
  points: 0,
  createdAt: new Date(),
  details: { kind: "live-call", state, callId, startedAt: new Date().toISOString(), reservedSec: seconds, seconds, endedAt: null, endedBy: null, hungUp: false, mode: "casual", topicId: "x" },
});

describe("POST /api/coach/live/start", () => {
  it("returns OpenAI's SDP answer, reserves the call and schedules the server-side hard stop", async () => {
    const res = await start(startReq());
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toBe("application/sdp");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await res.text()).toBe(SDP_ANSWER);
    expect(res.headers.get("x-live-seconds")).toBe("240");
    expect(decodeURIComponent(res.headers.get("x-live-topic") ?? "")).toBe(TOPIC.label);

    // One multipart request to the unified calls endpoint, key and safety id on the server only.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/realtime/calls");
    const headers = init!.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-test-0123456789abcdefghijklmnop");
    expect(headers["OpenAI-Safety-Identifier"]).toBe(createHash("sha256").update("u-1").digest("hex"));
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("openai-beta");
    const form = init!.body as FormData;
    expect(form.get("sdp")).toBe(SDP_OFFER);
    const session = JSON.parse(String(form.get("session")));
    expect(session).toMatchObject({ type: "realtime", model: "gpt-realtime-2.1-mini", include: ["item.input_audio_transcription.logprobs"] });
    expect(session.audio.input.transcription.model).toBe("gpt-4o-transcribe");
    expect(session.instructions).toContain(TOPIC.label);

    // The reservation holds the full length, with OpenAI's call id.
    const [row] = liveRows();
    expect(res.headers.get("x-live-call")).toBe(row.id);
    expect(row.details).toMatchObject({ state: "open", callId: "rtc_call1", reservedSec: 240, seconds: 240, mode: "part1", topicId: TOPIC.id });

    // after(): waits the reserved length + 5 s, then hangs up and settles (tampered client).
    expect(m.after).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const stop = (m.after.mock.calls[0][0] as () => Promise<void>)();
    await vi.advanceTimersByTimeAsync(244_000);
    expect(hangups()).toEqual([]);
    await vi.advanceTimersByTimeAsync(2_000);
    await stop;
    expect(hangups()).toEqual(["https://api.openai.com/v1/realtime/calls/rtc_call1/hangup"]);
    expect(liveRows()[0].details).toMatchObject({ state: "ended", endedBy: "server", hungUp: true });
    expect(liveRows()[0].details!.seconds as number).toBeLessThanOrEqual(240);
  });

  it("never logs the SDP", async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { message: "bad" } }), { status: 500 }));
    await start(startReq());
    const logged = spies.flatMap((s) => s.mock.calls).map((a) => a.map(String).join(" ")).join("\n");
    expect(logged).not.toContain("SECRET-OFFER-MARKER");
  });

  it("requires a signed-in student and a same-origin request", async () => {
    m.auth.mockResolvedValue(null);
    expect((await start(startReq())).status).toBe(401);
    m.auth.mockResolvedValue({ user: { id: "t-1", role: "TEACHER" } });
    expect((await start(startReq())).status).toBe(403);
    m.auth.mockResolvedValue({ user: { id: "u-1", role: "STUDENT" } });
    expect((await start(startReq({}, { origin: "https://evil.test" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates the body (400): SDP shape and size, mode, topic", async () => {
    for (const bad of [
      { sdp: "hello" },
      { sdp: `v=0\r\n${"a".repeat(20_001)}` },
      { mode: "part2" },
      { topicId: "p3-averna-speaking-01" }, // a Part 3 topic in Part 1 mode
      { topicId: "" },
    ])
      expect((await start(startReq(bad))).status).toBe(400);
    expect((await start(post("/api/coach/live/start", "not json"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveRows()).toEqual([]);
  });

  it("answers 503 without an OpenAI key and reserves nothing", async () => {
    m.hasOpenAI.mockReturnValue(false);
    const res = await start(startReq());
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/isn't available/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveRows()).toEqual([]);
  });

  it("429 when the student's daily minutes are used up", async () => {
    process.env.REALTIME_STUDENT_MINUTES_PER_DAY = "1";
    m.rows.push(usedRow("s-u-1", 45));
    const res = await start(startReq());
    expect(res.status).toBe(429);
    expect((await res.json()).reason).toBe("student-limit");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveRows()).toHaveLength(1);
  });

  it("429 when the global daily budget is used up", async () => {
    process.env.REALTIME_DAILY_MINUTES_CAP = "2";
    m.rows.push(usedRow("s-u-2", 60), usedRow("s-u-3", 50));
    const res = await start(startReq());
    expect(res.status).toBe(429);
    expect((await res.json()).reason).toBe("global-limit");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("429 when guardAi caps the number of calls", async () => {
    expect(AI_LIMITS["realtime-speaking"]).toEqual({ perHour: 4, perDay: 6 });
    m.limit.mockResolvedValue({ ok: false, retryAfterSeconds: 60 });
    const res = await start(startReq());
    expect(res.status).toBe(429);
    expect((await res.json()).reason).toBe("call-limit");
    expect(m.limit.mock.calls[0][0].map((p: { key: string }) => p.key)).toEqual(expect.arrayContaining(["ai:realtime-speaking:u-1:day"]));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveRows()).toEqual([]);
  });

  it("rolls its reservation back when a concurrent call took the minutes meanwhile", async () => {
    process.env.REALTIME_STUDENT_MINUTES_PER_DAY = "5"; // 300 s, a call reserves 240
    m.onCreate = (row) => {
      if (row.action === "LIVE_SPEAKING" && row.id !== "concurrent") m.rows.push({ ...usedRow("s-u-1", 240, "open"), id: "concurrent" });
    };
    const res = await start(startReq());
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(liveRows().map((r) => r.id)).toEqual(["concurrent"]);
  });

  it("removes the reservation when OpenAI refuses (502)", async () => {
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 500 }));
    const res = await start(startReq());
    expect(res.status).toBe(502);
    expect(liveRows()).toEqual([]);
    expect(m.after).not.toHaveBeenCalled();
  });

  it("a new start hangs up the student's previous open call", async () => {
    const first = await start(startReq());
    const firstId = first.headers.get("x-live-call");
    const second = await start(startReq({ mode: "casual", topicId: "surprise" }));
    expect(second.status).toBe(201);
    expect(hangups()).toEqual(["https://api.openai.com/v1/realtime/calls/rtc_call1/hangup"]);
    const old = liveRows().find((r) => r.id === firstId)!;
    expect(old.details).toMatchObject({ state: "ended", endedBy: "replaced", hungUp: true });
    const fresh = liveRows().find((r) => r.id === second.headers.get("x-live-call"))!;
    expect(fresh.details).toMatchObject({ state: "open", callId: "rtc_call2" });
  });
});

describe("POST /api/coach/live/end", () => {
  it("settles to the server-measured length, hangs up once, awards XP for ≥ 60 s of speech, and is idempotent", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T08:00:00Z"));
    const res = await start(startReq());
    const id = res.headers.get("x-live-call")!;
    vi.setSystemTime(new Date("2026-10-21T08:01:30Z")); // 90 s later
    const out = await end(post("/api/coach/live/end", { id, speechSec: 70, words: 140 }));
    expect(out.status).toBe(200);
    const body = await out.json();
    expect(body).toMatchObject({ ok: true, seconds: 90, xp: 10 });
    expect(body.remainingSec).toBe(600 - 90);
    expect(hangups()).toEqual(["https://api.openai.com/v1/realtime/calls/rtc_call1/hangup"]);
    expect(liveRows()[0].details).toMatchObject({ state: "ended", endedBy: "student", seconds: 90, hungUp: true });
    expect(m.awardXp).toHaveBeenCalledWith(expect.objectContaining({ studentId: "s-u-1", amount: 10, idempotencyKey: `live-speaking:${id}:s-u-1` }));

    // A repeat (e.g. the pagehide keepalive) changes nothing and doesn't hang up again.
    vi.setSystemTime(new Date("2026-10-21T08:03:00Z"));
    const again = await (await end(post("/api/coach/live/end", { id }))).json();
    expect(again.seconds).toBe(90);
    expect(hangups()).toHaveLength(1);
  });

  it("pays no XP for a short call", async () => {
    const res = await start(startReq());
    const body = await (await end(post("/api/coach/live/end", { id: res.headers.get("x-live-call"), speechSec: 20 }))).json();
    expect(body.xp).toBe(0);
    expect(body.xpNote).toMatch(/at least 1 minute/);
    expect(m.awardXp).not.toHaveBeenCalled();
  });

  it("only ends the student's own calls", async () => {
    const res = await start(startReq());
    const id = res.headers.get("x-live-call");
    m.auth.mockResolvedValue({ user: { id: "u-2", role: "STUDENT" } });
    expect((await end(post("/api/coach/live/end", { id }))).status).toBe(404);
    expect(liveRows()[0].details).toMatchObject({ state: "open" });
    m.auth.mockResolvedValue({ user: { id: "t-1", role: "TEACHER" } });
    expect((await end(post("/api/coach/live/end", { id }))).status).toBe(403);
    m.auth.mockResolvedValue(null);
    expect((await end(post("/api/coach/live/end", { id }))).status).toBe(401);
    m.auth.mockResolvedValue({ user: { id: "u-1", role: "STUDENT" } });
    expect((await end(post("/api/coach/live/end", { id: 42 }))).status).toBe(400);
  });
});

describe("POST /api/coach/live/tips", () => {
  const body = {
    mode: "casual",
    topic: "Travel",
    turns: [
      { who: "ai", text: "Where did you go last summer?" },
      { who: "me", text: "I went to Samarkand with my family, it was very hot but beautiful." },
    ],
    stats: { words: 13, wpm: null, fillers: 0, longestAnswerWords: 13, callSec: 60 },
  };

  it("returns three AI tips (one call, guardAi-limited)", async () => {
    expect(AI_LIMITS["live-speaking-tips"]).toBeTruthy();
    m.tips.mockResolvedValue(["Tip one.", "Tip two.", "Tip three."]);
    const res = await tips(post("/api/coach/live/tips", body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tips: ["Tip one.", "Tip two.", "Tip three."], source: "ai" });
    expect(m.tips).toHaveBeenCalledTimes(1);
  });

  it("503 without a key, 429 at the limit, 502 when the model fails, 400 for a bad body", async () => {
    m.hasOpenAI.mockReturnValue(false);
    expect((await tips(post("/api/coach/live/tips", body))).status).toBe(503);
    m.hasOpenAI.mockReturnValue(true);
    m.limit.mockResolvedValueOnce({ ok: false });
    expect((await tips(post("/api/coach/live/tips", body))).status).toBe(429);
    m.tips.mockResolvedValue(null);
    expect((await tips(post("/api/coach/live/tips", body))).status).toBe(502);
    expect((await tips(post("/api/coach/live/tips", { ...body, turns: [{ who: "ai", text: "only the partner" }] }))).status).toBe(400);
    expect((await tips(post("/api/coach/live/tips", { ...body, turns: [{ who: "me", text: "x".repeat(1_501) }] }))).status).toBe(400);
  });
});
