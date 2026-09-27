/**
 * Exam homework — homework that points at content from the test library (a
 * Reading paper or passage, a Listening test or part, a Writing task or the
 * full Writing test, a Speaking set) instead of free text.
 *
 * The student does it in the normal CD-IELTS runner (the practice URL carries
 * ?hw=<homeworkId>); when that attempt is saved, the submit route calls
 * recordExamHomework(), which creates the HomeworkSubmission, links the
 * IELTSTest and pays the teacher's homework points — once, for the first
 * attempt. Reading / Listening are graded automatically; Writing / Speaking
 * count as submitted and wait for the teacher's review.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { awardXp } from "@/lib/engine/xp-engine";
import { computeHomeworkXp } from "@/lib/engine/progression/xp";
import { settleProgression } from "@/lib/engine/progression/service";

export const EXAM_HOMEWORK_KINDS = [
  "READING",
  "LISTENING",
  "WRITING_TASK1",
  "WRITING_TASK2",
  "WRITING_EXAM",
  "SPEAKING",
] as const;
export type ExamHomeworkKind = (typeof EXAM_HOMEWORK_KINDS)[number];

/** Homework.module (IELTSModule) for each kind. */
export const MODULE_FOR_KIND: Record<ExamHomeworkKind, "READING" | "LISTENING" | "WRITING" | "SPEAKING"> = {
  READING: "READING",
  LISTENING: "LISTENING",
  WRITING_TASK1: "WRITING",
  WRITING_TASK2: "WRITING",
  WRITING_EXAM: "WRITING",
  SPEAKING: "SPEAKING",
};

/** Reading / Listening are marked by the key; Writing / Speaking wait for the teacher. */
export const AUTO_GRADED: Record<ExamHomeworkKind, boolean> = {
  READING: true,
  LISTENING: true,
  WRITING_TASK1: false,
  WRITING_TASK2: false,
  WRITING_EXAM: false,
  SPEAKING: false,
};

export function isExamHomeworkKind(x: unknown): x is ExamHomeworkKind {
  return typeof x === "string" && (EXAM_HOMEWORK_KINDS as readonly string[]).includes(x);
}

/** WRITING_EXAM stores both prompt ids in contentId as "<task1Id>|<task2Id>". */
export function writingExamContentId(task1Id: string, task2Id: string): string {
  return `${task1Id}|${task2Id}`;
}

export function splitWritingExamContentId(contentId: string): { task1: string; task2: string } | null {
  const [task1, task2] = contentId.split("|");
  return task1 && task2 ? { task1, task2 } : null;
}

export interface ExamHomeworkRef {
  id: string;
  contentKind: string | null;
  contentId: string | null;
  contentPart: number | null;
}

/**
 * The practice URL that opens this homework's content, or null for classic
 * homework. The practice page adds a fresh attempt id and keeps ?hw.
 */
export function examHomeworkHref(h: ExamHomeworkRef): string | null {
  if (!isExamHomeworkKind(h.contentKind) || !h.contentId) return null;
  const hw = `hw=${encodeURIComponent(h.id)}`;
  const id = encodeURIComponent(h.contentId);
  const part = h.contentPart != null ? `part=${h.contentPart}&` : "";
  switch (h.contentKind) {
    case "READING":
      return `/learning/reading/${id}?${part}${hw}`;
    case "LISTENING":
      return `/learning/listening/${id}?${part}${hw}`;
    case "WRITING_TASK1":
      return `/learning/writing/task1?p=${id}&${hw}`;
    case "WRITING_TASK2":
      return `/learning/writing/task2?p=${id}&${hw}`;
    case "WRITING_EXAM": {
      const pair = splitWritingExamContentId(h.contentId);
      return pair
        ? `/learning/writing/exam?t1=${encodeURIComponent(pair.task1)}&t2=${encodeURIComponent(pair.task2)}&${hw}`
        : null;
    }
    case "SPEAKING":
      return `/learning/speaking-test/${id}?${hw}`;
  }
}

export interface ExamHomeworkTarget {
  homeworkId: string;
  kind: ExamHomeworkKind;
  contentId: string;
  part: number | null;
  title: string;
  dueDate: Date;
  points: number;
  groupId: string;
  teacherId: string;
}

const HOMEWORK_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * The exam homework this student may complete with the given content, or null
 * (unknown id, not the student's group, not an exam homework, or different
 * content). `expect` is what the student is actually doing, so a homework id
 * can never be attached to another paper.
 */
