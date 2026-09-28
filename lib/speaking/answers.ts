/**
 * A recorded Speaking attempt's answers, built from its SpeakingRecording rows
 * (server transcripts and server-measured durations — never the browser's).
 * Pure; used by submitSpeakingTest (lib/ielts/submit.ts).
 */

import type { SpeakingExamSet } from "../ielts/types";
import { MAX_ANSWER_SECONDS, flattenSpeakingQuestions, recordingMatchesQuestion, type SpeakingPart } from "./shared";
import { parseSpeechMetrics, type SpeechMetrics } from "./metrics";

/** The SpeakingRecording columns answer building reads. */
export interface RecordingRow {
  questionIndex: number;
  setId: string;
  /** The question as it was asked when the answer was recorded. */
  question: string;
  transcript: string;
  durationMs: number;
  metrics?: unknown;
}

/** One answer of a recorded attempt (an answers.answers[] item, plus the recording's metrics). */
export interface RecordedSpeakingAnswer {
  part: SpeakingPart;
  /** From the set (by questionIndex), not from the row or the client. */
  question: string;
  transcript: string;
  /** durationMs / 1000, capped per part (Part 2 ≤ 180 s, others ≤ 150 s). */
  seconds: number;
  questionIndex: number;
  metrics: SpeechMetrics | null;
}

/**
 * Rows → answers in question order. Rows of another set, unknown indices,
 * duplicates and rows recorded for a different question (the set was edited
 * or reordered since — the same check as attemptProgress) are ignored.
 */
export function answersFromRecordings(set: SpeakingExamSet, rows: RecordingRow[]): RecordedSpeakingAnswer[] {
  const items = flattenSpeakingQuestions(set);
  const seen = new Set<number>();
  const out: RecordedSpeakingAnswer[] = [];
  const sorted = [...rows].sort((a, b) => a.questionIndex - b.questionIndex);
  for (const row of sorted) {
    if (!row || row.setId !== set.id || !Number.isInteger(row.questionIndex) || seen.has(row.questionIndex)) continue;
    const item = items[row.questionIndex];
    if (!item || !recordingMatchesQuestion(item, row.question)) continue;
    seen.add(row.questionIndex);
    const ms = Number(row.durationMs);
    out.push({
      part: item.part,
      question: item.question.trim().slice(0, 400),
      transcript: typeof row.transcript === "string" ? row.transcript.trim().slice(0, 4000) : "",
      seconds: Math.max(0, Math.min(Math.round((Number.isFinite(ms) ? ms : 0) / 1000), MAX_ANSWER_SECONDS[item.part])),
      questionIndex: row.questionIndex,
      metrics: parseSpeechMetrics(row.metrics),
    });
  }
  return out;
}

/** A client answer after validation against the set (validSpeakingAnswers). */
export interface CheckedSpeakingAnswer {
  part: SpeakingPart;
  question: string;
  transcript: string;
  seconds: number;
  questionIndex?: number;
  typed?: boolean;
}

/**
 * The candidate's own answers for questions that have no recording: typed
 * (`typed: true` — the microphone failed mid-test, or an upload failed and the
 * answer was typed at the end) or transcribed by the browser (recording
 * stopped mid-test — transcription unavailable or today's limit reached — and
 * the rest was answered with the browser's speech recognition). A recorded
 * question always keeps the server's transcript, whatever the browser sends
 * for it. (Only typed ones count towards the typed-XP rule — lib/ielts/submit.ts.)
 */
export function typedAnswersBesides<T extends CheckedSpeakingAnswer>(recorded: { questionIndex: number }[], client: T[]): T[] {
  const taken = new Set(recorded.map((a) => a.questionIndex));
  return client.filter((a) => typeof a.questionIndex === "number" && !taken.has(a.questionIndex) && a.transcript.trim().length > 0);
}
