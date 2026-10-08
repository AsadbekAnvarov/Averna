import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessmentEligible, retryDelayMs, MAX_ASSESSMENT_ATTEMPTS } from "@/lib/assessment/retry-policy";
const m = vi.hoisted(() => ({
  findJob: vi.fn(), claim: vi.fn(), finish: vi.fn(), findTest: vi.fn(), transaction: vi.fn(),
  txJob: vi.fn(), txJobUpdate: vi.fn(), txTest: vi.fn(), lock: vi.fn(), save: vi.fn(), homework: vi.fn(), notice: vi.fn(),
  guard: vi.fn(), assess: vi.fn(), configured: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: {
  aiAssessmentJob: { findFirst: m.findJob, updateMany: m.claim },
  iELTSTest: { findUnique: m.findTest }, $transaction: m.transaction,
} }));
vi.mock("@/lib/ai", () => ({ assessWritingTask: m.assess, hasOpenAI: m.configured }));
vi.mock("@/lib/engine/ai-guard", () => ({ guardAi: m.guard }));
import { processWritingRetry } from "@/lib/assessment/writing-queue";
const answers = { essay: "A real essay with a coherent argument.", prompt: "Discuss this", taskType: "task2" };
const test = { id: "test-one", module: "WRITING", answers, aiAnalysis: { source: "heuristic" }, review: null, student: { userId: "user-one" } };
const assessment = { source: "ai", taskAchievement: 6, coherenceCohesion: 6, lexicalResource: 6, grammarAccuracy: 6, overallBand: 6, strengths: ["Clear"], weaknesses: ["Brief"], recommendations: ["Expand"], detailedFeedback: "A clear argument.", aiDetectionScore: 0 };

