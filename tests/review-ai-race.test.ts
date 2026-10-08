import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), current: vi.fn(), existing: vi.fn(), upsert: vi.fn(), update: vi.fn(), lock: vi.fn(), tx: vi.fn(), allowed: vi.fn(), teacher: vi.fn(), next: vi.fn(), notify: vi.fn(), subs: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { iELTSTest: { findUnique: m.find }, $transaction: m.tx } }));
vi.mock("@/lib/access", () => ({ canReviewStudent: m.allowed, teacherOf: m.teacher }));
vi.mock("@/lib/notifications", () => ({ notifyUser: m.notify }));
vi.mock("@/lib/ielts/mock", () => ({ MOCK_SECTIONS: ["READING", "LISTENING", "WRITING", "SPEAKING"], resultsOf: (x: unknown) => x }));
vi.mock("@/lib/review/queue", () => ({ nextPendingReview: m.next }));
import { saveTestReview } from "@/lib/review/save";
const criteria = { taskAchievement: 7, coherenceCohesion: 7, lexicalResource: 7, grammarAccuracy: 7 };
const input = { band: 7, criteria, comment: "Good work" };
describe("teacher review and delayed AI serialization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.find.mockResolvedValue({ id: "test-12345", studentId: "s", module: "WRITING", score: 4, aiAnalysis: { overallBand: 4 }, answers: { taskType: "task2" }, student: { userId: "u" } });
    m.allowed.mockResolvedValue(true); m.teacher.mockResolvedValue({ id: "teacher" });
    m.current.mockResolvedValue({ score: 6, aiAnalysis: { overallBand: 6 } });
    m.existing.mockResolvedValue(null);m.subs.mockResolvedValue([]);m.next.mockResolvedValue(null);
    m.upsert.mockImplementation(async ({ create }) => ({ ...create, updatedAt: new Date() }));
    m.tx.mockImplementation(async fn => fn({ $queryRaw: m.lock, iELTSTest: { findUniqueOrThrow: m.current, update: m.update }, testReview: { findUnique: m.existing, upsert: m.upsert }, homeworkSubmission: { findMany: m.subs } }));
  });
  it("uses the AI band re-read after the lock, not the stale authorization read", async () => {
    const result = await saveTestReview({ id: "reviewer", role: "TEACHER" }, "test-12345", input);
    expect(result.ok).toBe(true);
    expect(m.upsert.mock.calls[0][0].create.aiBand).toBe(6);
    expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.current.mock.invocationCallOrder[0]);
    expect(m.current.mock.invocationCallOrder[0]).toBeLessThan(m.upsert.mock.invocationCallOrder[0]);
    expect(m.update.mock.calls[0][0].data.score).toBe(7);
  });
  it("preserves the original pre-review band on edits", async () => {
    m.existing.mockResolvedValue({ band: 5, aiBand: 4, criteria, comment: "Earlier" });
    await saveTestReview({ id: "reviewer", role: "TEACHER" }, "test-12345", input);
    expect(m.upsert.mock.calls[0][0].create.aiBand).toBe(4);
    expect(m.upsert.mock.calls[0][0].update).not.toHaveProperty("aiBand");
  });
  it("does not take a row lock or write before permission checks", async () => {
    m.allowed.mockResolvedValue(false);
    expect(await saveTestReview({ id: "other" }, "test-12345", input)).toMatchObject({ ok: false, status: 403 });
    expect(m.tx).not.toHaveBeenCalled();
  });
});
