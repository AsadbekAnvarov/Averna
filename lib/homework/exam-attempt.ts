/**
 * Exam homework — which saved attempt may complete which homework, and whether
 * it counts. Pure (no database, no server imports), so recordExamHomework, the
 * submit routes, the result-page notice, the teacher's results page and the
 * offline checks all apply one rule:
 *
 *   content: the student's own attempt at exactly the homework's content — the
 *            same skill and paper + part (Reading / Listening), prompt + task
 *            (Writing task), both prompts of one sitting (full Writing test) or
 *            set (Speaking); not a mock section; saved after the homework was set;
 *   counts:  a real attempt — Reading / Listening: at least half of the
 *            questions in the homework's scope answered; Writing: real words
 *            that address the task, at least the minimum the attempt's own XP
 *            needs (Task 1 80, Task 2 120 — every task of a full test).
 *            Speaking's rule lives in its submit route. An attempt that doesn't
 *            count leaves the homework in To do.
 */

import { sittingBand, sittingFeedback, sittingReviewed } from "../review/scoring";
import { essayWordsOf } from "../review/answers";
import { XP_CONFIG } from "../engine/progression/config";
import type { ExamHomeworkKind } from "./library-shared";

/** A saved IELTSTest, as far as these rules need it. */
export interface StoredAttempt {
  id: string;
  studentId: string;
  module: string;
  answers: unknown;
  aiAnalysis?: unknown;
  completedAt: Date | string;
}

/** A saved attempt with its band (IELTSTest.score — the teacher's once reviewed) and its TestReview. */
export interface ScoredAttempt extends StoredAttempt {
  score: number;
  review?: { band: number; comment: string | null; reviewerId: string; updatedAt: Date | string } | null;
}

/** The homework content an attempt is. */
export interface AttemptContent {
  kind: ExamHomeworkKind;
  /** Paper / prompt / set id; a full Writing test: "<task1Id>|<task2Id>". */
  contentId: string;
  /** Reading passage / Listening part (0-based); null = the whole paper (and every other kind). */
  part: number | null;
}

/** The homework an attempt should complete. */
export interface HomeworkRef extends AttemptContent {
  homeworkId: string;
  /** Homework.createdAt. */
  setAt: Date | string;
}

/** An attempt saved up to this long before the homework's creation time still counts (clock skew). */
export const HOMEWORK_CLOCK_SKEW_MS = 2 * 60_000;

export type WritingTaskKey = "task1" | "task2";

/**
 * Writing homework: the words a task needs to count — the minimums the
 * attempt's own XP needs (progression config XP_CONFIG.writing), so homework
 * points are never paid for an essay that earns no XP itself.
 */
export const HOMEWORK_WRITING_MIN_WORDS: Readonly<Record<WritingTaskKey, number>> = {
  task1: XP_CONFIG.writing.task1.minWords,
  task2: XP_CONFIG.writing.task2.minWords,
};

export type WritingHomeworkKind = "WRITING_TASK1" | "WRITING_TASK2" | "WRITING_EXAM";

export function isWritingHomeworkKind(kind: unknown): kind is WritingHomeworkKind {
  return kind === "WRITING_TASK1" || kind === "WRITING_TASK2" || kind === "WRITING_EXAM";
}

/**
 * The Writing rule in words, for the homework pages and descriptions:
 * "at least 120 words" (one task) or "at least 80 words in Task 1 and 120 in Task 2" (the full test).
 */
export function writingHomeworkMinimum(kind: WritingHomeworkKind): string {
  const { task1, task2 } = HOMEWORK_WRITING_MIN_WORDS;
  if (kind === "WRITING_EXAM") return `at least ${task1} words in Task 1 and ${task2} in Task 2`;
  return `at least ${kind === "WRITING_TASK1" ? task1 : task2} words`;
}

/** The homework pages' sentence for the Writing rule, e.g. "Your first attempt with at least 120 words on the task counts." */
export function writingHomeworkRule(kind: WritingHomeworkKind): string {
  return `Your first attempt with ${writingHomeworkMinimum(kind)}${kind === "WRITING_EXAM" ? "" : " on the task"} counts.`;
}

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const answersOf = (row: { answers: unknown }): Record<string, unknown> => asRec(row.answers) ?? {};
const taskOf = (a: Record<string, unknown>): "task1" | "task2" | null =>
  a.taskType === "task1" || a.taskType === "task2" ? a.taskType : null;
const time = (d: Date | string): number => new Date(d).getTime();

