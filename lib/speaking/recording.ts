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
 *    item of answers.answers[] carries the same `questionIndex`. A row only
 *    counts while its `question` still matches the set's question at that
 *    index (recordingMatchesQuestion — the set may be edited later).
 *  • `audioUrl` is a PUBLIC Blob URL (random suffix) — show it only to people
 *    who may see the student (lib/access canViewStudent). It is set to null
 *    when the audio expires (`expiresAt`, SPEAKING_AUDIO_RETENTION_DAYS, daily
 *    cron → lib/speaking/cleanup.ts); transcripts and metrics stay.
 *  • `metrics` (JSON) is the answer's SpeechMetrics plus `sha256` (of the
 *    uploaded file), when the audio wasn't stored because this month's audio
 *    budget was used up `audioNotKept: "monthly-limit"` (audioNotKeptReason()),
 *    and the take counters (TakeCounters): `takes` (takes of this question
 *    saved under this attempt), `takesDay` ("YYYY-MM-DD", Tashkent) with
 *    `takesToday` (takes saved that day), and `putsMonth` ("YYYY-MM", UTC) with
 *    `putsInMonth` (audio files uploaded for this row that month). Every
 *    accepted take updates them — the same file again doesn't.
 *  • Result page: /learning/speaking-test/result/<IELTSTest id>.
 *
 * ─── Limits (spend and the Hobby Blob allowance) ────────────────────────────
 *  • per answer: MAX_UPLOAD_BYTES_BY_PART — the part's longest answer at 128 kbps;
 *  • per question: MAX_TAKES_PER_QUESTION (5) takes of one question per
 *    attempt → 409 "too-many-takes" (that answer is typed at the end instead;
 *    recording goes on);
 *  • per student: SPEAKING_DAILY_RECORDINGS (default 150) takes per Tashkent
 *    day, re-takes included — the sum of `takesToday` over the student's rows
 *    of today, in the database (the same on every instance) → "limit";
 *  • audio files: SPEAKING_AUDIO_MONTHLY_UPLOADS (default 1500) uploads per
 *    calendar month (UTC) — the sum of `putsInMonth`, replaced takes included;
 *    past it the transcript is kept and the audio isn't;
 *  • transcription that no retry fixes (key rejected, out of credit, model
 *    missing) or a missing table → "unavailable", remembered on this instance
 *    for 10 minutes — the capabilities report recorded answers as paused, so
 *    new tests start with the browser's speech recognition / typing;
 *  • a retried upload of the same file isn't transcribed (billed) again.
 * The sums are raw SQL over the JSON counters; if that query fails they fall
 * back to counting rows (rows saved today / files kept from this month).
 * ────────────────────────────────────────────────────────────────────────────
 */

import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { guardAi } from "@/lib/engine/ai-guard";
import { OpenAiAudioError, audioAiConfigured, transcribeAudio, type Transcription } from "@/lib/openai-audio";
import { blobConfigured, deleteBlobs, putBlob } from "@/lib/storage/blob";
import { wordCount } from "@/lib/ielts/format";
import type { SpeakingExamSet } from "@/lib/ielts/types";
import { tashkentDateKey, tashkentDayStart } from "@/lib/utils";
import { sniffAudio, type AudioFormat } from "./audio-format";
import { cleanTranscription, clipToSeconds, computeSpeechMetrics, type SpeechMetrics } from "./metrics";
import {
  MAX_ANSWER_SECONDS,
  MAX_TAKES_PER_QUESTION,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES_BY_PART,
  RECORDED_QUESTION_CHARS,
  flattenSpeakingQuestions,
  recordingMatchesQuestion,
  type RecordedAnswer,
  type RecordingStopCode,
  type SpeakingCapabilities,
  type SpeakingErrorCode,
  type SpeakingPart,
  type SpeakingProgress,
  type SpeakingQuestionItem,
} from "./shared";

