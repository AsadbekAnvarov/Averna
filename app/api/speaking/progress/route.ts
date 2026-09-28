import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSpeakingSet } from "@/lib/ielts/catalog";
import { clientAttemptKey } from "@/lib/ielts/submit";
import { attemptProgress } from "@/lib/speaking/recording";
import type { SpeakingApiError, SpeakingErrorCode, SpeakingProgress } from "@/lib/speaking/shared";

export const dynamic = "force-dynamic";

/**
 * GET /api/speaking/progress?attemptKey=&setId=
 * → { answered: RecordedAnswer[], submitted }
 *
 * The answers of this attempt that are already recorded on the server — a
 * reloaded Speaking test continues from the first unanswered question.
 * Students only ever see their own recordings.
 */

function reply(status: number, code: SpeakingErrorCode, message: string) {
  const body: SpeakingApiError = { error: message, code };
  return NextResponse.json(body, { status });
}

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    return reply(401, "auth", "Please sign in again.");
  }
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return reply(404, "not-student", "Student profile not found.");
    const params = req.nextUrl.searchParams;
    const attemptKey = clientAttemptKey(params.get("attemptKey"));
    const setId = params.get("setId");
    if (!attemptKey || !setId || setId.length > 200) return reply(400, "bad-request", "Missing attempt or test.");
    const set = await getSpeakingSet(setId);
    if (!set) return reply(400, "unknown-set", "This Speaking test couldn't be found.");
    const body: SpeakingProgress = await attemptProgress(student.id, attemptKey, set);
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("Speaking progress error:", e);
    return reply(500, "server", "Your saved answers couldn't be loaded.");
  }
}
