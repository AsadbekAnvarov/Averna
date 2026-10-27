/**
 * "Approved · Undo" for the one-tap review approval (idea 10).
 *
 * Approving saves through the normal review path (./save `saveTestReview`:
 * TestReview, the attempt's band, the homework submission, the mock sitting,
 * the student's notification). Just before that save, the parts it will touch
 * are snapshotted: the previous review (or none), the attempt's band, the
 * homework submissions it completed and the mock sitting's results. The
 * snapshot travels back to the browser as a short-lived token signed with the
 * auth secret (HMAC-SHA256), bound to the reviewer and the attempt.
 *
 * Undo (within UNDO_WINDOW_MS) verifies the token and that the review is still
 * exactly the one this approval saved (same updatedAt, same reviewer), then in
 * one transaction restores every snapshotted row — deleting the review when
 * there was none before — and removes the in-app notification the approval
 * sent. A Telegram copy that already went out can't be recalled.
 *
 * SERVER ONLY.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { answersOf, examAttemptIdOf, mockAttemptIdOf } from "./answers";
import { isReviewSkill, studentResultHref } from "./scoring";

/** How long an approval can be undone (the toast shows ~6 s; the rest is network slack). */
export const UNDO_WINDOW_MS = 2 * 60_000;

const json = (x: unknown) => x as Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;

export interface SubmissionSnapshot {
  id: string;
  status: string;
  band: number | null;
  feedback: string | null;
  gradedBy: string | null;
  gradedAt: string | null;
}

export interface ReviewSnapshot {
  testId: string;
  studentId: string;
  skill: "WRITING" | "SPEAKING";
  /** The review before the approval (null = none). */
  review: { band: number; criteria: unknown; comment: string | null; reviewerId: string } | null;
  score: number;
  submissions: SubmissionSnapshot[];
  mock: { id: string; results: unknown; overall: number | null } | null;
}

export interface UndoPayload {
  v: 1;
  /** User id of the reviewer who approved. */
  by: string;
  exp: number;
  before: ReviewSnapshot;
  after: { reviewUpdatedAt: string; mockUpdatedAt: string | null; notifiedAt: number | null };
}

