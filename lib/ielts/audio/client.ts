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
 * One query per test. recordingsOnly is fail-closed: any missing/stale/disabled
 * asset returns null, never scripts or generated/browser voices. Legacy/practice
 * callers retain their original fallback.
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { TTS_MODEL } from "@/lib/openai-audio";
import { toClientListening } from "../sanitize";
import type { ClientListeningTest, ExamListeningTest } from "../types";
import { partAudioHash } from "./hash";
import { sanitizeTimeline } from "./timeline";

export interface ReadyRow {
  testId?: string;
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

export function listeningClientContent(test: ExamListeningTest): Promise<ClientListeningTest>;
export function listeningClientContent(test: ExamListeningTest, options: { recordingsOnly: true; rows?: ReadyRow[] }): Promise<ClientListeningTest | null>;
export async function listeningClientContent(test: ExamListeningTest, options?: { recordingsOnly: true; rows?: ReadyRow[] }): Promise<ClientListeningTest | null> {
  const base = toClientListening(test);
  // Switched off: scripts for every part, no recordings.
  if (!listeningAudioEnabled()) return options?.recordingsOnly ? null : base;
  // The old short practice tests never get recordings (the admin skips them).
  if (test.source === "legacy" || !test.parts.length) return options?.recordingsOnly ? null : base;
  try {
    const rows = options?.rows ?? (await db.listeningAudio.findMany({
      where: { testId: test.id, status: "ready" },
      select: { partIndex: true, url: true, durationMs: true, scriptHash: true, timeline: true },
    })) as ReadyRow[];
    if (!Array.isArray(rows) || !rows.length) return options?.recordingsOnly ? null : base;
    const model = TTS_MODEL();
    const content = {
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
    if (options?.recordingsOnly && content.parts.some(p => !p.audio)) return null;
    return content;
  } catch {
    return options?.recordingsOnly ? null : base;
  }
}
