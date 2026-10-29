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
import type { ClientListeningTest, ClientSegment, ExamListeningTest } from "../types";
import type { StoredSegments } from "../segments";
import { partAudioHash, wholeRecordingHash } from "./hash";
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

/** Practice of one part of a whole recording with verified boundaries. */
export interface SegmentPartOption {
  index: number;
  segments: StoredSegments;
}

export function listeningClientContent(test: ExamListeningTest, options?: { segmentPart?: SegmentPartOption | null }): Promise<ClientListeningTest>;
export function listeningClientContent(test: ExamListeningTest, options: { recordingsOnly: true; rows?: ReadyRow[] }): Promise<ClientListeningTest | null>;
export async function listeningClientContent(
  test: ExamListeningTest,
  options?: { recordingsOnly?: true; rows?: ReadyRow[]; segmentPart?: SegmentPartOption | null },
): Promise<ClientListeningTest | null> {
  const rawBase = toClientListening(test);
  // Imported whole-file papers never substitute speech synthesis when missing.
  const base = test.recordingMode === "whole"
    ? { ...rawBase, parts: rawBase.parts.map(p => ({ ...p, script: [] })) }
    : rawBase;
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
    if (test.recordingMode === "whole") {
      const row = rows.find(r => r.partIndex === -1);
      if (!row || typeof row.url !== "string" || !row.url.startsWith("https://") ||
          !Number.isFinite(row.durationMs) || row.durationMs <= 0 ||
          row.scriptHash !== wholeRecordingHash(test)) return options?.recordingsOnly ? null : base;
      const seg = options?.segmentPart;
      const part = seg ? seg.segments.parts[seg.index] : undefined;
      if (seg && part && !options?.recordingsOnly) {
        // One verified part: only its byte range plays (no fullRecording, so the runner stays in part mode).
        const segment: ClientSegment = {
          startMs: part.startMs,
          endMs: part.endMs,
          frameStart: part.frameStart,
          frameEnd: part.frameEnd,
          byteStart: part.byteStart,
          byteEnd: part.byteEnd,
          sampleRate: seg.segments.sampleRate,
          samplesPerFrame: seg.segments.samplesPerFrame,
          sourceDurationMs: row.durationMs,
        };
        return {
          ...base,
          parts: base.parts.map((p, i) => i === seg.index
            ? { ...p, script: [], audio: { url: row.url!, durationMs: part.endMs - part.startMs, timeline: [], segment } }
            : { ...p, script: [] }),
        };
      }
      return {
        ...base,
        parts: base.parts.map(p => ({ ...p, script: [] })),
        fullRecording: { url: row.url, durationMs: row.durationMs, timeline: [] },
      };
    }
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
