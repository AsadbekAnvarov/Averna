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

/** How much of the question a SpeakingRecording row keeps. */
export const RECORDED_QUESTION_CHARS = 1000;

/**
 * A recording still answers the set's question at its index — false once the
 * set was edited or reordered after the answer was recorded. The one check
 * for resuming (attemptProgress) and for marking (answersFromRecordings).
 */
export function recordingMatchesQuestion(item: { question: string } | undefined, recordedQuestion: unknown): boolean {
  if (!item || typeof item.question !== "string" || typeof recordedQuestion !== "string") return false;
  const want = normQuestion(item.question.slice(0, RECORDED_QUESTION_CHARS));
  return want.length > 0 && want === normQuestion(recordedQuestion.slice(0, RECORDED_QUESTION_CHARS));
}

/**
 * Longest answer the server accepts, per part, in seconds. The runner's own
 * turn limits are shorter (Part 1 45 s, Part 2 2 min + 20 s follow-up, Part 3 75 s).
 */
export const MAX_ANSWER_SECONDS: Record<SpeakingPart, number> = { 1: 150, 2: 180, 3: 150 };

/** Audio bit rate the recorder asks for (speech-quality Opus / AAC). */
export const RECORDING_BITS_PER_SECOND = 32_000;

/** Highest bit rate an honest recording has: Safari's AAC may ignore the 32 kbps asked for (~128 kbps). */
export const MAX_RECORDING_BITS_PER_SECOND = 128_000;

/** Vercel's request body limit is 4.5 MB; one answer stays below 4 MB (the multipart envelope needs a little). */
const PLATFORM_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;

/**
 * Upload cap for one answer of this part: its longest answer
 * (MAX_ANSWER_SECONDS) at 128 kbps, plus 25 % and 64 KB for the container —
 * Part 1 / 3 ≈ 2.9 MB, Part 2 ≈ 3.5 MB. A bigger file isn't one answer (and
 * would be billed as one by the transcription service).
 */
export function maxUploadBytesFor(part: SpeakingPart): number {
  const bytes = Math.ceil(((MAX_ANSWER_SECONDS[part] * MAX_RECORDING_BITS_PER_SECOND) / 8) * 1.25) + 64 * 1024;
  return Math.min(PLATFORM_UPLOAD_LIMIT_BYTES, bytes);
}

export const MAX_UPLOAD_BYTES_BY_PART: Record<SpeakingPart, number> = {
  1: maxUploadBytesFor(1),
  2: maxUploadBytesFor(2),
  3: maxUploadBytesFor(3),
};

/** The largest per-part cap (the answer route refuses bigger bodies before reading them). */
export const MAX_UPLOAD_BYTES = Math.max(MAX_UPLOAD_BYTES_BY_PART[1], MAX_UPLOAD_BYTES_BY_PART[2], MAX_UPLOAD_BYTES_BY_PART[3]);

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

/** Why recorded answers are off for now although this deployment has them (see SpeakingCapabilities.paused). */
export type RecordingStopCode = "unavailable" | "limit";

/**
 * Upload errors that end recorded answers for the rest of the test: the
 * server can't transcribe right now ("unavailable" — the key, the credit or
 * the database) or the student's recordings for today are used up ("limit").
 * Retrying won't help; the runner carries on with the browser's speech
 * recognition or typing.
 */
export function stopsRecording(code: unknown): code is RecordingStopCode {
  return code === "unavailable" || code === "limit";
}

/**
 * Takes of one question an attempt may save (the server's per-question cap).
 * Past it the answer route refuses with 409 "too-many-takes": that answer
 * isn't recorded again (the runner lets it be typed at the end), but
 * recording goes on for the other questions.
 */
export const MAX_TAKES_PER_QUESTION = 5;

/** A failed upload that "Try uploading again" could fix — not a stop code, and not a question whose takes are used up. */
export function uploadRetryCanHelp(code: unknown): boolean {
  return !stopsRecording(code) && code !== "too-many-takes";
}

/** GET /api/speaking/capabilities */
export interface SpeakingCapabilities {
  /** Answers can be recorded and transcribed on the server (OPENAI_API_KEY, and not paused). */
  serverTranscription: boolean;
  /** The audio files are kept for the teacher (Blob storage + retentionDays > 0, and this month's budget isn't used up). */
  storeAudio: boolean;
  /** Days the audio is kept (SPEAKING_AUDIO_RETENTION_DAYS, default 30; 0 = never kept). */
  retentionDays: number;
  /** Longest accepted answer per part (seconds). */
  maxAnswerSeconds: Record<SpeakingPart, number>;
  /** Upload cap per answer, by part (bytes). */
  maxUploadBytesPerPart: Record<SpeakingPart, number>;
  /** The largest of maxUploadBytesPerPart. */
  maxUploadBytes: number;
  /**
   * Recorded answers are normally on here but not right now (serverTranscription
   * is false meanwhile): "unavailable" — transcription failed for everyone a
   * moment ago; "limit" — this student's recordings for today are used up. A
   * reloaded recorded test still resumes from its saved answers.
   */
  paused?: RecordingStopCode;
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
  | "too-many-takes"
  | "rate-limited"
  | "limit"
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
  const bytes = (o.maxUploadBytesPerPart && typeof o.maxUploadBytesPerPart === "object" ? o.maxUploadBytesPerPart : {}) as Record<string, unknown>;
  const byteCap = (p: SpeakingPart) => (finite(bytes[p]) && bytes[p] > 0 ? (bytes[p] as number) : MAX_UPLOAD_BYTES_BY_PART[p]);
  return {
    serverTranscription: o.serverTranscription,
    storeAudio: o.storeAudio === true,
    retentionDays: finite(o.retentionDays) ? Math.max(0, Math.round(o.retentionDays)) : 0,
    maxAnswerSeconds: { 1: cap(1), 2: cap(2), 3: cap(3) },
    maxUploadBytesPerPart: { 1: byteCap(1), 2: byteCap(2), 3: byteCap(3) },
    maxUploadBytes: finite(o.maxUploadBytes) && o.maxUploadBytes > 0 ? o.maxUploadBytes : MAX_UPLOAD_BYTES,
    ...(stopsRecording(o.paused) ? { paused: o.paused } : {}),
  };
}

/** "30 days" / "1 day". */
export function daysLabel(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}
