/**
 * Teacher review — the band maths shared by the review form (browser) and the
 * save route (server): the four criteria per skill, validation, the IELTS
 * average, reading the AI's assessment back out of a test row, and applying a
 * review to a mock sitting's results.
 *
 * Pure and dependency-free (only lib/ielts/bands at runtime) — safe on the
 * server and in "use client" components.
 */

import { overallBand, roundBand, writingBand } from "../ielts/bands";
import type { MockResults, MockSection, MockSectionResult } from "../ielts/mock";

export type ReviewSkill = "WRITING" | "SPEAKING";
export type WritingTask = "task1" | "task2";

export function isReviewSkill(x: unknown): x is ReviewSkill {
  return x === "WRITING" || x === "SPEAKING";
}

export type WritingCriterionKey = "taskAchievement" | "coherenceCohesion" | "lexicalResource" | "grammarAccuracy";
export type SpeakingCriterionKey = "fluency" | "lexical" | "grammar" | "pronunciation";
export type CriterionKey = WritingCriterionKey | SpeakingCriterionKey;

/**
 * Criterion bands as stored in TestReview.criteria:
 *   Writing  { taskAchievement, coherenceCohesion, lexicalResource, grammarAccuracy }
 *   Speaking { fluency, lexical, grammar, pronunciation }
 * null = not rated (only Speaking pronunciation may stay unrated).
 */
export type ReviewCriteria = Partial<Record<CriterionKey, number | null>>;

export interface CriterionDef {
  key: CriterionKey;
  label: string;
  /** May be left unrated (the band then comes from the other criteria). */
  optional?: boolean;
}