describe("durable Writing retry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.configured.mockReturnValue(true);
    m.findJob.mockResolvedValue({ id: "job-one", testId: "test-one", attempts: 0 });
    m.claim.mockResolvedValue({ count: 1 });
    m.findTest.mockResolvedValue(test);
    m.guard.mockResolvedValue({ ok: true });
    m.assess.mockResolvedValue(assessment);
    m.txJob.mockResolvedValue({ count: 1 });
    m.txTest.mockResolvedValue(test);
    m.transaction.mockImplementation(async fn => fn({
      aiAssessmentJob: { updateMany: m.txJob, update: m.txJobUpdate },
      iELTSTest: { findUnique: m.txTest, update: m.save },
      homeworkSubmission: { updateMany: m.homework }, notification: { create: m.notice }, $queryRaw: m.lock,
    }));
  });
  it("does not claim work without a provider configuration", async () => {
    m.configured.mockReturnValue(false);
    expect(await processWritingRetry()).toBe("unconfigured");
    expect(m.findJob).not.toHaveBeenCalled();
  });
  it("does not run a job claimed by another instance", async () => {
    m.claim.mockResolvedValueOnce({ count: 0 });
    expect(await processWritingRetry()).toBe("busy");
    expect(m.assess).not.toHaveBeenCalled();
  });
  it("claims pending and stale-running jobs with a unique lease", async () => {
    await processWritingRetry("test-one");
    expect(m.findJob.mock.calls[0][0].where).toMatchObject({ testId: "test-one", OR: [
      { status: "pending", nextAttemptAt: { lte: expect.any(Date) } },
      { status: "running", leaseUntil: { lte: expect.any(Date) } },
    ] });
    expect(m.claim.mock.calls[0][0].data).toMatchObject({ leaseToken: expect.any(String), leaseUntil: expect.any(Date) });
  });
  it("checks the original student's limits and does not consume a paid attempt when blocked", async () => {
    m.guard.mockResolvedValue({ ok: false, retryAfterSeconds: 3600 });
    expect(await processWritingRetry()).toBe("pending");
    expect(m.guard).toHaveBeenCalledWith("user-one", "writing-submit");
    expect(m.assess).not.toHaveBeenCalled();
    expect(m.claim.mock.calls.some(([arg]) => arg.data.attempts)).toBe(false);
    expect(m.claim.mock.calls.at(-1)?.[0].data.lastError).toBe("budget_unavailable");
  });
  it("saves feedback and the in-app notice together, without awarding XP", async () => {
    expect(await processWritingRetry()).toBe("done");
    expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ data: { score: 6, aiAnalysis: expect.objectContaining({ source: "ai", wordCount: 7 }) } }));
    expect(m.notice).toHaveBeenCalledOnce();
    expect(m.homework.mock.calls[0][0].where.status).toEqual({ not: "GRADED" });
    expect(m.lock).toHaveBeenCalledOnce();
  });
  it("never applies or notifies a result from an expired or superseded lease", async () => {
    m.txJob.mockResolvedValue({ count: 0 });
    expect(await processWritingRetry()).toBe("superseded");
    expect(m.save).not.toHaveBeenCalled();
    expect(m.notice).not.toHaveBeenCalled();
    expect(m.txJob.mock.calls[0][0].where).toMatchObject({ leaseToken: expect.any(String), leaseUntil: { gt: expect.any(Date) } });
  });
  it("does not call AI for already-reviewed work", async () => {
    m.findTest.mockResolvedValue({ ...test, review: { testId: test.id } });
    expect(await processWritingRetry()).toBe("skipped");
    expect(m.assess).not.toHaveBeenCalled();
  });
  it("a teacher review committed during the AI request wins", async () => {
    m.txTest.mockResolvedValue({ ...test, review: { testId: test.id } });
    expect(await processWritingRetry()).toBe("skipped");
    expect(m.save).not.toHaveBeenCalled();
    expect(m.homework).not.toHaveBeenCalled();
    expect(m.notice).not.toHaveBeenCalled();
  });
  it("does not overwrite an AI result already committed", async () => {
    m.txTest.mockResolvedValue({ ...test, aiAnalysis: { source: "ai" } });
    expect(await processWritingRetry()).toBe("skipped");
    expect(m.save).not.toHaveBeenCalled();
  });
  it("retries a provider failure and stores no private error body", async () => {
    m.assess.mockRejectedValue(new Error("PRIVATE ESSAY / provider secret"));
    expect(await processWritingRetry()).toBe("pending");
    expect(m.claim.mock.calls.at(-1)?.[0].data).toMatchObject({ lastError: "assessment_unavailable", leaseToken: null });
    expect(m.transaction).not.toHaveBeenCalled();
  });
  it("rejects malformed AI feedback rather than saving it", async () => {
    m.assess.mockResolvedValue({ source: "ai", overallBand: 99 });
    expect(await processWritingRetry()).toBe("pending");
    expect(m.save).not.toHaveBeenCalled();
  });
  it("stops provider retries at the configured bound", async () => {
    m.findJob.mockResolvedValue({ id: "job-one", testId: test.id, attempts: MAX_ASSESSMENT_ATTEMPTS - 1 });
    m.assess.mockRejectedValue(new Error("offline"));
    expect(await processWritingRetry()).toBe("failed");
  });
  it("does not make another paid call after an exhausted stale lease", async () => {
    m.findJob.mockResolvedValue({ id: "job-one", testId: test.id, attempts: MAX_ASSESSMENT_ATTEMPTS });
    expect(await processWritingRetry()).toBe("failed");
    expect(m.assess).not.toHaveBeenCalled();
  });
  it("does not persist after losing the lease before the model call", async () => {
    m.claim.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect(await processWritingRetry()).toBe("superseded");
    expect(m.assess).not.toHaveBeenCalled();
  });
});
describe("retry scope and backoff", () => {
  it("uses bounded exponential backoff", () => {
    expect(retryDelayMs(1)).toBe(300000);
    expect(retryDelayMs(2)).toBe(600000);
    expect(retryDelayMs(100)).toBe(21600000);
  });
  it.each([
    ["SPEAKING", answers, {}], ["WRITING", { ...answers, mockAttemptId: "mock" }, {}],
    ["WRITING", { ...answers, examAttemptId: "exam" }, {}], ["WRITING", { ...answers, essay: "" }, {}],
    ["WRITING", answers, { source: "ai" }], ["WRITING", null, {}],
  ])("excludes unsupported work", (module, data, analysis) => expect(assessmentEligible(module as string, data, analysis, false)).toBe(false));
});
