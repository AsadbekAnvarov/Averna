import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSpeakingSet } from "@/lib/ielts/catalog";
import { clientAttemptKey } from "@/lib/ielts/submit";
import { saveRecordedAnswer } from "@/lib/speaking/recording";
import { MAX_UPLOAD_BYTES, flattenSpeakingQuestions, type SpeakingApiError, type SpeakingErrorCode } from "@/lib/speaking/shared";

export const dynamic = "force-dynamic";
// One transcription (up to ~40 s for a long Part 2 answer) plus the audio upload.
export const maxDuration = 60;

/**
 * One recorded Speaking answer.
 * multipart/form-data: file (the recording), attemptKey, setId, questionIndex
 * → RecordedAnswer { questionIndex, part, transcript, words, durationMs, stored }
 *
 * The part and the question come from the set (by questionIndex), the duration
 * from the audio itself — nothing the browser says about the answer is
 * trusted. Uploading the same question again replaces the earlier take.
 * Errors: { error, code, retryAfterSec? } (429 carries Retry-After).
 */

function reply(status: number, code: SpeakingErrorCode, message: string, retryAfterSec?: number) {
  const body: SpeakingApiError = { error: message, code, ...(retryAfterSec ? { retryAfterSec } : {}) };
  return NextResponse.json(body, { status, headers: retryAfterSec ? { "Retry-After": String(retryAfterSec) } : undefined });
}

const isBlob = (x: unknown): x is Blob =>
  !!x && typeof x === "object" && typeof (x as Blob).arrayBuffer === "function" && typeof (x as Blob).size === "number";

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return reply(401, "auth", "Your session has expired. Sign in again in a new tab, then come back here — your answers are kept on this page.");
  }
  try {
    // Refuse oversized bodies before reading them (the multipart envelope adds a little).
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_UPLOAD_BYTES + 256 * 1024) return reply(413, "too-large", "This recording is too long to upload.");

    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return reply(404, "not-student", "Student profile not found.");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return reply(400, "bad-request", "The recording didn't arrive in one piece. Please try again.");
    }
    const attemptKey = clientAttemptKey(form.get("attemptKey"));
    const setId = form.get("setId");
    const rawIndex = form.get("questionIndex");
    const file = form.get("file");
    if (!attemptKey || typeof setId !== "string" || !setId || setId.length > 200) {
      return reply(400, "bad-request", "This answer couldn't be matched to your test. Reload the page to continue.");
    }
    const set = await getSpeakingSet(setId);
    if (!set) return reply(400, "unknown-set", "This Speaking test couldn't be found.");
    const questionIndex = typeof rawIndex === "string" && /^\d{1,3}$/.test(rawIndex) ? Number(rawIndex) : -1;
    if (questionIndex < 0 || questionIndex >= flattenSpeakingQuestions(set).length) {
      return reply(400, "unknown-question", "This question isn't part of the test.");
    }
    if (!isBlob(file)) return reply(400, "no-file", "No recording was attached.");

    const r = await saveRecordedAnswer({ studentId: student.id, userId, attemptKey, set, questionIndex, file });
    if (!r.ok) return reply(r.status, r.code, r.error, r.retryAfterSec);
    return NextResponse.json(r.answer);
  } catch (e) {
    console.error("Speaking answer error:", e);
    return reply(500, "server", "Your answer couldn't be saved yet — retrying.");
  }
}
