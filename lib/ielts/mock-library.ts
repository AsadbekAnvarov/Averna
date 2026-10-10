import { db } from "@/lib/db";
import { getListeningExam, getReadingExam } from "./catalog";
import { listeningAudioEnabled, listeningClientContent, type ReadyRow } from "./audio/client";
import { testNumbers } from "./format";
import type { ExamTestSummary, ClientListeningTest } from "./types";
export function isFullObjective(test: { parts: { groups: Parameters<typeof testNumbers>[0]["parts"][number]["groups"] }[] }, parts: number) {
  const numbers = testNumbers(test);
  return test.parts.length === parts && numbers.length === 40 && new Set(numbers).size === 40 && numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 40);
}
/** One audio-row read, then load only candidates with four files. Never render/generate audio. */
export async function mockListeningLibrary(summaries: ExamTestSummary[]): Promise<Map<string, ClientListeningTest>> {
  const ready = new Map<string, ClientListeningTest>();
  const full = summaries.filter(t => t.full && t.parts === 4 && t.questions === 40);
  if (!full.length || !listeningAudioEnabled()) return ready;
  const rows = await db.listeningAudio.findMany({ where: { testId: { in: full.map(t => t.id) }, status: "ready" }, select: { testId: true, partIndex: true, url: true, durationMs: true, scriptHash: true, timeline: true } }) as ReadyRow[];
  const grouped = new Map<string, ReadyRow[]>();
  for (const row of rows) { if (row.testId) grouped.set(row.testId, [...(grouped.get(row.testId) || []), row]); }
  for (const summary of full) {
    const files = grouped.get(summary.id) || [];
    if (![0, 1, 2, 3].every(i => files.some(row => row.partIndex === i && !!row.url && row.durationMs > 0))) continue;
    const test = await getListeningExam(summary.id);
    if (!test || !isFullObjective(test, 4)) continue;
    const content = await listeningClientContent(test, { recordingsOnly: true, rows: files });
    if (content) ready.set(summary.id, content);
  }
  return ready;
}
export function recordingMinutes(test: ClientListeningTest): number | null {
  if (test.parts.length !== 4 || test.parts.some(p => !p.audio || p.audio.durationMs <= 0)) return null;
  const duration = test.parts.reduce((n, p) => n + p.audio!.durationMs, 0);
  // Existing recordings include announcements/reading pauses. Only the final two-minute answer check is added.
  return (duration + 120_000) / 60_000;
}

/** Validate actual paper structure, not only a library card's full flag. */
export async function mockReadingLibrary(summaries: ExamTestSummary[]): Promise<Set<string>> {
  const ready = new Set<string>();
  for (const summary of summaries.filter(t => t.full && t.parts === 3 && t.questions === 40)) {
    const test = await getReadingExam(summary.id);
    if (test && isFullObjective(test, 3)) ready.add(summary.id);
  }
  return ready;
}
