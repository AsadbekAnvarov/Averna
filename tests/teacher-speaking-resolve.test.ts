/** POST /api/teacher/speaking/reports/[id]/resolve — role + group ownership (docs/peer-speaking.md, Phase C). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    teacher: { findUnique: vi.fn() },
    student: { count: vi.fn() },
    speakingReport: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));

import { POST } from "@/app/api/teacher/speaking/reports/[id]/resolve/route";

const ctx = (id = "rep-1") => ({ params: Promise.resolve({ id }) });
const req = (origin = "https://averna.test") =>
  new Request("https://averna.test/api/teacher/speaking/reports/rep-1/resolve", { method: "POST", headers: { origin } });

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-t", role: "TEACHER" } });
  m.db.teacher.findUnique.mockResolvedValue({ id: "t-1" });
  m.db.student.count.mockResolvedValue(1);
  m.db.speakingReport.findUnique.mockResolvedValue({ id: "rep-1", status: "OPEN", reporterId: "st-a", reportedId: "st-b" });
  m.db.speakingReport.updateMany.mockResolvedValue({ count: 1 });
  m.db.speakingReport.count.mockResolvedValue(1);
});

describe("resolve a peer speaking report", () => {
  it("lets the teacher of an involved student resolve it", async () => {
    const res = await POST(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, stillPaused: false });
    expect(m.db.student.count).toHaveBeenCalledWith({ where: { id: { in: ["st-a", "st-b"] }, group: { teacherId: "t-1" } } });
    const write = m.db.speakingReport.updateMany.mock.calls[0][0];
    expect(write.where).toEqual({ id: "rep-1", status: "OPEN" });
    expect(write.data).toMatchObject({ status: "RESOLVED", resolvedById: "u-t", resolvedAt: expect.any(Date) });
  });

  it("refuses teachers of other groups, students and cross-site posts", async () => {
    m.db.student.count.mockResolvedValue(0);
    expect((await POST(req(), ctx())).status).toBe(403);
    m.db.teacher.findUnique.mockResolvedValue(null);
    expect((await POST(req(), ctx())).status).toBe(403);
    m.auth.mockResolvedValue({ user: { id: "u-s", role: "STUDENT" } });
    expect((await POST(req(), ctx())).status).toBe(403);
    m.auth.mockResolvedValue(null);
    expect((await POST(req(), ctx())).status).toBe(401);
    m.auth.mockResolvedValue({ user: { id: "u-t", role: "TEACHER" } });
    expect((await POST(req("https://evil.test"), ctx())).status).toBe(403);
    expect(m.db.speakingReport.updateMany).not.toHaveBeenCalled();
  });

  it("admins may resolve any report; the reply says if the student is still paused", async () => {
    m.auth.mockResolvedValue({ user: { id: "u-admin", role: "ADMIN" } });
    m.db.speakingReport.count.mockResolvedValue(2);
    const body = await (await POST(req(), ctx())).json();
    expect(body).toEqual({ ok: true, stillPaused: true });
    expect(m.db.student.count).not.toHaveBeenCalled();
    expect(m.db.speakingReport.updateMany.mock.calls[0][0].data.resolvedById).toBe("u-admin");
  });

  it("404 for an unknown report, 400 for a bad id, no write for an already resolved one", async () => {
    m.db.speakingReport.findUnique.mockResolvedValueOnce(null);
    expect((await POST(req(), ctx())).status).toBe(404);
    expect((await POST(req(), ctx("bad id!"))).status).toBe(400);
    m.db.speakingReport.findUnique.mockResolvedValueOnce({ id: "rep-1", status: "RESOLVED", reporterId: "st-a", reportedId: "st-b" });
    expect((await POST(req(), ctx())).status).toBe(200);
    expect(m.db.speakingReport.updateMany).not.toHaveBeenCalled();
  });
});
