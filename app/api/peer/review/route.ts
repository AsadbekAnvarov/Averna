import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateStudentPoints } from "@/lib/db-helpers";

export const dynamic = "force-dynamic";

const REVIEW_POINTS = 10;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const submissionId = String(body?.submissionId ?? "");
    const rating = Math.max(1, Math.min(9, Math.round(Number(body?.rating) || 0)));
    const strengths = String(body?.strengths ?? "").trim().slice(0, 2000);
    const improvements = String(body?.improvements ?? "").trim().slice(0, 2000);

    if (!submissionId || (strengths.length < 5 && improvements.length < 5)) {
      return NextResponse.json(
        { error: "Add a rating and a few words of helpful feedback." },
        { status: 400 }
      );
    }

    try {
      const submission = await (db as any).peerSubmission.findUnique({ where: { id: submissionId } });
      if (!submission) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }
      if (submission.studentId === student.id) {
        return NextResponse.json({ error: "You can't review your own writing." }, { status: 400 });
      }

      const existing = await (db as any).peerReview.findFirst({
        where: { submissionId, reviewerId: student.id },
      });
      if (existing) {
        return NextResponse.json({ error: "You already reviewed this submission." }, { status: 400 });
      }

      await (db as any).peerReview.create({
        data: {
          submissionId,
          reviewerId: student.id,
          reviewerName: user.name ?? "Student",
          rating,
          strengths,
          improvements,
        },
      });

      // Reward the reviewer for helping a peer
      await db.activityLog.create({
        data: { studentId: student.id, action: "PEER_REVIEW_GIVEN", details: { submissionId }, points: REVIEW_POINTS },
      });
      await updateStudentPoints(student.id, REVIEW_POINTS);

      return NextResponse.json({ ok: true, pointsEarned: REVIEW_POINTS });
    } catch (e) {
      return NextResponse.json(
        { error: "Peer Review isn't set up yet. Ask an admin to run the database migration." },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit review";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
