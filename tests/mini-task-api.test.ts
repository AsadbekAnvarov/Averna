/** GET/POST /api/teacher/mini-task — one-button mini task (docs/elegance-roadmap.md, idea 10). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  canReview: vi.fn(),
  teacherOf: vi.fn(),
  student: vi.fn(),
  resolve: vi.fn(),
  create: vi.fn(),
  load: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/access", () => ({ canReviewStudent: m.canReview, teacherOf: m.teacherOf }));
vi.mock("@/lib/db", () => ({ db: { student: { findUnique: m.student } } }));
vi.mock("@/lib/homework/library", () => ({ resolveExamContent: m.resolve }));
vi.mock("@/lib/homework/create", async () => {
  const real = await vi.importActual<typeof import("@/lib/homework/create")>("@/lib/homework/create");
  return { ...real, createHomework: m.create };
});
vi.mock("@/lib/teacher/mini-task-load", () => ({ loadMiniTask: m.load }));
vi.mock("next/cache", () => ({ revalidateTag: m.revalidateTag }));

import { GET, POST } from "@/app/api/teacher/mini-task/route";

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();
const ASSIGN = { studentId: "st-1", contentKind: "READING", contentId: "r1", contentPart: 1, kind: "matching-headings", title: "Mini task: Matching headings" };
const post = (body: unknown, origin = "https://averna.test") =>
  new Request("https://averna.test/api/teacher/mini-task", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u-t", role: "TEACHER" } });
  m.teacherOf.mockResolvedValue({ id: "t-1" });
  m.canReview.mockResolvedValue(true);
  m.student.mockResolvedValue({ id: "st-1", userId: "u-st", groupId: "g-1" });
  m.resolve.mockResolvedValue({
    ok: true,
    content: { kind: "READING", contentId: "r1", contentPart: 1, contentTitle: "Bees · Passage 2", module: "READING", title: "Reading", description: "Reading homework: Passage 2.", difficulty: 3 },
  });
  m.create.mockResolvedValue([{ id: "hw-9", groupId: "g-1" }]);
  m.load.mockResolvedValue({ contentId: "r1", contentPart: 1, title: "Mini task: Matching headings" });
});

describe("mini task API", () => {
  it("previews for the teacher's own student only", async () => {
    const ok = await GET(new Request("https://averna.test/api/teacher/mini-task?studentId=st-1"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ task: { contentId: "r1", contentPart: 1, title: "Mini task: Matching headings" } });
    m.canReview.mockResolvedValueOnce(false);
    expect((await GET(new Request("https://averna.test/api/teacher/mini-task?studentId=st-2"))).status).toBe(403);
    expect((await GET(new Request("https://averna.test/api/teacher/mini-task?studentId=bad id"))).status).toBe(400);
    m.auth.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://averna.test/api/teacher/mini-task?studentId=st-1"))).status).toBe(401);
    expect(m.load).toHaveBeenCalledTimes(1);
  });

  it("assigns ONE student's homework through the normal homework path", async () => {
    const res = await POST(post({ ...ASSIGN, dueDate: tomorrow() }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, homeworkId: "hw-9" });
    const [data, groups, assignee] = m.create.mock.calls[0];
    expect(groups).toEqual(["g-1"]);
    expect(assignee).toEqual({ studentId: "st-1", userId: "u-st" });
    expect(data).toMatchObject({ title: ASSIGN.title, teacherId: "t-1", contentKind: "READING", contentId: "r1", contentPart: 1, points: 20 });
    expect(data.description).toMatch(/^A short practice task from your teacher, picked for matching headings questions\./);
    expect(m.revalidateTag).toHaveBeenCalledWith("needs-help:t-1");
  });

  it("401 / 403 (students, other teachers' students, cross-site) / 400 (invalid, past due)", async () => {
    m.auth.mockResolvedValueOnce(null);
    expect((await POST(post({ ...ASSIGN, dueDate: tomorrow() }))).status).toBe(401);
    m.auth.mockResolvedValueOnce({ user: { id: "u-s", role: "STUDENT" } });
    expect((await POST(post({ ...ASSIGN, dueDate: tomorrow() }))).status).toBe(403);
    m.canReview.mockResolvedValueOnce(false);
    expect((await POST(post({ ...ASSIGN, dueDate: tomorrow() }))).status).toBe(403);
    expect((await POST(post({ ...ASSIGN, dueDate: tomorrow() }, "https://evil.test"))).status).toBe(403);
    expect((await POST(post({ ...ASSIGN, title: "", dueDate: tomorrow() }))).status).toBe(400);
    expect((await POST(post({ ...ASSIGN, contentKind: "WRITING_TASK2", dueDate: tomorrow() }))).status).toBe(400);
    expect((await POST(post({ ...ASSIGN, dueDate: "2020-01-01T10:00" }))).status).toBe(400);
    expect(m.create).not.toHaveBeenCalled();
  });
});
