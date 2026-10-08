import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reserve: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: mocks.reserve }));
import { guardAi } from "@/lib/engine/ai-guard";
describe("shared AI ceiling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.AI_DAILY_REQUEST_LIMIT;
  });
  it("reserves per-user hourly, daily and platform windows together", async () => {
    mocks.reserve.mockResolvedValue({ ok: true });
    expect((await guardAi("student-1", "writing-submit")).ok).toBe(true);
    const windows = mocks.reserve.mock.calls[0][0];
    expect(windows).toHaveLength(3);
    expect(windows[0]).toMatchObject({ seconds: 3600, limit: 8 });
    expect(windows[2].key).toBe("ai:platform:day");
  });
  it("fails closed when the shared store fails", async () => {
    mocks.reserve.mockResolvedValue({
      ok: false,
      unavailable: true,
      retryAfterSeconds: 60,
    });
    expect(await guardAi("student-1", "writing-submit")).toMatchObject({
      ok: false,
      retryAfterSeconds: 60,
    });
  });
  it("uses the configured global ceiling", async () => {
    process.env.AI_DAILY_REQUEST_LIMIT = "100";
    mocks.reserve.mockResolvedValue({ ok: true });
    await guardAi("s", "xray");
    expect(mocks.reserve.mock.calls[0][0][2].limit).toBe(100);
  });
});
