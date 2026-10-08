import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasOpenAI } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";
import {
  ExamGenError,
  GEN_ROW_SELECT,
  LOCK_MS,
  MODEL_TIMEOUT_MS,
  applyOutcome,
  callExamModel,
  countsAsFailure,
  generateStep,
  isExamGenLevel,
  isFailedDraft,
  isLocked,
  readDraft,
  releaseDraft,
  skillForModule,
  summarizeDraft,
  type StepOutcome,
} from "@/lib/ielts/generate";
import type { StepResponse } from "@/lib/ielts/generation-types";

export const dynamic = "force-dynamic";
// One step = one model call (aborted after ≤ 50 s) + two small DB writes.
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const asJson = (v: unknown) => v as Prisma.InputJsonValue;

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return json({ error: signedOut ? "Please sign in." : "Teacher or admin access required." }, signedOut ? 401 : 403);
}

/**
 * POST { draftId } — generate the draft's next missing step (one Reading
 * passage, one Listening part, or the whole Writing task / Speaking set).
 * Validation or model failures answer 200 { ok: false, error } so the client
 * can retry; three failures in a row mark the draft "failed".
 */
export async function POST(req: NextRequest) {
  const started = Date.now();
  let user;
  try {
    user = await requireTeacherOrAdmin();
  } catch (e) {
    return authError(e);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const draftId = typeof body?.draftId === "string" ? body.draftId.trim() : "";
  if (!draftId) return json({ error: "draftId is required." }, 400);
  if (!hasOpenAI()) return json({ error: "OpenAI is not configured — set OPENAI_API_KEY to generate tests." }, 400);
  const guard = await guardAi(user.id, "exam-gen");
  if (!guard.ok) return json({ error: guard.message ?? "AI limit reached.", retryAfterSec: guard.retryAfterSeconds ?? 600 }, 429);

  try {
    const row = await db.generatedTest.findUnique({ where: { id: draftId }, select: GEN_ROW_SELECT });
    if (!row || !isExamGenLevel(row.level)) return json({ error: "Draft not found." }, 404);
    const skill = skillForModule(row.module);
    if (!skill) return json({ error: "This row is not a bulk-generator draft." }, 400);
    if (row.published) return json({ error: "This test is already published." }, 400);
    const stored = readDraft(row.data, skill);
    if (!stored) {
      // Every step is done already (e.g. a duplicate request): nothing to generate.
      const done: StepResponse = { ok: true, draft: summarizeDraft(row) };
      return json(done);
    }
    // An explicit admin retry clears the strikes of a failed draft (the parts
    // generated so far are kept); otherwise a failed draft is left alone.
    const draft = isFailedDraft(stored) && body?.retry === true ? { ...stored, failures: 0, status: undefined } : stored;
    if (isFailedDraft(draft)) {
      return json({ error: `This draft failed ${draft.failures} times${draft.lastError ? ` (${draft.lastError})` : ""}. Retry it or delete it and plan a new one.` }, 400);
    }

    // Short lock (optimistic on updatedAt) so two concurrent requests never generate the same step.
    const now = Date.now();
    const busy = () => {
      const res: StepResponse = { ok: false, draft: summarizeDraft(row, now), error: "Another request is generating this draft — try again in a minute." };
      return json(res);
    };
    if (isLocked(draft, now)) return busy();
    const locked = await db.generatedTest.updateMany({
      where: { id: row.id, updatedAt: row.updatedAt, published: false },
      data: { data: asJson({ ...draft, lockedUntil: now + LOCK_MS }), updatedAt: new Date() },
    });
    if (locked.count !== 1) return busy();
    const held = await db.generatedTest.findUnique({ where: { id: row.id }, select: { updatedAt: true } });
    if (!held) return json({ error: "Draft not found." }, 404);
    const token = held.updatedAt;
    // Compare-and-set on the lock's updatedAt: never overwrite a row someone else changed or deleted meanwhile.
    const save = async (data: unknown, description?: string): Promise<boolean> => {
      const res = await db.generatedTest.updateMany({
        where: { id: row.id, updatedAt: token },
        data: { data: asJson(data), updatedAt: new Date(), ...(description != null ? { description } : {}) },
      });
      return res.count === 1;
    };

    let outcome: StepOutcome;
    try {
      // Leave a few seconds of the 60 s budget for the final save.
      const budget = Math.max(10_000, Math.min(MODEL_TIMEOUT_MS, 56_000 - (Date.now() - started)));
      outcome = await generateStep({ id: row.id, draft, complete: (r) => callExamModel(r, budget) });
    } catch (e) {
      const err = e instanceof ExamGenError ? e : new ExamGenError("upstream", e instanceof Error ? e.message : "The model call failed.");
      if (countsAsFailure(err.kind)) {
        outcome = { ok: false, error: err.message, errors: [] };
      } else {
        // Rate limits, configuration and upstream outages are not this draft's fault: release it without a strike.
        const released = releaseDraft(draft, err.message);
        await save(released);
        console.warn(`exam-gen/step ${row.id}: ${err.kind}: ${err.message}`);
        if (err.kind === "rate_limit") return json({ error: err.message, retryAfterSec: err.retryAfterSec ?? 60 }, 429);
        if (err.kind === "config") return json({ error: err.message }, 400);
        const res: StepResponse = { ok: false, draft: summarizeDraft({ ...row, data: released }), error: err.message };
        return json(res);
      }
    }

    const next = applyOutcome(draft, outcome);
    if (!(await save(next.data, next.final ? next.description : undefined))) {
      const current = await db.generatedTest.findUnique({ where: { id: row.id }, select: GEN_ROW_SELECT });
      if (!current) return json({ error: "The draft was deleted while it was being generated." }, 404);
      const res: StepResponse = { ok: false, draft: summarizeDraft(current), error: "The draft changed while it was being generated; this result was discarded." };
      return json(res);
    }
    if (!outcome.ok) console.warn(`exam-gen/step ${row.id}: ${outcome.error}`);
    const summary = summarizeDraft({ ...row, data: next.data });
    const res: StepResponse = outcome.ok ? { ok: true, draft: summary } : { ok: false, draft: summary, error: outcome.error };
    return json(res);
  } catch (error) {
    console.error("exam-gen/step error:", error);
    return json({ error: error instanceof Error ? error.message : "The generation step failed." }, 500);
  }
}
