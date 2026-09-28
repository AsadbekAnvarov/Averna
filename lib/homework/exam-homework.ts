/**
 * Exam homework — homework that points at content from the test library (a
 * Reading paper or passage, a Listening test or part, a Writing task or the
 * full Writing test, a Speaking set) instead of free text.
 *
 * The student does it in the normal CD-IELTS runner (the practice URL carries
 * ?hw=<homeworkId>); when that attempt is saved, the submit route calls
 * recordExamHomework(), which checks the saved attempt really is this
 * homework's content and a real attempt (./exam-attempt), then creates the
 * HomeworkSubmission, links the IELTSTest and pays the teacher's homework
 * points — once, for the first attempt that counts. Reading / Listening are
 * graded automatically; Writing / Speaking count as submitted and wait for the
 * teacher's review. An attempt that doesn't count leaves the homework in To do,
 * and its result page says why (homeworkNoticeFor).
 *
 * SERVER ONLY.
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { teacherOf } from "@/lib/access";
import { checkAndAwardAchievements } from "@/lib/db-helpers";
import { isGenuineWriting, isOnTopic } from "@/lib/utils";
import { awardXp } from "@/lib/engine/xp-engine";
import { computeHomeworkXp } from "@/lib/engine/progression/xp";
import { settleProgression } from "@/lib/engine/progression/service";
import {
  HOMEWORK_CLOCK_SKEW_MS,
  HOMEWORK_WRITING_MIN_WORDS,
  attemptContentOf,
  attemptGate,
  attemptMismatch,
  noticeReason,
  reviewedHomework,
  type ScoredAttempt,
  type StoredAttempt,
  type WritingTaskKey,
  type WritingVerdict,
} from "./exam-attempt";

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
  /** When the homework was set (Homework.createdAt) — only attempts saved after it count. */
  setAt: Date;
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
          createdAt: true,
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
      setAt: hw.createdAt,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Recording an attempt
// ---------------------------------------------------------------------------

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/**
 * One Writing answer as the homework gate sees it (./exam-attempt
 * writingTaskGate): its words, isGenuineWriting with the task's homework
 * minimum (the attempt's own XP minimum — Task 1 80, Task 2 120 real words,
 * not repeated words or filler) and isOnTopic against the task's wording
 * (null when the wording isn't known).
 */
export function writingVerdict(essay: unknown, prompt: unknown, task: WritingTaskKey): WritingVerdict {
  const text = typeof essay === "string" ? essay : "";
  const wording = typeof prompt === "string" ? prompt : "";
  return {
    task,
    words: text.trim().split(/\s+/).filter(Boolean).length,
    genuine: isGenuineWriting(text, HOMEWORK_WRITING_MIN_WORDS[task]),
    onTopic: wording.trim() ? isOnTopic(text, wording) : null,
  };
}

const ATTEMPT_SELECT = {
  id: true,
  studentId: true,
  module: true,
  score: true,
  answers: true,
  aiAnalysis: true,
  completedAt: true,
  review: { select: { band: true, comment: true, reviewerId: true, updatedAt: true } },
} as const;

/** The other rows of the full-Writing-test sitting `row` belongs to (none for anything else, or a mock sitting). */
async function sittingRowsOf(row: StoredAttempt): Promise<ScoredAttempt[]> {
  const a = asRec(row.answers);
  const key = typeof a?.examAttemptId === "string" ? a.examAttemptId : "";
  if (row.module !== "WRITING" || !key || a?.mock === true) return [];
  return db.iELTSTest.findMany({
    where: { studentId: row.studentId, module: "WRITING", id: { not: row.id }, answers: { path: ["examAttemptId"], equals: key } },
    select: ATTEMPT_SELECT,
    take: 4,
  });
}

/** P2002 = unique constraint: here (studentId, homeworkId) — a concurrent request created the submission first. */
const isUniqueViolation = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";

