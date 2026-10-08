// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  reserve: vi.fn(),
  student: { findUnique: vi.fn() },
  cards: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  reviews: { deleteMany: vi.fn() },
  raw: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/security/rate-limit", () => ({ reserveLimits: mocks.reserve }));
vi.mock("@/lib/db", () => ({
  db: {
    student: mocks.student,
    mistakeEntry: mocks.cards,
    reviewItem: mocks.reviews,
    $queryRaw: mocks.raw,
    $transaction: mocks.transaction,
  },
}));
import { GET, POST, DELETE } from "@/app/api/mistakes/route";
const req = (body: unknown) =>
  new NextRequest("https://averna.example/api/mistakes", {
    method: "POST",
    body: JSON.stringify(body),
  });
describe("correction API ownership and persistence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    mocks.student.findUnique.mockResolvedValue({ id: "s1" });
    mocks.reserve.mockResolvedValue({ ok: true });
    mocks.transaction.mockImplementation(async (fn) =>
      fn({
        student: mocks.student,
        mistakeEntry: mocks.cards,
        reviewItem: mocks.reviews,
        $queryRaw: mocks.raw,
      }),
    );
    mocks.cards.count.mockResolvedValue(0);
    mocks.cards.findUnique.mockResolvedValue(null);
  });
  it("denies anonymous access", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.cards.findMany).not.toHaveBeenCalled();
  });
  it("denies teacher account access to a student bank", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u2", role: "TEACHER" } });
    expect((await GET()).status).toBe(401);
  });
  it("filters every read by the authenticated student", async () => {
    mocks.cards.findMany.mockResolvedValue([]);
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.cards.findMany.mock.calls[0][0].where).toEqual({
      studentId: "s1",
    });
  });
  it("never accepts ownership sent by a client", async () => {
    mocks.cards.create.mockImplementation(async (arg) => arg.data);
    const response = await POST(
      req({ id: "c1", wrong: "went", right: "been", studentId: "s2" }),
    );
    expect(response.status).toBe(201);
    expect(mocks.cards.create.mock.calls[0][0].data.studentId).toBe("s1");
  });
  it("does not overwrite an id owned by another student", async () => {
    mocks.cards.findUnique.mockResolvedValue({ id: "c1", studentId: "s2" });
    expect(
      (await POST(req({ id: "c1", wrong: "went", right: "been" }))).status,
    ).toBe(409);
    expect(mocks.cards.create).not.toHaveBeenCalled();
  });
  it("makes a create retry idempotent", async () => {
    mocks.cards.findUnique.mockResolvedValue({ id: "c1", studentId: "s1" });
    expect(
      (await POST(req({ id: "c1", wrong: "went", right: "been" }))).status,
    ).toBe(201);
    expect(mocks.cards.create).not.toHaveBeenCalled();
  });
  it("checks recall against a server-owned correction", async () => {
    mocks.cards.findFirst.mockResolvedValue({
      id: "c1",
      right: "I have been.",
    });
    const response = await POST(
      req({ action: "practice", id: "c1", answer: "I have went" }),
    );
    expect((await response.json()).matched).toBe(false);
    expect(mocks.cards.update).not.toHaveBeenCalled();
  });
  it("records matching practice without inventing XP", async () => {
    mocks.cards.findFirst.mockResolvedValue({
      id: "c1",
      right: "I have been.",
    });
    const response = await POST(
      req({ action: "practice", id: "c1", answer: "I HAVE been" }),
    );
    expect((await response.json()).matched).toBe(true);
    expect(mocks.cards.update).toHaveBeenCalledOnce();
  });
  it("filters deletion by owner", async () => {
    mocks.cards.deleteMany.mockResolvedValue({ count: 0 });
    expect(
      (
        await DELETE(
          new NextRequest("https://averna.example/api/mistakes?id=c2", {
            method: "DELETE",
          }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.cards.deleteMany.mock.calls[0][0].where).toEqual({
      id: "c2",
      studentId: "s1",
    });
    expect(mocks.reviews.deleteMany).not.toHaveBeenCalled();
  });
  it("returns an error rather than an empty successful bank on DB outage", async () => {
    mocks.cards.findMany.mockRejectedValue(new Error("offline"));
    expect((await GET()).status).toBe(503);
  });
});
