import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/assessment/writing-queue", () => ({ processWritingRetry: vi.fn() }));
import { processAssessmentBatch } from "@/lib/assessment/batch";
import { POST } from "@/app/api/cron/assessments/route";
afterEach(() => vi.unstubAllEnvs());
describe("bounded assessment scheduler", () => {
  it("never starts more than two jobs", async () => { const process = vi.fn().mockResolvedValue("done"); const result = await processAssessmentBatch({ process, limit: 200, now: () => 0 }); expect(process).toHaveBeenCalledTimes(2); expect(result.processed).toBe(2); });
  it.each(["busy", "idle", "unconfigured"])("stops on %s", async status => { const process = vi.fn().mockResolvedValue(status); expect((await processAssessmentBatch({ process, now: () => 0 })).processed).toBe(0); expect(process).toHaveBeenCalledOnce(); });
  it("leaves time for a provider call and transaction", async () => { let clock = 0; const process = vi.fn().mockImplementation(async () => { clock += 20000; return "done"; }); await processAssessmentBatch({ process, now: () => clock }); expect(process).toHaveBeenCalledOnce(); });
  it("does not start with too little budget", async () => { const process = vi.fn(); await processAssessmentBatch({ process, deadlineMs: 1000, now: () => 0 }); expect(process).not.toHaveBeenCalled(); });
  it("is off before authentication/storage by default", async () => { vi.stubEnv("ASSESSMENT_SCHEDULER", "off"); expect((await POST(new Request("https://averna.test/api/cron/assessments", { method: "POST" }))).status).toBe(404); });
  it("requires an independently configured long secret", async () => { vi.stubEnv("ASSESSMENT_SCHEDULER", "on"); vi.stubEnv("ASSESSMENT_SCHEDULER_SECRET", "short"); expect((await POST(new Request("https://averna.test/api/cron/assessments", { method: "POST", headers: { authorization: "Bearer short" } }))).status).toBe(401); });
});
