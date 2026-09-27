/**
 * Saving a teacher's review of a Writing / Speaking attempt — an idempotent
 * upsert (saving the same review twice changes nothing and notifies once).
 *
 * In one transaction:
 *   1. TestReview upsert — aiBand is the AI's band from before the FIRST review
 *      and is never overwritten;
 *   2. IELTSTest.score = the reviewed band (XP is NOT recalculated);
 *   3. homework: the HomeworkSubmission completed by this attempt gets the band,
 *      status GRADED, the comment as feedback, gradedBy (the reviewer's Teacher
 *      id, if any) and gradedAt. For a full Writing test the submission points
 *      at Task 2: its band is writingBand() of both tasks' current bands and
 *      its feedback carries both tasks' comments — reviewing either task keeps
 *      it up to date (it becomes GRADED once Task 2 is reviewed);
 *   4. mock: the sitting's results (Writing task bands + writingBand, Speaking
 *      band + criteria) and, for a finished sitting, `overall` — guarded by the
 *      row's updatedAt so a concurrent change is never overwritten.
 * Then the student is notified (only when something changed).
 *
 * SERVER ONLY.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canReviewStudent, teacherOf, type Viewer } from "@/lib/access";
import { notifyUser } from "@/lib/notifications";
import { MOCK_SECTIONS, resultsOf } from "@/lib/ielts/mock";
import {
  aiBandOf,
  applyReviewToMockResults,
  attemptLabel,
  isReviewSkill,
  mockOverallBand,
  parseReviewInput,
  readCriteria,
  reviewNotification,
  sameReview,
  sittingBand,
  sittingFeedback,
  studentResultHref,
  type MockReviewUpdate,
  type ReviewCriteria,
  type ReviewInput,
  type ReviewSkill,
  type WritingTask,
} from "./scoring";
import { parseQueueFilters } from "./filters";
import { answersOf, asRec, examAttemptIdOf, isFullSpeakingTest, mockAttemptIdOf, taskTypeOf } from "./answers";
import { nextPendingReview } from "./queue";

const json = (x: unknown) => x as Prisma.InputJsonValue;
const TEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface SavedReview {
  testId: string;
  band: number;
  aiBand: number | null;
  criteria: ReviewCriteria;
  comment: string | null;
  updatedAt: string;
}

export type SaveReviewResult =
  | {
      ok: true;
      /** First review of this attempt. */
      created: boolean;
      /** Band, criteria or comment differ from what was saved before. */
      changed: boolean;
      review: SavedReview;
      /** The next pending attempt in the teacher's queue (same filters), or null. */
      next: string | null;
    }
  | { ok: false; status: number; error: string };

type Tx = Prisma.TransactionClient;

interface SittingTask {
  id: string;
  score: number;
  comment: string | null;
  reviewed: boolean;
}
interface Sitting {
  task1: SittingTask;
  task2: SittingTask;
}

/** Both tasks of a full Writing test, read inside the transaction (so they include this review). */
async function loadSitting(tx: Tx, studentId: string, examAttemptId: string): Promise<Sitting | null> {
  const rows: { id: string; score: number; answers: unknown; review: { comment: string | null } | null }[] =
    await tx.iELTSTest.findMany({
      where: { studentId, module: "WRITING", answers: { path: ["examAttemptId"], equals: examAttemptId } },
      select: { id: true, score: true, answers: true, review: { select: { comment: true } } },
      take: 4,
    });
  const find = (task: WritingTask): SittingTask | undefined => {
    const r = rows.find((x) => taskTypeOf(answersOf(x.answers)) === task);
    return r ? { id: r.id, score: r.score, comment: r.review?.comment ?? null, reviewed: !!r.review } : undefined;
  };
  const task1 = find("task1");
  const task2 = find("task2");
  return task1 && task2 ? { task1, task2 } : null;
}

async function updateHomework(
  tx: Tx,
  o: { testId: string; band: number; comment: string | null; sitting: Sitting | null; gradedBy: string | null; now: Date }
): Promise<void> {
  const ids = Array.from(new Set([o.testId, ...(o.sitting ? [o.sitting.task2.id] : [])]));
  const subs: { id: string; testId: string | null }[] = await tx.homeworkSubmission.findMany({
    where: { testId: { in: ids } },
    select: { id: true, testId: true },
  });
  for (const s of subs) {
    const sitting = o.sitting && s.testId === o.sitting.task2.id ? o.sitting : null;
    const graded = s.testId === o.testId || (!!sitting && sitting.task2.reviewed);
    await tx.homeworkSubmission.update({
      where: { id: s.id },
      data: {
        band: sitting ? sittingBand(sitting.task1.score, sitting.task2.score) : o.band,
        feedback: sitting ? sittingFeedback(sitting.task1.comment, sitting.task2.comment) : o.comment,
        ...(graded ? { status: "GRADED", gradedBy: o.gradedBy, gradedAt: o.now } : {}),
      },
    });
  }
}

