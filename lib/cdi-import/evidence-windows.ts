/** "Where the answer is heard" buttons (tests 3–6) → evidence windows in whole milliseconds. */

import { attr, select, type HtmlDocument } from "./dom";
import type { ConvertIssue } from "./groups";

export interface EvidenceButton {
  questions: number[];
  start: number;
  end: number;
}

export function evidenceButtons(doc: HtmlDocument): EvidenceButton[] {
  return select(doc, { cls: "audio-evidence-button" }).flatMap((b) => {
    const s = Number(attr(b, "data-audio-start"));
    const e = Number(attr(b, "data-audio-end"));
    const questions = (attr(b, "data-questions") ?? "").split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return questions.length && Number.isFinite(s) && Number.isFinite(e) ? [{ questions, start: s, end: e }] : [];
  });
}

/**
 * Windows by question number: { startMs: round(s × 1000), endMs: round(e × 1000) },
 * kept exactly when 0 ≤ startMs < endMs ≤ durationMs (else dropped with a warning).
 */
export function evidenceWindows(
  buttons: EvidenceButton[],
  durationMs: number,
  file: string,
  warnings: ConvertIssue[],
): Record<string, { startMs: number; endMs: number }> {
  const out: Record<string, { startMs: number; endMs: number }> = {};
  for (const b of buttons) {
    const startMs = Math.round(b.start * 1000);
    const endMs = Math.round(b.end * 1000);
    const ok = startMs >= 0 && startMs < endMs && endMs <= durationMs;
    for (const n of b.questions) {
      if (!ok) {
        warnings.push({ file, questions: [n], message: `The answer window ${b.start}–${b.end} s is outside the recording or empty; it was dropped.` });
        continue;
      }
      if (!out[String(n)]) out[String(n)] = { startMs, endMs };
    }
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => Number(a[0]) - Number(b[0])));
}
