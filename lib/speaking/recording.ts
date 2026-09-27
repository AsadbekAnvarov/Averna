/**
 * Recorded Speaking answers (SpeakingRecording) — SERVER ONLY.
 *
 * ─── Contract for other modules ─────────────────────────────────────────────
 *  • A Speaking attempt whose answers were recorded and transcribed on the
 *    server is an IELTSTest row (module SPEAKING, answers.format "exam-v2")
 *    with `answers.recorded === true` and `answers.recordingKey` (string) — the
 *    runner's attempt id: the practice attempt id, or "<mockAttemptId>-S".
 *  • Its recordings are
 *      db.speakingRecording.findMany({
 *        where: { studentId, attemptKey: answers.recordingKey },
 *        orderBy: { questionIndex: "asc" },
 *      })
 *    — exactly what `recordingsForTest(row)` returns.
 *  • `questionIndex` is the question's position in flattenSpeakingQuestions(set)
 *    (Part 1 questions → Part 2 cue → Part 2 follow-up if any → Part 3); each
 *    item of answers.answers[] carries the same `questionIndex`.
 *  • `audioUrl` is a PUBLIC Blob URL (random suffix) — show it only to people
 *    who may see the student (lib/access canViewStudent). It is set to null
 *    when the audio expires (`expiresAt`, SPEAKING_AUDIO_RETENTION_DAYS, daily
 *    cron → lib/speaking/cleanup.ts); transcripts and metrics stay.
 *  • Result page: /learning/speaking-test/result/<IELTSTest id>.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { guardAi } from "@/lib/engine/ai-guard";
import { OpenAiAudioError, audioAiConfigured, transcribeAudio, type Transcription } from "@/lib/openai-audio";
import { blobConfigured, deleteBlobs, putBlob } from "@/lib/storage/blob";
import { wordCount } from "@/lib/ielts/format";
import type { SpeakingExamSet } from "@/lib/ielts/types";
import { sniffAudio } from "./audio-format";
import { cleanTranscription, clipToSeconds, computeSpeechMetrics, type SpeechMetrics } from "./metrics";
import {
  MAX_ANSWER_SECONDS,
  MAX_UPLOAD_BYTES,
  flattenSpeakingQuestions,
  type RecordedAnswer,
  type SpeakingCapabilities,
  type SpeakingErrorCode,
  type SpeakingPart,
  type SpeakingProgress,
} from "./shared";

export {
  flattenSpeakingQuestions,
  MAX_ANSWER_SECONDS,
  MAX_UPLOAD_BYTES,
  type RecordedAnswer,
  type SpeakingCapabilities,
  type SpeakingProgress,
  type SpeakingQuestionItem,
} from "./shared";

const DAY_MS = 86_400_000;
const DEFAULT_RETENTION_DAYS = 30;

/** Days the audio files are kept (SPEAKING_AUDIO_RETENTION_DAYS, default 30; 0 = don't keep audio). */
export function retentionDays(): number {
  const raw = process.env.SPEAKING_AUDIO_RETENTION_DAYS;
  if (raw == null || String(raw).trim() === "") return DEFAULT_RETENTION_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.min(3650, Math.floor(n)) : DEFAULT_RETENTION_DAYS;
}

/** Recorded answers keep their audio for the teacher. */
export function audioStorageEnabled(): boolean {
  return blobConfigured() && retentionDays() > 0;
}

export function speakingCapabilities(): SpeakingCapabilities {
  const serverTranscription = audioAiConfigured();
  return {
    serverTranscription,
    storeAudio: serverTranscription && audioStorageEnabled(),
    retentionDays: retentionDays(),
    maxAnswerSeconds: { ...MAX_ANSWER_SECONDS },
    maxUploadBytes: MAX_UPLOAD_BYTES,
  };
}

