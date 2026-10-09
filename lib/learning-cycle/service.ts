import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canViewStudent, canReviewStudent, visibleStudentIds, type Viewer } from "@/lib/access";
import { buildPlan, CycleError, nextStep, parseEntry, parsePracticeReview, validSourceId, type CyclePlan, type CycleView, type PracticeEntry, type PracticeReview } from "./rules";

type Tx = Prisma.TransactionClient;
type Actor = Viewer & { name?: string | null };
type CycleRow = { id: string; originalId: string; plan: CyclePlan };
type EntryRow = Omit<PracticeEntry, "createdAt" | "updatedAt" | "review"> & { createdAt: Date; updatedAt: Date };
type ReviewRow = Omit<PracticeReview, "createdAt"> & { entryId: string; createdAt: Date };
const sourceSelect = { id: true, studentId: true, module: true, score: true, answers: true, aiAnalysis: true, review: { select: { band: true, criteria: true, comment: true } }, student: { select: { userId: true, blacklisted: true, group: { select: { teacher: { select: { userId: true } } } } } } } as const;
async function source(viewer: Viewer, testId: string, client: Tx = db) {
  if (!validSourceId(testId) || !["STUDENT", "TEACHER", "ADMIN"].includes(viewer.role ?? "")) throw new CycleError("This work is not available.", 404);
  const row = await client.iELTSTest.findUnique({ where: { id: testId }, select: sourceSelect });
  if (!row || !(await canViewStudent(viewer, row.studentId, client))) throw new CycleError("This work is not available.", 404);
  if (row.module !== "WRITING" && row.module !== "SPEAKING") throw new CycleError("This work is not available.", 404);
  return row;
}
async function stored(client: Tx, testId: string): Promise<CycleRow | null> {
  const rows = await client.$queryRaw<CycleRow[]>`SELECT "id","originalId","plan" FROM "learning_cycles" WHERE "originalId"=${testId}`;
  return rows[0] ?? null;
}
async function entries(client: Tx, cycleId: string): Promise<PracticeEntry[]> {
  const [es, rs] = await Promise.all([
    client.$queryRaw<EntryRow[]>`SELECT * FROM "learning_cycle_entries" WHERE "cycleId"=${cycleId} ORDER BY "createdAt","id"`,
    client.$queryRaw<ReviewRow[]>`SELECT r.* FROM "learning_cycle_reviews" r JOIN "learning_cycle_entries" e ON e."id"=r."entryId" WHERE e."cycleId"=${cycleId}`,
  ]);
  return es.map(e => { const r = rs.find(r => r.entryId === e.id); return { id: e.id, kind: e.kind, status: e.status, body: e.body, reflection: e.reflection, version: e.version, createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(), review: r ? { outcomes: r.outcomes, comment: r.comment, reviewerName: r.reviewerName, createdAt: r.createdAt.toISOString() } : null }; });
}
export async function getCycle(viewer: Actor, testId: string): Promise<CycleView> {
  const row = await source(viewer, testId); const cycle = await stored(db, testId);
  const owner = viewer.role === "STUDENT" && row.student.userId === viewer.id;
  const work = cycle ? await entries(db, cycle.id) : [];
  return { id: cycle?.id ?? null, sourceId: testId, plan: cycle?.plan ?? buildPlan(row), entries: work.filter(e => owner || e.status === "SUBMITTED"), isOwner: owner, canWrite: viewer.role === "STUDENT" && row.student.userId === viewer.id && !row.student.blacklisted, canReview: await canReviewStudent(viewer, row.studentId), hasAssignedTeacher: !!row.student.group?.teacher.userId };
}
async function audit(tx: Tx, viewer: Actor, action: string, testId: string) {
  await tx.auditLog.create({ data: { actorId: viewer.id, actorName: viewer.name ?? "User", role: viewer.role ?? "", action, detail: `sourceTestId=${testId}` } });
}
/** All mutations lock the original attempt, also used by original teacher reviews.
 * No original grade, submission, XP, streak, money or AI job is modified. */
