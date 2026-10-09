import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { identifier, object, poll, signalNames, text, ToolError, type SignalKind } from "./rules";
type Actor = { id: string; role?: string | null; name?: string | null };
type Tx = Prisma.TransactionClient;
type SessionRow = { id: string; topic: string; status: string; openedAt: Date; closedAt: Date | null };
type PollRow = { id: string; prompt: string; options: string[]; correct: number; explanation: string; status: string };
export type ClassroomView = { groupId: string; groupName: string; staff: boolean; canWrite: boolean; capturedAt: string; session: { id: string; topic: string; status: string; openedAt: string } | null; ownSignal: { kind: SignalKind; question: string; version: number } | null; signals: { studentId: string; name: string; kind: SignalKind | null; question: string; updatedAt: string | null; answered: boolean }[]; counts: Record<SignalKind, number>; rosterCount: number; poll: { id: string; prompt: string; options: string[]; status: string; correct?: number; explanation?: string; ownAnswer: number | null; answers: number[]; responseCount: number } | null };
async function access(actor: Actor, groupId: string, tx: Tx = db) {
  if (!["ADMIN", "TEACHER", "STUDENT"].includes(actor.role ?? "")) throw new ToolError("Classroom access is required.", 403);
  const rows = await tx.$queryRaw<{ id: string; name: string; studentId: string | null; blacklisted: boolean | null }[]>(Prisma.sql`
    SELECT g."id",g."name",s."id" AS "studentId",s."blacklisted" FROM "groups" g
    JOIN "teachers" t ON t."id"=g."teacherId" LEFT JOIN "students" s ON s."groupId"=g."id" AND s."userId"=${actor.id}
    WHERE g."id"=${groupId} AND (${actor.role === "ADMIN"} OR (${actor.role === "TEACHER"} AND t."userId"=${actor.id}) OR (${actor.role === "STUDENT"} AND s."id" IS NOT NULL))`);
  if (!rows[0]) throw new ToolError("This classroom is not available.", 404);
  return rows[0];
}
export async function classroomGroups(actor: Actor) {
  if (!["ADMIN", "TEACHER", "STUDENT"].includes(actor.role ?? "")) throw new ToolError("Classroom access is required.", 403);
  return db.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`SELECT g."id",g."name" FROM "groups" g JOIN "teachers" t ON t."id"=g."teacherId" WHERE ${actor.role === "ADMIN"} OR (${actor.role === "TEACHER"} AND t."userId"=${actor.id}) OR (${actor.role === "STUDENT"} AND EXISTS(SELECT 1 FROM "students" s WHERE s."groupId"=g."id" AND s."userId"=${actor.id})) ORDER BY g."name",g."id" LIMIT 200`);
}
async function snapshot(actor: Actor, groupId: string, tx: Tx): Promise<ClassroomView> {
  const group = await access(actor, identifier(groupId), tx); const staff = actor.role !== "STUDENT";
  const sessions = await tx.$queryRaw<SessionRow[]>`SELECT "id","topic","status","openedAt","closedAt" FROM "classroom_sessions" WHERE "groupId"=${groupId} ORDER BY "openedAt" DESC,"id" DESC LIMIT 1`;
  const session = sessions[0];
  const roster = await tx.$queryRaw<{ studentId: string; name: string }[]>`SELECT s."id" AS "studentId",COALESCE(u."name",'Student') AS "name" FROM "students" s JOIN "users" u ON u."id"=s."userId" WHERE s."groupId"=${groupId} ORDER BY u."name",s."id" LIMIT 301`;
  if (roster.length > 300) throw new ToolError("This classroom supports up to 300 enrolled learners. Ask the centre to split this group.", 409);
  const base: ClassroomView = { groupId, groupName: group.name, staff, canWrite: staff || !group.blacklisted, capturedAt: new Date().toISOString(), session: session ? { id: session.id, topic: session.topic, status: session.status, openedAt: session.openedAt.toISOString() } : null, ownSignal: null, signals: [], counts: { UNDERSTOOD: 0, EXAMPLE: 0, QUESTION: 0 }, rosterCount: roster.length, poll: null };
  if (!session) return base;
  const ps = await tx.$queryRaw<PollRow[]>`SELECT "id","prompt","options","correct","explanation","status" FROM "classroom_polls" WHERE "sessionId"=${session.id} ORDER BY "createdAt" DESC,"id" DESC LIMIT 1`; const p = ps[0];
  const signals = await tx.$queryRaw<{ studentId: string; kind: SignalKind; question: string; version: number; updatedAt: Date }[]>`SELECT sg."studentId",sg."kind",sg."question",sg."version",sg."updatedAt" FROM "classroom_signals" sg JOIN "students" s ON s."id"=sg."studentId" WHERE sg."sessionId"=${session.id} AND s."groupId"=${groupId}`;
  const answers = p ? await tx.$queryRaw<{ studentId: string; option: number }[]>`SELECT a."studentId",a."option" FROM "classroom_answers" a JOIN "students" s ON s."id"=a."studentId" WHERE a."pollId"=${p.id} AND s."groupId"=${groupId}` : [];
  for (const s of signals) base.counts[s.kind]++;
  const own = signals.find(s => s.studentId === group.studentId); if (own) base.ownSignal = { kind: own.kind, question: own.question, version: own.version };
  if (staff) base.signals = roster.map(s => { const sg = signals.find(v => v.studentId === s.studentId); return { ...s, kind: sg?.kind ?? null, question: sg?.question ?? "", updatedAt: sg?.updatedAt.toISOString() ?? null, answered: answers.some(a => a.studentId === s.studentId) }; });
  if (p) base.poll = { id: p.id, prompt: p.prompt, options: p.options, status: p.status, ...(staff || p.status === "CLOSED" ? { correct: p.correct, explanation: p.explanation } : {}), ownAnswer: answers.find(a => a.studentId === group.studentId)?.option ?? null, answers: staff || p.status === "CLOSED" ? p.options.map((_, i) => answers.filter(a => a.option === i).length) : [], responseCount: staff || p.status === "CLOSED" ? answers.length : 0 };
  return base;
}
export async function getClassroom(actor: Actor, groupId: string) { return db.$transaction(tx => snapshot(actor, groupId, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }); }
export async function mutateClassroom(actor: Actor, raw: unknown) {
  const cmd = object(raw); const groupId = identifier(cmd.groupId); await access(actor, groupId);
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "groups" WHERE "id"=${groupId} FOR UPDATE`;
    const group = await access(actor, groupId, tx); const staff = actor.role === "ADMIN" || actor.role === "TEACHER";
    const staffActions = ["START", "CLOSE", "PUBLISH_POLL", "CLOSE_POLL"];
    if (staffActions.includes(String(cmd.action)) ? !staff : actor.role !== "STUDENT" || !group.studentId || group.blacklisted) throw new ToolError("This action is not permitted.", 403);
    if (cmd.action === "START") {
      const topic = text(cmd.topic, "Lesson topic", 3, 160); const id = identifier(cmd.operationId);
      const prior = await tx.$queryRaw<{ groupId: string; topic: string }[]>`SELECT "groupId","topic" FROM "classroom_sessions" WHERE "id"=${id}`;
      if (prior[0]) { if (prior[0].groupId === groupId && prior[0].topic === topic) return; throw new ToolError("This start request was already used. Refresh.", 409); }
      const active = await tx.$queryRaw<{ id: string; topic: string }[]>`SELECT "id","topic" FROM "classroom_sessions" WHERE "groupId"=${groupId} AND "status"='OPEN'`;
      if (active[0]) { if (active[0].topic === topic) return; throw new ToolError("A lesson is already open. Refresh or close it first.", 409); }
      await tx.$executeRaw`INSERT INTO "classroom_sessions" ("id","groupId","createdBy","topic") VALUES (${id},${groupId},${actor.id},${topic})`;
    } else {
      const sessionId = identifier(cmd.sessionId); const rows = await tx.$queryRaw<SessionRow[]>`SELECT * FROM "classroom_sessions" WHERE "id"=${sessionId} AND "groupId"=${groupId}`; const s = rows[0];
      if (!s) throw new ToolError("This lesson is not available.", 404);
      if (cmd.action === "CLOSE" && s.status === "CLOSED") return;
      if (s.status !== "OPEN") throw new ToolError("This lesson has closed. Refresh to see the latest lesson.", 409);
      if (cmd.action === "CLOSE") { await tx.$executeRaw`UPDATE "classroom_polls" SET "status"='CLOSED' WHERE "sessionId"=${s.id} AND "status"='OPEN'`; await tx.$executeRaw`UPDATE "classroom_sessions" SET "status"='CLOSED',"closedAt"=CURRENT_TIMESTAMP WHERE "id"=${s.id}`; }
      else if (cmd.action === "PUBLISH_POLL") {
        const input = poll(cmd); const id = identifier(cmd.operationId);
        const prior = await tx.$queryRaw<(PollRow & { sessionId: string })[]>`SELECT * FROM "classroom_polls" WHERE "id"=${id}`;
        if (prior[0]) { const p = prior[0] as PollRow & { sessionId: string }; if (p.sessionId === s.id && p.prompt === input.prompt && JSON.stringify(p.options) === JSON.stringify(input.options) && p.correct === input.correct && p.explanation === input.explanation) return; throw new ToolError("This check request was already used. Refresh.", 409); }
        const existing = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "classroom_polls" WHERE "sessionId"=${s.id} AND "status"='OPEN'`;
        if (existing.length) throw new ToolError("Close the current check before publishing another.", 409);
        await tx.$executeRaw`INSERT INTO "classroom_polls" ("id","sessionId","prompt","options","correct","explanation") VALUES (${id},${s.id},${input.prompt},${JSON.stringify(input.options)}::jsonb,${input.correct},${input.explanation})`;
      } else if (cmd.action === "CLOSE_POLL" || cmd.action === "ANSWER") {
        const pollId = identifier(cmd.pollId); const ps = await tx.$queryRaw<PollRow[]>`SELECT * FROM "classroom_polls" WHERE "id"=${pollId} AND "sessionId"=${s.id}`; const p = ps[0]; if (!p) throw new ToolError("This check is not available.", 404);
        if (cmd.action === "CLOSE_POLL") { if (p.status === "CLOSED") return; await tx.$executeRaw`UPDATE "classroom_polls" SET "status"='CLOSED' WHERE "id"=${p.id}`; }
        else {
          if (!Number.isInteger(cmd.option) || Number(cmd.option) < 0 || Number(cmd.option) >= p.options.length) throw new ToolError("Choose a valid option.");
          const prior = await tx.$queryRaw<{ option: number }[]>`SELECT "option" FROM "classroom_answers" WHERE "pollId"=${p.id} AND "studentId"=${group.studentId}`;
          if (prior[0]) { if (prior[0].option === cmd.option) return; throw new ToolError("Your answer is already saved for this check.", 409); }
          if (p.status !== "OPEN") throw new ToolError("The check has closed.", 409);
          await tx.$executeRaw`INSERT INTO "classroom_answers" ("id","pollId","studentId","option") VALUES (${randomUUID()},${p.id},${group.studentId},${Number(cmd.option)})`;
        }
      } else if (cmd.action === "SIGNAL") {
        if (!Object.hasOwn(signalNames, String(cmd.kind))) throw new ToolError("Choose a valid signal.");
        const question = cmd.kind === "QUESTION" ? text(cmd.question ?? "", "Question", 3, 500) : "";
        const existing = await tx.$queryRaw<{ kind: string; question: string; version: number }[]>`SELECT "kind","question","version" FROM "classroom_signals" WHERE "sessionId"=${s.id} AND "studentId"=${group.studentId}`;
        const current = existing[0]; if (current?.kind === cmd.kind && current.question === question) return;
        if (!Number.isInteger(cmd.version) || cmd.version !== (current?.version ?? 0)) throw new ToolError("Your signal changed in another tab. Refresh before sending.", 409);
        await tx.$executeRaw`INSERT INTO "classroom_signals" ("id","sessionId","studentId","kind","question") VALUES (${randomUUID()},${s.id},${group.studentId},${String(cmd.kind)},${question}) ON CONFLICT ("sessionId","studentId") DO UPDATE SET "kind"=EXCLUDED."kind","question"=EXCLUDED."question","version"="classroom_signals"."version"+1,"updatedAt"=CURRENT_TIMESTAMP`;
      } else throw new ToolError("Choose a valid classroom action.");
    }
    if (staff) await tx.auditLog.create({ data: { actorId: actor.id, actorName: actor.name ?? "Staff", role: actor.role ?? "", action: `Classroom ${String(cmd.action)}`, detail: `groupId=${groupId}` } });
  });
}