/**
 * Task 1 and Task 2 of the full-Writing-test sitting `row` belongs to, found
 * among `row` and `rows` by the same student and answers.examAttemptId. null
 * when `row` isn't part of a sitting.
 */
export function sittingTasks<T extends StoredAttempt>(row: T, rows: readonly T[] = []): { task1: T | null; task2: T | null } | null {
  const key = str(answersOf(row).examAttemptId);
  if (row.module !== "WRITING" || !key) return null;
  const same = [row, ...rows.filter((r) => r.id !== row.id)].filter(
    (r) => r.studentId === row.studentId && r.module === "WRITING" && str(answersOf(r).examAttemptId) === key
  );
  const pick = (task: "task1" | "task2") => same.find((r) => taskOf(answersOf(r)) === task) ?? null;
  return { task1: pick("task1"), task2: pick("task2") };
}

/**
 * The homework content an attempt is, or null when exam homework can't point at
 * it (a mock section, a legacy attempt, a practice essay saved without its
 * prompt id, a sitting with a task missing). A full Writing test needs both of
 * its rows (`sitting`).
 */
export function attemptContentOf(row: StoredAttempt, sitting: readonly StoredAttempt[] = []): AttemptContent | null {
  const a = answersOf(row);
  if (a.mock === true) return null;
  if (row.module === "READING" || row.module === "LISTENING") {
    const examId = str(a.examId);
    if (a.format !== "exam-v2" || !examId) return null;
    const part = typeof a.part === "number" && Number.isInteger(a.part) && a.part >= 0 ? a.part : null;
    return { kind: row.module === "READING" ? "READING" : "LISTENING", contentId: examId, part };
  }
  if (row.module === "WRITING") {
    const task = taskOf(a);
    const promptId = str(a.promptId);
    if (!task || !promptId) return null;
    if (!str(a.examAttemptId)) return { kind: task === "task1" ? "WRITING_TASK1" : "WRITING_TASK2", contentId: promptId, part: null };
    const s = sittingTasks(row, sitting);
    const t1 = s?.task1;
    const t2 = s?.task2;
    if (!t1 || !t2 || answersOf(t1).mock === true || answersOf(t2).mock === true) return null;
    const p1 = str(answersOf(t1).promptId);
    const p2 = str(answersOf(t2).promptId);
    return p1 && p2 ? { kind: "WRITING_EXAM", contentId: `${p1}|${p2}`, part: null } : null;
  }
  if (row.module === "SPEAKING") {
    const setId = str(a.examId);
    if (a.format !== "exam-v2" || !setId || !Array.isArray(a.answers)) return null;
    return { kind: "SPEAKING", contentId: setId, part: null };
  }
  return null;
}

/**
 * Why `row` can't complete this homework for `studentId` — null when it can.
 * It must be the student's own attempt at exactly the homework's content (and
 * not one saved for another homework), saved after the homework was set. A
 * full Writing test is completed by its Task 2 row; `sitting` must hold the
 * sitting's Task 1 row, which is checked too.
 */
export function attemptMismatch(
  hw: HomeworkRef,
  studentId: string,
  row: StoredAttempt,
  sitting: readonly StoredAttempt[] = []
): string | null {
  if (!studentId || row.studentId !== studentId) return "another student's attempt";
  const c = attemptContentOf(row, sitting);
  if (!c) return "not an attempt exam homework can use";
  if (c.kind !== hw.kind) return `a ${c.kind} attempt for ${hw.kind} homework`;
  if (c.contentId !== hw.contentId) return "an attempt at other content";
  if (c.part !== (hw.part ?? null)) return "an attempt at another part";
  const stamped = str(answersOf(row).homeworkId);
  if (stamped && stamped !== hw.homeworkId) return "an attempt made for another homework";
  const rows: StoredAttempt[] = [row];
  if (hw.kind === "WRITING_EXAM") {
    const s = sittingTasks(row, sitting);
    if (!s?.task1 || s.task2?.id !== row.id) return "not the Task 2 row of its sitting";
    rows.push(s.task1);
  }
  const since = time(hw.setAt) - HOMEWORK_CLOCK_SKEW_MS;
  if (!Number.isFinite(since) || rows.some((r) => !(time(r.completedAt) >= since))) return "saved before the homework was set";
  return null;
}

// ---------------------------------------------------------------------------
// Does it count?
// ---------------------------------------------------------------------------

/** Whether an attempt counts for its homework; if not, one sentence telling the student why. */
export type HomeworkGate = { counts: true } | { counts: false; reason: string };