// ---------------------------------------------------------------------------
// Reading recordings
// ---------------------------------------------------------------------------

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/** A SpeakingRecording row as the pages read it. */
export interface SpeakingRecordingRow {
  id: string;
  studentId: string;
  attemptKey: string;
  setId: string;
  part: number;
  questionIndex: number;
  question: string;
  transcript: string;
  words: number;
  durationMs: number;
  audioUrl: string | null;
  audioBytes: number;
  mimeType: string | null;
  metrics: unknown;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** answers.recordingKey of a recorded Speaking IELTSTest row, or null. */
export function recordingKeyOf(answers: unknown): string | null {
  const key = asRec(answers)?.recordingKey;
  return typeof key === "string" && key.length > 0 ? key : null;
}

/**
 * The recordings of a recorded Speaking attempt (see the contract above); []
 * for any other row, or when the recordings can't be read.
 */
export async function recordingsForTest(row: { studentId: string; answers: unknown }): Promise<SpeakingRecordingRow[]> {
  const attemptKey = recordingKeyOf(row.answers);
  if (!attemptKey) return [];
  try {
    return await db.speakingRecording.findMany({
      where: { studentId: row.studentId, attemptKey },
      orderBy: { questionIndex: "asc" },
    });
  } catch (e) {
    console.error("Speaking recordings unavailable:", e);
    return [];
  }
}

/** The rows submitSpeakingTest builds a recorded attempt from ([] when the table can't be read). */
export async function loadAttemptRecordings(
  studentId: string,
  attemptKey: string,
  setId: string
): Promise<{ questionIndex: number; setId: string; transcript: string; durationMs: number; metrics: unknown }[]> {
  try {
    return await db.speakingRecording.findMany({
      where: { studentId, attemptKey, setId },
      orderBy: { questionIndex: "asc" },
      select: { questionIndex: true, setId: true, transcript: true, durationMs: true, metrics: true },
    });
  } catch (e) {
    console.error("Speaking recordings unavailable:", e);
    return [];
  }
}

/** True when this attempt has at least one recorded answer with speech. */
export async function hasRecordedSpeech(studentId: string, attemptKey: string, setId: string): Promise<boolean> {
  try {
    const n = await db.speakingRecording.count({ where: { studentId, attemptKey, setId, words: { gt: 0 } } });
    return n > 0;
  } catch {
    return false;
  }
}

/** A recorded attempt under this key was already submitted — its recordings are final. */
export async function attemptSubmitted(studentId: string, attemptKey: string): Promise<boolean> {
  try {
    const row = await db.iELTSTest.findFirst({
      where: { studentId, module: "SPEAKING", answers: { path: ["recordingKey"], equals: attemptKey } },
      select: { id: true },
    });
    return !!row;
  } catch {
    return false;
  }
}

function toRecordedAnswer(r: {
  questionIndex: number;
  part: number;
  transcript: string;
  words: number;
  durationMs: number;
  audioUrl: string | null;
}): RecordedAnswer {
  return {
    questionIndex: r.questionIndex,
    part: (r.part === 2 || r.part === 3 ? r.part : 1) as SpeakingPart,
    transcript: r.transcript,
    words: r.words,
    durationMs: r.durationMs,
    stored: !!r.audioUrl,
  };
}

/** What this attempt already has on the server (the runner resumes from it). */
export async function attemptProgress(studentId: string, attemptKey: string, set: SpeakingExamSet): Promise<SpeakingProgress> {
  const items = flattenSpeakingQuestions(set);
  const [rows, submitted] = await Promise.all([
    db.speakingRecording.findMany({
      where: { studentId, attemptKey, setId: set.id },
      orderBy: { questionIndex: "asc" },
      select: { questionIndex: true, part: true, question: true, transcript: true, words: true, durationMs: true, audioUrl: true },
    }) as Promise<{ questionIndex: number; part: number; question: string; transcript: string; words: number; durationMs: number; audioUrl: string | null }[]>,
    attemptSubmitted(studentId, attemptKey),
  ]);
  // Only rows that still match the set's question at that position.
  const answered = rows.filter((r) => items[r.questionIndex]?.question === r.question).map(toRecordedAnswer);
  return { answered, submitted };
}

// ---------------------------------------------------------------------------
// Saving one recorded answer
// ---------------------------------------------------------------------------

export type SaveAnswerResult =
  | { ok: true; answer: RecordedAnswer }
  | { ok: false; status: number; error: string; code: SpeakingErrorCode; retryAfterSec?: number };

const fail = (status: number, code: SpeakingErrorCode, error: string, retryAfterSec?: number): SaveAnswerResult => ({
  ok: false,
  status,
  code,
  error,
  ...(retryAfterSec ? { retryAfterSec } : {}),
});

/** Transcription budget inside the route's 60 s (leaves time for the audio upload and the database). */
const TRANSCRIBE_TIMEOUT_MS = 38_000;
const BLOB_TIMEOUT_MS = 12_000;

function timeoutSignal(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

/**
 * One answer: validate the file → transcribe it (prompted with the question)
 * → speech metrics from the word timestamps → keep the audio (when enabled)
 * → upsert the SpeakingRecording row (a new take replaces the old file).
 * The question and its part come from the set; the duration from the audio.
 */
export async function saveRecordedAnswer(o: {
  studentId: string;
  userId: string;
  attemptKey: string;
  set: SpeakingExamSet;
  questionIndex: number;
  file: Blob;
}): Promise<SaveAnswerResult> {
  const item = flattenSpeakingQuestions(o.set)[o.questionIndex];
  if (!item) return fail(400, "unknown-question", "This question isn't part of the test.");
  if (!audioAiConfigured()) return fail(503, "unavailable", "Recorded answers aren't available right now.");

  const size = o.file.size;
  if (!size) return fail(400, "no-file", "The recording was empty. Please answer again.");
  if (size > MAX_UPLOAD_BYTES) return fail(413, "too-large", "This recording is too long to upload.");
  const bytes = new Uint8Array(await o.file.arrayBuffer());
  const format = sniffAudio(bytes.subarray(0, 64));
  if (!format) return fail(415, "unsupported-format", "This recording format isn't supported.");

  if (await attemptSubmitted(o.studentId, o.attemptKey)) {
    return fail(409, "submitted", "This test has already been submitted, so its answers can't change.");
  }

  const guard = guardAi(o.userId, "speaking-answer");
  if (!guard.ok) {
    return fail(429, "rate-limited", guard.message ?? "Too many recordings at once — try again in a moment.", guard.retryAfterSeconds ?? 60);
  }

  let t: Transcription;
  try {
    t = await transcribeAudio({
      audio: new Blob([bytes], { type: format.mime }),
      filename: `answer.${format.ext}`,
      language: "en",
      // The question improves recognition of the topic words (an echo of it alone is dropped below).
      prompt: item.question,
      timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof OpenAiAudioError) {
      if (e.status === 429) return fail(429, "rate-limited", "The transcription service is busy — retrying shortly.", e.retryAfterSec ?? 20);
      if (e.status === 400 || e.status === 413 || e.status === 415) {
        return fail(422, "bad-audio", "We couldn't read this recording.");
      }
      if (e.status === 401 || e.status === 403) {
        console.error("Speaking transcription is misconfigured:", e.message);
        return fail(503, "unavailable", "Recorded answers aren't available right now.");
      }
    }
    console.error("Speaking transcription failed:", e);
    return fail(502, "transcription-failed", "We couldn't transcribe this answer yet — retrying.");
  }

  const cap = MAX_ANSWER_SECONDS[item.part];
  const clean = clipToSeconds(cleanTranscription(t, item.question), cap);
  const lastWordEnd = t.words.reduce((m, w) => Math.max(m, w.end), 0);
  // Duration from the audio itself (whisper-1 reports it); estimated from the size for other models.
  const measured = t.durationSec ?? (lastWordEnd > 0 ? lastWordEnd : (size * 8) / 32_000);
  const durationSec = Math.max(0, Math.min(measured, cap));
  const metrics: SpeechMetrics = computeSpeechMetrics(clean.words, durationSec);
  const transcript = clean.text.slice(0, 4000);
  const words = wordCount(transcript);

  // The audio, for the teacher (best effort: the transcript is what the test is marked from).
  let audioUrl: string | null = null;
  if (audioStorageEnabled()) {
    const bt = timeoutSignal(BLOB_TIMEOUT_MS);
    try {
      const put = await putBlob(`speaking/${o.studentId}/${o.attemptKey}/q${o.questionIndex}.${format.ext}`, bytes, {
        contentType: format.mime,
        signal: bt.signal,
      });
      audioUrl = put.url;
    } catch (e) {
      console.error("Speaking audio upload failed (the transcript is kept):", e);
    } finally {
      bt.done();
    }
  }
  const expiresAt = audioUrl ? new Date(Date.now() + retentionDays() * DAY_MS) : null;

  const where = {
    studentId_attemptKey_questionIndex: { studentId: o.studentId, attemptKey: o.attemptKey, questionIndex: o.questionIndex },
  };
  const previous = (await db.speakingRecording.findUnique({ where, select: { audioUrl: true } }).catch(() => null)) as {
    audioUrl: string | null;
  } | null;
  const data = {
    setId: o.set.id,
    part: item.part,
    question: item.question.slice(0, 1000),
    transcript,
    words,
    durationMs: Math.round(durationSec * 1000),
    audioUrl,
    audioBytes: audioUrl ? size : 0,
    mimeType: format.mime,
    metrics: metrics as unknown as Prisma.InputJsonValue,
    expiresAt,
  };
  try {
    await db.speakingRecording.upsert({
      where,
      create: { studentId: o.studentId, attemptKey: o.attemptKey, questionIndex: o.questionIndex, ...data },
      update: data,
    });
  } catch (e) {
    if (audioUrl) await deleteBlobs([audioUrl]); // don't leave an unreferenced file behind
    throw e;
  }
  // A new take replaces the old one: its file goes (the old audio no longer matches the transcript).
  if (previous?.audioUrl && previous.audioUrl !== audioUrl) await deleteBlobs([previous.audioUrl]);

  return {
    ok: true,
    answer: { questionIndex: o.questionIndex, part: item.part, transcript, words, durationMs: data.durationMs, stored: !!audioUrl },
  };
}
