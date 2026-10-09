import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { comparison, identifier, object, rating, reference, ToolError, type Scores } from "./rules";
type Actor = { id: string; name?: string | null; role?: string | null };
type ReferenceRow = { id: string; authorId: string | null; title: string; module: string; prompt: string; body: string; scores: Scores; rationale: string; createdAt: Date };
type RatingRow = { scores: Scores; quote: string; rationale: string; createdAt: Date };
export type CalibrationView = { admin: boolean; items: { id: string; title: string; module: string; completed: boolean }[]; hasMore: boolean; page: number; selected: { id: string; title: string; module: string; prompt: string; body: string; canRate: boolean; own: { scores: Scores; quote: string; rationale: string; createdAt: string } | null; reference: { rationale: string; comparison: ReturnType<typeof comparison> } | null } | null };
function staff(actor: Actor) { if (actor.role !== "ADMIN" && actor.role !== "TEACHER") throw new ToolError("Staff access is required.", 403); }
export async function getCalibration(actor: Actor, selectedId?: string, page = 1): Promise<CalibrationView> {
  staff(actor); const safePage = Math.max(1, Math.min(10000, Math.floor(Number(page) || 1)));
  return db.$transaction(async tx => {
    const items = await tx.$queryRaw<{ id: string; title: string; module: string; completed: boolean }[]>`SELECT r."id",r."title",r."module",EXISTS(SELECT 1 FROM "calibration_ratings" a WHERE a."referenceId"=r."id" AND a."userId"=${actor.id}) AS "completed" FROM "calibration_references" r ORDER BY r."createdAt" DESC,r."id" DESC LIMIT 21 OFFSET ${(safePage - 1) * 20}`;
    const id = selectedId ? identifier(selectedId) : items[0]?.id;
    const view: CalibrationView = { admin: actor.role === "ADMIN", items: items.slice(0, 20), hasMore: items.length > 20, page: safePage, selected: null };
    if (!id) return view;
    const rows = await tx.$queryRaw<ReferenceRow[]>`SELECT * FROM "calibration_references" WHERE "id"=${id}`; const r = rows[0]; if (!r) throw new ToolError("This reference is not available.", 404);
    const ratings = await tx.$queryRaw<RatingRow[]>`SELECT "scores","quote","rationale","createdAt" FROM "calibration_ratings" WHERE "referenceId"=${r.id} AND "userId"=${actor.id}`; const own = ratings[0];
    view.selected = { id: r.id, title: r.title, module: r.module, prompt: r.prompt, body: r.body, canRate: !own && r.authorId !== actor.id, own: own ? { ...own, createdAt: own.createdAt.toISOString() } : null, reference: own ? { rationale: r.rationale, comparison: comparison(own.scores, r.scores) } : null };
    return view;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function mutateCalibration(actor: Actor, raw: unknown) {
  staff(actor); const cmd = object(raw);
  if (cmd.action === "CREATE_REFERENCE") {
    if (actor.role !== "ADMIN") throw new ToolError("An administrator must confirm the centre's reference.", 403);
    const input = reference(cmd); const id = identifier(cmd.operationId);
    await db.$transaction(async tx => {
      // Serialize reference publication retries without touching existing learner records.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${actor.id} FOR UPDATE`;
      const prior = await tx.$queryRaw<ReferenceRow[]>`SELECT * FROM "calibration_references" WHERE "id"=${id}`;
      if (prior[0]) { const p = prior[0]; if (p.authorId === actor.id && p.title === input.title && p.module === input.module && p.prompt === input.prompt && p.body === input.body && p.rationale === input.rationale && Object.entries(input.scores).every(([key, value]) => p.scores[key as keyof Scores] === value)) return; throw new ToolError("This publication request was already used. Refresh.", 409); }
      await tx.$executeRaw`INSERT INTO "calibration_references" ("id","authorId","title","module","prompt","body","scores","rationale") VALUES (${id},${actor.id},${input.title},${input.module},${input.prompt},${input.body},${JSON.stringify(input.scores)}::jsonb,${input.rationale})`;
      await tx.auditLog.create({ data: { actorId: actor.id, actorName: actor.name ?? "Administrator", role: "ADMIN", action: "Published centre calibration reference", detail: `referenceId=${id}` } });
    }); return id;
  }
  if (cmd.action !== "RATE") throw new ToolError("Choose a valid calibration action."); const id = identifier(cmd.referenceId);
  await db.$transaction(async tx => {
    const rows = await tx.$queryRaw<ReferenceRow[]>`SELECT * FROM "calibration_references" WHERE "id"=${id} FOR UPDATE`; const ref = rows[0];
    if (!ref) throw new ToolError("This reference is not available.", 404); if (ref.authorId === actor.id) throw new ToolError("Choose a reference authored by another administrator for blind practice.", 403);
    const input = rating(cmd, ref.body);
    const prior = await tx.$queryRaw<RatingRow[]>`SELECT "scores","quote","rationale","createdAt" FROM "calibration_ratings" WHERE "referenceId"=${id} AND "userId"=${actor.id}`;
    if (prior[0]) { const p = prior[0]; if (p.quote === input.quote && p.rationale === input.rationale && Object.entries(input.scores).every(([key, value]) => p.scores[key as keyof Scores] === value)) return; throw new ToolError("Your blind assessment is already saved. Read the comparison.", 409); }
    await tx.$executeRaw`INSERT INTO "calibration_ratings" ("id","referenceId","userId","scores","quote","rationale") VALUES (${randomUUID()},${id},${actor.id},${JSON.stringify(input.scores)}::jsonb,${input.quote},${input.rationale})`;
    await tx.auditLog.create({ data: { actorId: actor.id, actorName: actor.name ?? "Staff", role: actor.role ?? "", action: "Completed private calibration practice", detail: `referenceId=${id}` } });
  }); return id;
}