export async function examHomeworkFor(
  studentId: string,
  homeworkId: unknown,
  expect: { kind: ExamHomeworkKind | ExamHomeworkKind[]; contentId: string; part?: number | null }
): Promise<ExamHomeworkTarget | null> {
  if (typeof homeworkId !== "string" || !HOMEWORK_ID_RE.test(homeworkId)) return null;
  try {
    const [hw, student] = await Promise.all([
      db.homework.findUnique({
        where: { id: homeworkId },
        select: {
          id: true,
          title: true,
          dueDate: true,
          points: true,
          groupId: true,
          teacherId: true,
          contentKind: true,
          contentId: true,
          contentPart: true,
          contentTitle: true,
        },
      }),
      db.student.findUnique({ where: { id: studentId }, select: { groupId: true } }),
    ]);
    if (!hw || !student || !student.groupId || hw.groupId !== student.groupId) return null;
    if (!isExamHomeworkKind(hw.contentKind) || !hw.contentId) return null;
    const kinds = Array.isArray(expect.kind) ? expect.kind : [expect.kind];
    if (!kinds.includes(hw.contentKind)) return null;
    if (hw.contentId !== expect.contentId) return null;
    if (expect.part !== undefined && (hw.contentPart ?? null) !== (expect.part ?? null)) return null;
    return {
      homeworkId: hw.id,
      kind: hw.contentKind,
      contentId: hw.contentId,
      part: hw.contentPart ?? null,
      title: hw.contentTitle || hw.title,
      dueDate: hw.dueDate,
      points: hw.points,
      groupId: hw.groupId,
      teacherId: hw.teacherId,
    };
  } catch {
    return null;
  }
}

/**
 * Record a saved attempt as the homework submission. The first attempt wins
 * (a retry or a second attempt leaves the submission alone). Never throws.
 */
export async function recordExamHomework(o: {
  studentId: string;
  target: ExamHomeworkTarget;
  /** The IELTSTest that completed the homework (Writing exam: the Task 2 row). */
  testId: string;
  band: number;
  /** One line for the teacher, e.g. "Passage 2 · 9/13 correct · band 6.5". */
  summary: string;
  /** Something was actually answered / written (no points for an empty attempt). */
  genuine: boolean;
}): Promise<{ created: boolean; pointsAwarded: number }> {
  const { studentId, target } = o;
  try {
    const existing = await db.homeworkSubmission.findUnique({
      where: { studentId_homeworkId: { studentId, homeworkId: target.homeworkId } },
      select: { id: true },
    });
    if (existing) return { created: false, pointsAwarded: 0 };

    const position = (await db.homeworkSubmission.count({ where: { homeworkId: target.homeworkId } })) + 1;
    const pointsAwarded = computeHomeworkXp(target.points, position, o.genuine);
    const band = Math.max(0, Math.min(9, Number(o.band) || 0));
    let submission: { id: string };
    try {
      submission = await db.homeworkSubmission.create({
        data: {
          studentId,
          homeworkId: target.homeworkId,
          content: o.summary.slice(0, 500),
          position,
          pointsAwarded,
          status: AUTO_GRADED[target.kind] ? "GRADED" : "SUBMITTED",
          gradedAt: AUTO_GRADED[target.kind] ? new Date() : null,
          testId: o.testId,
          band,
        },
        select: { id: true },
      });
    } catch {
      // (studentId, homeworkId) is unique: a concurrent request got there first.
      return { created: false, pointsAwarded: 0 };
    }

    await db.activityLog
      .create({
        data: {
          studentId,
          action: "HOMEWORK_SUBMITTED",
          details: { homeworkId: target.homeworkId, position, points: pointsAwarded, testId: o.testId, band },
          points: pointsAwarded,
        },
      })
      .catch(() => null);

    if (pointsAwarded > 0) {
      await awardXp({
        studentId,
        amount: pointsAwarded,
        source: "homework",
        skipLog: true,
        idempotencyKey: `homework:${submission.id}`,
        activity: MODULE_FOR_KIND[target.kind],
        refId: submission.id,
        breakdown: {
          lines: [
            { label: "Homework", amount: target.points },
            ...(pointsAwarded > target.points ? [{ label: `Submitted #${position}`, amount: pointsAwarded - target.points }] : []),
          ],
        },
      }).catch((e: unknown) => console.error("Exam homework XP failed:", e));
      await settleProgression(studentId).catch(() => null);
    }
    return { created: true, pointsAwarded };
  } catch (e) {
    console.error("recordExamHomework failed:", e);
    return { created: false, pointsAwarded: 0 };
  }
}
