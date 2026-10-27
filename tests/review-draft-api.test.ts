/**
 * AI-drafted review → one-tap approval (docs/elegance-roadmap.md, idea 10):
 * POST /api/teacher/reviews/[testId]/approve | draft | undo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    testReview: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    iELTSTest: { update: vi.fn() },
    homeworkSubmission: { update: vi.fn() },
    mockAttempt: { updateMany: vi.fn() },
  };
  return {
    auth: vi.fn(),
    canReview: vi.fn(),
    teacherOf: vi.fn(),
    save: vi.fn(),
    limit: vi.fn(),
    hasOpenAI: vi.fn(),
    draftAi: vi.fn(),
    revalidateTag: vi.fn(),
    tx,
    db: {
      iELTSTest: { findUnique: vi.fn(), findMany: vi.fn() },
      homeworkSubmission: { findMany: vi.fn() },
      mockAttempt: { findFirst: vi.fn(), findUnique: vi.fn() },
      student: { findUnique: vi.fn() },
      notification: { deleteMany: vi.fn() },
      $executeRaw: vi.fn(),
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/access", () => ({ canReviewStudent: m.canReview, teacherOf: m.teacherOf }));
vi.mock("@/lib/review/save", () => ({ saveTestReview: m.save }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: m.limit }));
vi.mock("next/cache", () => ({ revalidateTag: m.revalidateTag, unstable_cache: (fn: () => unknown) => fn }));
vi.mock("@/lib/ai", async () => {
  const real = await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
  return { heuristicWritingAssessment: real.heuristicWritingAssessment, hasOpenAI: m.hasOpenAI, draftReviewFeedback: m.draftAi };
});

import { POST as approve } from "@/app/api/teacher/reviews/[testId]/approve/route";
import { POST as draft } from "@/app/api/teacher/reviews/[testId]/draft/route";
import { POST as undo } from "@/app/api/teacher/reviews/[testId]/undo/route";
import { AI_LIMITS } from "@/lib/engine/ai-guard";

const TEST_ID = "test-12345";
const ctx = (id = TEST_ID) => ({ params: Promise.resolve({ testId: id }) });
const req = (body: unknown, origin = "https://averna.test") =>
  new Request(`https://averna.test/api/teacher/reviews/${TEST_ID}/x`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const criteria = { taskAchievement: 6, coherenceCohesion: 6.5, lexicalResource: 6, grammarAccuracy: 6 };
const REVIEW = { band: 6, criteria, comment: "Clear position.\n\nNext steps:\n- Use more linking words" };
const ESSAY = "Some people think that universities should only teach practical skills, while others disagree. ".repeat(4);
const attempt = (ai: Record<string, unknown>) => ({
  id: TEST_ID,
  studentId: "st-1",
  module: "WRITING",
  score: 6,
  answers: { essay: ESSAY, prompt: "Discuss both views.", taskType: "task2" },
  aiAnalysis: ai,
  review: null,
});
const UPDATED = "2026-10-26T05:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXTAUTH_SECRET = "test-secret-for-undo-tokens";
  m.auth.mockResolvedValue({ user: { id: "u-t", role: "TEACHER" } });
  m.canReview.mockResolvedValue(true);
  m.teacherOf.mockResolvedValue({ id: "t-1" });
  m.limit.mockResolvedValue({ ok: true });
  m.hasOpenAI.mockReturnValue(true);
  m.db.iELTSTest.findUnique.mockResolvedValue(attempt({ assessedBy: "ai", detailedFeedback: "Your position is clear. Paragraphs need linking.", recommendations: ["Link ideas"] }));
  m.db.iELTSTest.findMany.mockResolvedValue([]);
  m.db.homeworkSubmission.findMany.mockResolvedValue([
    { id: "sub-1", status: "SUBMITTED", band: 6, feedback: null, gradedBy: null, gradedAt: null },
  ]);
  m.db.mockAttempt.findFirst.mockResolvedValue(null);
  m.db.student.findUnique.mockResolvedValue({ userId: "u-student" });
  m.db.notification.deleteMany.mockResolvedValue({ count: 1 });
  m.save.mockResolvedValue({
    ok: true,
    created: true,
    changed: true,
    review: { testId: TEST_ID, band: 6, aiBand: 6, criteria, comment: REVIEW.comment, updatedAt: UPDATED },
    next: "test-67890",
  });
  m.tx.$queryRaw.mockResolvedValue([]);
  m.tx.testReview.findUnique.mockResolvedValue({ updatedAt: new Date(UPDATED), reviewerId: "u-t" });
});

describe("POST …/approve", () => {
  it("saves through the same path as the manual review and returns an undo token", async () => {
    const res = await approve(req({ ...REVIEW, queue: { days: 30 } }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(m.save).toHaveBeenCalledWith({ id: "u-t", role: "TEACHER" }, TEST_ID, { ...REVIEW, queue: { days: 30 } });
    expect(body).toMatchObject({ ok: true, next: "test-67890" });
    expect(typeof body.undo).toBe("string");
    expect(m.revalidateTag).toHaveBeenCalledWith("needs-help:t-1");
  });

  it("an edited draft is saved the same way, with the teacher's values", async () => {
    const edited = { band: 6.5, criteria: { ...criteria, lexicalResource: 7 }, comment: "My own words." };
    expect((await approve(req(edited), ctx())).status).toBe(200);
    expect(m.save.mock.calls[0][2]).toEqual(edited);
  });

  it("401 signed out, 403 for students, other teachers' students and cross-site posts", async () => {
    m.auth.mockResolvedValueOnce(null);
    expect((await approve(req(REVIEW), ctx())).status).toBe(401);
    m.auth.mockResolvedValueOnce({ user: { id: "u-s", role: "STUDENT" } });
    expect((await approve(req(REVIEW), ctx())).status).toBe(403);
    m.canReview.mockResolvedValueOnce(false);
    expect((await approve(req(REVIEW), ctx())).status).toBe(403);
    expect((await approve(req(REVIEW, "https://evil.test"), ctx())).status).toBe(403);
    expect(m.save).not.toHaveBeenCalled();
  });

  it("400 for an invalid body, 404 for an unknown attempt; a save-path error keeps its status", async () => {
    expect((await approve(req({ band: 6 }), ctx())).status).toBe(400);
    expect((await approve(req("not json"), ctx())).status).toBe(400);
    expect((await approve(req(REVIEW), ctx("bad id!"))).status).toBe(404);
    m.db.iELTSTest.findUnique.mockResolvedValueOnce(null);
    expect((await approve(req(REVIEW), ctx())).status).toBe(404);
    expect(m.save).not.toHaveBeenCalled();
    m.save.mockResolvedValueOnce({ ok: false, status: 400, error: "Give a band for Lexical Resource." });
    const res = await approve(req(REVIEW), ctx());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Lexical/);
  });
});

describe("POST …/draft (regenerate)", () => {
  it("reuses a stored assessment without an AI call", async () => {
    const res = await draft(req({}), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generated).toBe(false);
    expect(body.draft).toMatchObject({ source: "stored", feedback: "Your position is clear. Paragraphs need linking.", nextSteps: ["Link ideas"] });
    expect(m.draftAi).not.toHaveBeenCalled();
    expect(m.limit).not.toHaveBeenCalled();
  });

  it("regenerates new words for the same bands and keeps them on the attempt", async () => {
    m.db.iELTSTest.findUnique.mockResolvedValue(attempt({ assessedBy: "ai", ...criteria, overallBand: 6, detailedFeedback: "Old." }));
    m.draftAi.mockResolvedValue({ feedback: "Fresh feedback.", nextSteps: ["One", "Two"] });
    const res = await draft(req({ regenerate: true }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ generated: true, draft: { source: "ai", feedback: "Fresh feedback.", nextSteps: ["One", "Two"], band: 6 } });
    expect(m.db.$executeRaw).toHaveBeenCalledTimes(1);
    const keys = m.limit.mock.calls[0][0].map((p: { key: string }) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["ai:review-draft:u-t:day", "ai:review-draft:u-t:hour"]));
  });

  it("429 over the daily cap, 503 without an AI key, 403 for another teacher's student, 400 invalid", async () => {
    expect(AI_LIMITS["review-draft"]).toEqual({ perHour: 30, perDay: 80 });
    m.limit.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });
    expect((await draft(req({ regenerate: true }), ctx())).status).toBe(429);
    m.hasOpenAI.mockReturnValue(false);
    expect((await draft(req({ regenerate: true }), ctx())).status).toBe(503);
    m.canReview.mockResolvedValueOnce(false);
    expect((await draft(req({ regenerate: true }), ctx())).status).toBe(403);
    expect((await draft(req({ regenerate: "yes" }), ctx())).status).toBe(400);
    expect(m.draftAi).not.toHaveBeenCalled();
  });

  it("without an AI key, Writing drafts from the heuristic scorer and Speaking asks the teacher to write", async () => {
    m.hasOpenAI.mockReturnValue(false);
    m.db.iELTSTest.findUnique.mockResolvedValue(attempt({ assessedBy: "heuristic", wordCount: 60 }));
    const w = await (await draft(req({}), ctx())).json();
    expect(w.draft.source).toBe("heuristic");
    expect(w.draft.feedback.length).toBeGreaterThan(10);
    expect(w.draft.feedback).not.toMatch(/api key/i);
    m.db.iELTSTest.findUnique.mockResolvedValue({ ...attempt({ criteria: { fluency: 6, lexical: 6, grammar: 6 } }), module: "SPEAKING", answers: { answers: [] } });
    const s = await (await draft(req({}), ctx())).json();
    expect(s.draft).toMatchObject({ source: "none", feedback: "" });
  });
});

describe("POST …/undo", () => {
  async function approvedToken(): Promise<string> {
    const res = await approve(req(REVIEW), ctx());
    return (await res.json()).undo as string;
  }

  it("puts the attempt back: no review, the AI band, the submission as it was, no notification", async () => {
    const token = await approvedToken();
    const res = await undo(req({ token }), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, restored: "none" });
    expect(m.tx.testReview.delete).toHaveBeenCalledWith({ where: { testId: TEST_ID } });
    expect(m.tx.iELTSTest.update).toHaveBeenCalledWith({ where: { id: TEST_ID }, data: { score: 6 } });
    expect(m.tx.homeworkSubmission.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "SUBMITTED", band: 6, feedback: null, gradedBy: null, gradedAt: null },
    });
    expect(m.db.notification.deleteMany.mock.calls[0][0].where).toMatchObject({ userId: "u-student", type: "grade", link: `/learning/writing/result/${TEST_ID}` });
  });

  it("restores the previous review when there was one", async () => {
    m.db.iELTSTest.findUnique.mockResolvedValue({ ...attempt({}), review: { band: 5.5, criteria, comment: "Earlier", reviewerId: "u-other" } });
    const token = await approvedToken();
    expect(await (await undo(req({ token }), ctx())).json()).toEqual({ ok: true, restored: "previous" });
    expect(m.tx.testReview.update.mock.calls[0][0].data).toMatchObject({ band: 5.5, comment: "Earlier", reviewerId: "u-other" });
    expect(m.tx.testReview.delete).not.toHaveBeenCalled();
  });

  it("refuses a forged, foreign or stale token and another teacher's student", async () => {
    const token = await approvedToken();
    expect((await undo(req({ token: `${token}x` }), ctx())).status).toBe(400);
    expect((await undo(req({ nope: 1 }), ctx())).status).toBe(400);
    m.auth.mockResolvedValueOnce({ user: { id: "u-t2", role: "TEACHER" } });
    expect((await undo(req({ token }), ctx())).status).toBe(403);
    m.canReview.mockResolvedValueOnce(false);
    expect((await undo(req({ token }), ctx())).status).toBe(403);
    m.auth.mockResolvedValueOnce(null);
    expect((await undo(req({ token }), ctx())).status).toBe(401);
    // Edited again after the approval: nothing is overwritten.
    m.tx.testReview.findUnique.mockResolvedValueOnce({ updatedAt: new Date("2026-10-26T05:01:00.000Z"), reviewerId: "u-t" });
    expect((await undo(req({ token }), ctx())).status).toBe(409);
    expect(m.tx.testReview.delete).not.toHaveBeenCalled();
  });

  it("expires after the undo window", async () => {
    const token = await approvedToken();
    const now = Date.now();
    const spy = vi.spyOn(Date, "now").mockReturnValue(now + 3 * 60_000);
    try {
      expect((await undo(req({ token }), ctx())).status).toBe(410);
    } finally {
      spy.mockRestore();
    }
  });
});