const COUNTS: HomeworkGate = { counts: true };

/** Reading / Listening: at least half of the questions in the homework's scope answered. */
export function objectiveGate(answered: number, total: number): HomeworkGate {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const a = Math.max(0, Math.floor(Number(answered) || 0));
  if (t > 0 && a * 2 >= t) return COUNTS;
  if (t === 0) return { counts: false, reason: "Answer the questions for it to count." };
  return {
    counts: false,
    reason: `Answer at least half of the questions (${Math.ceil(t / 2)} of ${t}) for it to count — you answered ${Math.min(a, t)}.`,
  };
}

/** One Writing answer as the gate sees it (exam-homework's writingVerdict computes it on the server). */
export interface WritingVerdict {
  /** The task it answers — its minimum is HOMEWORK_WRITING_MIN_WORDS[task]. */
  task: WritingTaskKey;
  words: number;
  /** isGenuineWriting(essay, HOMEWORK_WRITING_MIN_WORDS[task]): long enough and not repeated words / filler. */
  genuine: boolean;
  /** isOnTopic(essay, the task's wording); null when the wording isn't known. */
  onTopic: boolean | null;
}

/** One Writing task: at least its minimum (80 / 120) of real words that address the task. */
export function writingTaskGate(v: WritingVerdict): HomeworkGate {
  const min = HOMEWORK_WRITING_MIN_WORDS[v.task];
  if (v.words < min) {
    return { counts: false, reason: `Write at least ${min} words for it to count — your answer has ${v.words}.` };
  }
  if (!v.genuine) return { counts: false, reason: "Write a real answer to the task for it to count — repeated words or filler don't." };
  if (v.onTopic === false) {
    return { counts: false, reason: "Answer the task you were set for it to count — this answer doesn't address its topic." };
  }
  return COUNTS;
}

/** A full Writing test: each task by the single-task rule (Task 1 80 words, Task 2 120). */
export function writingExamGate(task1: WritingVerdict, task2: WritingVerdict): HomeworkGate {
  const tasks = [
    { label: "Task 1", v: { ...task1, task: "task1" as const } },
    { label: "Task 2", v: { ...task2, task: "task2" as const } },
  ];
  const names = (list: typeof tasks) => list.map((t) => t.label).join(" and ");
  const short = tasks.filter((t) => t.v.words < HOMEWORK_WRITING_MIN_WORDS[t.v.task]);
  if (short.length) {
    return {
      counts: false,
      reason: `Write ${writingHomeworkMinimum("WRITING_EXAM")} for it to count — ${short.map((t) => `${t.label} has ${t.v.words}`).join(" and ")}.`,
    };
  }
  const filler = tasks.filter((t) => !t.v.genuine);
  if (filler.length) {
    return {
      counts: false,
      reason: `Write a real answer to each task for it to count — ${names(filler)} ${filler.length > 1 ? "are" : "is"} repeated words or filler.`,
    };
  }
  const off = tasks.filter((t) => t.v.onTopic === false);
  if (off.length) {
    return {
      counts: false,
      reason: `Answer the tasks you were set for it to count — ${names(off)} ${off.length > 1 ? "don't address their topics" : "doesn't address its topic"}.`,
    };
  }
  return COUNTS;
}

/** Speaking homework: the words (transcribed or typed) a test needs across its answers to count. */
export const SPEAKING_HOMEWORK_MIN_WORDS = 60;

/** Speaking: enough words across the test (the server's transcripts, or what was typed). */
export function speakingGate(words: number): HomeworkGate {
  const w = Math.max(0, Math.floor(Number(words) || 0));
  if (w >= SPEAKING_HOMEWORK_MIN_WORDS) return COUNTS;
  return {
    counts: false,
    reason: `Answer every part of the test — at least ${SPEAKING_HOMEWORK_MIN_WORDS} words across your answers — for it to count. This attempt has ${w}.`,
  };
}

/** The notice for a real attempt at the content that wasn't started from the homework (no ?hw). */
export const OUTSIDE_HOMEWORK_REASON = "Only attempts started from the homework page count — open the homework and start it from there.";
/** The notice's default for a Speaking attempt with enough words (not started from the homework page). */
export const SPEAKING_NOTICE_REASON = "Start it from the homework page and answer every part of the test for it to count.";

/**
 * The result-page notice's sentence for an attempt that left its homework open:
 * the caller's own (`override` — e.g. the Speaking page, whose rule lives in its
 * route), else the rule it failed (`gate`), else why a real attempt didn't count.
 */
