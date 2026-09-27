import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { speakingCapabilities } from "@/lib/speaking/recording";
import type { SpeakingApiError, SpeakingCapabilities } from "@/lib/speaking/shared";

export const dynamic = "force-dynamic";

/**
 * What the Speaking runner can do on this deployment:
 * → { serverTranscription, storeAudio, retentionDays, maxAnswerSeconds, maxUploadBytes }
 *
 * serverTranscription (OPENAI_API_KEY) switches the runner to recorded answers;
 * without it the browser's speech recognition / typing is used, as before.
 */
export async function GET() {
  try {
    await requireAuth();
  } catch {
    const body: SpeakingApiError = { error: "Please sign in again.", code: "auth" };
    return NextResponse.json(body, { status: 401 });
  }
  const body: SpeakingCapabilities = speakingCapabilities();
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
