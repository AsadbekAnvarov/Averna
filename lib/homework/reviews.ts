/**
 * Which Writing / Speaking homework attempts the teacher has reviewed.
 *
 * The homework's band always comes from HomeworkSubmission.band (the review
 * flow keeps it current — for a full Writing test it stores the combined
 * Writing band), so this only answers "reviewed or not". A full Writing test
 * links its Task 2 row and counts as reviewed once BOTH tasks are; its Task 1
 * row is found through answers.examAttemptId, exactly as the review screen does.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { AUTO_GRADED, isExamHomeworkKind } from "./exam-homework";

interface LinkedAttempt {
  /** Homework.contentKind. */
  kind: string | null;
  /** HomeworkSubmission.testId. */
  testId: string | null;
}

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/** Test ids (HomeworkSubmission.testId) that count as reviewed. Never throws. */
export async function reviewedTestIds(attempts: LinkedAttempt[]): Promise<Set<string>> {
  const out = new Set<string>();
  const single: string[] = [];
  const sittings: string[] = [];
  for (const a of attempts) {
    if (!a.testId || !isExamHomeworkKind(a.kind) || AUTO_GRADED[a.kind]) continue;
    (a.kind === "WRITING_EXAM" ? sittings : single).push(a.testId);
  }
  const ids = Array.from(new Set([...single, ...sittings]));
  if (!ids.length) return out;
  try {
    const reviews: { testId: string }[] = await db.testReview.findMany({ where: { testId: { in: ids } }, select: { testId: true } });
    const reviewed = new Set(reviews.map((r) => r.testId));
    for (const id of single) if (reviewed.has(id)) out.add(id);

    // Full Writing test: Task 2 is reviewed — is its Task 1 too?
    const task2 = sittings.filter((id) => reviewed.has(id));
    if (!task2.length) return out;
    const rows: { id: string; studentId: string; answers: unknown }[] = await db.iELTSTest.findMany({
      where: { id: { in: task2 } },
      select: { id: true, studentId: true, answers: true },
    });
    const pairs = rows.map((r) => ({ id: r.id, studentId: r.studentId, attempt: asRec(r.answers)?.examAttemptId }));
    const keyed = pairs.filter((p): p is { id: string; studentId: string; attempt: string } => typeof p.attempt === "string" && !!p.attempt);
    // A sitting without an attempt id has no findable Task 1: its Task 2 review is the whole review.
    for (const p of pairs) if (typeof p.attempt !== "string" || !p.attempt) out.add(p.id);
    if (!keyed.length) return out;
    const siblings: { studentId: string; answers: unknown; review: { id: string } | null }[] = await db.iELTSTest.findMany({
      where: {
        module: "WRITING",
        id: { notIn: task2 },
        OR: keyed.map((p) => ({ studentId: p.studentId, answers: { path: ["examAttemptId"], equals: p.attempt } })),
      },
      select: { studentId: true, answers: true, review: { select: { id: true } } },
    });
    const task1 = new Map<string, boolean>();
    for (const s of siblings) {
      const attempt = asRec(s.answers)?.examAttemptId;
      if (typeof attempt === "string") task1.set(`${s.studentId}|${attempt}`, !!s.review);
    }
    for (const p of keyed) {
      const t1 = task1.get(`${p.studentId}|${p.attempt}`);
      // No Task 1 row (nothing to review there) or Task 1 reviewed too.
      if (t1 === undefined || t1) out.add(p.id);
    }
  } catch (e) {
    console.error("reviewedTestIds failed:", e);
  }
  return out;
}
