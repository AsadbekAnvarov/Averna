/**
 * Contract for the admin bulk generator (/api/admin/exam-gen/*).
 *
 * The browser drives generation one STEP at a time (one Reading passage, one
 * Listening part, one Writing task or one Speaking set per request) so every
 * request fits a serverless time limit; a draft becomes "ready" when all its
 * steps are generated and it passes validation, and only then can it be
 * published to students.
 */

export type GenSkill = "READING" | "LISTENING" | "WRITING_TASK1" | "WRITING_TASK2" | "SPEAKING";
export type GenDifficulty = "Easy" | "Medium" | "Hard";
export type DraftStatus = "queued" | "generating" | "ready" | "failed" | "published";

export interface DraftSummary {
  id: string;
  skill: GenSkill;
  title: string;
  topic: string;
  difficulty: GenDifficulty;
  status: DraftStatus;
  /** Steps generated so far / total (Reading 3 passages, Listening 4 parts, others 1). */
  stepsDone: number;
  steps: number;
  /** Questions generated so far (Reading/Listening). */
  questions: number;
  /** Validator warnings for the reviewer. */
  warnings: string[];
  /** Last failure message (model error, invalid output …). */
  lastError?: string;
  /** How many times the current step has failed. */
  failures: number;
  createdAt: string;
}

/** POST /api/admin/exam-gen/plan */
export interface PlanRequest {
  skill: GenSkill;
  /** 1–100 drafts to create. */
  count: number;
  difficulty: GenDifficulty | "mixed";
}
export interface PlanResponse {
  ok: true;
  drafts: DraftSummary[];
}

/** POST /api/admin/exam-gen/step — generates the next missing step of one draft. */
export interface StepRequest {
  draftId: string;
  /** Admin pressed "retry" on a FAILED draft: its failure count is reset and the missing step is generated again. */
  retry?: boolean;
}
export interface StepResponse {
  ok: boolean;
  draft: DraftSummary;
  /** Present when the step failed (draft.status may still be "generating" — retry is allowed). */
  error?: string;
}

/** GET /api/admin/exam-gen/drafts?skill=READING|…|ALL */
export interface DraftsResponse {
  drafts: DraftSummary[];
  openAiConfigured: boolean;
}

/** POST /api/admin/exam-gen/publish */
export interface PublishRequest {
  ids: string[];
  publish: boolean;
}
export interface PublishResponse {
  ok: true;
  updated: number;
}

/** POST /api/admin/exam-gen/delete */
export interface DeleteRequest {
  ids: string[];
}
export interface DeleteResponse {
  ok: true;
  deleted: number;
}

/** GET /api/admin/exam-gen/preview?id= — full JSON for review (answers included; admins only). */
export interface PreviewResponse {
  draft: DraftSummary;
  test: unknown;
}

/** Any route: HTTP 429 when the AI budget is exhausted. */
export interface RateLimitedResponse {
  error: string;
  retryAfterSec: number;
}

export const STEPS_FOR: Record<GenSkill, number> = {
  READING: 3,
  LISTENING: 4,
  WRITING_TASK1: 1,
  WRITING_TASK2: 1,
  SPEAKING: 1,
};
