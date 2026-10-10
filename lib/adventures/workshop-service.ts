import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { workshopSchema, type WorkshopSummary, type WorkshopPayload } from "./rules";
export class WorkshopError extends Error { constructor(public status: number, message: string) { super(message); } }
type Row = { id: string; title: string; status: string; version: number; feedback: string | null; createdAt: Date; payload: unknown; authorName?: string; groupName?: string };
export function summary(row: Row): WorkshopSummary {
  const parsed = workshopSchema.safeParse(row.payload);
  if (!parsed.success) throw new WorkshopError(503, "A stored workshop needs review before it can be loaded.");
  return { id: row.id, title: row.title, status: row.status, version: row.version, feedback: row.feedback, createdAt: row.createdAt.toISOString(), payload: parsed.data, authorName: row.authorName, groupName: row.groupName };
}
export async function listWorkshops(userId: string, mode: "mine" | "class" | "review") {
  // Membership, role and blacklist conditions are evaluated in the same SQL read.
  const rows = mode === "review" ? await db.$queryRaw<Row[]>`
    SELECT w.*, au."name" AS "authorName", g."name" AS "groupName"
    FROM "adventure_workshops" w JOIN "students" a ON a."id"=w."authorStudentId"
    JOIN "users" au ON au."id"=a."userId" JOIN "groups" g ON g."id"=w."groupId"
    JOIN "teachers" t ON t."id"=g."teacherId" JOIN "users" viewer ON viewer."id"=t."userId"
    WHERE viewer."id"=${userId} AND viewer."role"='TEACHER' AND au."role"='STUDENT'
      AND a."groupId"=g."id" AND a."blacklisted"=false
    ORDER BY w."updatedAt" DESC, w."id" LIMIT 26`
    : mode === "class" ? await db.$queryRaw<Row[]>`
    SELECT w.*, au."name" AS "authorName", g."name" AS "groupName"
    FROM "adventure_workshops" w JOIN "students" a ON a."id"=w."authorStudentId"
    JOIN "users" au ON au."id"=a."userId" JOIN "groups" g ON g."id"=w."groupId"
    JOIN "students" member ON member."groupId"=g."id" JOIN "users" viewer ON viewer."id"=member."userId"
    WHERE viewer."id"=${userId} AND viewer."role"='STUDENT' AND member."blacklisted"=false
      AND a."groupId"=g."id" AND a."blacklisted"=false AND au."role"='STUDENT' AND w."status"='APPROVED'
    ORDER BY w."updatedAt" DESC, w."id" LIMIT 26`
    : await db.$queryRaw<Row[]>`
    SELECT w.*, au."name" AS "authorName", g."name" AS "groupName"
    FROM "adventure_workshops" w JOIN "students" a ON a."id"=w."authorStudentId"
    JOIN "users" au ON au."id"=a."userId" JOIN "groups" g ON g."id"=w."groupId"
    WHERE au."id"=${userId} AND au."role"='STUDENT' AND a."blacklisted"=false
    ORDER BY w."updatedAt" DESC, w."id" LIMIT 26`;
  return { items: rows.slice(0, 25).map(summary), more: rows.length > 25 };
}
async function lockUser(tx: Prisma.TransactionClient, userId: string, role: "STUDENT" | "TEACHER") {
  const rows = await tx.$queryRaw<{ role: string }[]>`SELECT "role" FROM "users" WHERE "id"=${userId} FOR UPDATE`;
  if (rows[0]?.role !== role) throw new WorkshopError(403, "This account cannot perform that action.");
}
export async function submitWorkshop(userId: string, requestId: string, payload: WorkshopPayload) {
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return db.$transaction(async tx => {
    await lockUser(tx, userId, "STUDENT");
    const initial = await tx.student.findUnique({ where: { userId }, select: { id: true, groupId: true } });
    if (!initial?.groupId) throw new WorkshopError(403, "Join a class before submitting for teacher review. Your personal draft is safe.");
    // Group before student is the same lock order used by moderation.
    await tx.$queryRaw`SELECT "id" FROM "groups" WHERE "id"=${initial.groupId} FOR UPDATE`;
    const owners = await tx.$queryRaw<{ id: string; groupId: string | null; blacklisted: boolean }[]>`SELECT "id", "groupId", "blacklisted" FROM "students" WHERE "userId"=${userId} FOR UPDATE`;
    const owner = owners[0];
    if (!owner || owner.blacklisted || owner.groupId !== initial.groupId) throw new WorkshopError(409, "Your class access changed. Reload before sharing; your draft is safe.");
    const existing = await tx.adventureWorkshop.findUnique({ where: { authorStudentId_requestId: { authorStudentId: owner.id, requestId } } });
    if (existing) {
      if (existing.fingerprint !== fingerprint || existing.groupId !== owner.groupId) throw new WorkshopError(409, "That submission ID belongs to a different draft. Review your draft and submit again.");
      return summary(existing);
    }
    const row = await tx.adventureWorkshop.create({ data: { authorStudentId: owner.id, groupId: owner.groupId, requestId, fingerprint, title: payload.title, payload } });
    return summary(row);
  }, { timeout: 10_000 });
}
export async function reviewWorkshop(userId: string, input: { id: string; version: number; decision: "APPROVED" | "REJECTED"; feedback: string }) {
  return db.$transaction(async tx => {
    await lockUser(tx, userId, "TEACHER");
    const initial = await tx.adventureWorkshop.findUnique({ where: { id: input.id }, select: { groupId: true, authorStudentId: true } });
    if (!initial) throw new WorkshopError(404, "Workshop not found.");
    const groups = await tx.$queryRaw<{ id: string }[]>`SELECT g."id" FROM "groups" g JOIN "teachers" t ON t."id"=g."teacherId" WHERE g."id"=${initial.groupId} AND t."userId"=${userId} FOR UPDATE OF g`;
    if (!groups.length) throw new WorkshopError(403, "Only the current teacher of this class can review this workshop.");
    const authors = await tx.$queryRaw<{ id: string }[]>`SELECT a."id" FROM "students" a JOIN "users" au ON au."id"=a."userId" WHERE a."id"=${initial.authorStudentId} AND a."groupId"=${initial.groupId} AND a."blacklisted"=false AND au."role"='STUDENT' FOR UPDATE OF a`;
    if (!authors.length) throw new WorkshopError(409, "The author is no longer active in this class.");
    await tx.$queryRaw`SELECT "id" FROM "adventure_workshops" WHERE "id"=${input.id} FOR UPDATE`;
    const current = await tx.adventureWorkshop.findUnique({ where: { id: input.id } });
    if (!current || current.version !== input.version) throw new WorkshopError(409, "This review changed. Reload before making a decision.");
    const parsed = workshopSchema.safeParse(current.payload);
    if (!parsed.success) throw new WorkshopError(409, "This content is invalid and cannot be published.");
    const changed = await tx.adventureWorkshop.updateMany({ where: { id: input.id, version: input.version }, data: { status: input.decision, feedback: input.feedback || null, reviewerUserId: userId, version: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkshopError(409, "Another review won. Reload the list.");
    const updated = await tx.adventureWorkshop.findUniqueOrThrow({ where: { id: input.id } });
    return summary(updated);
  }, { timeout: 10_000 });
}
export async function withdrawWorkshop(userId: string, id: string, version: number) {
  return db.$transaction(async tx => {
    await lockUser(tx, userId, "STUDENT");
    const owner = await tx.student.findUnique({ where: { userId }, select: { id: true } });
    if (!owner) throw new WorkshopError(403, "Student account required.");
    const result = await tx.adventureWorkshop.deleteMany({ where: { id, authorStudentId: owner.id, version } });
    if (result.count !== 1) throw new WorkshopError(409, "The submission changed or is not yours. Reload before withdrawing.");
  });
}
