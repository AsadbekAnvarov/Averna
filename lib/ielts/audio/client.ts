/**
 * What a Listening test looks like in the browser.
 *
 * Parts with ready pre-rendered audio (ListeningAudio, matching the part's
 * current script) get `audio` and NO script — the recording plays from the
 * Blob CDN, and the transcript (which contains every gap answer) never reaches
 * the browser. Parts without audio keep their script for browser TTS.
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

export async function listeningClientContent(test: ExamListeningTest): Promise<ClientListeningTest> {
  const base = toClientListening(test);
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
