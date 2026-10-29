/**
 * Which papers can be practised one part at a time, and the Listening card
 * model. Pure (client and server). Reading: always by passage. Listening: per
 * part files, or a whole recording whose part boundaries are verified
 * (`splittable`, set by the catalog from listening_part_segments).
 */

import { rangeLabel } from "./format";
import type { ExamTestSummary } from "./types";

export function canPractiseParts(s: Pick<ExamTestSummary, "partInfo" | "recordingMode" | "splittable">): boolean {
  return s.partInfo.length > 1 && (s.recordingMode !== "whole" || s.splittable === true);
}

/**
 * The part index for practice: an integer in [0, parts − 1] when the paper has
 * several parts and can be split; otherwise null (the full test).
 */
export function resolvePracticePart(test: { parts: unknown[] }, raw: unknown, splittable: boolean): number | null {
  if (!splittable) return null;
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\s*\d+\s*$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 0 || n >= test.parts.length) return null;
  return test.parts.length > 1 ? n : null;
}

/** Minutes for one part: verified segment length + 1 minute to check; otherwise the paper's share. */
export function listeningPartMinutes(s: Pick<ExamTestSummary, "partInfo" | "timeLimit">, part: number): number {
  const ms = s.partInfo[part]?.durationMs;
  if (typeof ms === "number" && ms > 0) return Math.ceil(ms / 60000) + 1;
  return Math.max(1, Math.round(s.timeLimit / Math.max(1, s.partInfo.length)));
}

export interface ListeningCardRow {
  n: number;
  title: string;
  detail: string;
  href?: string;
}
export interface ListeningCardModel {
  label: string;
  rows: ListeningCardRow[];
  note: string | null;
  cta: { href: string; label: string };
}

export const WHOLE_UNVERIFIED_NOTE = "Original, uncut audio. Separate part playback is unavailable until recording boundaries are verified.";

function topic(title: string | undefined): string | null {
  return title && !/^part\s*\d+$/i.test(title.trim()) ? title : null;
}

export function listeningCardModel(s: ExamTestSummary): ListeningCardModel {
  const href = `/learning/listening/${encodeURIComponent(s.id)}`;
  const cta = { href, label: s.full ? "Start full test" : "Start practice test" };
  const whole = s.recordingMode === "whole";
  const split = canPractiseParts(s);
  const range = (p: { from: number; to: number }) => (p.to > 0 ? rangeLabel(p.from, p.to) : null);
  const rows: ListeningCardRow[] = s.partInfo.map((p, i) => {
    const custom = topic(p.title);
    if (split) {
      const minutes = whole ? `${listeningPartMinutes(s, i)} min` : `~${listeningPartMinutes(s, i)} min`;
      return {
        n: i + 1,
        title: `Practise Part ${i + 1}`,
        detail: [custom, range(p), minutes].filter(Boolean).join(" · ") || `${s.questions} questions`,
        href: `${href}?part=${i}`,
      };
    }
    return { n: i + 1, title: custom ?? `Part ${i + 1}`, detail: [custom, range(p)].filter(Boolean).join(" · ") || `${s.questions} questions` };
  });
  const label = split ? "Parts · practise one at a time" : whole ? "One complete recording · Parts 1–4" : "Recording";
  return { label, rows, note: whole && !split ? WHOLE_UNVERIFIED_NOTE : null, cta };
}
