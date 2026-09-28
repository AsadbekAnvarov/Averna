import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWritingTask } from "@/lib/ielts/catalog";
import { clientAttemptKey, submitWritingExam } from "@/lib/ielts/submit";
import { examHomeworkFor, recordExamHomework, writingExamContentId, writingVerdict } from "@/lib/homework/exam-homework";
import { writingExamGate } from "@/lib/homework/exam-attempt";

export const dynamic = "force-dynamic";
// Two essays are assessed by the AI examiner (in parallel).
export const maxDuration = 60;

/**
 * Full Writing test (Task 1 + Task 2 in 60 minutes) — practice mode.
 * Body: { task1Id, task2Id, essays: { task1, task2 }, timeSpent, submissionId }
 * → { band, task1: { testId, band, words, xpAwarded }, task2: { … }, xpAwarded }
 *
 * Each task is saved as its own WRITING test, so the existing result page
 * shows the full feedback for each essay.
 */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Sign in again in a new tab, then press Try again — your essays are saved." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const [task1, task2] = await Promise.all([
      typeof body.task1Id === "string" ? getWritingTask("task1", body.task1Id) : null,
      typeof body.task2Id === "string" ? getWritingTask("task2", body.task2Id) : null,
    ]);
    if (!task1 || !task2) {
      return NextResponse.json({ error: "These Writing tasks couldn't be found. Please start the test again." }, { status: 400 });
    }
    const essays = (body.essays && typeof body.essays === "object" ? body.essays : {}) as { task1?: unknown; task2?: unknown };
    const words = (x: unknown) => (typeof x === "string" ? x.trim().split(/\s+/).filter(Boolean).length : 0);
    if (words(essays.task1) + words(essays.task2) < 20) {
      return NextResponse.json({ error: "Write your answers before submitting — both tasks are empty." }, { status: 400 });
    }

    const r = await submitWritingExam({
      studentId: student.id,
      userId,
      task1,
      task2,
      essays: { task1: essays.task1, task2: essays.task2 },
      timeSpent: body.timeSpent,
      idempotencyKey: clientAttemptKey(body.submissionId),
    });
    // Exam homework (?hw): the first attempt at exactly these two tasks that counts completes it
    // (recordExamHomework checks the saved sitting is these tasks and counts by the same rule).
    if (body.homeworkId) {
      const target = await examHomeworkFor(student.id, body.homeworkId, {
        kind: "WRITING_EXAM",
        contentId: writingExamContentId(task1.id, task2.id),
      });
      if (target) {
        await recordExamHomework({
          studentId: student.id,
          target,
          testId: r.task2.testId,
          band: r.band,
          summary: `Writing test · Task 1 ${r.task1.words} words (band ${r.task1.band.toFixed(1)}) · Task 2 ${r.task2.words} words (band ${r.task2.band.toFixed(1)}) · Writing band ${r.band.toFixed(1)} (AI estimate)`,
          // Each task: the minimum its own XP needs (Task 1 80, Task 2 120 real words, not filler), on the task.
          genuine: writingExamGate(
            writingVerdict(essays.task1, task1.prompt, "task1"),
            writingVerdict(essays.task2, task2.prompt, "task2")
          ).counts,
        });
      }
    }
    const pick = (t: typeof r.task1) => ({ testId: t.testId, band: t.band, words: t.words, xpAwarded: t.xpAwarded, xpNotes: t.xpNotes });
    return NextResponse.json({
      band: r.band,
      task1: pick(r.task1),
      task2: pick(r.task2),
      xpAwarded: r.task1.xpAwarded + r.task2.xpAwarded,
    });
  } catch (error) {
    console.error("Writing exam error:", error);
    return NextResponse.json(
      { error: "Your essays weren't submitted. Nothing was lost — please try again." },
      { status: 500 }
    );
  }
}