const WRITING_CRITERIA: readonly CriterionDef[] = [
  { key: "taskAchievement", label: "Task Achievement / Response" },
  { key: "coherenceCohesion", label: "Coherence & Cohesion" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammarAccuracy", label: "Grammatical Range & Accuracy" },
];

const SPEAKING_CRITERIA: readonly CriterionDef[] = [
  { key: "fluency", label: "Fluency & Coherence" },
  { key: "lexical", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" },
  { key: "pronunciation", label: "Pronunciation", optional: true },
];

/** The four criteria of a skill; Writing's first one is named after the task (Task 1 Achievement, Task 2 Response). */
export function criteriaFor(skill: ReviewSkill, taskType?: WritingTask | null): CriterionDef[] {
  if (skill === "SPEAKING") return [...SPEAKING_CRITERIA];
  return WRITING_CRITERIA.map((c) =>
    c.key === "taskAchievement" && taskType
      ? { ...c, label: taskType === "task1" ? "Task Achievement" : "Task Response" }
      : { ...c }
  );
}

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

export const MAX_COMMENT_CHARS = 4000;
/** Writing: an essay needs this many words to be worth a teacher's review. */
export const MIN_REVIEW_ESSAY_WORDS = 20;
/** IELTS minimum length of each Writing task. */
export const MIN_TASK_WORDS: Record<WritingTask, number> = { task1: 150, task2: 250 };

/** Every valid band, highest first (for the selects). */
export const BAND_OPTIONS: readonly number[] = Array.from({ length: 19 }, (_, i) => 9 - i * 0.5);

/** A band from 0 to 9 in steps of 0.5. */
export function isHalfBand(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 9 && Number.isInteger(x * 2);
}

/** A number or numeric string that is a valid half band, as a number; otherwise null. */
export function toHalfBand(x: unknown): number | null {
  if (typeof x === "string") {
    const s = x.trim();
    if (!s || !/^\d+(\.\d+)?$/.test(s)) return null;
    x = Number(s);
  }
  return isHalfBand(x) ? x : null;
}

/** The nearest half band (0–9), for prefilling from the AI's unrounded criteria; null when not a number. */
export function snapBand(x: unknown): number | null {
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  return Math.max(0, Math.min(9, Math.round(x * 2) / 2));
}

export function formatBand(b: number | null | undefined): string {
  return typeof b === "number" && Number.isFinite(b) ? b.toFixed(1) : "—";
}

/** "+0.5", "−1.0", "±0" — the teacher's band against the AI's. */
export function formatBandDelta(band: number, ai: number | null | undefined): string | null {
  if (typeof ai !== "number" || !Number.isFinite(ai)) return null;
  const d = Math.round((band - ai) * 2) / 2;
  if (d === 0) return "±0";
  return `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}`;
}

/**
 * The IELTS average of the rated criteria (roundBand: .25 → .5, .75 → next
 * band), or null when nothing is rated. Unrated optional criteria are skipped,
 * so a Speaking review without Pronunciation averages the other three.
 */
export function criteriaBand(skill: ReviewSkill, criteria: ReviewCriteria): number | null {
  const values = criteriaFor(skill)
    .map((c) => criteria[c.key])
    .filter(isHalfBand);
  if (!values.length) return null;
  return roundBand(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Every required criterion has a valid band. */
export function criteriaComplete(skill: ReviewSkill, criteria: ReviewCriteria): boolean {
  return criteriaFor(skill).every((c) => c.optional || isHalfBand(criteria[c.key]));
}

/** Stored criteria (TestReview.criteria JSON) read back: known keys only, invalid values → null. */
export function readCriteria(skill: ReviewSkill, raw: unknown): ReviewCriteria {
  const o = asRec(raw) ?? {};
  const out: ReviewCriteria = {};
  for (const c of criteriaFor(skill)) out[c.key] = toHalfBand(o[c.key]);
  return out;
}

// ---------------------------------------------------------------------------
// The AI's assessment (IELTSTest.aiAnalysis)
// ---------------------------------------------------------------------------

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/**
 * The AI examiner's criteria. Writing: WritingAssessment. Speaking: exam-v2
 * `criteria { fluency, lexical, grammar, pronunciation }`, or the legacy
 * single-answer shape `{ fluency, vocabulary, grammar }`.
 */
export function aiCriteriaOf(skill: ReviewSkill, aiAnalysis: unknown): ReviewCriteria {
  const ai = asRec(aiAnalysis) ?? {};
  if (skill === "WRITING") {
    return {
      taskAchievement: num(ai.taskAchievement),
      coherenceCohesion: num(ai.coherenceCohesion),
      lexicalResource: num(ai.lexicalResource),
      grammarAccuracy: num(ai.grammarAccuracy),
    };
  }
  const c = asRec(ai.criteria) ?? {};
  return {
    fluency: num(c.fluency) ?? num(ai.fluency),
    lexical: num(c.lexical) ?? num(ai.vocabulary) ?? num(ai.lexical),
    grammar: num(c.grammar) ?? num(ai.grammar),
    pronunciation: num(c.pronunciation) ?? num(ai.pronunciation),
  };
}

/** The AI's overall band stored with the attempt (Writing overallBand, Speaking overall), or null. */
export function aiBandOf(skill: ReviewSkill, aiAnalysis: unknown): number | null {
  const ai = asRec(aiAnalysis) ?? {};
  const b = skill === "WRITING" ? num(ai.overallBand) : num(ai.overall) ?? num(ai.band);
  return b == null ? null : Math.max(0, Math.min(9, b));
}

/** Form prefill from the AI: each criterion snapped to a half band (unrated stays null). */
export function prefillFromAi(skill: ReviewSkill, ai: ReviewCriteria): ReviewCriteria {
  const out: ReviewCriteria = {};
  for (const c of criteriaFor(skill)) out[c.key] = snapBand(ai[c.key]);
  return out;
}

// ---------------------------------------------------------------------------
// Validation of a submitted review
// ---------------------------------------------------------------------------

export interface ReviewInput {
  band: number;
  criteria: ReviewCriteria;
  comment: string | null;
}

export type ReviewParse = { ok: true; value: ReviewInput } | { ok: false; error: string };

/** Validate the POST body: every required criterion and the band 0–9 in 0.5 steps, comment ≤ 4000 characters. */
export function parseReviewInput(skill: ReviewSkill, raw: unknown, taskType?: WritingTask | null): ReviewParse {
  const body = asRec(raw);
  if (!body) return { ok: false, error: "The review is missing." };
  const given = asRec(body.criteria) ?? {};
  const criteria: ReviewCriteria = {};
  for (const c of criteriaFor(skill, taskType)) {
    const v = given[c.key];
    if (v === undefined || v === null || v === "") {
      if (c.optional) {
        criteria[c.key] = null;
        continue;
      }
      return { ok: false, error: `Give a band for ${c.label}.` };
    }
    const b = toHalfBand(v);
    if (b === null) return { ok: false, error: `${c.label} must be a band from 0 to 9 in steps of 0.5.` };
    criteria[c.key] = b;
  }
  const band = toHalfBand(body.band);
  if (band === null) return { ok: false, error: "The overall band must be from 0 to 9 in steps of 0.5." };

  let comment: string | null = null;
  if (body.comment !== undefined && body.comment !== null) {
    if (typeof body.comment !== "string") return { ok: false, error: "The comment must be text." };
    const c = body.comment.replace(/\r\n?/g, "\n").trim();
    if (c.length > MAX_COMMENT_CHARS) {
      return { ok: false, error: `Keep the comment to ${MAX_COMMENT_CHARS} characters (it has ${c.length}).` };
    }
    comment = c || null;
  }
  return { ok: true, value: { band, criteria, comment } };
}

/** Same band, criteria and comment — a re-save changes nothing (no second notification). */
export function sameReview(
  skill: ReviewSkill,
  a: { band: number; criteria: unknown; comment: string | null },
  b: ReviewInput
): boolean {
  if (a.band !== b.band || (a.comment ?? null) !== (b.comment ?? null)) return false;
  const ca = readCriteria(skill, a.criteria);
  return criteriaFor(skill).every((c) => (ca[c.key] ?? null) === (b.criteria[c.key] ?? null));
}

// ---------------------------------------------------------------------------
// Where a review lands
// ---------------------------------------------------------------------------

/** "Writing Task 2", "Writing", "Speaking test", "Speaking practice". */
export function attemptLabel(skill: ReviewSkill, taskType: WritingTask | null, fullSpeakingTest = true): string {
  if (skill === "WRITING") return taskType === "task1" ? "Writing Task 1" : taskType === "task2" ? "Writing Task 2" : "Writing";
  return fullSpeakingTest ? "Speaking test" : "Speaking practice";
}

/** The student's result page for an attempt. */
export function studentResultHref(skill: ReviewSkill, testId: string): string {
  const id = encodeURIComponent(testId);
  return skill === "WRITING" ? `/learning/writing/result/${id}` : `/learning/speaking-test/result/${id}`;
}

export function reviewNotification(label: string, band: number, updated: boolean): { title: string; message: string } {
  return {
    title: updated ? `Your teacher updated the review of your ${label}` : `Your teacher reviewed your ${label}`,
    message: `Band ${formatBand(band)} — read the feedback`,
  };
}

/** Homework feedback for a full Writing test: both tasks' comments, labelled. */
export function sittingFeedback(task1Comment: string | null | undefined, task2Comment: string | null | undefined): string | null {
  const parts: string[] = [];
  if (task1Comment && task1Comment.trim()) parts.push(`Task 1: ${task1Comment.trim()}`);
  if (task2Comment && task2Comment.trim()) parts.push(`Task 2: ${task2Comment.trim()}`);
  return parts.length ? parts.join("\n\n") : null;
}

/** The band of a full Writing test from both tasks' current bands (Task 2 counts double). */
export function sittingBand(task1: number, task2: number): number {
  return writingBand(task1, task2);
}

/** A Writing task worth a teacher's review (MIN_REVIEW_ESSAY_WORDS+ words) — only these enter the queue. */
export function isReviewableEssay(words: number | null | undefined): boolean {
  return typeof words === "number" && Number.isFinite(words) && words >= MIN_REVIEW_ESSAY_WORDS;
}

/**
 * Whether a full Writing test (the tasks of one sitting) counts as reviewed —
 * the one rule behind its homework's GRADED status and the "reviewed" state the
 * homework pages show: every task worth reviewing (isReviewableEssay) has a
 * review, and at least one task does. A task too short to review never enters
 * the queue, so nothing waits for it.
 */
export function sittingReviewed(tasks: readonly { words: number | null | undefined; reviewed: boolean }[]): boolean {
  return tasks.some((t) => t.reviewed) && tasks.every((t) => t.reviewed || !isReviewableEssay(t.words));
}

// ---------------------------------------------------------------------------
// Mock exam results
// ---------------------------------------------------------------------------

export type MockReviewUpdate =
  | {
      section: "WRITING";
      testId: string;
      /** Current bands of the sitting's two tasks (IELTSTest.score, after the review). */
      task1Band: number;
      task2Band: number;
    }
  | {
      section: "SPEAKING";
      testId: string;
      band: number;
      criteria: { fluency: number; lexical: number; grammar: number; pronunciation: number | null };
    };

/**
 * A mock sitting's results with a teacher review applied, keeping the
 * MockResults shape: Writing gets both task bands and band = writingBand;
 * Speaking gets the band and the criteria (pronunciation only when the teacher
 * rated it). The section is marked `reviewed`. Returns null when the reviewed
 * test isn't one of that section's tests (nothing to change).
 */
export function applyReviewToMockResults(results: MockResults, u: MockReviewUpdate): MockResults | null {
  const prev = results[u.section];
  if (!prev || !Array.isArray(prev.testIds) || !prev.testIds.includes(u.testId)) return null;
  let next: MockSectionResult;
  if (u.section === "WRITING") {
    next = {
      ...prev,
      task1Band: u.task1Band,
      task2Band: u.task2Band,
      band: writingBand(u.task1Band, u.task2Band),
      reviewed: true,
    };
  } else {
    next = {
      ...prev,
      band: u.band,
      criteria: {
        fluency: u.criteria.fluency,
        lexical: u.criteria.lexical,
        grammar: u.criteria.grammar,
        pronunciation: u.criteria.pronunciation,
      },
      reviewed: true,
    };
  }
  return { ...results, [u.section]: next };
}

/** The sitting's overall band, computed exactly like the mock exam does (missing sections count as 0). */
export function mockOverallBand(results: MockResults, sections: readonly MockSection[]): number {
  return overallBand(sections.map((s) => results[s]?.band ?? 0));
}
