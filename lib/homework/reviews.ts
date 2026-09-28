/**
 * Which Writing / Speaking homework attempts the teacher has reviewed.
 *
 * The homework's band always comes from HomeworkSubmission.band (the review
 * flow keeps it current — for a full Writing test it stores the combined
 * Writing band), so this only answers "reviewed or not". A full Writing test
 * links its Task 2 row; its Task 1 row is found through answers.examAttemptId,
 * exactly as the review screen does, and the sitting counts as reviewed by the
 * rule the review save uses for GRADED (lib/review/scoring sittingReviewed):
 * every task worth reviewing (MIN_REVIEW_ESSAY_WORDS+ words — the queue's
 * rule) has a review.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { sittingReviewed } from "@/lib/review/scoring";
import { answersOf, essayWordsOf, examAttemptIdOf, taskTypeOf } from "@/lib/review/answers";
import { AUTO_GRADED, isExamHomeworkKind } from "./exam-homework";

interface LinkedAttempt {
  /** Homework.contentKind. */
  kind: string | null;
  /** HomeworkSubmission.testId. */
  testId: string | null;
}

type SittingRow = { id: string; studentId: string; answers: unknown; aiAnalysis: unknown; review: { id: string } | null };

const taskState = (r: Pick<SittingRow, "answers" | "aiAnalysis" | "review">) => ({
  words: essayWordsOf(answersOf(r.answers), r.aiAnalysis),
  reviewed: !!r.review,
});

/** Test ids (HomeworkSubmission.testId) that count as reviewed. Never throws. */
export async function reviewedTestIds(attempts: LinkedAttempt[]): Promise<Set<string>> {
  const out = new Set<string>();
  const single = new Set<string>();
  const sittings = new Set<string>();
  for (const a of attempts) {
    if (!a.testId || !isExamHomeworkKind(a.kind) || AUTO_GRADED[a.kind]) continue;
    (a.kind === "WRITING_EXAM" ? sittings : single).add(a.testId);
  }
  if (!single.size && !sittings.size) return out;
  try {
    if (single.size) {
      const reviews: { testId: string }[] = await db.testReview.findMany({
        where: { testId: { in: Array.from(single) } },
        select: { testId: true },
      });
      for (const r of reviews) out.add(r.testId);
    }
    if (!sittings.size) return out;

    // Full Writing test (the linked row is Task 2).
    const task2Ids = Array.from(sittings);
    const rows: SittingRow[] = await db.iELTSTest.findMany({
      where: { id: { in: task2Ids } },
      select: { id: true, studentId: true, answers: true, aiAnalysis: true, review: { select: { id: true } } },
    });
    const keyed: { row: SittingRow; key: string }[] = [];
    for (const r of rows) {
      const key = examAttemptIdOf(answersOf(r.answers));
      if (key) keyed.push({ row: r, key });
      // A sitting without an attempt id has no findable Task 1: its Task 2 is the whole sitting.
      else if (sittingReviewed([taskState(r)])) out.add(r.id);
    }
    if (!keyed.length) return out;
    const siblings: SittingRow[] = await db.iELTSTest.findMany({
      where: {
        module: "WRITING",
        id: { notIn: task2Ids },
        OR: keyed.map((k) => ({ studentId: k.row.studentId, answers: { path: ["examAttemptId"], equals: k.key } })),
      },
      select: { id: true, studentId: true, answers: true, aiAnalysis: true, review: { select: { id: true } } },
    });
    const task1 = new Map<string, ReturnType<typeof taskState>>();
    for (const s of siblings) {
      const a = answersOf(s.answers);
      const key = examAttemptIdOf(a);
      if (key && taskTypeOf(a) === "task1") task1.set(`${s.studentId}|${key}`, taskState(s));
    }
    for (const k of keyed) {
      const t1 = task1.get(`${k.row.studentId}|${k.key}`);
      // No Task 1 row: nothing to wait for there.
      if (sittingReviewed(t1 ? [t1, taskState(k.row)] : [taskState(k.row)])) out.add(k.row.id);
    }
  } catch (e) {
    console.error("reviewedTestIds failed:", e);
  }
  return out;
}
