/**
 * Shared guard for the AI-draft review routes (idea 10): approve, undo and
 * draft under /api/teacher/reviews/[testId]/…. A browser call from this site
 * (trustedMutation), a signed-in TEACHER (the drafts are a teacher tool — the
 * admin review flow stays the manual form), an attempt id of the right shape
 * and a student of the teacher's own groups (lib/access `canReviewStudent`).
 *
 * SERVER ONLY.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canReviewStudent } from "@/lib/access";
import { db } from "@/lib/db";
import { trustedMutation } from "@/lib/security/same-origin";

const TEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const reviewReply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export type ReviewTeacher = { ok: true; user: { id: string; role: "TEACHER" }; studentId: string } | { ok: false; response: NextResponse };

export async function reviewTeacher(request: Request, testId: string): Promise<ReviewTeacher> {
  if (!trustedMutation(request)) return { ok: false, response: reviewReply({ error: "Untrusted origin" }, 403) };
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return { ok: false, response: reviewReply({ error: "Your session has expired. Sign in again in a new tab — the draft is still here." }, 401) };
  }
  if (user.role !== "TEACHER") return { ok: false, response: reviewReply({ error: "AI review drafts are for teachers." }, 403) };
  if (typeof testId !== "string" || !TEST_ID_RE.test(testId)) {
    return { ok: false, response: reviewReply({ error: "This attempt couldn't be found." }, 404) };
  }
  const test: { studentId: string } | null = await db.iELTSTest.findUnique({ where: { id: testId }, select: { studentId: true } });
  if (!test) return { ok: false, response: reviewReply({ error: "This attempt couldn't be found." }, 404) };
  const viewer = { id: user.id, role: "TEACHER" as const };
  if (!(await canReviewStudent(viewer, test.studentId))) {
    return { ok: false, response: reviewReply({ error: "You can only review the work of students in your own groups." }, 403) };
  }
  return { ok: true, user: viewer, studentId: test.studentId };
}