export async function mutateCycle(viewer: Actor, testId: string, raw: unknown): Promise<void> {
  const command = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const action = command.action;
  if (!["START", "SAVE_DRAFT", "SUBMIT", "REVIEW"].includes(String(action))) throw new CycleError("Choose a valid action.");
  // Authorization before the transaction, then checked again after locking.
  const before = await source(viewer, testId);
  if (action === "REVIEW") { if (!(await canReviewStudent(viewer, before.studentId))) throw new CycleError("Only the student's teacher or an administrator can review this work.", 403); }
  else if (viewer.role !== "STUDENT" || before.student.userId !== viewer.id || before.student.blacklisted) throw new CycleError("Only the learner can change their practice work.", 403);
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ielts_tests" WHERE "id"=${testId} FOR UPDATE`;
    const row = await source(viewer, testId, tx);
    if (action === "REVIEW") { if (!(await canReviewStudent(viewer, row.studentId, tx))) throw new CycleError("This review is no longer permitted.", 403); }
    else if (viewer.role !== "STUDENT" || row.student.userId !== viewer.id || row.student.blacklisted) throw new CycleError("This change is no longer permitted.", 403);
    let cycle = await stored(tx, testId);
    if (action === "START") {
      if (cycle) return;
      const plan = buildPlan(row); const id = randomUUID();
      await tx.$executeRaw`INSERT INTO "learning_cycles" ("id","originalId","plan") VALUES (${id},${testId},${JSON.stringify(plan)}::jsonb)`;
      await audit(tx, viewer, "Started formative practice cycle", testId); return;
    }
    if (!cycle) throw new CycleError("Start the practice cycle first.", 409);
    const es = await entries(tx, cycle.id);
    if (action === "REVIEW") {
      const e = es.find(e => e.id === command.entryId);
      if (!e || e.status !== "SUBMITTED") throw new CycleError("Only a submitted response can be reviewed.", 409);
      const review = parsePracticeReview(command, cycle.plan, e);
      if (e.review) {
        if (review.outcomes.length === e.review.outcomes.length && review.outcomes.every(o => e.review!.outcomes.some(saved => saved.key === o.key && saved.outcome === o.outcome && saved.quote === o.quote)) && review.comment === e.review.comment) return;
        throw new CycleError("This response already has a review. Refresh to see it.", 409);
      }
      await tx.$executeRaw`INSERT INTO "learning_cycle_reviews" ("id","entryId","reviewerId","reviewerName","outcomes","comment") VALUES (${randomUUID()},${e.id},${viewer.id},${viewer.name ?? "Teacher"},${JSON.stringify(review.outcomes)}::jsonb,${review.comment})`;
      await audit(tx, viewer, "Reviewed formative practice response", testId);
      await tx.notification.create({ data: { userId: row.student.userId, type: "system", title: "Your practice feedback is ready", message: e.kind === "REVISION" ? "Read your teacher's feedback, then apply the focus skills to a new task." : "Your skill-transfer feedback is ready. Your private portfolio now includes both practice steps.", link: `/learning/feedback-cycle/${testId}` } }); return;
    }
    const input = parseEntry(command, action === "SUBMIT"); const current = es.find(e => e.kind === input.kind);
    // A retry after a committed submission is harmless; changed content is rejected.
    if (current?.status === "SUBMITTED") {
      if (action === "SUBMIT" && current.body === input.body && current.reflection === input.reflection) return;
      throw new CycleError("Submitted work is kept as evidence and cannot be overwritten.", 409);
    }
    const step = nextStep(es);
    if ((input.kind === "REVISION" && step !== "REVISION") || (input.kind === "TRANSFER" && step !== "TRANSFER")) throw new CycleError("Finish the previous step and wait for its review first.", 409);
    if (input.version !== (current?.version ?? 0)) throw new CycleError("This draft changed in another tab. Refresh before editing it.", 409);
    if (action === "SAVE_DRAFT" && current?.body === input.body && current.reflection === input.reflection) return;
    if (action === "SUBMIT") {
      const clean = (text: string) => text.replace(/\s+/g, " ").trim();
      const sameOriginal = clean(input.body) === clean(cycle.plan.original);
      const sameRevision = input.kind === "TRANSFER" && clean(input.body) === clean(es.find(e => e.kind === "REVISION")?.body ?? "");
      if (sameOriginal || sameRevision) throw new CycleError("Use a revised response or an answer to the new task, not an unchanged copy.");
    }
    const status = action === "SUBMIT" ? "SUBMITTED" : "DRAFT";
    if (current) await tx.$executeRaw`UPDATE "learning_cycle_entries" SET "body"=${input.body},"reflection"=${input.reflection},"status"=${status},"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${current.id}`;
    else await tx.$executeRaw`INSERT INTO "learning_cycle_entries" ("id","cycleId","kind","status","body","reflection") VALUES (${randomUUID()},${cycle.id},${input.kind},${status},${input.body},${input.reflection})`;
    await audit(tx, viewer, action === "SUBMIT" ? "Submitted formative practice response" : "Saved private practice draft", testId);
    const teacherId = row.student.group?.teacher.userId;
    if (action === "SUBMIT" && teacherId) await tx.notification.create({ data: { userId: teacherId, type: "system", title: "Practice follow-up to review", message: `A learner submitted a ${input.kind === "REVISION" ? "revision" : "skill-transfer response"}.`, link: `/learning/feedback-cycle/${testId}` } });
  });
}
export interface CycleListItem { sourceId: string; title: string; skill: string; studentName: string | null; createdAt: string; stage: string }
export async function listCycles(viewer: Actor, mode: "portfolio" | "inbox", page = 1): Promise<{ items: CycleListItem[]; hasMore: boolean }> {
  if (mode === "inbox" && viewer.role !== "ADMIN" && viewer.role !== "TEACHER") throw new CycleError("Teacher access is required.", 403);
  if (mode === "portfolio" && viewer.role !== "STUDENT") throw new CycleError("Student access is required.", 403);
  const ids = await visibleStudentIds(viewer); if (Array.isArray(ids) && !ids.length) return { items: [], hasMore: false };
  const scope = viewer.role === "ADMIN" ? Prisma.sql`TRUE` : viewer.role === "TEACHER" ? Prisma.sql`EXISTS (SELECT 1 FROM "groups" g JOIN "teachers" te ON te."id"=g."teacherId" WHERE g."id"=s."groupId" AND te."userId"=${viewer.id})` : Prisma.sql`s."userId"=${viewer.id}`;
  const pending = mode === "inbox" ? Prisma.sql`AND s."userId" <> ${viewer.id} AND EXISTS (SELECT 1 FROM "learning_cycle_entries" e LEFT JOIN "learning_cycle_reviews" r ON r."entryId"=e."id" WHERE e."cycleId"=c."id" AND e."status"='SUBMITTED' AND r."id" IS NULL)` : Prisma.empty;
  const safePage = Math.max(1, Math.min(10000, Math.floor(Number(page) || 1)));
  const rows = await db.$queryRaw<{ id: string; originalId: string; plan: CyclePlan; createdAt: Date; studentName: string | null; stage: string }[]>(Prisma.sql`
    SELECT c.*,u."name" AS "studentName", CASE
      WHEN EXISTS (SELECT 1 FROM "learning_cycle_entries" e JOIN "learning_cycle_reviews" r ON r."entryId"=e."id" WHERE e."cycleId"=c."id" AND e."kind"='TRANSFER') THEN 'Feedback complete'
      WHEN EXISTS (SELECT 1 FROM "learning_cycle_entries" e LEFT JOIN "learning_cycle_reviews" r ON r."entryId"=e."id" WHERE e."cycleId"=c."id" AND e."status"='SUBMITTED' AND r."id" IS NULL) THEN 'Awaiting review'
      ELSE 'In progress' END AS "stage"
    FROM "learning_cycles" c JOIN "ielts_tests" t ON t."id"=c."originalId" JOIN "students" s ON s."id"=t."studentId" JOIN "users" u ON u."id"=s."userId"
    WHERE ${scope} ${pending} ORDER BY c."createdAt" DESC,c."id" DESC LIMIT 21 OFFSET ${(safePage - 1) * 20}`);
  return { hasMore: rows.length > 20, items: rows.slice(0, 20).map(r => ({ sourceId: r.originalId, title: r.plan.title, skill: r.plan.skill, studentName: r.studentName, createdAt: r.createdAt.toISOString(), stage: r.stage })) };
}
