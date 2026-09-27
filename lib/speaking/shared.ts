/**
 * Recorded Speaking — what the browser runner, the API routes and the server
 * share: the order of a set's questions, the answer limits and the API shapes.
 *
 * Pure and client-safe (type imports only). The server-side contract
 * (recordingsForTest …) lives in ./recording.ts, which re-exports these.
 */

import type { SpeakingExamSet } from "../ielts/types";

export type SpeakingPart = 1 | 2 | 3;
export type SpeakingQuestionKind = "short" | "long" | "followUp";

export interface SpeakingQuestionItem {
  /** Position in the flattened list — SpeakingRecording.questionIndex. */
  index: number;
  part: SpeakingPart;
  /** short = Part 1 / Part 3 question; long = the Part 2 cue card; followUp = the Part 2 rounding-off question. */
  kind: SpeakingQuestionKind;
  question: string;
  /** Part 1: index of the question's topic in set.part1. */
  topicIndex?: number;
}

/**
 * Every question of a set in the order the examiner asks it:
 * Part 1 questions (topic by topic) → the Part 2 cue card → the Part 2
 * follow-up (when the set has one) → Part 3 questions.
 *
 * The runner asks in exactly this order and uploads each answer under its
 * index; the server derives the part and the question text from the index
 * (never from the client).
 */
export function flattenSpeakingQuestions(set: SpeakingExamSet): SpeakingQuestionItem[] {
  const out: SpeakingQuestionItem[] = [];
  (Array.isArray(set.part1) ? set.part1 : []).forEach((topic, topicIndex) => {
    for (const question of Array.isArray(topic?.questions) ? topic.questions : []) {
      out.push({ index: out.length, part: 1, kind: "short", question, topicIndex });
    }
  });
  out.push({ index: out.length, part: 2, kind: "long", question: set.part2.cue });
  const followUp = set.part2.followUp?.trim();
  if (followUp) out.push({ index: out.length, part: 2, kind: "followUp", question: followUp });
  for (const question of Array.isArray(set.part3?.questions) ? set.part3.questions : []) {
    out.push({ index: out.length, part: 3, kind: "short", question });
  }
  return out;
}

/** Question text normalised for matching ("Why?" ≈ "why"). Same rule as lib/ielts/submit.ts. */
export const normQuestion = (q: string) => q.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Longest answer the server accepts, per part, in seconds. The runner's own
 * turn limits are shorter (Part 1 45 s, Part 2 2 min + 20 s follow-up, Part 3 75 s).
 */
export const MAX_ANSWER_SECONDS: Record<SpeakingPart, number> = { 1: 150, 2: 180, 3: 150 };

/** Upload cap per answer (Vercel's request body limit is 4.5 MB). ~15 min of audio at 32 kbps. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Audio bit rate the recorder asks for (speech-quality Opus / AAC). */
export const RECORDING_BITS_PER_SECOND = 32_000;

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

/** GET /api/speaking/capabilities */
export interface SpeakingCapabilities {
  /** Answers can be recorded and transcribed on the server (OPENAI_API_KEY). */
  serverTranscription: boolean;
  /** The audio files are kept for the teacher (Blob storage + retentionDays > 0). */
  storeAudio: boolean;
  /** Days the audio is kept (SPEAKING_AUDIO_RETENTION_DAYS, default 30; 0 = never kept). */
  retentionDays: number;
  /** Longest accepted answer per part (seconds). */
  maxAnswerSeconds: Record<SpeakingPart, number>;
  maxUploadBytes: number;
}

/** One recorded answer — POST /api/speaking/answer, and each item of GET /api/speaking/progress. */
export interface RecordedAnswer {
  questionIndex: number;
  part: SpeakingPart;
  transcript: string;
  words: number;
  /** Server-measured length of the recording (ms). */
  durationMs: number;
  /** The audio file was kept for the teacher. */
  stored: boolean;
}

/** GET /api/speaking/progress?attemptKey=&setId= */
export interface SpeakingProgress {
  answered: RecordedAnswer[];
  /** The attempt was already submitted (its recordings are final). */
  submitted: boolean;
}

export type SpeakingErrorCode =
  | "auth"
  | "not-student"
  | "unavailable"
  | "bad-request"
  | "unknown-set"
  | "unknown-question"
  | "no-file"
  | "too-large"
  | "unsupported-format"
  | "bad-audio"
  | "submitted"
  | "rate-limited"
  | "transcription-failed"
  | "server";

/** Every error response of the /api/speaking/* routes. */
export interface SpeakingApiError {
  error: string;
  code: SpeakingErrorCode;
  /** 429: seconds to wait before retrying. */
  retryAfterSec?: number;
}

const isPart = (x: unknown): x is SpeakingPart => x === 1 || x === 2 || x === 3;
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Defensive read of a RecordedAnswer (client side). */
export function parseRecordedAnswer(x: unknown): RecordedAnswer | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (!finite(o.questionIndex) || !Number.isInteger(o.questionIndex) || o.questionIndex < 0 || !isPart(o.part)) return null;
  return {
    questionIndex: o.questionIndex,
    part: o.part,
    transcript: typeof o.transcript === "string" ? o.transcript : "",
    words: finite(o.words) ? Math.max(0, Math.round(o.words)) : 0,
    durationMs: finite(o.durationMs) ? Math.max(0, Math.round(o.durationMs)) : 0,
    stored: o.stored === true,
  };
}

/** Defensive read of the capabilities response (client side); null when unusable. */
export function parseCapabilities(x: unknown): SpeakingCapabilities | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.serverTranscription !== "boolean") return null;
  const max = (o.maxAnswerSeconds && typeof o.maxAnswerSeconds === "object" ? o.maxAnswerSeconds : {}) as Record<string, unknown>;
  const cap = (p: SpeakingPart) => (finite(max[p]) && max[p] > 0 ? (max[p] as number) : MAX_ANSWER_SECONDS[p]);
  return {
    serverTranscription: o.serverTranscription,
    storeAudio: o.storeAudio === true,
    retentionDays: finite(o.retentionDays) ? Math.max(0, Math.round(o.retentionDays)) : 0,
    maxAnswerSeconds: { 1: cap(1), 2: cap(2), 3: cap(3) },
    maxUploadBytes: finite(o.maxUploadBytes) && o.maxUploadBytes > 0 ? o.maxUploadBytes : MAX_UPLOAD_BYTES,
  };
}

/** "30 days" / "1 day". */
export function daysLabel(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}
