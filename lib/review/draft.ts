/**
 * Server half of the AI review draft (idea 10; the pure part is
 * ./draft-shared). Reads one Writing / Speaking attempt, reuses the stored
 * assessment when it already has feedback text, and otherwise drafts the
 * feedback with one AI call (lib/ai `draftReviewFeedback`) and keeps it in the
 * attempt's existing aiAnalysis JSON (`teacherDraft`, an atomic jsonb merge —
 * no schema change), so reopening the item costs nothing. Without an AI key
 * Writing falls back to the transparent heuristic scorer and Speaking to "write
 * your own feedback".
 *
 * Access is checked by the caller (lib/access `canReviewStudent`).
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { draftReviewFeedback, hasOpenAI, heuristicWritingAssessment } from "@/lib/ai";
import { aiBandOf, aiCriteriaOf, isReviewSkill, type ReviewSkill, type WritingTask } from "./scoring";
import { answersOf, asRec, str, taskTypeOf } from "./answers";
import { draftFromAnalysis, type ReviewDraft } from "./draft-shared";

const TEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface DraftContext {
  testId: string;
  studentId: string;
  skill: ReviewSkill;
  taskType: WritingTask | null;
  aiAnalysis: unknown;
  aiBand: number | null;
  /** The task wording (Writing prompt / Speaking questions). */
  task: string;
  /** The student's work as text (essay / transcripts). */
  work: string;
  reviewed: boolean;
}

/** The attempt as the draft needs it; null for an unknown id or a skill teachers don't review. */
export async function draftContext(testId: string): Promise<DraftContext | null> {
  if (typeof testId !== "string" || !TEST_ID_RE.test(testId)) return null;
  const t: {
    id: string;
    studentId: string;
    module: string;
    score: number;
    answers: unknown;
    aiAnalysis: unknown;
    review: { aiBand: number | null } | null;
  } | null = await db.iELTSTest.findUnique({
    where: { id: testId },
    select: { id: true, studentId: true, module: true, score: true, answers: true, aiAnalysis: true, review: { select: { aiBand: true } } },
  });
  if (!t || !isReviewSkill(t.module)) return null;
  const skill: ReviewSkill = t.module;
  const a = answersOf(t.answers);
  let task = "";
  let work = "";
  if (skill === "WRITING") {
    task = str(a.prompt);
    work = str(a.essay);
  } else if (Array.isArray(a.answers)) {
    const turns = (a.answers as unknown[]).map((x) => asRec(x)).filter((x): x is Record<string, unknown> => !!x).slice(0, 40);
    task = turns.map((x) => str(x.question)).filter(Boolean).join(" / ");
    work = turns
      .filter((x) => str(x.transcript).trim())
      .map((x) => `[Part ${typeof x.part === "number" ? x.part : "?"}] ${str(x.question)}\n${str(x.transcript).trim()}`)
      .join("\n\n");
  } else {
    task = str(a.question);
    work = str(a.transcript);
  }
  return {
    testId: t.id,
    studentId: t.studentId,
    skill,
    taskType: skill === "WRITING" ? taskTypeOf(a) : null,
    aiAnalysis: t.aiAnalysis,
    aiBand: t.review?.aiBand ?? aiBandOf(skill, t.aiAnalysis) ?? t.score,
    task,
    work,
    reviewed: !!t.review,
  };
}

/**
 * The draft without a new AI call: the stored assessment (or a kept draft);
 * for Writing with no usable stored text, the heuristic scorer's words.
 */
export function storedDraft(ctx: DraftContext): ReviewDraft {
  const first = draftFromAnalysis(ctx.skill, ctx.aiAnalysis, { aiBand: ctx.aiBand });
  if (first.feedback || ctx.skill !== "WRITING" || !ctx.work.trim()) return first;
  const h = heuristicWritingAssessment(ctx.work, ctx.taskType ?? "task2") as unknown as Record<string, unknown>;
  return draftFromAnalysis(ctx.skill, ctx.aiAnalysis, { aiBand: ctx.aiBand, heuristic: h });
}

/** Whether a fresh AI draft is possible for this attempt (a key and some work to read). */
export function canGenerate(ctx: DraftContext): boolean {
  return hasOpenAI() && ctx.work.trim().length > 0;
}

/**
 * One AI call: new feedback words for the stored bands, kept in
 * aiAnalysis.teacherDraft. Null when the call fails (the caller keeps the
 * stored draft). Call guardAi BEFORE this.
 */
export async function generateDraft(ctx: DraftContext): Promise<ReviewDraft | null> {
  const base = storedDraft(ctx);
  const out = await draftReviewFeedback({
    skill: ctx.skill,
    task: ctx.task,
    band: base.band,
    criteria: aiCriteriaOf(ctx.skill, ctx.aiAnalysis),
    work: ctx.work,
  });
  if (!out) return null;
  const kept = { feedback: out.feedback, nextSteps: out.nextSteps, at: new Date().toISOString() };
  try {
    // Merge (never replace) so a concurrent write of another aiAnalysis key isn't lost.
    await db.$executeRaw`
      UPDATE "ielts_tests"
      SET "aiAnalysis" = COALESCE("aiAnalysis", '{}'::jsonb) || jsonb_build_object('teacherDraft', ${JSON.stringify(kept)}::jsonb)
      WHERE "id" = ${ctx.testId} AND ("aiAnalysis" IS NULL OR jsonb_typeof("aiAnalysis") = 'object')`;
  } catch (e) {
    console.error("Review draft: keeping the draft failed:", e instanceof Error ? e.message : e);
  }
  return { ...base, feedback: out.feedback, nextSteps: out.nextSteps, source: "ai" };
}