export {
  flattenSpeakingQuestions,
  MAX_ANSWER_SECONDS,
  MAX_TAKES_PER_QUESTION,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES_BY_PART,
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

function envCount(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/**
 * Takes per student per Tashkent day (SPEAKING_DAILY_RECORDINGS, default
 * 150 ≈ 8 full tests). Every accepted take counts — a re-take of a question
 * too — summed from the rows' take counters in the database, so every instance
 * sees the same count.
 */
export function dailyRecordingLimit(): number {
  return envCount("SPEAKING_DAILY_RECORDINGS", 150);
}

/**
 * Audio uploads per calendar month, UTC (SPEAKING_AUDIO_MONTHLY_UPLOADS,
 * default 1500) — every file put in the store counts, also one a later take
 * replaced. Hobby's Blob store allows 2,000 uploads a month and the Listening
 * renders need room too; past the budget answers are still transcribed and
 * marked, only their audio isn't kept. 0 = never store audio.
 */
export function monthlyAudioUploadLimit(): number {
  return envCount("SPEAKING_AUDIO_MONTHLY_UPLOADS", 1500);
}

/** Browsers may keep a played recording this long (seconds) — not the year Blob uses by default: the audio is deleted after retentionDays. */
export const SPEAKING_AUDIO_CACHE_SECONDS = 86_400;

/** Recorded answers keep their audio for the teacher. */
export function audioStorageEnabled(): boolean {
  return blobConfigured() && retentionDays() > 0;
}

// ---------------------------------------------------------------------------
// "Unavailable" — remembered on this instance
// ---------------------------------------------------------------------------

/** How long a failure that no retry fixes switches recorded answers off on this instance. */
export const UNAVAILABLE_FOR_MS = 10 * 60_000;
let unavailableUntil = 0;

/** Transcription can't work right now (key, credit, model or table): new tests start without recording for a while. */
export function markRecordingUnavailable(why: string, now: number = Date.now()): void {
  if (now >= unavailableUntil) console.error(`Recorded Speaking answers are paused for ${UNAVAILABLE_FOR_MS / 60_000} minutes: ${why}`);
  unavailableUntil = now + UNAVAILABLE_FOR_MS;
}

export function recordingUnavailable(now: number = Date.now()): boolean {
  return now < unavailableUntil;
}

/** Prisma: the table (P2021) or one of its columns (P2022) doesn't exist — prisma/sql/deploy.sql wasn't applied. */
export function isMissingTableError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === "P2021" || code === "P2022") return true;
  const message = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return /speaking_recordings/i.test(message) && /does not exist/i.test(message);
}

export type TranscriptionFailure = "unavailable" | "busy" | "bad-audio" | "retry";

/**
 * What a failed transcription means for the answer:
 *  • unavailable — the key is rejected (401 / 403), the model doesn't exist
 *    (404) or the account is out of credit (429 insufficient_quota): nothing
 *    works until an admin fixes it, so the runner stops recording;
 *  • busy — rate limited (any other 429): retry shortly;
 *  • bad-audio — OpenAI refused this file (400 / 413 / 415);
 *  • retry — timeout, network or 5xx.
 */
export function classifyTranscriptionError(e: unknown): TranscriptionFailure {
  if (!(e instanceof OpenAiAudioError)) return "retry";
  const { status } = e;
  if (status === 401 || status === 403 || status === 404) return "unavailable";
  if (status === 429) {
    return e.code === "insufficient_quota" || /insufficient_quota|exceeded your current quota/i.test(e.message) ? "unavailable" : "busy";
  }
  if (status === 400 || status === 413 || status === 415) return "bad-audio";
  return "retry";
}

// ---------------------------------------------------------------------------
// Capabilities, limits and storage
// ---------------------------------------------------------------------------

export function speakingCapabilities(now: number = Date.now()): SpeakingCapabilities {
  const configured = audioAiConfigured();
  const paused = configured && recordingUnavailable(now);
  const serverTranscription = configured && !paused;
  return {
    serverTranscription,
    storeAudio: serverTranscription && audioStorageEnabled(),
    retentionDays: retentionDays(),
    maxAnswerSeconds: { ...MAX_ANSWER_SECONDS },
    maxUploadBytesPerPart: { ...MAX_UPLOAD_BYTES_BY_PART },
    maxUploadBytes: MAX_UPLOAD_BYTES,
    ...(paused ? { paused: "unavailable" as const } : {}),
  };
}

