import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSpeakingSet } from "@/lib/ielts/catalog";
import { clientAttemptKey, submitSpeakingTest } from "@/lib/ielts/submit";
import { hasRecordedSpeech } from "@/lib/speaking/recording";
import { examHomeworkFor, recordExamHomework } from "@/lib/homework/exam-homework";
import { buildSessionOutcome } from "@/lib/engine/progression/service";
import type { SpeakingTestResult } from "@/components/exam/types";

export const dynamic = "force-dynamic";
// The whole test is assessed by the AI examiner in one call.
export const maxDuration = 60;

/**
 * Full Speaking test (Parts 1–3) — practice mode.
 * Body: { setId, answers: SpeakingAnswer[], totalSeconds, inputMode, submissionId }
 * → SpeakingTestResult
 *
 * Transcripts are re-validated against the set (unknown questions are dropped,
 * the part comes from the set, durations are capped) and scored on the server;
 * nothing the client reports about its own score is trusted. Recorded answers
 * (inputMode "recorded") are marked from the server's own transcripts of the
 * recordings saved under the attempt id (/api/speaking/answer).
 */
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Sign in again in a new tab, then come back here and submit — keep this tab open so your answers aren't lost." }, { status: 401 });
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return NextResponse.json({ error: "Student profile not found." }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const set = typeof body.setId === "string" ? await getSpeakingSet(body.setId) : null;
    if (!set) {
      return NextResponse.json({ error: "This Speaking test couldn't be found. Please pick it again from the list." }, { status: 400 });
    }
    const attemptKey = clientAttemptKey(body.submissionId);
    const hasSpeech =
      (Array.isArray(body.answers) &&
        body.answers.some((a) => a && typeof a === "object" && typeof (a as { transcript?: unknown }).transcript === "string" && (a as { transcript: string }).transcript.trim().length > 0)) ||
      // Recorded answers: the transcripts the server made count, whatever the browser sends.
      (!!attemptKey && (await hasRecordedSpeech(student.id, attemptKey, set.id)));
    if (!hasSpeech) {
      return NextResponse.json({ error: "We didn't receive any answers. Check your microphone and try again." }, { status: 400 });
    }

    const r = await submitSpeakingTest({
      studentId: student.id,
      userId,
      set,
      rawAnswers: body.answers,
      inputMode: body.inputMode,
      idempotencyKey: attemptKey,
      // Answers recorded by the runner under this attempt id (lib/speaking/recording.ts).
      recordingKey: attemptKey,
    });

    // Exam homework (?hw): the first attempt at this set completes it (the teacher reviews it later).
    if (body.homeworkId) {
      const target = await examHomeworkFor(student.id, body.homeworkId, { kind: "SPEAKING", contentId: set.id });
      if (target) {
        await recordExamHomework({
          studentId: student.id,
          target,
          testId: r.testId,
          band: r.band,
          summary: `${r.recorded ? "Recorded Speaking test" : "Speaking test"} · ${r.words} words · band ${r.band.toFixed(1)} (AI estimate)`,
          genuine: r.words >= 30,
        });
      }
    }

    const result: SpeakingTestResult = {
      testId: r.testId,
      band: r.band,
      criteria: r.criteria,
      feedback: r.feedback,
      perPart: r.perPart,
      xpAwarded: r.xpAwarded,
      xpNotes: r.xpNotes,
      outcome: await buildSessionOutcome(student.id, r.testId).catch(() => null),
      assessedBy: r.assessedBy,
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Speaking test error:", error);
    return NextResponse.json(
      { error: "Your test wasn't submitted. Your answers are still here — please try again." },
      { status: 500 }
    );
  }
}