export function noticeReason(kind: ExamHomeworkKind, gate: HomeworkGate | null, override?: string | null): string {
  const own = typeof override === "string" ? override.trim() : "";
  if (own) return own;
  if (gate && !gate.counts) return gate.reason;
  return kind === "SPEAKING" ? SPEAKING_NOTICE_REASON : OUTSIDE_HOMEWORK_REASON;
}

/**
 * Whether a saved attempt counts for homework of `kind`, judged from what was
 * stored (never from the request): Reading / Listening from the stored answered
 * and question counts, Writing from the stored essays and task wording
 * (`verdict`: exam-homework's writingVerdict), Speaking from the stored
 * transcripts (speakingGate). null for a full Writing test without both rows.
 */
export function attemptGate(
  kind: ExamHomeworkKind,
  row: StoredAttempt,
  sitting: readonly StoredAttempt[],
  verdict: (essay: string, prompt: string, task: WritingTaskKey) => WritingVerdict
): HomeworkGate | null {
  const essay = (r: StoredAttempt, task: WritingTaskKey) => verdict(str(answersOf(r).essay), str(answersOf(r).prompt), task);
  switch (kind) {
    case "READING":
    case "LISTENING": {
      const ai = asRec(row.aiAnalysis) ?? {};
      return objectiveGate(num(ai.answeredCount) ?? 0, num(ai.totalQuestions) ?? 0);
    }
    case "WRITING_TASK1":
    case "WRITING_TASK2":
      return writingTaskGate(essay(row, kind === "WRITING_TASK1" ? "task1" : "task2"));
    case "WRITING_EXAM": {
      const s = sittingTasks(row, sitting);
      return s?.task1 && s.task2 ? writingExamGate(essay(s.task1, "task1"), essay(s.task2, "task2")) : null;
    }
    case "SPEAKING": {
      // The words the attempt was marked on (aiAnalysis.wordCount — what the submit route checks), else its transcripts.
      const stored = num(asRec(row.aiAnalysis)?.wordCount);
      const list = answersOf(row).answers;
      const counted = (Array.isArray(list) ? list : []).reduce(
        (n: number, a: unknown) => n + str(asRec(a)?.transcript).trim().split(/\s+/).filter(Boolean).length,
        0
      );
      return speakingGate(stored ?? counted);
    }
  }
}

// ---------------------------------------------------------------------------
// Reviewed before the homework row existed
// ---------------------------------------------------------------------------

export interface ReviewedHomework {
  band: number;
  feedback: string | null;
  /** Fully reviewed: the submission is GRADED. */
  graded: boolean;
  /** The latest review: its reviewer (a User id) and when it was saved. */
  reviewerId: string;
  reviewedAt: Date;
}

/**
 * The homework fields for an attempt a teacher reviewed before its homework
 * row existed (the review lands between the test save and recordExamHomework),
 * by the same rule as the review save (lib/review/save): one attempt — the
 * teacher's band and comment, GRADED; a full Writing test — the band of both
 * tasks' current bands and both comments, GRADED once every task worth
 * reviewing has a review (sittingReviewed). null: nothing reviewed yet.
 */
export function reviewedHomework(kind: ExamHomeworkKind, row: ScoredAttempt, sitting: readonly ScoredAttempt[] = []): ReviewedHomework | null {
  if (kind === "READING" || kind === "LISTENING") return null;
  if (kind !== "WRITING_EXAM") {
    const r = row.review;
    return r ? { band: r.band, feedback: r.comment ?? null, graded: true, reviewerId: r.reviewerId, reviewedAt: new Date(r.updatedAt) } : null;
  }
  const s = sittingTasks(row, sitting);
  const t1 = s?.task1;
  const t2 = s?.task2;
  if (!t1 || !t2) return null;
  const reviews = [t1.review, t2.review].filter((r): r is NonNullable<ScoredAttempt["review"]> => !!r);
  if (!reviews.length) return null;
  const latest = reviews.reduce((a, b) => (time(b.updatedAt) > time(a.updatedAt) ? b : a));
  const task = (t: ScoredAttempt) => ({ words: essayWordsOf(answersOf(t), t.aiAnalysis), reviewed: !!t.review });
  return {
    band: sittingBand(t1.score, t2.score),
    feedback: sittingFeedback(t1.review?.comment, t2.review?.comment),
    graded: sittingReviewed([task(t1), task(t2)]),
    reviewerId: latest.reviewerId,
    reviewedAt: new Date(latest.updatedAt),
  };
}
