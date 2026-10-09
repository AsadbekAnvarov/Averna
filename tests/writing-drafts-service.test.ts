import { beforeEach, describe, expect, it, vi } from "vitest";
import { draftWriteSchema, draftScope } from "@/lib/writing-drafts/rules";
const m = vi.hoisted(() => ({ read: vi.fn(), tx: vi.fn(), lock: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { writingDraft: { findUnique: m.read }, $transaction: m.tx } }));
import { writeDraft, readDraft } from "@/lib/writing-drafts/service";
const input = { taskType: "task2" as const, promptId: "topic-1", essay: "My original essay", attemptId: "attempt-123", timeLeft: 2200, version: 0 };
const saved = { ...input, promptHash: "hash", version: 1, updatedAt: new Date("2026-10-09") };
beforeEach(() => {
  vi.resetAllMocks(); m.lock.mockResolvedValue([{ id: "student-1", blacklisted: false }]);
  m.read.mockResolvedValue(null); m.create.mockResolvedValue(saved); m.update.mockResolvedValue({ ...saved, version: 2 });
  m.tx.mockImplementation(async fn => fn({ $queryRaw: m.lock, writingDraft: { findUnique: m.read, create: m.create, update: m.update } }));
});
describe("private versioned Writing drafts", () => {
  it("strictly rejects client ownership fields", () => expect(draftWriteSchema.safeParse({ ...input, studentId: "other" }).success).toBe(false));
  it.each([{ ...input, essay: "a".repeat(20001) }, { ...input, version: -1 }, { ...input, timeLeft: 9999 }, { ...input, attemptId: "bad" }])("bounds draft fields %#", value => expect(draftWriteSchema.safeParse(value).success).toBe(false));
  it("scopes task 1 and task 2 separately", () => expect(draftScope("task1", "same")).not.toBe(draftScope("task2", "same")));
  it("derives the owner under a row lock", async () => { await writeDraft("signed-in-user", input, "hash"); expect(m.lock).toHaveBeenCalledOnce(); expect(m.create.mock.calls[0][0].data.studentId).toBe("student-1"); });
  it("denies a blacklisted account before reading content", async () => { m.lock.mockResolvedValue([{ id: "student-1", blacklisted: true }]); await expect(writeDraft("u", input, "hash")).rejects.toMatchObject({ status: 403 }); expect(m.read).not.toHaveBeenCalled(); });
  it("does not overwrite a newer remote revision", async () => { m.read.mockResolvedValue({ ...saved, essay: "Other device", version: 3 }); await expect(writeDraft("u", { ...input, version: 1 }, "hash")).rejects.toMatchObject({ status: 409 }); expect(m.update).not.toHaveBeenCalled(); });
  it("repeated identical requests are idempotent", async () => { m.read.mockResolvedValue(saved); expect((await writeDraft("u", input, "hash"))?.version).toBe(1); expect(m.update).not.toHaveBeenCalled(); });
  it("cannot load a draft against a changed task", async () => { m.read.mockResolvedValue(saved); await expect(readDraft("student-1", "task2", "topic-1", "changed")).rejects.toMatchObject({ status: 409 }); });
  it("cannot clear another device's new attempt", async () => { m.read.mockResolvedValue({ ...saved, attemptId: "other-attempt" }); await expect(writeDraft("u", { ...input, version: 1 }, "hash", true)).rejects.toMatchObject({ status: 409 }); });
  it("clears with a versioned tombstone, never a deletion race", async () => { m.read.mockResolvedValue(saved); await writeDraft("u", { ...input, version: 1 }, "hash", true); expect(m.update.mock.calls[0][0].data).toEqual({ essay: "", attemptId: "attempt-123", timeLeft: 0, version: { increment: 1 } }); });
});