/**
 * Record a saved attempt as the homework submission. The first attempt that
 * counts wins (a retry or a later attempt leaves the submission alone), and
 * only when:
 *   - the attempt really is this homework's content (./exam-attempt
 *     attemptMismatch): the student's own attempt at the same paper and part,
 *     prompt, prompt pair or set, saved after the homework was set, and not
 *     already the attempt of another homework — a replayed attempt id resolves
 *     to whatever row the ledger holds under it;
 *   - it is a real attempt: `genuine` (the route's verdict — Speaking's rule)
 *     AND the rule judged from the stored attempt (./exam-attempt attemptGate:
 *     Reading / Listening half the questions, Writing real words on the task —
 *     at least the attempt's own XP minimum, Task 1 80 and Task 2 120).
 * Otherwise nothing is recorded and the homework stays in To do.
 *
 * A teacher may already have reviewed a Writing / Speaking attempt (the queue
 * shows it as soon as the test is saved): its band, comment and GRADED status
 * are used then. The submission, its activity-log row and the homework XP
 * commit in one transaction; badges and missions are settled after. Never throws.
 */
export async function recordExamHomework(o: {
  studentId: string;
  target: ExamHomeworkTarget;
  /** The IELTSTest that completed the homework (Writing exam: the Task 2 row). */
  testId: string;
  /** The attempt's band (the AI estimate for Writing / Speaking). */
  band: number;
  /** One line for the teacher, e.g. "Passage 2 · 9/13 correct · band 6.5". */
  summary: string;
  /** The route's verdict that this is a real attempt (an empty or token one doesn't complete the homework). */
  genuine: boolean;
}): Promise<{ created: boolean; pointsAwarded: number }> {
  const { studentId, target } = o;
  const none = { created: false, pointsAwarded: 0 };
  try {
    const existing = await db.homeworkSubmission.findUnique({
      where: { studentId_homeworkId: { studentId, homeworkId: target.homeworkId } },
      select: { id: true },
    });
    if (existing) return none;

    const [row, linked]: [ScoredAttempt | null, { homeworkId: string } | null] =
      typeof o.testId === "string" && o.testId
        ? await Promise.all([
            db.iELTSTest.findUnique({ where: { id: o.testId }, select: ATTEMPT_SELECT }),
            db.homeworkSubmission.findFirst({ where: { testId: o.testId }, select: { homeworkId: true } }),
          ])
        : [null, null];
    if (!row) return none;
    const sitting = await sittingRowsOf(row);
    const mismatch =
      linked && linked.homeworkId !== target.homeworkId
        ? "an attempt that already completed another homework"
        : attemptMismatch(
            { homeworkId: target.homeworkId, kind: target.kind, contentId: target.contentId, part: target.part, setAt: target.setAt },
            studentId,
            row,
            sitting
          );
    if (mismatch) {
      console.warn(`Exam homework ${target.homeworkId}: attempt ${o.testId} not recorded — ${mismatch}.`);
      return none;
    }
    const gate = attemptGate(target.kind, row, sitting, writingVerdict);
    if (!o.genuine || (gate && !gate.counts)) return none;

    const auto = AUTO_GRADED[target.kind];
    const reviewed = auto ? null : reviewedHomework(target.kind, row, sitting);
    const gradedBy = reviewed?.graded ? (await teacherOf(reviewed.reviewerId))?.id ?? null : null;
    const band = Math.max(0, Math.min(9, Number(reviewed ? reviewed.band : o.band) || 0));
    const position = (await db.homeworkSubmission.count({ where: { homeworkId: target.homeworkId } })) + 1;
    const pointsAwarded = computeHomeworkXp(target.points, position, true);
    const submissionId = randomUUID();

    const writes = [
      db.homeworkSubmission.create({
        data: {
          id: submissionId,
          studentId,
          homeworkId: target.homeworkId,
          content: o.summary.slice(0, 500),
          position,
          pointsAwarded,
          status: auto || reviewed?.graded ? "GRADED" : "SUBMITTED",
          gradedAt: auto ? new Date() : reviewed?.graded ? reviewed.reviewedAt : null,
          ...(gradedBy ? { gradedBy } : {}),
          ...(reviewed ? { feedback: reviewed.feedback } : {}),
          testId: o.testId,
          band,
        },
      }),
      db.activityLog.create({
        data: {
          studentId,
          action: "HOMEWORK_SUBMITTED",
          details: { homeworkId: target.homeworkId, position, points: pointsAwarded, testId: o.testId, band },
          points: pointsAwarded,
        },
      }),
    ];
    try {
      if (pointsAwarded > 0) {
        // The ledger row, the totalPoints increment, the submission and its activity-log row commit together.
        await awardXp({
          studentId,
          amount: pointsAwarded,
          source: "homework",
          skipLog: true,
          idempotencyKey: `homework:${submissionId}`,
          activity: MODULE_FOR_KIND[target.kind],
          refId: submissionId,
          breakdown: {
            lines: [
              { label: "Homework", amount: target.points },
              ...(pointsAwarded > target.points ? [{ label: `Submitted #${position}`, amount: pointsAwarded - target.points }] : []),
            ],
          },
          atomicWith: writes,
        });
      } else {
        await db.$transaction(writes);
      }
    } catch (e) {
      // Nothing was written. (studentId, homeworkId) is unique: a concurrent request got there first.
      if (!isUniqueViolation(e)) console.error("Exam homework submission failed:", e);
      return none;
    }

    // Badges (HOMEWORK_MASTER, EARLY_BIRD …) and missions — best-effort, after the commit.
    await checkAndAwardAchievements(studentId).catch((e: unknown) => console.error("Exam homework badges failed:", e));
    await settleProgression(studentId).catch(() => null);
    return { created: true, pointsAwarded };
  } catch (e) {
    console.error("recordExamHomework failed:", e);
    return none;
  }
}

