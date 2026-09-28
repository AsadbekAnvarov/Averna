import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSpeakingSet } from "@/lib/ielts/catalog";
import { clientAttemptKey, submitSpeakingTest } from "@/lib/ielts/submit";
import { hasRecordedSpeech } from "@/lib/speaking/recording";
import { examHomeworkFor, recordExamHomework } from "@/lib/homework/exam-homework";
import { speakingGate } from "@/lib/homework/exam-attempt";
import { buildSessionOutcome } from "@/lib/engine/progression/service";
import type { SpeakingTestResult } from "@/components/exam/types";

export const dynamic = "force-dynamic";
// The whole test is assessed by the AI examiner in one call.
export const maxDuration = 60;

/**
 * The mock exam records its Speaking section under "<mockAttemptId>-S"
 * (components/exam/mock-orchestrator.tsx). The mock id when this key is one of
 * the caller's mock attempts, otherwise null.
 */
async function ownMockKey(studentId: string, key: string | undefined): Promise<string | null> {
  const m = key ? /^(.+)-S$/.exec(key) : null;
  if (!m) return null;
  const row = (await db.mockAttempt.findFirst({ where: { id: m[1], studentId }, select: { id: true } })) as { id: string } | null;
  return row ? row.id : null;
}

/**
 * Full Speaking test (Parts 1–3) — practice mode.
 * Body: { setId, answers: SpeakingAnswer[], totalSeconds, inputMode, submissionId }
 * → SpeakingTestResult
 *
 * Transcripts are re-validated against the set (unknown questions are dropped,
 * the part comes from the set, durations are capped) and scored on the server;
 * nothing the client reports about its own score is trusted. Recorded answers
 * (inputMode "recorded") are marked from the server's own transcripts of the
 * recordings saved under the attempt id (/api/speaking/answer). A mock exam's
 * recording key ("<mockAttemptId>-S") is refused (409): those answers are
 * marked by the mock.
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
    // A mock's Speaking recordings can't become a practice attempt (a second XP award, and the mock's
    // later uploads would be refused as "already submitted").
    if (await ownMockKey(student.id, attemptKey)) {
      return NextResponse.json(
        {
          error:
            "These answers belong to your mock exam, so they can't be submitted as a practice test. Finish the Speaking section in the mock exam instead.",
        },
        { status: 409 }
      );
    }
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
          // Really answered: enough words across the test (the server's transcripts, or what was typed).
          genuine: speakingGate(r.words).counts,
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
