// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), get: vi.fn(), mutate: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: m.auth })); vi.mock("@/lib/learning-cycle/service", () => ({ getCycle: m.get, mutateCycle: m.mutate })); vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: m.limit }));
import { GET, POST } from "@/app/api/learning/feedback-cycle/[testId]/route";
const props = { params: Promise.resolve({ testId: "test-12345" }) };
const req = (body: unknown = { action: "START" }, headers: Record<string, string> = {}) => new Request("https://averna.example/api/learning/feedback-cycle/test-12345", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://averna.example", ...headers }, body: JSON.stringify(body) });
describe("practice cycle API boundaries", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("LEARNING_CYCLE", "on"); m.auth.mockResolvedValue({ id: "u", role: "STUDENT" }); m.get.mockResolvedValue({ sourceId: "test-12345" }); m.limit.mockResolvedValue({ ok: true }) }); afterEach(() => vi.unstubAllEnvs());
  it("is opt-in and reads no student data when disabled", async () => { vi.stubEnv("LEARNING_CYCLE", ""); expect((await GET(new Request("https://averna.example"), props)).status).toBe(404); expect(m.auth).not.toHaveBeenCalled(); expect(m.get).not.toHaveBeenCalled() });
  it("rejects signed-out reads", async () => { m.auth.mockRejectedValue(new Error("Unauthorized")); expect((await GET(new Request("https://averna.example"), props)).status).toBe(401); expect(m.get).not.toHaveBeenCalled() });
  it("returns private no-store data and varies by cookie", async () => { const r = await GET(new Request("https://averna.example"), props); expect(r.headers.get("cache-control")).toContain("no-store"); expect(r.headers.get("vary")).toBe("Cookie") });
  it("rejects cross-origin changes before auth or rate reservation", async () => { expect((await POST(req({}, { Origin: "https://evil.example" }), props)).status).toBe(403); expect(m.auth).not.toHaveBeenCalled(); expect(m.mutate).not.toHaveBeenCalled() });
  it("rejects non-JSON writes", async () => { expect((await POST(req({}, { "Content-Type": "text/plain" }), props)).status).toBe(415); expect(m.mutate).not.toHaveBeenCalled() });
  it("bounds a streamed body even without content-length", async () => { expect((await POST(req({ body: "£".repeat(46000) }), props)).status).toBe(413); expect(m.mutate).not.toHaveBeenCalled() });
  it("rate-limits writes before mutation", async () => { m.limit.mockResolvedValue({ ok: false, retryAfterSeconds: 60 }); expect((await POST(req(), props)).status).toBe(429); expect(m.mutate).not.toHaveBeenCalled() });
  it("fails closed when the rate-limit store is unavailable", async () => { m.limit.mockResolvedValue({ ok: false, unavailable: true }); expect((await POST(req(), props)).status).toBe(503); expect(m.mutate).not.toHaveBeenCalled() });
  it("uses the authenticated actor, not a client-supplied student id", async () => { const r = await POST(req({ action: "START", studentId: "other" }), props); expect(r.status).toBe(200); expect(m.mutate.mock.calls[0][0]).toEqual({ id: "u", role: "STUDENT" }) });
  it("does not expose database error details", async () => { m.mutate.mockRejectedValue(new Error("private database password")); const r = await POST(req(), props); expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("database password") });
});