// ---------------------------------------------------------------------------
// Result-page notice
// ---------------------------------------------------------------------------

export interface HomeworkNotice {
  homeworkId: string;
  /** The homework's title. */
  title: string;
  /** The homework's page (/homework/<id>), where the student starts it. */
  href: string;
  /** Why this attempt didn't complete it — one sentence for the student. */
  reason: string;
}

/** Overdue homework stays in the student's To do list this long (app/homework/page.tsx). */
const TODO_OVERDUE_DAYS = 30;

/**
 * For a result page, shown to the attempt's owner only: the student's
 * still-open exam homework for exactly this attempt's content — set before the
 * attempt, still in their To do list (not submitted) — with the reason this
 * attempt didn't complete it (./exam-attempt: too little answered or written,
 * off-topic, or not started from the homework). null when there is none.
 *
 * `test` is the IELTSTest row the page loaded. Speaking's rule lives in its
 * submit route, so a Speaking page may pass `opts.reason`; otherwise a generic
 * sentence is used. Never throws.
 */
export async function homeworkNoticeFor(
  studentId: string,
  test: StoredAttempt,
  opts: { reason?: string | null } = {}
): Promise<HomeworkNotice | null> {
  try {
    if (!studentId || !test || test.studentId !== studentId) return null;
    const completedAt = new Date(test.completedAt).getTime();
    if (!Number.isFinite(completedAt)) return null;
    const sitting = await sittingRowsOf(test);
    const content = attemptContentOf(test, sitting);
    if (!content) return null;
    const student: { groupId: string | null } | null = await db.student.findUnique({
      where: { id: studentId },
      select: { groupId: true },
    });
    if (!student?.groupId) return null;
    const hw: { id: string; title: string; contentTitle: string | null } | null = await db.homework.findFirst({
      where: {
        groupId: student.groupId,
        contentKind: content.kind,
        contentId: content.contentId,
        ...(content.kind === "READING" || content.kind === "LISTENING" ? { contentPart: content.part } : {}),
        createdAt: { lte: new Date(completedAt + HOMEWORK_CLOCK_SKEW_MS) },
        dueDate: { gte: new Date(Date.now() - TODO_OVERDUE_DAYS * 86_400_000) },
        submissions: { none: { studentId } },
      },
      orderBy: { dueDate: "asc" },
      select: { id: true, title: true, contentTitle: true },
    });
    if (!hw) return null;
    return {
      homeworkId: hw.id,
      title: hw.title?.trim() || hw.contentTitle?.trim() || "Homework",
      href: `/homework/${encodeURIComponent(hw.id)}`,
      reason: noticeReason(content.kind, attemptGate(content.kind, test, sitting, writingVerdict), opts.reason),
    };
  } catch (e) {
    console.error("homeworkNoticeFor failed:", e);
    return null;
  }
}