// -- take counters (metrics JSON) ----------------------------------------------

/** The take counters kept in a row's metrics (see the contract). */
export interface TakeCounters {
  /** Takes of this question saved under this attempt (every accepted take; the same file again isn't one). */
  takes: number;
  /** Tashkent day ("YYYY-MM-DD") of the latest take, and the takes saved that day. */
  takesDay: string;
  takesToday: number;
  /** UTC month ("YYYY-MM") of the latest audio upload, and the files uploaded for this row that month. */
  putsMonth?: string;
  putsInMonth?: number;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;
const whole = (x: unknown): number | undefined => (typeof x === "number" && Number.isInteger(x) && x >= 0 ? x : undefined);

/** The counters a row's metrics carry (rows saved before the counters existed have none). */
export function readTakeCounters(metrics: unknown): Partial<TakeCounters> {
  const m = asRec(metrics);
  if (!m) return {};
  const out: Partial<TakeCounters> = {};
  const takes = whole(m.takes);
  if (takes !== undefined) out.takes = takes;
  if (typeof m.takesDay === "string" && DAY_KEY.test(m.takesDay)) {
    out.takesDay = m.takesDay;
    const today = whole(m.takesToday);
    if (today !== undefined) out.takesToday = today;
  }
  if (typeof m.putsMonth === "string" && MONTH_KEY.test(m.putsMonth)) {
    out.putsMonth = m.putsMonth;
    const puts = whole(m.putsInMonth);
    if (puts !== undefined) out.putsInMonth = puts;
  }
  return out;
}

/** Takes a row already has: its counter — or 1 for a row saved before the counters existed; 0 without a row. */
export function takesOf(row: { metrics?: unknown } | null | undefined): number {
  if (!row) return 0;
  return readTakeCounters(row.metrics).takes ?? 1;
}

/** "YYYY-MM" (UTC): the Blob store's upload allowance runs by calendar month. */
export function utcMonthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

/**
 * The counters after one more accepted take. `prev`: the row as it is now
 * (null: the question's first take); `stored`: this take's audio file was
 * uploaded. A take without a file keeps the uploads already counted this month.
 */
export function nextTakeCounters(prev: { metrics?: unknown } | null, o: { now: Date; stored: boolean }): TakeCounters {
  const c = readTakeCounters(prev?.metrics);
  const day = tashkentDateKey(o.now);
  const month = utcMonthKey(o.now);
  const out: TakeCounters = {
    takes: takesOf(prev) + 1,
    takesDay: day,
    takesToday: (c.takesDay === day ? c.takesToday ?? 1 : 0) + 1,
  };
  if (o.stored) {
    out.putsMonth = month;
    out.putsInMonth = (c.putsMonth === month ? c.putsInMonth ?? 1 : 0) + 1;
  } else if (c.putsMonth) {
    out.putsMonth = c.putsMonth;
    if (c.putsInMonth !== undefined) out.putsInMonth = c.putsInMonth;
  }
  return out;
}

/** A raw `SELECT … ::int AS "n"` result as a count (int, bigint, numeric or text, whatever the driver returns). */
function countFrom(rows: unknown): number {
  const v = Array.isArray(rows) && rows.length ? (rows[0] as { n?: unknown } | null)?.n : 0;
  const n = typeof v === "bigint" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// -- the daily and monthly sums --------------------------------------------------

/** Fallback count: rows this student saved today (Tashkent), without the rows the daily clean-up rewrote (expired audio). */
async function rowsSavedToday(studentId: string, now: Date): Promise<number> {
  return db.speakingRecording.count({
    where: {
      studentId,
      updatedAt: { gte: tashkentDayStart(now) },
      // A fresh answer never has a past expiry; the clean-up only touches expired rows.
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}

/**
 * Takes this student saved today (Tashkent): the sum of `takesToday` over their
 * rows whose `takesDay` is today — a row saved before the counters existed
 * counts once if it was saved today. Falls back to counting today's rows when
 * the query fails (a missing table then surfaces from that count).
 */
async function takesToday(studentId: string, now: Date = new Date()): Promise<number> {
  const day = tashkentDateKey(now);
  const dayStart = tashkentDayStart(now).toISOString();
  const at = now.toISOString();
  try {
    // A row with today's takesDay was written today, so "updatedAt" ≥ the day's start holds for every row counted.
    return countFrom(
      await db.$queryRaw`
        SELECT COALESCE(SUM(
          CASE
            WHEN "metrics"->>'takesDay' = ${day} THEN
              CASE WHEN jsonb_typeof("metrics"->'takesToday') = 'number' THEN ("metrics"->>'takesToday')::numeric ELSE 1 END
            WHEN "metrics"->'takesDay' IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > ${at}::timestamp) THEN 1
            ELSE 0
          END
        ), 0)::int AS "n"
        FROM "speaking_recordings"
        WHERE "studentId" = ${studentId} AND "updatedAt" >= ${dayStart}::timestamp`
    );
  } catch (e) {
    if (!isMissingTableError(e)) console.error("Speaking: today's takes couldn't be summed (counting today's answers instead):", e);
    return rowsSavedToday(studentId, now);
  }
}

const monthStartUtc = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** Fallback count: audio files stored this calendar month (UTC) that are still kept. */
async function rowsWithAudioThisMonth(now: Date): Promise<number> {
  return db.speakingRecording.count({ where: { audioUrl: { not: null }, updatedAt: { gte: monthStartUtc(now) } } });
}

/**
 * Audio files uploaded this calendar month (UTC): the sum of `putsInMonth` over
 * the rows whose `putsMonth` is this month — replaced takes and expired files
 * included; a row saved before the counters existed counts once while it keeps
 * a file from this month. Falls back to counting this month's kept files when
 * the query fails.
 */
async function audioUploadsThisMonth(now: Date = new Date()): Promise<number> {
  const month = utcMonthKey(now);
  const monthStart = monthStartUtc(now).toISOString();
  try {
    // A row with this month's putsMonth was written this month, so "updatedAt" ≥ the month's start holds for it.
    return countFrom(
      await db.$queryRaw`
        SELECT COALESCE(SUM(
          CASE
            WHEN "metrics"->>'putsMonth' = ${month} THEN
              CASE WHEN jsonb_typeof("metrics"->'putsInMonth') = 'number' THEN ("metrics"->>'putsInMonth')::numeric ELSE 1 END
            WHEN "metrics"->'putsMonth' IS NULL AND "audioUrl" IS NOT NULL THEN 1
            ELSE 0
          END
        ), 0)::int AS "n"
        FROM "speaking_recordings"
        WHERE "updatedAt" >= ${monthStart}::timestamp`
    );
  } catch (e) {
    if (!isMissingTableError(e)) console.error("Speaking: this month's audio uploads couldn't be summed (counting kept files instead):", e);
    return rowsWithAudioThisMonth(now);
  }
}

/** This month's audio budget is used up. Unknown (the count failed) → not reached: the audio is best effort anyway. */
async function audioBudgetReached(): Promise<boolean> {
  const limit = monthlyAudioUploadLimit();
  if (limit <= 0) return true;
  try {
    return (await audioUploadsThisMonth()) >= limit;
  } catch (e) {
    console.error("The Speaking audio budget couldn't be checked (the audio is kept):", e);
    return false;
  }
}

/**
 * The capabilities for one student (GET /api/speaking/capabilities): also
 * paused when their takes for today are used up (or the table is missing),
 * and no audio is promised once this month's upload budget is reached.
 * Never throws.
 */
export async function speakingCapabilitiesFor(studentId: string | null): Promise<SpeakingCapabilities> {
  const caps = speakingCapabilities();
  if (!caps.serverTranscription) return caps;
  const pausedFor = (paused: RecordingStopCode): SpeakingCapabilities => ({ ...caps, serverTranscription: false, storeAudio: false, paused });
  try {
    const limit = monthlyAudioUploadLimit();
    const [today, uploads] = await Promise.all([
      studentId ? takesToday(studentId) : Promise.resolve(0),
      caps.storeAudio && limit > 0 ? audioUploadsThisMonth() : Promise.resolve(0),
    ]);
    if (today >= dailyRecordingLimit()) return pausedFor("limit");
    return caps.storeAudio && (limit <= 0 || uploads >= limit) ? { ...caps, storeAudio: false } : caps;
  } catch (e) {
    if (isMissingTableError(e)) {
      markRecordingUnavailable("the speaking_recordings table is missing — apply prisma/sql/deploy.sql");
      return pausedFor("unavailable");
    }
    console.error("Speaking capabilities: the recording limits couldn't be checked:", e);
    return caps;
  }
}

/**
 * Speaking audio in the Blob store, for the admin storage meter: `bytes` /
 * `files` of the recordings whose audio is still kept, and `uploadsThisMonth`
 * — this calendar month's (UTC) audio uploads, replaced takes included: the
 * same sum the monthly budget (SPEAKING_AUDIO_MONTHLY_UPLOADS) is checked
 * against. Zeros when the table doesn't exist yet; other database errors are
 * thrown.
 */
export async function speakingStorageUsage(): Promise<{ bytes: number; files: number; uploadsThisMonth: number }> {
  try {
    const [agg, uploadsThisMonth] = await Promise.all([
      db.speakingRecording.aggregate({ where: { audioUrl: { not: null } }, _sum: { audioBytes: true }, _count: { _all: true } }) as Promise<{
        _sum?: { audioBytes?: number | null } | null;
        _count?: { _all?: number | null } | null;
      }>,
      audioUploadsThisMonth(),
    ]);
    const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, x) : 0);
    return { bytes: n(agg?._sum?.audioBytes), files: n(agg?._count?._all), uploadsThisMonth: n(uploadsThisMonth) };
  } catch (e) {
    if (isMissingTableError(e)) return { bytes: 0, files: 0, uploadsThisMonth: 0 };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Reading recordings
// ---------------------------------------------------------------------------

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/** Why a recording has no audio when the server chose not to keep it. */
export type AudioNotKept = "monthly-limit";

/** What saveRecordedAnswer keeps next to the speech metrics (the metrics JSON column). */
function extrasOf(metrics: unknown): { sha256: string | null; audioNotKept: AudioNotKept | null } {
  const m = asRec(metrics);
  return {
    sha256: typeof m?.sha256 === "string" && m.sha256 ? m.sha256 : null,
    audioNotKept: m?.audioNotKept === "monthly-limit" ? "monthly-limit" : null,
  };
}

/** "monthly-limit" when the answer's audio wasn't stored because this month's audio budget was used up; null otherwise. */
export function audioNotKeptReason(metrics: unknown): AudioNotKept | null {
  return extrasOf(metrics).audioNotKept;
}

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
): Promise<{ questionIndex: number; setId: string; question: string; transcript: string; durationMs: number; metrics: unknown }[]> {
  try {
    return await db.speakingRecording.findMany({
      where: { studentId, attemptKey, setId },
      orderBy: { questionIndex: "asc" },
      select: { questionIndex: true, setId: true, question: true, transcript: true, durationMs: true, metrics: true },
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
  const answered = rows.filter((r) => recordingMatchesQuestion(items[r.questionIndex], r.question)).map(toRecordedAnswer);
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

/** 503 "unavailable" — the runner stops recording for the rest of the test (no retry). */
const unavailable = (): SaveAnswerResult => fail(503, "unavailable", "Recorded answers aren't available right now.");

const MISSING_TABLE = "the speaking_recordings table is missing — apply prisma/sql/deploy.sql";

function stopUnavailable(why: string): SaveAnswerResult {
  markRecordingUnavailable(why);
  return unavailable();
}

/** Transcription budget inside the route's 60 s (leaves time for the audio upload and the database). */
const TRANSCRIBE_TIMEOUT_MS = 38_000;
const BLOB_TIMEOUT_MS = 12_000;

function timeoutSignal(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}

// -- retries of the same file (this instance) ---------------------------------

/** Recent transcriptions by student + sha256 of the file: a retried upload isn't billed again. */
const TRANSCRIPTION_TTL_MS = 15 * 60_000;
const TRANSCRIPTION_CACHE_MAX = 64;
const transcriptions = new Map<string, { at: number; value: Promise<Transcription> }>();
/** Saves in progress: an upload retried while the first request still runs waits for it (one bill, one file). */
const saving = new Map<string, Promise<SaveAnswerResult>>();

function cachedTranscription(key: string, now: number): Promise<Transcription> | null {
  const hit = transcriptions.get(key);
  if (!hit) return null;
  if (now - hit.at > TRANSCRIPTION_TTL_MS) {
    transcriptions.delete(key);
    return null;
  }
  return hit.value;
}

function rememberTranscription(key: string, value: Promise<Transcription>, now: number): void {
  transcriptions.delete(key);
  transcriptions.set(key, { at: now, value });
  while (transcriptions.size > TRANSCRIPTION_CACHE_MAX) {
    const oldest = transcriptions.keys().next().value;
    if (oldest === undefined) break;
    transcriptions.delete(oldest);
  }
  // Only successes are kept: a failed transcription is tried again by the retry.
  value.catch(() => {
    if (transcriptions.get(key)?.value === value) transcriptions.delete(key);
  });
}

/** Forget what this instance remembers (tests; a new instance starts empty). */
export function resetRecordingMemory(): void {
  unavailableUntil = 0;
  transcriptions.clear();
  saving.clear();
}

/**
 * One answer: validate the file (per-part size cap, real audio) → the same
 * file again returns the saved answer (not a take) → today's takes, then this
 * question's takes (MAX_TAKES_PER_QUESTION) → transcribe it (prompted with the
 * question; a retry of the same bytes reuses the transcription) → speech
 * metrics from the word timestamps → keep the audio (when enabled and this
 * month's upload budget allows) → write the SpeakingRecording row with the
 * take counters (writeTake; a new take replaces the old file). The question
 * and its part come from the set; the duration from the audio.
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
  if (!audioAiConfigured() || recordingUnavailable()) return unavailable();

  const size = o.file.size;
  if (!size) return fail(400, "no-file", "The recording was empty. Please answer again.");
  if (size > MAX_UPLOAD_BYTES_BY_PART[item.part]) return fail(413, "too-large", "This recording is too long to upload.");
  const buffer = await o.file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const format = sniffAudio(bytes.subarray(0, 64));
  if (!format) return fail(415, "unsupported-format", "This recording format isn't supported.");

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const key = `${o.studentId}\n${o.attemptKey}\n${o.questionIndex}\n${sha256}`;
  const running = saving.get(key);
  if (running) return running;
  const job = saveTake({ ...o, item, buffer, bytes, format, sha256 });
  saving.set(key, job);
  try {
    return await job;
  } finally {
    if (saving.get(key) === job) saving.delete(key);
  }
}

type ExistingRow = {
  part: number;
  question: string;
  setId: string;
  transcript: string;
  words: number;
  durationMs: number;
  audioUrl: string | null;
  metrics: unknown;
};

async function saveTake(o: {
  studentId: string;
  userId: string;
  attemptKey: string;
  set: SpeakingExamSet;
  questionIndex: number;
  item: SpeakingQuestionItem;
  buffer: ArrayBuffer;
  bytes: Uint8Array;
  format: AudioFormat;
  sha256: string;
}): Promise<SaveAnswerResult> {
  const { item, bytes, format, sha256 } = o;
  if (await attemptSubmitted(o.studentId, o.attemptKey)) {
    return fail(409, "submitted", "This test has already been submitted, so its answers can't change.");
  }

  const where = {
    studentId_attemptKey_questionIndex: { studentId: o.studentId, attemptKey: o.attemptKey, questionIndex: o.questionIndex },
  };
  // The first look at the table: a missing one stops here, before OpenAI is paid.
  let existing: ExistingRow | null;
  let today: number;
  try {
    [existing, today] = await Promise.all([
      db.speakingRecording.findUnique({
        where,
        select: { part: true, question: true, setId: true, transcript: true, words: true, durationMs: true, audioUrl: true, metrics: true },
      }) as Promise<ExistingRow | null>,
      takesToday(o.studentId),
    ]);
  } catch (e) {
    if (isMissingTableError(e)) return stopUnavailable(MISSING_TABLE);
    throw e;
  }
  // The same file again (the reply to the first upload was lost): it's saved already — not another take.
  if (existing && existing.setId === o.set.id && recordingMatchesQuestion(item, existing.question) && extrasOf(existing.metrics).sha256 === sha256) {
    return { ok: true, answer: toRecordedAnswer({ ...existing, questionIndex: o.questionIndex }) };
  }
  // Today's takes (re-takes included) are used up: recording stops for the rest of the test.
  if (today >= dailyRecordingLimit()) {
    return fail(429, "limit", "You've reached today's limit for recorded answers. The rest of the test continues without recording.");
  }
  // This question's takes are used up: this answer isn't recorded again (it can be typed at the end).
  if (takesOf(existing) >= MAX_TAKES_PER_QUESTION) {
    return fail(409, "too-many-takes", `This question has already been recorded ${MAX_TAKES_PER_QUESTION} times in this test, so this take wasn't saved.`);
  }

  const cacheKey = `${o.studentId}\n${sha256}`;
  let pending = cachedTranscription(cacheKey, Date.now());
  if (!pending) {
    const guard = guardAi(o.userId, "speaking-answer");
    if (!guard.ok) {
      return fail(429, "rate-limited", guard.message ?? "Too many recordings at once — try again in a moment.", guard.retryAfterSeconds ?? 60);
    }
    pending = transcribeAudio({
      audio: new Blob([o.buffer], { type: format.mime }),
      filename: `answer.${format.ext}`,
      language: "en",
      // The question improves recognition of the topic words (an echo of it alone is dropped below).
      prompt: item.question,
      timeoutMs: TRANSCRIBE_TIMEOUT_MS,
    });
    rememberTranscription(cacheKey, pending, Date.now());
  }

  let t: Transcription;
  try {
    t = await pending;
  } catch (e) {
    switch (classifyTranscriptionError(e)) {
      case "unavailable":
        return stopUnavailable(`transcription failed — ${e instanceof Error ? e.message : String(e)}`);
      case "busy":
        return fail(429, "rate-limited", "The transcription service is busy — retrying shortly.", (e as OpenAiAudioError).retryAfterSec ?? 20);
      case "bad-audio":
        return fail(422, "bad-audio", "We couldn't read this recording.");
      default:
        console.error("Speaking transcription failed:", e);
        return fail(502, "transcription-failed", "We couldn't transcribe this answer yet — retrying.");
    }
  }

  const cap = MAX_ANSWER_SECONDS[item.part];
  const clean = clipToSeconds(cleanTranscription(t, item.question), cap);
  const lastWordEnd = t.words.reduce((m, w) => Math.max(m, w.end), 0);
  // Duration from the audio itself (whisper-1 reports it); estimated from the size for other models.
  const measured = t.durationSec ?? (lastWordEnd > 0 ? lastWordEnd : (bytes.length * 8) / 32_000);
  const durationSec = Math.max(0, Math.min(measured, cap));
  const metrics: SpeechMetrics = computeSpeechMetrics(clean.words, durationSec);
  const transcript = clean.text.slice(0, 4000);
  const words = wordCount(transcript);

  // The audio, for the teacher (best effort: the transcript is what the test is marked from),
  // while this month's audio budget lasts.
  let audioUrl: string | null = null;
  let audioNotKept: AudioNotKept | null = null;
  if (audioStorageEnabled()) {
    if (await audioBudgetReached()) {
      audioNotKept = "monthly-limit";
    } else {
      const bt = timeoutSignal(BLOB_TIMEOUT_MS);
      try {
        const put = await putBlob(`speaking/${o.studentId}/${o.attemptKey}/q${o.questionIndex}.${format.ext}`, bytes, {
          contentType: format.mime,
          cacheMaxAge: SPEAKING_AUDIO_CACHE_SECONDS,
          signal: bt.signal,
        });
        audioUrl = put.url;
      } catch (e) {
        console.error("Speaking audio upload failed (the transcript is kept):", e);
      } finally {
        bt.done();
      }
    }
  }
  const expiresAt = audioUrl ? new Date(Date.now() + retentionDays() * DAY_MS) : null;

  const data = {
    setId: o.set.id,
    part: item.part,
    question: item.question.slice(0, RECORDED_QUESTION_CHARS),
    transcript,
    words,
    durationMs: Math.round(durationSec * 1000),
    audioUrl,
    audioBytes: audioUrl ? bytes.length : 0,
    mimeType: format.mime,
    expiresAt,
  };
  let replaced: string | null;
  try {
    replaced = await writeTake({
      where,
      key: { studentId: o.studentId, attemptKey: o.attemptKey, questionIndex: o.questionIndex },
      data,
      // The speech metrics, the file's hash (the same bytes again return this answer) and why no audio was kept;
      // writeTake adds the take counters.
      metrics: { ...metrics, sha256, ...(audioNotKept ? { audioNotKept } : {}) },
      stored: !!audioUrl,
    });
  } catch (e) {
    if (audioUrl) await deleteBlobs([audioUrl]); // don't leave an unreferenced file behind
    if (isMissingTableError(e)) return stopUnavailable(MISSING_TABLE);
    throw e;
  }
  // A new take replaces the old one: its file goes (the old audio no longer matches the transcript).
  if (replaced && replaced !== audioUrl) await deleteBlobs([replaced]);

  return {
    ok: true,
    answer: { questionIndex: o.questionIndex, part: item.part, transcript, words, durationMs: data.durationMs, stored: !!audioUrl },
  };
}

type RowState = { audioUrl: string | null; metrics: unknown; updatedAt: Date } | null;

/** Compare-and-set rounds before a take is written regardless (several takes of one question at the same moment). */
const WRITE_ROUNDS = 3;

const isUniqueViolation = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

/**
 * Write one accepted take, its counters (nextTakeCounters) counted on top of
 * the row as it is at that moment: the row is created, or updated only while
 * it is unchanged since it was read (compare-and-set on updatedAt) — so takes
 * of one question saved at the same time each count, and each replaced file is
 * the one that was really replaced. After WRITE_ROUNDS lost races the take is
 * written anyway (last write wins). Returns the audio URL of the take it
 * replaced (null for a first take).
 */
async function writeTake(o: {
  where: { studentId_attemptKey_questionIndex: { studentId: string; attemptKey: string; questionIndex: number } };
  key: { studentId: string; attemptKey: string; questionIndex: number };
  /** The take's columns, metrics aside. */
  data: Record<string, unknown>;
  /** The take's metrics, the counters aside. */
  metrics: Record<string, unknown>;
  /** This take's audio file was uploaded (counted in putsInMonth). */
  stored: boolean;
}): Promise<string | null> {
  const read = async (): Promise<RowState> =>
    ((await db.speakingRecording.findUnique({ where: o.where, select: { audioUrl: true, metrics: true, updatedAt: true } })) ?? null) as RowState;
  const counted = (prev: RowState, now: Date) =>
    ({ ...o.metrics, ...nextTakeCounters(prev, { now, stored: o.stored }) }) as unknown as Prisma.InputJsonValue;
  for (let round = 0; round < WRITE_ROUNDS; round++) {
    const prev = await read();
    const now = new Date();
    if (!prev) {
      try {
        await db.speakingRecording.create({ data: { ...o.key, ...o.data, metrics: counted(null, now) } });
        return null;
      } catch (e) {
        if (isUniqueViolation(e)) continue; // another take created the row meanwhile: count this one on top of it
        throw e;
      }
    }
    // Strictly later than the row's stamp, so a write in the same millisecond still changes it.
    const stamp = new Date(Math.max(now.getTime(), new Date(prev.updatedAt).getTime() + 1));
    const r = (await db.speakingRecording.updateMany({
      where: { ...o.key, updatedAt: prev.updatedAt },
      data: { ...o.data, metrics: counted(prev, now), updatedAt: stamp },
    })) as { count?: number } | null;
    if ((r?.count ?? 0) > 0) return prev.audioUrl;
  }
  const prev = await read();
  const now = new Date();
  await db.speakingRecording.upsert({
    where: o.where,
    create: { ...o.key, ...o.data, metrics: counted(null, now) },
    update: { ...o.data, metrics: counted(prev, now) },
  });
  return prev?.audioUrl ?? null;
}
