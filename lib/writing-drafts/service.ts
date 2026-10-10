import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { draftScope, sameDraft, type DraftSnapshot, type DraftWrite } from "./rules";
export class DraftError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Row = { essay: string; attemptId: string; timeLeft: number; version: number; updatedAt: Date; promptHash: string };
const snapshot = (row: Row): DraftSnapshot => ({ essay: row.essay, attemptId: row.attemptId, timeLeft: row.timeLeft, version: row.version, updatedAt: row.updatedAt.toISOString() });
export const promptHash = (prompt: string) => createHash("sha256").update(prompt).digest("hex");
export async function readDraft(studentId: string, taskType: string, promptId: string, hash: string) {
  const row = await db.writingDraft.findUnique({ where: { studentId_scope: { studentId, scope: draftScope(taskType, promptId) } } });
  if (row && row.promptHash !== hash) throw new DraftError(409, "This task changed. Keep your local text; the old account draft will not be loaded or overwritten.");
  return row ? snapshot(row) : null;
}
/** Student lock + version compare prevents lost updates and account/blacklist races. */
export async function writeDraft(userId: string, input: DraftWrite, hash: string, clear = false) {
  try {
    return await db.$transaction(async tx => {
      const owners = await tx.$queryRaw<{ id: string; blacklisted: boolean }[]>`
        SELECT "id", "blacklisted" FROM "students" WHERE "userId" = ${userId} FOR UPDATE`;
      const owner = owners[0];
      if (!owner || owner.blacklisted) throw new DraftError(403, "Student access is unavailable.");
      const where = { studentId_scope: { studentId: owner.id, scope: draftScope(input.taskType, input.promptId) } };
      const current = await tx.writingDraft.findUnique({ where });
      if (current && current.promptHash !== hash) throw new DraftError(409, "This task changed. Your local text is safe; use a new task.");
      if (clear && (!current || !current.essay)) return current ? snapshot(current) : null;
      const data = { essay: clear ? "" : input.essay, attemptId: input.attemptId, timeLeft: clear ? 0 : input.timeLeft };
      // Identical retries are idempotent, even when the previous response was lost.
      if (current && sameDraft(current, data)) return snapshot(current);
      if (current && (current.version !== input.version || (clear && current.attemptId !== input.attemptId)))
        throw new DraftError(409, "The account draft changed on another device. Compare both copies before replacing either.");
      if (!current && (input.version !== 0 || clear)) throw new DraftError(409, "Reload the account draft before saving.");
      const row = current
        ? await tx.writingDraft.update({ where, data: { ...data, version: { increment: 1 } } })
        : await tx.writingDraft.create({ data: { ...data, scope: draftScope(input.taskType, input.promptId), studentId: owner.id, promptHash: hash, version: 1 } });
      return snapshot(row);
    }, { timeout: 10000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new DraftError(409, "Another device saved first. Reload and compare the account draft.");
    throw error;
  }
}
