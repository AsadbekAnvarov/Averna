/**
 * What a Listening test looks like in the browser.
 *
 * Parts with ready pre-rendered audio (ListeningAudio, matching the part's
 * current script) get `audio` and NO script — the recording plays from the
 * Blob CDN, and the transcript (which contains every gap answer) never reaches
 * the browser. Parts without audio keep their script for browser TTS. If a
 * recording can't be played in the browser, the runner fetches that one part's
 * script from GET /api/listening/script and carries on with browser voices.
 *
 * Kill switch: LISTENING_AUDIO=off serves every part with its script and no
 * recording (browser voices, as before recordings existed) — in practice, the
 * mock exam and the placement test alike, since they all come through here.
 * For when the Blob store is restricted (quota), down or blocked. Nothing is
 * deleted: remove the variable (any other value) to serve the recordings
 * again. Environment variables apply to new deployments, so redeploy after
 * changing it on Vercel.
 *
 * A test with ONE real recording (CDI, `test.audio`) is different: it gets
 * `recording` (lib/ielts/sanitize — URL from lib/ielts/cdi-audio) and no
 * per-part audio, whatever LISTENING_AUDIO says; its parts have no script,
 * and their transcripts never reach the browser.
 *
 * One query per test; never throws (any problem → browser voices, as before).
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { TTS_MODEL } from "@/lib/openai-audio";
import { toClientListening } from "../sanitize";
import type { ClientListeningTest, ExamListeningTest } from "../types";
import { partAudioHash } from "./hash";
import { sanitizeTimeline } from "./timeline";

interface ReadyRow {
  partIndex: number;
  url: string | null;
  durationMs: number;
  scriptHash: string;
  timeline: unknown;
}

/** False when LISTENING_AUDIO is "off" (any case): recordings aren't served to students. */
export function listeningAudioEnabled(): boolean {
  return String(process.env.LISTENING_AUDIO ?? "").trim().toLowerCase() !== "off";
}

export async function listeningClientContent(test: ExamListeningTest): Promise<ClientListeningTest> {
  const base = toClientListening(test);
  // One real recording for the whole test (CDI): it has no script to render or read aloud, and it
  // isn't on the Blob store, so neither the per-part renders nor the kill switch apply.
  if (base.recording) return base;
  // Switched off: scripts for every part, no recordings.
  if (!listeningAudioEnabled()) return base;
  // The old short practice tests never get recordings (the admin skips them).
  if (test.source === "legacy" || !test.parts.length) return base;
  try {
    const rows = (await db.listeningAudio.findMany({
      where: { testId: test.id, status: "ready" },
      select: { partIndex: true, url: true, durationMs: true, scriptHash: true, timeline: true },
    })) as ReadyRow[];
    if (!Array.isArray(rows) || !rows.length) return base;
    const model = TTS_MODEL();
    return {
      ...base,
      parts: base.parts.map((p, i) => {
        const row = rows.find((r) => r.partIndex === i);
        if (!row || typeof row.url !== "string" || !row.url.startsWith("https://") || !(row.durationMs > 0)) return p;
        if (row.scriptHash !== partAudioHash(test, i, model)) return p; // stale: the script changed since
        return {
          ...p,
          script: [],
          audio: { url: row.url, durationMs: row.durationMs, timeline: sanitizeTimeline(row.timeline, row.durationMs) },
        };
      }),
    };
  } catch {
    return base;
  }
}
