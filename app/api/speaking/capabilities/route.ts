import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { speakingCapabilitiesFor } from "@/lib/speaking/recording";
import type { SpeakingApiError, SpeakingCapabilities } from "@/lib/speaking/shared";

export const dynamic = "force-dynamic";

/**
 * What the Speaking runner can do on this deployment, for this student:
 * → { serverTranscription, storeAudio, retentionDays, maxAnswerSeconds,
 *     maxUploadBytesPerPart, maxUploadBytes, paused? }
 *
 * serverTranscription (OPENAI_API_KEY) switches the runner to recorded answers;
 * without it the browser's speech recognition / typing is used, as before.
 * `paused` ("unavailable": transcription failed for everyone a moment ago;
 * "limit": this student's recordings for today are used up) turns recorded
 * answers off for now — new tests start in the browser's mode.
 */
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAuth()).id;
  } catch {
    const body: SpeakingApiError = { error: "Please sign in again.", code: "auth" };
    return NextResponse.json(body, { status: 401 });
  }
  const student = (await db.student.findUnique({ where: { userId }, select: { id: true } }).catch(() => null)) as { id: string } | null;
  const body: SpeakingCapabilities = await speakingCapabilitiesFor(student?.id ?? null);
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
