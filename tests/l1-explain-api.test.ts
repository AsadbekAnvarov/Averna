/** POST /api/l1/explain — "Explain in Oʻzbekcha / по-русски" on result pages (docs/elegance-roadmap.md, idea 8). */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  hasOpenAI: vi.fn(),
  translate: vi.fn(),
  cacheKeys: [] as string[][],
  cacheOptions: [] as unknown[],
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: m.limit }));
vi.mock("@/lib/ai", () => ({ hasOpenAI: m.hasOpenAI, translateExplanationL1: m.translate }));
// The data cache as a recorder: keys are checked, calls go straight through.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>, keys: string[], options: unknown) => {
    m.cacheKeys.push(keys);
    m.cacheOptions.push(options);
    return fn;
  },
}));

import { POST } from "@/app/api/l1/explain/route";
import { AI_LIMITS } from "@/lib/engine/ai-guard";

const EXPLANATION = "Paragraph B says the tower ‘could feed around two thousand residents’, so the statement is FALSE.";
const req = (b: unknown, headers: Record<string, string> = {}) =>
  new Request("https://averna.test/api/l1/explain", {
    method: "POST",
    headers: { origin: "https://averna.test", "content-type": "application/json", ...headers },
    body: typeof b === "string" ? b : JSON.stringify(b),
  });

let spies: { mock: { calls: unknown[][] }; mockRestore: () => void }[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  m.cacheKeys.length = 0;
  m.cacheOptions.length = 0;
  m.auth.mockResolvedValue({ user: { id: "u-1", role: "STUDENT" } });
  m.limit.mockResolvedValue({ ok: true });
  m.hasOpenAI.mockReturnValue(true);
  m.translate.mockResolvedValue("B xatboshida ‘could feed around two thousand residents’ deyilgan, shuning uchun javob FALSE.");
  spies = (["log", "info", "warn", "error"] as const).map((k) => vi.spyOn(console, k).mockImplementation(() => undefined));
});
afterEach(() => spies.forEach((s) => s.mockRestore()));

describe("POST /api/l1/explain", () => {
  it("translates for a signed-in student and caches by a sha256 of (text, lang)", async () => {
    const res = await POST(req({ text: EXPLANATION, lang: "uz" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: expect.stringContaining("FALSE"), lang: "uz" });
    expect(m.translate).toHaveBeenCalledWith(EXPLANATION, "uz");
    expect(res.headers.get("cache-control")).toContain("no-store");
    const [keys] = m.cacheKeys;
    expect(keys[0]).toBe("l1-explain-v1");
    expect(keys[1]).toBe("uz");
    expect(keys[2]).toMatch(/^[0-9a-f]{64}$/);
    expect(keys.join(" ")).not.toContain("tower"); // the key is a hash, not the text
    // Same pair → same key; another language → another key.
    await POST(req({ text: EXPLANATION, lang: "uz" }));
    await POST(req({ text: EXPLANATION, lang: "ru" }));
    expect(m.cacheKeys[1]).toEqual(keys);
    expect(m.cacheKeys[2][2]).not.toBe(keys[2]);
  });

  it("requires a student session", async () => {
    m.auth.mockResolvedValue(null);
    expect((await POST(req({ text: EXPLANATION, lang: "uz" }))).status).toBe(401);
    m.auth.mockResolvedValue({ user: { id: "t-1", role: "TEACHER" } });
    expect((await POST(req({ text: EXPLANATION, lang: "uz" }))).status).toBe(403);
    expect(m.translate).not.toHaveBeenCalled();
  });

  it("rejects a cross-site call", async () => {
    expect((await POST(req({ text: EXPLANATION, lang: "uz" }, { origin: "https://evil.test" }))).status).toBe(403);
  });

  it("validates the body: 1–1200 characters, uz or ru", async () => {
    const tooLong = await POST(req({ text: "a".repeat(1201), lang: "ru" }));
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error).toMatch(/too long/);
    expect((await POST(req({ text: "a".repeat(1200), lang: "ru" }))).status).toBe(200);
    for (const bad of [{ text: "   ", lang: "uz" }, { text: EXPLANATION, lang: "de" }, { text: 42, lang: "uz" }, {}, null, "not json"])
      expect((await POST(req(bad as unknown))).status).toBe(400);
  });

  it("answers 503 with a friendly message when no AI key is configured", async () => {
    m.hasOpenAI.mockReturnValue(false);
    const res = await POST(req({ text: EXPLANATION, lang: "ru" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/isn't available/);
    expect(m.limit).not.toHaveBeenCalled();
    expect(m.translate).not.toHaveBeenCalled();
  });

  it("is limited per student per day (429)", async () => {
    expect(AI_LIMITS["l1-explain"]).toEqual({ perHour: 20, perDay: 40 });
    let used = 0;
    m.limit.mockImplementation(async () => (++used <= 2 ? { ok: true } : { ok: false, retryAfterSeconds: 60 }));
    const codes: number[] = [];
    for (let i = 0; i < 3; i++) codes.push((await POST(req({ text: EXPLANATION, lang: "uz" }))).status);
    expect(codes).toEqual([200, 200, 429]);
    expect(m.translate).toHaveBeenCalledTimes(2);
    const keys = m.limit.mock.calls[0][0].map((p: { key: string }) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["ai:l1-explain:u-1:day", "ai:l1-explain:u-1:hour"]));
  });

  it("a failed translation is a 502, never cached, and the text is never logged", async () => {
    m.translate.mockResolvedValueOnce(null);
    const res = await POST(req({ text: EXPLANATION, lang: "uz" }));
    expect(res.status).toBe(502);
    m.translate.mockRejectedValueOnce(new Error(`boom: ${EXPLANATION}`));
    expect((await POST(req({ text: EXPLANATION, lang: "uz" }))).status).toBe(502);
    const logged = spies.flatMap((s) => s.mock.calls).map((a) => a.map(String).join(" ")).join("\n");
    expect(logged).not.toContain("tower");
  });
});