function secret(): string | null {
  const s = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  return s.length >= 8 ? s : null;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const mac = (key: string, body: string) => createHmac("sha256", key).update(`review-undo:${body}`).digest("base64url");

/** A signed token, or null when the deployment has no auth secret (then there's no Undo). */
export function signUndo(payload: UndoPayload): string | null {
  const key = secret();
  if (!key) return null;
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(key, body)}`;
}

export type VerifyResult = { ok: true; payload: UndoPayload } | { ok: false; status: number; error: string };

/** Check the signature, expiry, reviewer and attempt. */
export function verifyUndo(token: string, userId: string, testId: string, now = Date.now()): VerifyResult {
  const key = secret();
  const bad: VerifyResult = { ok: false, status: 400, error: "This undo link isn't valid." };
  if (!key || typeof token !== "string") return bad;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return bad;
  const want = Buffer.from(mac(key, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return bad;
  let payload: UndoPayload;
  try {
    payload = JSON.parse(unb64(body)) as UndoPayload;
  } catch {
    return bad;
  }
  if (payload?.v !== 1 || !payload.before || !payload.after) return bad;
  if (payload.by !== userId) return { ok: false, status: 403, error: "Only the teacher who approved this review can undo it." };
  if (payload.before.testId !== testId) return bad;
  if (!(payload.exp > now)) return { ok: false, status: 410, error: "Undo has expired — open the review to change it instead." };
  return { ok: true, payload };
}

/** What the approval is about to change (read before saving). Null for an unknown attempt. */
export async function captureReviewState(testId: string): Promise<ReviewSnapshot | null> {
  const t: {
    id: string;
    studentId: string;
    module: string;
    score: number;
    answers: unknown;
    review: { band: number; criteria: unknown; comment: string | null; reviewerId: string } | null;
  } | null = await db.iELTSTest.findUnique({
    where: { id: testId },
    select: { id: true, studentId: true, module: true, score: true, answers: true, review: { select: { band: true, criteria: true, comment: true, reviewerId: true } } },
  });
  if (!t || !isReviewSkill(t.module)) return null;
  const answers = answersOf(t.answers);
  const examAttemptId = t.module === "WRITING" ? examAttemptIdOf(answers) : null;
  const mockAttemptId = mockAttemptIdOf(answers);

  const sittingIds: { id: string }[] = examAttemptId
    ? await db.iELTSTest.findMany({
        where: { studentId: t.studentId, module: "WRITING", answers: { path: ["examAttemptId"], equals: examAttemptId } },
        select: { id: true },
        take: 4,
      })
    : [];
  const ids = Array.from(new Set([t.id, ...sittingIds.map((s) => s.id)]));
  const [subs, mock] = await Promise.all([
    db.homeworkSubmission.findMany({
      where: { testId: { in: ids } },
      select: { id: true, status: true, band: true, feedback: true, gradedBy: true, gradedAt: true },
    }) as Promise<{ id: string; status: string; band: number | null; feedback: string | null; gradedBy: string | null; gradedAt: Date | null }[]>,
    mockAttemptId
      ? (db.mockAttempt.findFirst({ where: { id: mockAttemptId, studentId: t.studentId }, select: { id: true, results: true, overall: true } }) as Promise<{
          id: string;
          results: unknown;
          overall: number | null;
        } | null>)
      : Promise.resolve(null),
  ]);

  return {
    testId: t.id,
    studentId: t.studentId,
    skill: t.module,
    review: t.review ? { band: t.review.band, criteria: t.review.criteria, comment: t.review.comment, reviewerId: t.review.reviewerId } : null,
    score: t.score,
    submissions: subs.map((s) => ({
      id: s.id,
      status: s.status,
      band: s.band,
      feedback: s.feedback,
      gradedBy: s.gradedBy,
      gradedAt: s.gradedAt ? new Date(s.gradedAt).toISOString() : null,
    })),
    mock: mock ? { id: mock.id, results: mock.results, overall: mock.overall } : null,
  };
}

/** The mock sitting's updatedAt right after the save (the undo only restores it if nothing changed since). */
export async function mockUpdatedAt(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const row: { updatedAt: Date } | null = await db.mockAttempt.findUnique({ where: { id }, select: { updatedAt: true } }).catch(() => null);
  return row ? row.updatedAt.toISOString() : null;
}

export type UndoResult = { ok: true; restored: "none" | "previous" } | { ok: false; status: number; error: string };

/** Restore the snapshot (the token is already verified and the viewer allowed). */
export async function undoReview(viewerId: string, payload: UndoPayload): Promise<UndoResult> {
  const b = payload.before;
  const done: "none" | "previous" | "changed" = await db.$transaction(
    async (tx: Tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ielts_tests" WHERE "id" = ${b.testId} FOR UPDATE`;
      const current: { updatedAt: Date; reviewerId: string } | null = await tx.testReview.findUnique({
        where: { testId: b.testId },
        select: { updatedAt: true, reviewerId: true },
      });
      if (!current || current.reviewerId !== viewerId || current.updatedAt.toISOString() !== payload.after.reviewUpdatedAt) return "changed";

      if (b.review) {
        await tx.testReview.update({
          where: { testId: b.testId },
          data: { band: b.review.band, criteria: b.review.criteria == null ? Prisma.DbNull : json(b.review.criteria), comment: b.review.comment, reviewerId: b.review.reviewerId },
        });
      } else {
        await tx.testReview.delete({ where: { testId: b.testId } });
      }
      await tx.iELTSTest.update({ where: { id: b.testId }, data: { score: b.score } });

      if (b.submissions.length) {
        const ids = b.submissions.map((s) => s.id);
        await tx.$queryRaw`SELECT "id" FROM "homework_submissions" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
        for (const s of b.submissions) {
          await tx.homeworkSubmission.update({
            where: { id: s.id },
            data: {
              status: s.status as "PENDING" | "SUBMITTED" | "GRADED" | "LATE",
              band: s.band,
              feedback: s.feedback,
              gradedBy: s.gradedBy,
              gradedAt: s.gradedAt ? new Date(s.gradedAt) : null,
            },
          });
        }
      }
      if (b.mock && payload.after.mockUpdatedAt) {
        const r: { count: number } = await tx.mockAttempt.updateMany({
          where: { id: b.mock.id, updatedAt: new Date(payload.after.mockUpdatedAt) },
          data: { results: json(b.mock.results ?? {}), overall: b.mock.overall },
        });
        if (r.count === 0) console.warn(`Review undo: mock attempt ${b.mock.id} changed since the approval; its results were left as they are.`);
      }
      return b.review ? "previous" : "none";
    },
    { maxWait: 5000, timeout: 15000 }
  );
  if (done === "changed") return { ok: false, status: 409, error: "This review changed after you approved it — open it to edit instead." };

  // The approval's in-app notification ("Your teacher reviewed your …") goes too.
  if (payload.after.notifiedAt) {
    try {
      const student: { userId: string } | null = await db.student.findUnique({ where: { id: b.studentId }, select: { userId: true } });
      if (student) {
        await db.notification.deleteMany({
          where: {
            userId: student.userId,
            type: "grade",
            link: studentResultHref(b.skill, b.testId),
            createdAt: { gte: new Date(payload.after.notifiedAt - 5_000) },
          },
        });
      }
    } catch (e) {
      console.error("Review undo: removing the notification failed:", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, restored: done };
}