async function updateMock(
  tx: Tx,
  o: { mockAttemptId: string; studentId: string; testId: string; skill: ReviewSkill; input: ReviewInput }
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row: { id: string; status: string; results: unknown; updatedAt: Date } | null = await tx.mockAttempt.findFirst({
      where: { id: o.mockAttemptId, studentId: o.studentId },
      select: { id: true, status: true, results: true, updatedAt: true },
    });
    if (!row) return;
    const results = resultsOf(row.results);
    let update: MockReviewUpdate;
    if (o.skill === "SPEAKING") {
      const c = o.input.criteria;
      update = {
        section: "SPEAKING",
        testId: o.testId,
        band: o.input.band,
        criteria: { fluency: c.fluency ?? 0, lexical: c.lexical ?? 0, grammar: c.grammar ?? 0, pronunciation: c.pronunciation ?? null },
      };
    } else {
      const ids = results.WRITING?.testIds ?? [];
      if (ids.length < 2) return;
      const scores: { id: string; score: number }[] = await tx.iELTSTest.findMany({
        where: { id: { in: [ids[0], ids[1]] } },
        select: { id: true, score: true },
      });
      const t1 = scores.find((s) => s.id === ids[0])?.score;
      const t2 = scores.find((s) => s.id === ids[1])?.score;
      if (typeof t1 !== "number" || typeof t2 !== "number") return;
      update = { section: "WRITING", testId: o.testId, task1Band: t1, task2Band: t2 };
    }
    const next = applyReviewToMockResults(results, update);
    if (!next) return;
    const r: { count: number } = await tx.mockAttempt.updateMany({
      where: { id: row.id, updatedAt: row.updatedAt },
      data: {
        results: json(next),
        ...(row.status === "finished" ? { overall: mockOverallBand(next, MOCK_SECTIONS) } : {}),
      },
    });
    if (r.count > 0) return;
  }
  console.warn(`Teacher review: mock attempt ${o.mockAttemptId} kept changing; its results were not updated.`);
}

/**
 * Validate and save a review. `body`: { band, criteria, comment, queue? } —
 * `queue` carries the teacher's queue filters so `next` follows them.
 */
export async function saveTestReview(viewer: Viewer, testId: string, body: unknown): Promise<SaveReviewResult> {
  if (typeof testId !== "string" || !TEST_ID_RE.test(testId)) {
    return { ok: false, status: 404, error: "This attempt couldn't be found." };
  }
  const test: {
    id: string;
    studentId: string;
    module: string;
    score: number;
    answers: unknown;
    aiAnalysis: unknown;
    student: { userId: string } | null;
  } | null = await db.iELTSTest.findUnique({
    where: { id: testId },
    select: { id: true, studentId: true, module: true, score: true, answers: true, aiAnalysis: true, student: { select: { userId: true } } },
  });
  if (!test) return { ok: false, status: 404, error: "This attempt couldn't be found." };
  if (!isReviewSkill(test.module)) {
    return { ok: false, status: 400, error: "Only Writing and Speaking attempts are reviewed by teachers." };
  }
  if (!(await canReviewStudent(viewer, test.studentId))) {
    return { ok: false, status: 403, error: "You can only review the work of students in your own groups." };
  }

  const skill: ReviewSkill = test.module;
  const answers = answersOf(test.answers);
  const taskType = skill === "WRITING" ? taskTypeOf(answers) : null;
  const parsed = parseReviewInput(skill, body, taskType);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const input = parsed.value;

  const teacher = await teacherOf(viewer.id);
  const examAttemptId = skill === "WRITING" ? examAttemptIdOf(answers) : null;
  const mockAttemptId = mockAttemptIdOf(answers);
  const now = new Date();

  const saved: {
    review: { band: number; aiBand: number | null; criteria: unknown; comment: string | null; updatedAt: Date };
    created: boolean;
    changed: boolean;
    siblingId: string | null;
  } = await db.$transaction(
    async (tx: Tx) => {
      const existing: { band: number; aiBand: number | null; criteria: unknown; comment: string | null } | null =
        await tx.testReview.findUnique({ where: { testId }, select: { band: true, aiBand: true, criteria: true, comment: true } });
      // The AI's band before the first review; test.score is the AI band until then.
      const aiBand = existing ? existing.aiBand : aiBandOf(skill, test.aiAnalysis) ?? test.score;
      const review = await tx.testReview.upsert({
        where: { testId },
        create: {
          testId,
          studentId: test.studentId,
          reviewerId: viewer.id,
          aiBand,
          band: input.band,
          criteria: json(input.criteria),
          comment: input.comment,
        },
        update: { reviewerId: viewer.id, band: input.band, criteria: json(input.criteria), comment: input.comment },
        select: { band: true, aiBand: true, criteria: true, comment: true, updatedAt: true },
      });
      await tx.iELTSTest.update({ where: { id: testId }, data: { score: input.band } });

      const sitting = examAttemptId ? await loadSitting(tx, test.studentId, examAttemptId) : null;
      await updateHomework(tx, { testId, band: input.band, comment: input.comment, sitting, gradedBy: teacher?.id ?? null, now });
      if (mockAttemptId) await updateMock(tx, { mockAttemptId, studentId: test.studentId, testId, skill, input });

      const siblingId = sitting ? (sitting.task1.id === testId ? sitting.task2.id : sitting.task1.id) : null;
      return { review, created: !existing, changed: !existing || !sameReview(skill, existing, input), siblingId };
    },
    { maxWait: 5000, timeout: 15000 }
  );

  if (saved.changed && test.student?.userId) {
    const label = attemptLabel(skill, taskType, isFullSpeakingTest(answers));
    const { title, message } = reviewNotification(label, input.band, !saved.created);
    await notifyUser(test.student.userId, { type: "grade", title, message, link: studentResultHref(skill, testId) });
  }

  const queue = parseQueueFilters(asRec(asRec(body)?.queue) ?? {});
  const next = await nextPendingReview(viewer, testId, queue, saved.siblingId);

  return {
    ok: true,
    created: saved.created,
    changed: saved.changed,
    review: {
      testId,
      band: saved.review.band,
      aiBand: saved.review.aiBand,
      criteria: readCriteria(skill, saved.review.criteria),
      comment: saved.review.comment,
      updatedAt: saved.review.updatedAt.toISOString(),
    },
    next,
  };
}
