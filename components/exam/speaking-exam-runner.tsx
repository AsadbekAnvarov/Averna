"use client";

/**
 * CD-IELTS Speaking test simulator — Parts 1–3 with a voiced examiner.
 *
 * Speaking is a conversation, so this runner doesn't use ExamShell: it is a
 * calm full-screen stage where the examiner (speech synthesis, one British
 * voice) asks every question and the candidate's answer is recorded
 * automatically (speech recognition → transcript). Timings follow the real
 * test: Part 1 answers up to 45 s, one minute to prepare Part 2 and up to two
 * minutes to speak, Part 3 answers up to 75 s. Without speech recognition the
 * candidate types instead — the same timing rules apply.
 *
 * Recorded mode — when the server can transcribe (/api/speaking/capabilities)
 * and the browser can record: every answer is recorded (lib/ielts/recorder.ts,
 * a level meter instead of the live transcript) and uploaded in a background
 * queue to /api/speaking/answer, which transcribes it and keeps the audio for
 * the teacher. The test flows on while answers upload; the final submission
 * waits for the queue. A reloaded test (practice or mock) continues from the
 * first unanswered question (/api/speaking/progress). Answer i is question i
 * of flattenSpeakingQuestions(set) — the order this runner asks in. When the
 * server stops taking recordings ("unavailable": transcription is down;
 * "limit": today's recordings are used up) — or two answers have run out of
 * retries on ordinary errors (5xx, timeouts: a plain outage) — the rest of
 * the test uses the browser's speech recognition (or typing), and every answer
 * whose upload failed can be typed at the end before submitting — nothing is
 * lost. A question recorded too often in this attempt ("too-many-takes") is
 * typed at the end too, while recording goes on. When the final wait for the
 * uploads drags on (about a minute), the candidate can stop waiting and type
 * every answer that isn't saved yet.
 *
 * Mock mode hands the transcripts to `onSubmit`; practice mode posts them to
 * /api/learning/speaking/test and shows the assessment.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Info,
  Keyboard,
  Loader2,
  Mic,
  NotebookPen,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionOutcomeCard } from "@/components/progression/session-outcome";
import { cn } from "@/lib/utils";
import type { SpeakingExamSet } from "@/lib/ielts/types";
import {
  Recorder,
  isRecognitionSupported,
  isSpeechSynthesisSupported,
  prepareExaminerVoice,
  primeSpeech,
  speak,
  stopSpeaking,
  type ExaminerVoiceInfo,
  type LiveTranscript,
  type RecorderErrorCode,
} from "@/lib/ielts/speech-recognition";
import { AnswerRecorder, isRecordingSupported, recorderProblemOf, type RecordedTake, type RecorderProblem } from "@/lib/ielts/recorder";
import { extensionForMime } from "@/lib/speaking/audio-format";
import {
  daysLabel,
  flattenSpeakingQuestions,
  parseCapabilities,
  parseRecordedAnswer,
  stopsRecording,
  uploadRetryCanHelp,
  type RecordedAnswer,
  type RecordingStopCode,
  type SpeakingCapabilities,
  type SpeakingQuestionItem,
} from "@/lib/speaking/shared";
import {
  OUTAGE_AFTER_EXHAUSTED,
  UploadQueue,
  countsTowardOutage,
  type UploadAttempt,
  type UploadFailure,
  type UploadJob,
  type UploadSnapshot,
} from "@/lib/speaking/upload-queue";
import { formatClock, useLeaveGuard } from "./use-exam";
import type { SpeakingAnswer, SpeakingExamRunnerProps, SpeakingTestResult, SpeakingTestSubmission } from "./types";

// ---------------------------------------------------------------------------
// Script & timings
// ---------------------------------------------------------------------------

type Part = 1 | 2 | 3;
type InputMode = SpeakingTestSubmission["inputMode"];
type EndReason = "next" | "timeout" | "cancel";

/** One question as the examiner asks it — `index` is its place in flattenSpeakingQuestions(set). */
type TurnItem = SpeakingQuestionItem;

/** What is happening on the stage right now. */
type Activity =
  | { kind: "idle" }
  | { kind: "examiner"; text: string }
  | { kind: "prep"; startedAt: number; endsAt: number }
  | { kind: "turn"; item: TurnItem; startedAt: number; min: number; max: number }
  | { kind: "saving"; item: TurnItem };

interface TurnHandle {
  item: TurnItem;
  startedAt: number;
  min: number;
  max: number;
  /** The speech recogniser was started for this turn. */
  recording: boolean;
  /** Recorded mode: the answer recorder was started for this turn. */
  recorded: boolean;
  /** Recognition / recording failed during this turn and the candidate finished it by typing. */
  typedFallback: boolean;
  ending: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  resolve: (reason: EndReason) => void;
}

interface PrepHandle {
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
}

type View = "intro" | "test" | "end";
type MicState = "unknown" | "checking" | "ready" | "blocked" | "missing" | "busy" | "failed" | "unsupported";
/** uploading / upload-failed: recorded mode, waiting for the answer uploads before submitting. */
type SubmitState = "idle" | "uploading" | "upload-failed" | "submitting" | "submitted" | "error" | "empty";
type OrbState = "speaking" | "listening" | "thinking" | "idle";

interface Capabilities {
  recognition: boolean;
  tts: boolean;
  media: boolean;
}

/** Seconds — the real test's timings. */
const TIMING = {
  minAnswer: 3,
  part1Max: 45,
  followUpMax: 20,
  part3Max: 75,
  prep: 60,
  longMax: 120,
  longMinMock: 60,
  longMinPractice: 30,
} as const;

const LINES = {
  /** Follows a time-of-day greeting ("Good morning." / "Good afternoon." / "Good evening."). */
  part1: "My name is Averna and I'll be your examiner today. In this first part, I'd like to ask you some questions about yourself.",
  topic: (topic: string) => `Let's talk about ${topic}.`,
  part2:
    "Now I'm going to give you a topic and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish.",
  part2Go:
    "All right? Remember you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?",
  part2Stop: "Thank you.",
  part3: (theme: string) =>
    `We've been talking about ${theme}, and I'd now like to discuss with you one or two more general questions related to this.`,
  end: "Thank you. That is the end of the speaking test.",
  soundCheck: "Hello. I'm Averna, your examiner. Can you hear me clearly?",
  /** A reloaded recorded test picking up where it stopped. */
  welcomeBack: "Welcome back. Let's carry on from where we stopped.",
};

const PART_INFO: Record<Part, { name: string; time: string; about: string }> = {
  1: { name: "Introduction and interview", time: "4–5 min", about: "Short questions about you and familiar topics." },
  2: { name: "Long turn", time: "3–4 min", about: "One minute to prepare, then talk for up to two minutes about a task card." },
  3: { name: "Discussion", time: "4–5 min", about: "Broader questions linked to the Part 2 topic." },
};

const CRITERIA = [
  { key: "fluency", label: "Fluency & Coherence" },
  { key: "lexical", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" },
  { key: "pronunciation", label: "Pronunciation" },
] as const;

const TYPED_FALLBACK = "Your browser can't transcribe speech — type what you would say; the timing rules still apply";
const KEEP_TYPING = "Type what you would say for the rest of the test — the timing rules still apply.";

const RECOGNITION_LOST: Record<RecorderErrorCode, string> = {
  "not-allowed": `Microphone access was blocked, so your speech can't be transcribed. ${KEEP_TYPING}`,
  "audio-capture": `We lost your microphone. ${KEEP_TYPING}`,
  network: `Speech transcription isn't responding — it needs an internet connection, and some browsers block it. ${KEEP_TYPING}`,
  "language-not-supported": `Your browser can't transcribe British English. ${KEEP_TYPING}`,
  "not-supported": `Your browser stopped transcribing speech. ${KEEP_TYPING}`,
  unknown: `Your browser stopped transcribing speech. ${KEEP_TYPING}`,
};

const MIC_PROBLEM: Record<"blocked" | "missing" | "busy" | "failed", { title: string; detail: string }> = {
  blocked: {
    title: "Microphone access is blocked.",
    detail: "Allow the microphone for this site (use the icon in the address bar), then check again.",
  },
  missing: { title: "No microphone was found.", detail: "Connect a microphone or headset, then check again." },
  busy: { title: "Your microphone is busy.", detail: "Another app or tab is using it. Close it, then check again." },
  failed: { title: "Your microphone couldn't start.", detail: "Check that it's connected and allowed for this site, then check again." },
};

const KEEP_TYPING_RECORDED = "Type what you would say for now — the answers already recorded are kept.";

/** Recorded mode: the microphone went away mid-test. */
const RECORDING_LOST: Record<RecorderProblem, string> = {
  "not-allowed": `Microphone access was blocked, so your answers can't be recorded. ${KEEP_TYPING_RECORDED}`,
  "no-device": `We lost your microphone. ${KEEP_TYPING_RECORDED}`,
  busy: `Another app took over your microphone. ${KEEP_TYPING_RECORDED}`,
  "not-supported": `Your browser stopped recording. ${KEEP_TYPING_RECORDED}`,
  unknown: `Recording stopped unexpectedly. ${KEEP_TYPING_RECORDED}`,
};

/** Why recording stopped mid-test (the server's answer to an upload). */
const STOPPED_WHY: Record<RecordingStopCode, string> = {
  unavailable: "Recorded answers aren't available right now.",
  limit: "You've reached today's limit for recorded answers.",
};

/** Recorded mode: the server stopped taking recordings — what happens for the rest of the test. */
const RECORDING_STOPPED: Record<"speech" | "typed", string> = {
  speech: "From the next question, your browser transcribes your answers as you speak. Answers that weren't saved can be typed at the end.",
  typed: "From the next question, type what you would say — the timing rules still apply. Answers that weren't saved can be typed at the end.",
};

/** The intro, when recorded answers are paused on the server. */
const RECORDING_PAUSED: Record<RecordingStopCode, string> = {
  unavailable: "Recorded answers aren't available right now, so this test uses your browser's speech recognition — or typing — instead.",
  limit: "You've reached today's limit for recorded answers, so this test uses your browser's speech recognition — or typing — instead.",
};

/** Longer than the answer route's 60 s, so a slow transcription isn't cut off and retried twice. */
const UPLOAD_TIMEOUT_MS = 75_000;
/** The end screen waits this long for the uploads before offering to stop waiting and type the rest. */
const UPLOAD_WAIT_OFFER_MS = 60_000;
/** What an upload stopped by "Stop waiting" reports (the typing step shows it). */
const WAIT_STOPPED: UploadFailure = { message: "Uploading was taking too long, so it was stopped.", code: "cancelled" };
/** How long the intro waits for the server's capabilities before using the browser's own recognition. */
const CAPABILITIES_TIMEOUT_MS = 8000;

const EMPTY_LIVE: LiveTranscript = { final: "", interim: "" };
const CANCELLED = Symbol("speaking-test-cancelled");
/** Space / Enter on these keep their native meaning instead of "Next". */
const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY", "OPTION", "LABEL"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

/** Words that keep their capital letter mid-sentence. */
const PROPER_WORD =
  /^(I|I'm|I've|English|British|IELTS|TV|Internet|Uzbek|Uzbekistan|Tashkent|Christmas|Ramadan|Navruz|Nowruz|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;

/** "Your Hometown" → "your hometown", so a topic reads naturally mid-sentence (acronyms and names are kept). */
function inSentence(phrase: string): string {
  const words = phrase.trim().replace(/[.!?:;,]+$/, "").split(/\s+/).filter(Boolean);
  if (!words.length) return phrase.trim();
  const lower = (w: string) => (/^[A-Z][a-z'’-]*$/.test(w) && !PROPER_WORD.test(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w);
  const titleCase = words.length > 1 && words.filter((w) => w.length > 3).every((w) => /^[A-Z]/.test(w));
  return words.map((w, i) => (i === 0 || titleCase ? lower(w) : w)).join(" ");
}

function countWords(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Time to read an examiner line on screen when the voice can't play. */
const readingMs = (text: string) => Math.min(9000, 1400 + countWords(text) * 280);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

const fmtBand = (b: number) => (Number.isFinite(b) ? b.toFixed(1) : "–");
/** The saved attempt's result page (answers, recordings, the teacher's review). */
const speakingResultHref = (testId: string) => `/learning/speaking-test/result/${encodeURIComponent(testId)}`;
const isStr = (v: unknown): v is string => typeof v === "string";
const numOr = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

function errorText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const e = (data as { error?: unknown }).error;
  return isStr(e) ? e : "";
}

/** Defensive read of the practice route's response (never crash the result view). */
function parseResult(data: unknown): SpeakingTestResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.band !== "number" || !Number.isFinite(d.band)) return null;
  const band = d.band;
  const c = (d.criteria && typeof d.criteria === "object" ? d.criteria : {}) as Record<string, unknown>;
  const perPart: SpeakingTestResult["perPart"] = Array.isArray(d.perPart)
    ? d.perPart.flatMap((raw): SpeakingTestResult["perPart"] => {
        const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const part = x.part;
        return part === 1 || part === 2 || part === 3 ? [{ part, words: numOr(x.words, 0), seconds: numOr(x.seconds, 0) }] : [];
      })
    : [];
  return {
    testId: isStr(d.testId) ? d.testId : "",
    band,
    criteria: {
      fluency: numOr(c.fluency, band),
      lexical: numOr(c.lexical, band),
      grammar: numOr(c.grammar, band),
      pronunciation: typeof c.pronunciation === "number" && Number.isFinite(c.pronunciation) ? c.pronunciation : null,
    },
    feedback: Array.isArray(d.feedback) ? d.feedback.filter(isStr) : [],
    perPart,
    xpAwarded: numOr(d.xpAwarded, 0),
    xpNotes: Array.isArray(d.xpNotes) ? d.xpNotes.filter(isStr) : [],
    outcome: (d.outcome as SpeakingTestResult["outcome"]) ?? null,
    assessedBy: d.assessedBy === "ai" ? "ai" : "heuristic",
  };
}

/** GET a JSON endpoint; null on any failure (the runner then keeps its browser-only flow). */
async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-store", signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Uploads one recorded answer to /api/speaking/answer (the queue retries what's retryable).
 * `onStop`: the server stopped taking recordings ("unavailable" / "limit") — never retried.
 */
function uploadSender(attemptKey: string, setId: string, onStop: (code: RecordingStopCode) => void) {
  return async (job: UploadJob, signal: AbortSignal): Promise<UploadAttempt<RecordedAnswer>> => {
    const form = new FormData();
    form.append("file", job.blob, job.filename);
    form.append("attemptKey", attemptKey);
    form.append("setId", setId);
    form.append("questionIndex", String(job.index));
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    signal.addEventListener("abort", onAbort);
    const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const res = await fetch("/api/speaking/answer", { method: "POST", body: form, credentials: "same-origin", signal: ctrl.signal });
      const data: unknown = await res.json().catch(() => null);
      if (res.ok) {
        const answer = parseRecordedAnswer(data);
        return answer ? { ok: true, value: answer } : { ok: false, retryable: true, message: "The server's reply couldn't be read." };
      }
      const d = (data && typeof data === "object" ? data : {}) as { code?: unknown; retryAfterSec?: unknown };
      if (stopsRecording(d.code)) {
        // Transcription is down or today's limit is used up: the rest of the test goes on without recording.
        onStop(d.code);
        return { ok: false, retryable: false, message: errorText(data) || "Recorded answers aren't available right now.", code: d.code };
      }
      const retryAfter = numOr(d.retryAfterSec, Number(res.headers.get("retry-after")) || 0);
      return {
        ok: false,
        // 4xx (except 408 / 429) won't change on a retry — e.g. 401: sign in again, then "Try again" at the end.
        retryable: res.status >= 500 || res.status === 408 || res.status === 429,
        message: errorText(data) || `The answer couldn't be uploaded (error ${res.status}).`,
        code: isStr(d.code) ? d.code : undefined,
        retryAfterMs: retryAfter > 0 ? retryAfter * 1000 : undefined,
      };
    } catch {
      return { ok: false, retryable: true, message: "No connection — the answer will upload when you're back online.", code: "network" };
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  };
}

/** The one line on the intro screen about what happens to the recordings. */
function recordingNotice(server: SpeakingCapabilities | null): string {
  if (server?.storeAudio && server.retentionDays > 0) {
    return `Your answers are recorded and transcribed to assess them. Your teacher can listen to the recordings for ${daysLabel(server.retentionDays)}, then the audio is deleted.`;
  }
  return "Your answers are recorded and transcribed to assess them; the audio itself isn't kept.";
}

/** A saved recording as an answer of this run (resume). */
function answerFromRecorded(item: TurnItem, rec: RecordedAnswer): SpeakingAnswer {
  return {
    part: item.part,
    question: item.question,
    transcript: rec.transcript,
    seconds: Math.round(rec.durationMs / 1000),
    questionIndex: item.index,
  };
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

/** The examiner: a soft ring pulses while they speak (static glow under reduced motion). */
function ExaminerOrb({ state, typed }: { state: OrbState; typed: boolean }) {
  const speaking = state === "speaking";
  const listening = state === "listening";
  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center sm:h-32 sm:w-32" aria-hidden>
      {speaking && (
        <>
          <span className="absolute inset-0 rounded-full border-2 border-averna-cyan/30 motion-safe:animate-[ping_2.6s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <span className="absolute -inset-2 rounded-full bg-averna-cyan/10 blur-xl motion-safe:animate-pulse-slow" />
        </>
      )}
      {listening && <span className="absolute -inset-2 rounded-full bg-averna-neon/10 blur-xl motion-safe:animate-pulse-slow" />}
      <span
        className={cn(
          "relative flex h-full w-full items-center justify-center rounded-full border bg-gradient-to-b from-[#0e261e] to-[#06120e] transition-[border-color,box-shadow] duration-500 motion-reduce:transition-none",
          speaking
            ? "border-averna-cyan/60 shadow-[0_0_36px_-8px_rgba(0,229,255,0.6)]"
            : listening
              ? "border-averna-neon/60 shadow-[0_0_36px_-8px_rgba(0,255,148,0.6)]"
              : "border-white/10"
        )}
      >
        {listening ? (
          typed ? (
            <Keyboard className="h-9 w-9 text-averna-neon sm:h-11 sm:w-11" />
          ) : (
            <Mic className="h-9 w-9 text-averna-neon sm:h-11 sm:w-11" />
          )
        ) : state === "thinking" ? (
          <NotebookPen className="h-9 w-9 text-gray-300 sm:h-11 sm:w-11" />
        ) : (
          <UserRound className={cn("h-10 w-10 sm:h-12 sm:w-12", speaking ? "text-averna-cyan" : "text-gray-400")} />
        )}
      </span>
    </div>
  );
}

/** Part 1 · Part 2 · Part 3 dots. */
function PartProgress({ part, stage }: { part: Part; stage: "before" | "during" | "after" }) {
  return (
    <ol className="flex items-center gap-1.5 text-xs font-semibold" aria-label="Test progress">
      {([1, 2, 3] as const).map((p, i) => {
        const done = stage === "after" || (stage === "during" && p < part);
        const current = stage === "during" && p === part;
        return (
          <li key={p} className="flex items-center gap-1.5" aria-current={current ? "step" : undefined}>
            {i > 0 && (
              <span className="text-gray-600" aria-hidden>
                ·
              </span>
            )}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                done ? "bg-averna-neon" : current ? "bg-averna-neon shadow-[0_0_0_3px_rgba(0,255,148,0.22)]" : "bg-white/20"
              )}
              aria-hidden
            />
            <span className={current ? "text-white" : done ? "text-gray-300" : "text-gray-500"}>Part {p}</span>
            <span className="sr-only">{done ? "(completed)" : current ? "(current)" : "(not started)"}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CueCard({
  card,
  notes,
  onNotes,
  editable,
  notesRef,
}: {
  card: SpeakingExamSet["part2"];
  notes: string;
  onNotes: (v: string) => void;
  editable: boolean;
  notesRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <section aria-labelledby="speaking-cue-title" className="av-panel mt-6 w-full rounded-2xl p-5 text-left sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-averna-neon">Candidate task card</p>
      <h2 id="speaking-cue-title" className="mt-2 text-lg font-semibold leading-snug text-white sm:text-xl">
        {card.cue}
      </h2>
      <p className="mt-3 text-sm font-medium text-gray-300">You should say:</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-gray-200 marker:text-averna-neon/70">
        {card.points.map((pt, i) => (
          <li key={i}>{pt}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-gray-200">{card.closing}</p>
      <div className="mt-4 border-t border-white/10 pt-4">
        {editable ? (
          <>
            <label htmlFor="speaking-notes" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <NotebookPen className="h-3.5 w-3.5" aria-hidden /> Your notes
            </label>
            <textarea
              id="speaking-notes"
              ref={notesRef}
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onNotes(e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="Jot down a few key words for each point…"
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white placeholder:text-gray-500 focus:border-averna-neon/50 focus:outline-none focus:ring-2 focus:ring-averna-neon/30"
            />
          </>
        ) : (
          <>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <NotebookPen className="h-3.5 w-3.5" aria-hidden /> Your notes
            </p>
            <p className={cn("mt-2 whitespace-pre-wrap text-sm", notes.trim() ? "text-gray-200" : "italic text-gray-500")}>
              {notes.trim() || "No notes."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function ErrorBox({ title, detail, actionLabel, onAction }: { title: string; detail?: string; actionLabel: string; onAction: () => void }) {
  return (
    <div role="alert" className="error-surface flex items-start gap-3 rounded-2xl p-4 text-left sm:p-5">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-red-200">{title}</p>
        {detail && <p className="mt-0.5 text-sm text-red-100/80">{detail}</p>}
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-400/40 px-4 text-sm font-medium text-red-200 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> {actionLabel}
        </button>
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/**
 * Microphone input level (recorded mode). Paints straight to the DOM — no
 * re-render per frame; under reduced motion it updates a few times a second
 * without easing.
 */
function LevelMeter({ recorder, className }: { recorder: AnswerRecorder | null; className?: string }) {
  const barRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!recorder) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let interval = 0;
    let alive = true;
    const paint = () => {
      const el = barRef.current;
      if (el) el.style.transform = `scaleX(${Math.max(0.03, recorder.level()).toFixed(3)})`;
    };
    if (reduced) {
      interval = window.setInterval(paint, 300);
    } else {
      const loop = () => {
        if (!alive) return;
        paint();
        raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
    }
    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, [recorder]);
  return (
    <div className={cn("relative h-2.5 overflow-hidden rounded-full bg-white/10", className)} aria-hidden>
      <div
        ref={barRef}
        className="h-full w-full origin-left rounded-full bg-gradient-to-r from-averna-neon/70 to-averna-cyan/80"
        style={{ transform: "scaleX(0.03)" }}
      />
    </div>
  );
}

/** Recorded mode: how the background uploads are doing (shown in the progress bar). */
function UploadStatus({ uploads }: { uploads: UploadSnapshot<RecordedAnswer> | null }) {
  if (!uploads || uploads.total === 0) return null;
  let icon: React.ReactNode;
  let text: string;
  let tone = "text-gray-400";
  if (uploads.retrying) {
    icon = <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />;
    text = "Connection problem — retrying…";
    tone = "text-amber-200";
  } else if (uploads.current != null) {
    icon = <Upload className="h-3.5 w-3.5" aria-hidden />;
    text = "Saving your answer…";
  } else if (uploads.failed > 0) {
    icon = <AlertTriangle className="h-3.5 w-3.5" aria-hidden />;
    text = `${uploads.failed} ${uploads.failed === 1 ? "answer" : "answers"} not saved yet`;
    tone = "text-amber-200";
  } else {
    icon = <CheckCircle2 className="h-3.5 w-3.5 text-averna-neon" aria-hidden />;
    text = `${uploads.done} saved`;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", tone)}>
      {icon}
      {text}
    </span>
  );
}

function ExitLinks() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Button asChild size="lg" className="glow-cta min-h-[48px] rounded-xl bg-averna-primary px-6 text-white hover:bg-averna-light">
        <Link href="/learning/speaking-test">
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          Try Another Speaking Test
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className="min-h-[48px] rounded-xl border-white/15 bg-transparent px-6 text-gray-200 hover:bg-white/5 hover:text-white"
      >
        <Link href="/learning">Back to Learning</Link>
      </Button>
    </div>
  );
}

function ResultView({
  result,
  answers,
  headingRef,
}: {
  result: SpeakingTestResult;
  answers: SpeakingAnswer[];
  headingRef: React.RefObject<HTMLHeadingElement>;
}) {
  const perPart = ([1, 2, 3] as const).map((p) => {
    const server = result.perPart.find((x) => x.part === p);
    const mine = answers.filter((a) => a.part === p);
    return {
      part: p,
      seconds: server?.seconds ?? mine.reduce((s, a) => s + a.seconds, 0),
      words: server?.words ?? mine.reduce((s, a) => s + countWords(a.transcript), 0),
    };
  });

  return (
    <div className="space-y-5">
      <section aria-labelledby="speaking-result-title" className="av-panel av-panel-hero rounded-3xl p-6 text-center sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-averna-neon">Speaking test result</p>
        <h1 id="speaking-result-title" ref={headingRef} tabIndex={-1} className="mt-2 text-sm font-medium text-gray-300 outline-none">
          Overall band (estimated)
        </h1>
        <p className="mt-1 text-7xl font-bold tabular-nums tracking-tight text-white">{fmtBand(result.band)}</p>
        <p className="mx-auto mt-3 max-w-md text-xs text-gray-400">
          {result.assessedBy === "ai"
            ? "Assessed by Averna's AI examiner from your transcript."
            : "Estimated automatically from your transcript."}
        </p>
        {result.testId && (
          <Link
            href={speakingResultHref(result.testId)}
            className="glow-hover mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-averna-neon/30 bg-averna-neon/[0.07] px-4 text-sm font-semibold text-averna-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
          >
            See full result
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </section>

      <section aria-labelledby="speaking-criteria-title" className="av-panel rounded-2xl p-5 sm:p-6">
        <h2 id="speaking-criteria-title" className="text-sm font-semibold text-white">
          Band by criterion
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CRITERIA.map((c) => {
            const value = result.criteria[c.key];
            return (
              <div key={c.key} className="flex min-h-[72px] items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <dt className="text-sm text-gray-300">{c.label}</dt>
                <dd className={value == null ? "max-w-[9rem] text-right text-xs font-medium text-gray-400" : "text-2xl font-bold tabular-nums text-white"}>
                  {value == null ? "Rated by a teacher or examiner" : fmtBand(value)}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {result.feedback.length > 0 && (
        <section aria-labelledby="speaking-feedback-title" className="av-panel rounded-2xl p-5 sm:p-6">
          <h2 id="speaking-feedback-title" className="text-sm font-semibold text-white">
            Examiner feedback
          </h2>
          <ul className="mt-3 space-y-2.5">
            {result.feedback.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-200">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-averna-neon" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="speaking-stats-title" className="av-panel rounded-2xl p-5 sm:p-6">
        <h2 id="speaking-stats-title" className="text-sm font-semibold text-white">
          Your speaking
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {perPart.map((p) => (
            <li key={p.part} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Part {p.part}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-white">
                {formatClock(p.seconds * 1000)} <span className="text-sm font-medium text-gray-400">speaking</span>
              </p>
              <p className="text-sm text-gray-400">{p.words} words</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-averna-neon/30 bg-averna-neon/10 px-3 py-1 text-sm font-semibold text-averna-neon">
            <Sparkles className="h-4 w-4" aria-hidden />
            {result.xpAwarded > 0 ? `+${result.xpAwarded} XP earned` : "No XP this time"}
          </span>
          {!result.outcome && result.xpNotes[0] && <span className="text-sm text-gray-400">{result.xpNotes[0]}</span>}
        </div>
      </section>

      {result.outcome && <SessionOutcomeCard outcome={result.outcome} />}

      {answers.length > 0 && (
        <details className="av-panel rounded-2xl px-5 py-3 sm:px-6">
          <summary className="flex min-h-[44px] cursor-pointer select-none items-center text-sm font-semibold text-white">
            Review your answers
          </summary>
          <ol className="mb-3 mt-2 space-y-4">
            {answers.map((a, i) => (
              <li key={i} className="border-t border-white/5 pt-4 first:border-0 first:pt-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Part {a.part} · {formatClock(a.seconds * 1000)}
                </p>
                <p className="mt-1 text-sm font-medium text-white">{a.question}</p>
                <p className={cn("mt-1 text-sm leading-relaxed", a.transcript ? "text-gray-300" : "italic text-gray-500")}>
                  {a.transcript || "No answer recorded."}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}

      <ExitLinks />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function SpeakingExamRunner({ set, mode, attemptId, onSubmit, exitHref, homeworkId }: SpeakingExamRunnerProps) {
  const isMock = mode === "mock";
  const longMin = isMock ? TIMING.longMinMock : TIMING.longMinPractice;
  /** Every question in the order the examiner asks it (the server uses the same indices). */
  const items = useMemo(() => flattenSpeakingQuestions(set), [set]);
  const total = items.length;

  const [caps, setCaps] = useState<Capabilities | null>(null);
  /** The server's side (/api/speaking/capabilities); null = unknown / unreachable. */
  const [server, setServer] = useState<SpeakingCapabilities | null>(null);
  const [serverReady, setServerReady] = useState(false);
  /** Answers can be recorded here (server transcription + a browser that records). */
  const [recordable, setRecordable] = useState(false);
  /** Recorded answers this attempt already has on the server (a reloaded test). */
  const [resume, setResume] = useState<Map<number, RecordedAnswer> | null>(null);
  const [uploads, setUploads] = useState<UploadSnapshot<RecordedAnswer> | null>(null);
  const [voiceInfo, setVoiceInfo] = useState<ExaminerVoiceInfo | null>(null);
  const [mic, setMic] = useState<MicState>("unknown");
  const [inputMode, setInputModeState] = useState<InputMode>("speech");
  const [ttsOn, setTtsOn] = useState(true);
  const [view, setView] = useState<View>("intro");
  const [part, setPart] = useState<Part>(1);
  const [asked, setAsked] = useState(0);
  const [activity, setActivity] = useState<Activity>({ kind: "idle" });
  const [cardVisible, setCardVisible] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [answers, setAnswers] = useState<SpeakingAnswer[]>([]);
  const [live, setLive] = useState<LiveTranscript>(EMPTY_LIVE);
  const [typed, setTyped] = useState("");
  const [notes, setNotes] = useState("");
  const [showTranscript, setShowTranscript] = useState(!isMock);
  const [voiceIssue, setVoiceIssue] = useState<string | null>(null);
  const [micIssue, setMicIssue] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [starting, setStarting] = useState(false);
  const [soundChecking, setSoundChecking] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<SpeakingTestResult | null>(null);
  /** The route answered "already saved" without the full assessment (retry of a saved attempt). */
  const [saved, setSaved] = useState<{ testId: string; outcome: SpeakingTestResult["outcome"] } | null>(null);
  /** The server stopped taking recordings mid-test ("unavailable" / "limit"): not recorded again in this run. */
  const [stopped, setStopped] = useState<RecordingStopCode | null>(null);
  /** The stage's notice after recording stopped. */
  const [serviceNotice, setServiceNotice] = useState<string | null>(null);
  /** Upload failures at the end: the questions, and what the candidate types for each (question index → text). */
  const [unsaved, setUnsaved] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  /** The end screen has waited UPLOAD_WAIT_OFFER_MS for the uploads: "Stop waiting" is offered. */
  const [uploadWaitLong, setUploadWaitLong] = useState(false);

  const mountedRef = useRef(false);
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const inputModeRef = useRef<InputMode>("speech");
  const ttsRef = useRef(true);
  const answersRef = useRef<SpeakingAnswer[]>([]);
  const typedRef = useRef("");
  const liveRef = useRef<LiveTranscript>(EMPTY_LIVE);
  const turnRef = useRef<TurnHandle | null>(null);
  const prepRef = useRef<PrepHandle | null>(null);
  const submissionRef = useRef<SpeakingTestSubmission | null>(null);
  const submittingRef = useRef(false);
  const markRef = useRef("");
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const typedAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const notesAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);
  const recognitionLostRef = useRef<(code: RecorderErrorCode) => void>(() => undefined);
  // Recorded mode.
  const answerRecorderRef = useRef<AnswerRecorder | null>(null);
  const queueRef = useRef<UploadQueue<RecordedAnswer> | null>(null);
  const resumeRef = useRef<Map<number, RecordedAnswer> | null>(null);
  const recordingLostRef = useRef<(code: RecorderProblem) => void>(() => undefined);
  const applyUploadRef = useRef<(index: number, value: RecordedAnswer) => void>(() => undefined);
  /** The microphone came back mid-answer: record again from the next question. */
  const backToRecordingRef = useRef(false);
  /** The server stopped taking recordings: never record again in this run. */
  const stoppedRef = useRef<RecordingStopCode | null>(null);
  /** Recording stopped while an answer was being recorded: this mode takes over once that answer ends. */
  const pendingModeRef = useRef<InputMode | null>(null);
  const recordingStoppedRef = useRef<(code: RecordingStopCode) => void>(() => undefined);
  /** Answers whose upload ran out of retries on ordinary errors (countsTowardOutage). */
  const exhaustedRef = useRef<Set<number>>(new Set<number>());
  const giveUpRef = useRef<(index: number, failure: UploadFailure) => void>(() => undefined);
  const viewRef = useRef<View>("intro");
  viewRef.current = view;

  const setInputMode = useCallback((m: InputMode) => {
    inputModeRef.current = m;
    setInputModeState(m);
  }, []);

  /** The answer recorder (recorded mode), created on first use. */
  const ensureRecorder = useCallback((): AnswerRecorder => {
    let rec = answerRecorderRef.current;
    if (!rec) {
      rec = new AnswerRecorder();
      rec.onProblem((code) => recordingLostRef.current(code));
      answerRecorderRef.current = rec;
    }
    return rec;
  }, []);

  /** The background upload queue (recorded mode), created with the first recorded answer. */
  const ensureQueue = useCallback((): UploadQueue<RecordedAnswer> => {
    let q = queueRef.current;
    if (!q) {
      q = new UploadQueue<RecordedAnswer>({
        send: uploadSender(attemptId, set.id, (code) => recordingStoppedRef.current(code)),
        onChange: (s) => {
          if (mountedRef.current) setUploads(s);
        },
        onResult: (index, value) => applyUploadRef.current(index, value),
        onGiveUp: (index, failure) => giveUpRef.current(index, failure),
      });
      queueRef.current = q;
    }
    return q;
  }, [attemptId, set.id]);

  const announce = useCallback((msg: string) => {
    // Re-announce identical messages (screen readers skip unchanged text).
    setAnnouncement((prev: string) => (prev === msg ? `${msg}\u00a0` : msg));
  }, []);

  const disableVoice = useCallback((reason: string) => {
    ttsRef.current = false;
    setTtsOn(false);
    setVoiceIssue(
      reason === "blocked"
        ? "Your browser blocked the examiner's voice — the examiner's words are shown on screen instead."
        : "The examiner's voice isn't available on this device — the examiner's words are shown on screen instead."
    );
  }, []);

  /** Stop whatever is running: the director, a turn, the preparation, the recorder and the voice. */
  const cancelRun = useCallback(() => {
    const wasRunning = abortRef.current !== null;
    runRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    const turn = turnRef.current;
    turnRef.current = null;
    if (turn?.timer) clearTimeout(turn.timer);
    turn?.resolve("cancel");
    const prep = prepRef.current;
    prepRef.current = null;
    if (prep) {
      clearTimeout(prep.timer);
      prep.resolve();
    }
    recorderRef.current?.cancel();
    answerRecorderRef.current?.cancel();
    // Leave a just-primed (silent) utterance alone on the very first start.
    if (wasRunning) stopSpeaking();
  }, []);

  // Capabilities, examiner voice and recorder — client-only, after mount.
  useEffect(() => {
    mountedRef.current = true;
    const recognition = isRecognitionSupported();
    const tts = isSpeechSynthesisSupported();
    const media = typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
    setCaps({ recognition, tts, media });
    ttsRef.current = tts;
    setTtsOn(tts);
    setInputMode(recognition ? "speech" : "typed");
    if (recognition && !media) setMic("unsupported");

    let alive = true;
    if (tts) {
      void prepareExaminerVoice().then((v) => {
        if (alive) setVoiceInfo(v);
      });
    }

    const recorder = recognition ? new Recorder({ lang: "en-GB" }) : null;
    recorderRef.current = recorder;
    const offInterim = recorder?.onInterim((_text, l) => {
      liveRef.current = l;
      setLive(l);
      setReconnecting(false);
    });
    const offError = recorder?.onError((code, fatal) => {
      if (fatal) recognitionLostRef.current(code);
      else if (code === "network") setReconnecting(true);
    });

    return () => {
      alive = false;
      mountedRef.current = false;
      cancelRun();
      offInterim?.();
      offError?.();
      recorder?.dispose();
      recorderRef.current = null;
      stopSpeaking();
    };
  }, [cancelRun, setInputMode]);

  // Recorded mode: can the server transcribe, and does this attempt already have answers (a reload)?
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), CAPABILITIES_TIMEOUT_MS);
    void (async () => {
      const serverCaps = parseCapabilities(await getJson("/api/speaking/capabilities", ctrl.signal));
      const canRecord = !!serverCaps?.serverTranscription && isRecordingSupported();
      // Paused on the server (transcription down, today's limit reached): no recording, but a reloaded
      // recorded test still keeps its saved answers and continues with the browser's recognition or typing.
      const canResume = canRecord || !!serverCaps?.paused;
      let saved: Map<number, RecordedAnswer> | null = null;
      if (canResume) {
        const q = new URLSearchParams({ attemptKey: attemptId, setId: set.id });
        const progress = (await getJson(`/api/speaking/progress?${q.toString()}`, ctrl.signal)) as { answered?: unknown; submitted?: unknown } | null;
        const list = Array.isArray(progress?.answered) ? progress.answered.map(parseRecordedAnswer) : [];
        const valid = list.filter((a): a is RecordedAnswer => a !== null && a.questionIndex < total);
        if (valid.length && progress?.submitted !== true) saved = new Map(valid.map((a) => [a.questionIndex, a]));
      }
      if (!alive) return;
      window.clearTimeout(timer);
      setServer(serverCaps);
      if (canRecord) {
        setRecordable(true);
        setInputMode("recorded");
      }
      if (saved) {
        resumeRef.current = saved;
        setResume(saved);
      }
      setServerReady(true);
    })();
    return () => {
      alive = false;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [attemptId, set.id, total, setInputMode]);

  // Recorded mode: drop the microphone and pending uploads when the runner goes away; retry as soon as we're back online.
  useEffect(() => {
    const onOnline = () => {
      const q = queueRef.current;
      if (!q) return;
      q.nudge();
      q.retryFailed((f) => f.code === "network"); // uploads that gave up while offline
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      queueRef.current?.dispose();
      queueRef.current = null;
      answerRecorderRef.current?.dispose();
      answerRecorderRef.current = null;
    };
  }, []);

  // Full-screen stage: lock the page behind it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Clock for the timers.
  useEffect(() => {
    if (view !== "test") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [view]);

  // The end screen's wait for the uploads: after about a minute, offer to stop waiting and type the rest.
  useEffect(() => {
    setUploadWaitLong(false);
    if (submitState !== "uploading") return;
    const id = window.setTimeout(() => setUploadWaitLong(true), UPLOAD_WAIT_OFFER_MS);
    return () => window.clearTimeout(id);
  }, [submitState]);

  const inProgress = view === "test" || (view === "end" && submitState !== "submitted" && submitState !== "empty");
  useLeaveGuard(inProgress);

  // Move focus to the new screen's heading (screen readers + keyboard users).
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [view, result]);

  const turnStartedAt = activity.kind === "turn" ? activity.startedAt : 0;
  useEffect(() => {
    if (turnStartedAt && inputMode === "typed") typedAreaRef.current?.focus();
  }, [turnStartedAt, inputMode]);

  const prepStartedAt = activity.kind === "prep" ? activity.startedAt : 0;
  useEffect(() => {
    // Straight into the notes on desktop; on phones the keyboard would hide the card.
    if (prepStartedAt && window.matchMedia?.("(pointer: fine)").matches) notesAreaRef.current?.focus({ preventScroll: true });
  }, [prepStartedAt]);

  useEffect(() => {
    const el = transcriptBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live, showTranscript]);

  // Spoken time cues for screen-reader users: the preparation minute, and the long turn when
  // typing (while the microphone is open they would be transcribed into the answer).
  useEffect(() => {
    let key = "";
    let msg = "";
    if (activity.kind === "turn" && activity.item.kind === "long" && inputMode === "typed") {
      const left = activity.max - (now - activity.startedAt) / 1000;
      if (left <= 15) {
        key = `${activity.startedAt}:15`;
        msg = "Fifteen seconds left.";
      } else if (left <= 60) {
        key = `${activity.startedAt}:60`;
        msg = "One minute left.";
      }
    } else if (activity.kind === "prep" && activity.endsAt - now <= 15000) {
      key = `${activity.startedAt}:prep`;
      msg = "Fifteen seconds of preparation left.";
    }
    if (key && markRef.current !== key) {
      markRef.current = key;
      announce(msg);
    }
  }, [now, activity, inputMode, announce]);

  // Recognition gave up mid-test → keep going by typing (what was heard is kept).
  recognitionLostRef.current = (code: RecorderErrorCode) => {
    if (inputModeRef.current === "typed") return;
    setInputMode("typed");
    setReconnecting(false);
    setMicIssue(RECOGNITION_LOST[code] ?? RECOGNITION_LOST.unknown);
    if (code === "not-allowed") setMic("blocked");
    else if (code === "audio-capture") setMic("missing");
    const turn = turnRef.current;
    if (turn && !turn.ending) {
      // Carry what was heard into the answer box; the candidate finishes the answer by typing.
      const carry = [liveRef.current.final, liveRef.current.interim].filter(Boolean).join(" ");
      turn.typedFallback = true;
      typedRef.current = carry;
      setTyped(carry);
    }
    announce("Speech transcription stopped. Type your answers for the rest of the test.");
  };

  // Recorded mode: the microphone went away → keep going by typing (recorded answers are kept).
  recordingLostRef.current = (code: RecorderProblem) => {
    const state: MicState = code === "not-allowed" ? "blocked" : code === "no-device" ? "missing" : code === "busy" ? "busy" : "failed";
    if (viewRef.current !== "test") {
      // Before the test: just show the problem on the microphone check.
      if (inputModeRef.current === "recorded") setMic(state);
      return;
    }
    if (inputModeRef.current !== "recorded") return;
    setInputMode("typed");
    setMic(state);
    setMicIssue(RECORDING_LOST[code] ?? RECORDING_LOST.unknown);
    const turn = turnRef.current;
    if (turn && !turn.ending && turn.recorded) {
      answerRecorderRef.current?.cancel();
      turn.typedFallback = true;
      typedRef.current = "";
      setTyped("");
    }
    announce("Recording stopped. Type your answers for now — the answers already recorded are kept.");
  };

  /** After recording stopped: the browser's own speech recognition when it has one, otherwise typing. */
  const fallbackMode = (): InputMode => (recorderRef.current ? "speech" : "typed");

  // Recorded mode: the server stopped taking recordings (transcription unavailable, or today's limit
  // reached) → the rest of the test uses the browser's recognition or typing; answers whose upload
  // failed can be typed at the end. An answer being recorded right now finishes as a recording.
  recordingStoppedRef.current = (code: RecordingStopCode) => {
    if (stoppedRef.current) return;
    stoppedRef.current = code;
    setStopped(code);
    setRecordable(false); // no way back to recording in this run ("Try my microphone again" hides)
    backToRecordingRef.current = false;
    if (viewRef.current !== "test" || inputModeRef.current !== "recorded") return;
    const next = fallbackMode();
    const turn = turnRef.current;
    if (turn && !turn.ending && turn.recorded && !turn.typedFallback) {
      pendingModeRef.current = next;
    } else {
      pendingModeRef.current = null;
      answerRecorderRef.current?.release();
      setInputMode(next);
    }
    setServiceNotice(`${STOPPED_WHY[code]} ${RECORDING_STOPPED[next === "speech" ? "speech" : "typed"]}`);
    announce(
      next === "speech"
        ? "Recording stopped. From the next question your browser transcribes your answers."
        : "Recording stopped. From the next question, type your answers."
    );
  };

  // Recorded mode: an answer's upload ran out of retries on ordinary errors (5xx, timeouts, the network
  // while online). After OUTAGE_AFTER_EXHAUSTED of them the server can't take recordings right now — a plain
  // transcription outage: the rest of the test goes on as for "unavailable" (the queued answers keep retrying).
  giveUpRef.current = (index: number, failure: UploadFailure) => {
    const online = typeof navigator === "undefined" || navigator.onLine !== false;
    if (!countsTowardOutage(failure, online)) return;
    exhaustedRef.current.add(index);
    if (exhaustedRef.current.size >= OUTAGE_AFTER_EXHAUSTED) recordingStoppedRef.current("unavailable");
  };

  // An uploaded answer's server transcript and measured duration replace the placeholders.
  applyUploadRef.current = (index: number, value: RecordedAnswer) => {
    let changed = false;
    answersRef.current = answersRef.current.map((a) => {
      if (a.questionIndex !== index || a.typed) return a;
      changed = true;
      return { ...a, transcript: value.transcript, seconds: Math.round(value.durationMs / 1000) };
    });
    if (changed && mountedRef.current) setAnswers(answersRef.current);
  };

  /** Recorded mode: open the microphone (asks for permission the first time). */
  const openRecorder = useCallback(async (): Promise<boolean> => {
    const rec = ensureRecorder();
    rec.primeAudio(); // synchronous part of a click: lets iOS Safari run the level meter
    if (rec.isOpen) {
      setMic("ready");
      return true;
    }
    setMic("checking");
    try {
      await rec.open();
      if (mountedRef.current) setMic("ready");
      return true;
    } catch (err) {
      if (!mountedRef.current) return false;
      const code = recorderProblemOf(err);
      if (code === "not-supported") {
        // This browser can't record after all: its own speech recognition, or typing.
        const recognition = isRecognitionSupported();
        setRecordable(false);
        setInputMode(recognition ? "speech" : "typed");
        setMic("unknown");
        return false;
      }
      setMic(code === "not-allowed" ? "blocked" : code === "no-device" ? "missing" : code === "busy" ? "busy" : "failed");
      return false;
    }
  }, [ensureRecorder, setInputMode]);

  const checkMic = useCallback(async (): Promise<boolean> => {
    if (inputModeRef.current === "recorded") return openRecorder();
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md || typeof md.getUserMedia !== "function") {
      setMic("unsupported");
      return true; // the recogniser asks for the microphone itself
    }
    setMic("checking");
    try {
      const stream = await md.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      if (mountedRef.current) setMic("ready");
      return true;
    } catch (err) {
      const name = (err as { name?: string } | null)?.name ?? "";
      const state: MicState =
        name === "NotFoundError" || name === "OverconstrainedError"
          ? "missing"
          : name === "NotReadableError" || name === "AbortError"
            ? "busy"
            : "blocked";
      if (mountedRef.current) setMic(state);
      return false;
    }
  }, [openRecorder]);

  // -- the conversation -------------------------------------------------------

  const endTurn = useCallback(
    async (reason: "next" | "timeout") => {
      const turn = turnRef.current;
      if (!turn || turn.ending) return;
      if (reason === "next" && Date.now() - turn.startedAt < turn.min * 1000) return;
      turn.ending = true;
      if (turn.timer) clearTimeout(turn.timer);
      setActivity({ kind: "saving", item: turn.item });
      let seconds = Math.round((Date.now() - turn.startedAt) / 1000);
      let spoken = "";
      const recorder = recorderRef.current;
      if (turn.recording && recorder) {
        const r = await recorder.stop();
        seconds = r.seconds;
        spoken = r.transcript;
      }
      const answerRecorder = answerRecorderRef.current;
      const take: RecordedTake | null =
        turn.recorded && !turn.typedFallback && answerRecorder ? await answerRecorder.stop() : null;
      if (take && take.durationMs > 0) seconds = Math.round(take.durationMs / 1000);
      if (turnRef.current !== turn) return; // cancelled while the recorder was stopping
      turnRef.current = null;
      const pendingMode = pendingModeRef.current;
      if (pendingMode) {
        // Recording stopped during this answer: it ends as a recording; the next question uses the browser's mode.
        pendingModeRef.current = null;
        answerRecorderRef.current?.release();
        setInputMode(pendingMode);
      } else if (backToRecordingRef.current) {
        backToRecordingRef.current = false;
        setInputMode("recorded");
      }
      const typedAnswer = (!turn.recording && !turn.recorded) || turn.typedFallback;
      // A recorded answer's transcript arrives with its upload (applyUploadRef).
      const transcript = (typedAnswer ? typedRef.current : turn.recorded ? "" : spoken).trim();
      const index = turn.item.index;
      const answer: SpeakingAnswer = {
        part: turn.item.part,
        question: turn.item.question,
        transcript,
        seconds: Math.max(0, Math.min(turn.max, seconds)),
        questionIndex: index,
        ...(typedAnswer ? { typed: true } : {}),
      };
      answersRef.current = [...answersRef.current.filter((a) => a.questionIndex !== index), answer];
      setAnswers(answersRef.current);
      if (take && take.blob.size > 0) {
        ensureQueue().enqueue({ index, blob: take.blob, filename: `q${index}.${extensionForMime(take.mimeType)}` });
      }
      if (reason === "timeout") announce(turn.item.kind === "long" ? "Time is up." : "Time is up for this answer.");
      turn.resolve(reason);
    },
    [announce, ensureQueue, setInputMode]
  );

  const endPrep = useCallback(() => {
    const prep = prepRef.current;
    if (!prep) return;
    prepRef.current = null;
    clearTimeout(prep.timer);
    prep.resolve();
  }, []);

  // Space / Enter = Next (when it's enabled and focus isn't in a control).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Spacebar" && e.key !== "Enter") return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || INTERACTIVE_TAGS.has(el.tagName))) return;
      const turn = turnRef.current;
      if (!turn || turn.ending || Date.now() - turn.startedAt < turn.min * 1000) return;
      e.preventDefault();
      void endTurn("next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endTurn]);

  const submit = useCallback(async () => {
    const submission = submissionRef.current;
    if (!submission || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitState("submitting");
    setSubmitError("");
    try {
      const handler = onSubmitRef.current;
      if (handler) {
        await handler(submission);
        if (mountedRef.current) setSubmitState("submitted");
        return;
      }
      if (!submission.answers.some((a) => a.transcript.trim())) {
        if (mountedRef.current) setSubmitState("empty");
        return;
      }
      // The attempt id makes a retry safe: the server won't save (or reward) it twice.
      const res = await fetch("/api/learning/speaking/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...submission, submissionId: attemptId, ...(homeworkId ? { homeworkId } : {}) }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(errorText(data) || "We couldn't assess your test. Check your connection and try again — your answers are safe.");
      }
      const parsed = parseResult(data);
      if (!mountedRef.current) return;
      if (parsed) {
        setResult(parsed);
      } else if (data && typeof data === "object" && isStr((data as { testId?: unknown }).testId)) {
        const d = data as { testId: string; outcome?: SpeakingTestResult["outcome"] };
        setSaved({ testId: d.testId, outcome: d.outcome ?? null });
      } else {
        throw new Error("We couldn't read the assessment. Try again — your answers are safe.");
      }
      setSubmitState("submitted");
    } catch (e) {
      if (mountedRef.current) {
        setSubmitError(e instanceof Error && e.message ? e.message : "Something went wrong. Try again — your answers are safe.");
        setSubmitState("error");
      }
    } finally {
      submittingRef.current = false;
    }
  }, [attemptId, homeworkId]);

  /** What gets submitted: the answers in question order (recorded ones with the server's transcripts). */
  const buildSubmission = (recorded: boolean): SpeakingTestSubmission => {
    const results = queueRef.current?.snapshot().results;
    const list = answersRef.current
      .map((a) => {
        const r = a.questionIndex != null && !a.typed ? results?.get(a.questionIndex) : undefined;
        return r ? { ...a, transcript: r.transcript, seconds: Math.round(r.durationMs / 1000) } : a;
      })
      .sort((x, y) => (x.questionIndex ?? 0) - (y.questionIndex ?? 0));
    // Nothing of this attempt reached the server (recording stopped before the first answer was saved):
    // the answers are the browser's own, so say how they were given.
    const stored = (results?.size ?? 0) > 0 || (resumeRef.current?.size ?? 0) > 0;
    const own: InputMode = inputModeRef.current === "recorded" ? "typed" : inputModeRef.current;
    return {
      setId: set.id,
      answers: list,
      totalSeconds: list.reduce((sum, a) => sum + a.seconds, 0),
      inputMode: recorded && stored ? "recorded" : own,
    };
  };

  /** Recorded answers: wait for the uploads (the server marks what it transcribed), then submit. */
  const finishRecorded = async () => {
    const queue = queueRef.current;
    if (queue) {
      setSubmitState("uploading");
      setSubmitError("");
      const snap = await queue.whenIdle();
      if (!mountedRef.current) return;
      if (snap.failed > 0) {
        const first = snap.failures.values().next().value;
        const failed = Array.from<number>(snap.failures.keys()).sort((a, b) => a - b);
        // Each failed answer can be typed; prefilled with whatever this page has for it (a browser transcript).
        setDrafts((prev: Record<number, string>) => {
          const next = { ...prev };
          for (const i of failed) {
            if (next[i] == null) next[i] = answersRef.current.find((a) => a.questionIndex === i)?.transcript ?? "";
          }
          return next;
        });
        setUnsaved(failed);
        setSubmitError(first?.message ?? "");
        setSubmitState("upload-failed");
        return;
      }
    }
    submissionRef.current = buildSubmission(true);
    queue?.dispose(); // the answers are final now: no late retries
    void submit();
  };

  /** Upload failures that another try could fix (not "unavailable" / "limit", nor a question whose takes are used up). */
  const retryUploads = () => {
    queueRef.current?.retryFailed((f) => uploadRetryCanHelp(f.code));
    void finishRecorded();
  };

  /**
   * The end screen has waited a long time (a transcription outage, a hanging connection): stop the uploads
   * still pending. finishRecorded's wait ends, and every answer that isn't saved yet goes to the typing step
   * ("Try uploading again" can still send them).
   */
  const stopWaiting = () => {
    queueRef.current?.cancelPending(WAIT_STOPPED);
  };

  /** Upload failures: what the candidate typed stands in for those answers (an empty box = unanswered), then submit. */
  const submitWithTyped = () => {
    const typedFor = new Map<number, string>(unsaved.map((i: number): [number, string] => [i, String(drafts[i] ?? "").trim()]));
    answersRef.current = answersRef.current.map((a) => {
      const text = a.questionIndex != null ? typedFor.get(a.questionIndex) : undefined;
      return text ? { ...a, transcript: text.slice(0, 4000), typed: true } : a;
    });
    setAnswers(answersRef.current);
    submissionRef.current = buildSubmission(true);
    queueRef.current?.dispose();
    void submit();
  };

  const finishTest = () => {
    setActivity({ kind: "idle" });
    setCardVisible(false);
    setView("end");
    // Any answer recorded in this attempt (even if the microphone was lost later): the recorded path.
    if (inputModeRef.current === "recorded" || queueRef.current || resumeRef.current?.size) {
      answerRecorderRef.current?.release(); // the microphone is no longer needed
      void finishRecorded();
      return;
    }
    submissionRef.current = buildSubmission(false);
    void submit();
  };

  /** A reloaded recorded test whose every answer is already saved: straight to the submission. */
  const finishFromSaved = () => {
    const saved = resumeRef.current;
    if (!saved) return;
    answersRef.current = items.filter((i) => saved.has(i.index)).map((i) => answerFromRecorded(i, saved.get(i.index) as RecordedAnswer));
    setAnswers(answersRef.current);
    submissionRef.current = null;
    setResult(null);
    setSaved(null);
    setSubmitState("idle");
    setSubmitError("");
    setPart(3);
    setAsked(total);
    finishTest();
  };

  /** The examiner says one line (or, without a voice, it stays on screen long enough to read). */
  const say = async (text: string, signal: AbortSignal) => {
    setActivity({ kind: "examiner", text });
    if (ttsRef.current) await speak(text, { signal, onError: disableVoice });
    if (ttsRef.current) {
      await sleep(250, signal); // a natural beat before the microphone opens
    } else {
      announce(`Examiner: ${text}`);
      await sleep(readingMs(text), signal);
    }
  };

  /** Recorded mode: make sure the microphone is still open before the candidate's turn (reopened once if it went away). */
  const prepareTurn = async (): Promise<void> => {
    if (inputModeRef.current !== "recorded") return;
    const rec = answerRecorderRef.current;
    if (!rec) {
      recordingLostRef.current("unknown");
      return;
    }
    if (rec.isOpen) return;
    try {
      await rec.open();
    } catch (err) {
      recordingLostRef.current(recorderProblemOf(err));
    }
  };

  /** The candidate's turn: records (or takes typing) until Next or the time limit. */
  const answerTurn = (item: TurnItem, min: number, max: number) =>
    new Promise<EndReason>((resolve) => {
      const recorder = recorderRef.current;
      const mode = inputModeRef.current;
      const speech = mode === "speech" && recorder !== null;
      const answerRecorder = answerRecorderRef.current;
      const recorded = mode === "recorded" && answerRecorder !== null && answerRecorder.start();
      typedRef.current = "";
      setTyped("");
      liveRef.current = EMPTY_LIVE;
      setLive(EMPTY_LIVE);
      setReconnecting(false);
      const startedAt = Date.now();
      const handle: TurnHandle = {
        item,
        startedAt,
        min,
        max,
        recording: speech,
        recorded,
        typedFallback: false,
        ending: false,
        timer: null,
        resolve,
      };
      turnRef.current = handle;
      if (speech && recorder) recorder.start();
      // The recorder couldn't start: this answer (and the next ones) are typed.
      if (mode === "recorded" && !recorded) recordingLostRef.current("unknown");
      handle.timer = setTimeout(() => void endTurn("timeout"), max * 1000);
      setNow(startedAt);
      setActivity({ kind: "turn", item, startedAt, min, max });
      // Keep it short while the microphone is open: a screen reader on speakers would be transcribed.
      announce(speech || recorded ? "Your turn." : "Your turn. Type what you would say.");
    });

  const prepTime = (seconds: number) =>
    new Promise<void>((resolve) => {
      const startedAt = Date.now();
      prepRef.current = { timer: setTimeout(endPrep, seconds * 1000), resolve };
      setNow(startedAt);
      setActivity({ kind: "prep", startedAt, endsAt: startedAt + seconds * 1000 });
      announce("Preparation time: one minute. You can make notes.");
    });

  const runTest = async () => {
    cancelRun();
    const runId = runRef.current;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;
    const alive = () => runRef.current === runId && mountedRef.current;
    async function step<T>(p: Promise<T>): Promise<T> {
      const value = await p;
      if (!alive()) throw CANCELLED;
      return value;
    }

    // A reloaded recorded test keeps what's already saved and asks only the rest.
    const saved = resumeRef.current;
    const done = (i: TurnItem) => !!saved?.has(i.index);
    const prefilled = saved ? items.filter(done).map((i) => answerFromRecorded(i, saved.get(i.index) as RecordedAnswer)) : [];
    const resumed = prefilled.length > 0;
    const firstOpen = items.find((i) => !done(i));

    answersRef.current = prefilled;
    setAnswers(prefilled);
    submissionRef.current = null;
    backToRecordingRef.current = false;
    pendingModeRef.current = null;
    markRef.current = "";
    setNotes("");
    setTyped("");
    setLive(EMPTY_LIVE);
    setMicIssue(null);
    setServiceNotice(null);
    setUnsaved([]);
    setDrafts({});
    setResult(null);
    setSaved(null);
    setSubmitState("idle");
    setSubmitError("");
    setCardVisible(false);
    setPart(firstOpen?.part ?? 1);
    setAsked(firstOpen ? firstOpen.index : 0);
    setActivity({ kind: "idle" });
    setView("test");

    const ask = async (item: TurnItem, min: number, max: number) => {
      setAsked(item.index + 1);
      await step(say(item.question, signal));
      await step(prepareTurn());
      await step(answerTurn(item, min, max));
    };

    try {
      await step(sleep(500, signal));
      if (resumed) await step(say(LINES.welcomeBack, signal));

      // Part 1 — introduction and interview.
      const part1 = items.filter((i) => i.part === 1 && !done(i));
      if (part1.length) {
        setPart(1);
        if (!resumed) await step(say(`${greeting()} ${LINES.part1}`, signal));
        for (let t = 0; t < set.part1.length; t++) {
          const questions = part1.filter((i) => i.topicIndex === t);
          if (!questions.length) continue;
          await step(say(LINES.topic(inSentence(set.part1[t].topic)), signal));
          for (const q of questions) await ask(q, TIMING.minAnswer, TIMING.part1Max);
        }
      }

      // Part 2 — the long turn (a resumed test that stopped before it gets the preparation minute again).
      const cue = items.find((i) => i.kind === "long");
      const follow = items.find((i) => i.kind === "followUp");
      if (cue && !done(cue)) {
        setPart(2);
        await step(say(LINES.part2, signal));
        setAsked(cue.index + 1);
        setCardVisible(true);
        await step(prepTime(TIMING.prep));
        await step(say(LINES.part2Go, signal));
        await step(prepareTurn());
        await step(answerTurn(cue, longMin, TIMING.longMax));
        await step(say(LINES.part2Stop, signal));
        setCardVisible(false);
      }
      if (follow && !done(follow)) {
        setPart(2);
        await ask(follow, TIMING.minAnswer, TIMING.followUpMax);
      }

      // Part 3 — discussion.
      const part3 = items.filter((i) => i.part === 3 && !done(i));
      if (part3.length) {
        setPart(3);
        await step(say(LINES.part3(inSentence(set.part3.theme)), signal));
        for (const q of part3) await ask(q, TIMING.minAnswer, TIMING.part3Max);
      }

      await step(say(LINES.end, signal));
      finishTest();
    } catch (err) {
      if (err === CANCELLED || !alive()) return;
      console.error("Speaking test stopped unexpectedly:", err);
      // Never lose the answers already given: close whatever is open and submit them.
      const turn = turnRef.current;
      turnRef.current = null;
      if (turn?.timer) clearTimeout(turn.timer);
      const prep = prepRef.current;
      prepRef.current = null;
      if (prep) clearTimeout(prep.timer);
      recorderRef.current?.cancel();
      answerRecorderRef.current?.cancel();
      stopSpeaking();
      finishTest();
    }
  };

  const onStart = async () => {
    if (starting || !caps || !serverReady) return;
    primeSpeech(); // must run inside the click: lets iOS Safari speak later
    const saved = resumeRef.current;
    if (saved && items.every((i) => saved.has(i.index))) {
      finishFromSaved(); // a reload after the last answer: nothing left to ask
      return;
    }
    if (inputModeRef.current === "recorded") {
      ensureRecorder().primeAudio(); // also inside the click: the level meter's audio context (iOS Safari)
      if (!answerRecorderRef.current?.isOpen) {
        setStarting(true);
        const ok = await openRecorder();
        if (!mountedRef.current) return;
        setStarting(false);
        if (!ok) return;
      }
      void runTest();
      return;
    }
    if (inputModeRef.current === "speech" && caps.media && mic !== "ready") {
      setStarting(true);
      const ok = await checkMic();
      if (!mountedRef.current) return;
      setStarting(false);
      if (!ok) return;
    }
    void runTest();
  };

  const restart = () => {
    cancelRun();
    answersRef.current = [];
    setAnswers([]);
    submissionRef.current = null;
    // A fresh run of the same attempt: every question is asked (and recorded) again.
    resumeRef.current = null;
    setResume(null);
    queueRef.current?.dispose();
    queueRef.current = null;
    setUploads(null);
    exhaustedRef.current = new Set<number>();
    // Recording stopped on the server's word (and the run ended before the switch took effect): don't record again.
    pendingModeRef.current = null;
    if (stoppedRef.current && inputModeRef.current === "recorded") {
      answerRecorderRef.current?.release();
      setInputMode(fallbackMode());
    }
    // The microphone was released at the end of the run: check it again on the intro.
    if (inputModeRef.current === "recorded" && !answerRecorderRef.current?.isOpen) setMic("unknown");
    setSubmitState("idle");
    setSubmitError("");
    setResult(null);
    setSaved(null);
    setActivity({ kind: "idle" });
    setCardVisible(false);
    setPart(1);
    setAsked(0);
    setView("intro");
  };

  const testSound = async () => {
    if (soundChecking) return;
    primeSpeech();
    setSoundChecking(true);
    await speak(LINES.soundCheck, { onError: disableVoice });
    if (mountedRef.current) setSoundChecking(false);
  };

  const switchToTyping = () => {
    answerRecorderRef.current?.release();
    setInputMode("typed");
  };
  const switchToMicrophone = async () => {
    setMicIssue(null);
    if (recordable && !stoppedRef.current) {
      setInputMode("recorded");
      await openRecorder();
      return;
    }
    setInputMode("speech");
    if (caps?.media) await checkMic();
  };

  /** Mid-test, after the microphone was lost: try it again (the next answer is recorded if it works). */
  const reconnectMicrophone = async () => {
    if (stoppedRef.current) return; // the server stopped taking recordings: typing (or recognition) it is
    const ok = await openRecorder();
    if (!ok || !mountedRef.current || stoppedRef.current) return;
    setMicIssue(null);
    announce("Microphone on again. Your next answer will be recorded.");
    // An answer being typed right now stays typed; recording resumes with the next question.
    if (turnRef.current) backToRecordingRef.current = true;
    else setInputMode("recorded");
  };

  const confirmExit = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (view === "test" && !window.confirm("Leave the Speaking test? Your answers so far will be lost.")) e.preventDefault();
  };

  // -- derived UI state -------------------------------------------------------

  const elapsedMs = activity.kind === "turn" ? Math.max(0, now - activity.startedAt) : 0;
  const canAdvance = activity.kind === "turn" && elapsedMs >= activity.min * 1000;
  const answeredCount = answers.filter((a) => a.transcript.trim()).length;
  const speakingSeconds = answers.reduce((s, a) => s + a.seconds, 0);
  const typedMode = inputMode === "typed";
  const recordedMode = inputMode === "recorded";
  /** Recorded answers are off for now: paused on the server, or stopped during this run. */
  const pausedReason: RecordingStopCode | null = stopped ?? server?.paused ?? null;
  /** Recorded answers already saved for this attempt (a reloaded test). */
  const savedCount = resume ? items.filter((i) => resume.has(i.index)).length : 0;
  const allSaved = savedCount > 0 && savedCount >= total;
  const firstUnsaved = resume ? items.find((i) => !resume.has(i.index)) : undefined;

  const orb: OrbState =
    activity.kind === "examiner"
      ? ttsOn
        ? "speaking"
        : "idle"
      : activity.kind === "turn"
        ? "listening"
        : activity.kind === "prep"
          ? "thinking"
          : "idle";

  const stateLabel =
    activity.kind === "examiner"
      ? ttsOn
        ? "Examiner is speaking…"
        : "Read the examiner's words"
      : activity.kind === "turn"
        ? typedMode
          ? "Your turn — type what you would say"
          : "Your turn — speak now"
        : activity.kind === "prep"
          ? "Preparation time"
          : activity.kind === "saving"
            ? "One moment…"
            : "Getting ready…";

  // -- screens ------------------------------------------------------------------

  const renderMicProblem = (state: "blocked" | "missing" | "busy" | "failed") => {
    const p = MIC_PROBLEM[state];
    return (
      <div role="alert" className="error-surface flex items-start gap-3 rounded-xl p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-200">{p.title}</p>
          <p className="mt-0.5 text-sm text-red-100/80">{p.detail}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void checkMic()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-400/40 px-4 text-sm font-medium text-red-200 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Check again
            </button>
            <button
              type="button"
              onClick={switchToTyping}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/15 px-4 text-sm font-medium text-gray-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
            >
              <Keyboard className="h-4 w-4" aria-hidden /> Type my answers instead
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMicCheck = () => {
    if (!caps || !serverReady) {
      return (
        <p className="flex min-h-[44px] items-center gap-2 text-sm text-gray-400" role="status">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> Checking your browser…
        </p>
      );
    }
    if (recordedMode) {
      if (mic === "blocked" || mic === "missing" || mic === "busy" || mic === "failed") return renderMicProblem(mic);
      return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center gap-3">
            {mic === "ready" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
            ) : mic === "checking" ? (
              <Loader2 className="h-5 w-5 shrink-0 text-gray-300 motion-safe:animate-spin" aria-hidden />
            ) : (
              <Mic className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
            )}
            <div className="min-w-0 flex-1" role="status">
              <p className="text-sm font-medium text-white">
                {mic === "ready" ? "Microphone ready" : mic === "checking" ? "Waiting for microphone permission…" : "Microphone"}
              </p>
              <p className="text-xs text-gray-400">
                {mic === "ready"
                  ? "Say something — the bar below moves when we can hear you."
                  : "Allow the microphone so your answers can be recorded."}
              </p>
            </div>
            {(mic === "unknown" || mic === "checking") && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void checkMic()}
                disabled={mic === "checking"}
                className="min-h-[44px] rounded-lg border-white/15 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
              >
                Check microphone
              </Button>
            )}
          </div>
          {mic === "ready" && <LevelMeter recorder={answerRecorderRef.current} className="mt-3" />}
        </div>
      );
    }
    if (typedMode && (recordable || caps.recognition)) {
      return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <Keyboard className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-gray-200">You&apos;ll type your answers — the timing rules still apply.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void switchToMicrophone()}
            className="min-h-[44px] rounded-lg border-white/15 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
          >
            <Mic className="mr-1.5 h-4 w-4" aria-hidden /> Use my microphone
          </Button>
        </div>
      );
    }
    if (!caps.recognition) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/30 bg-amber-400/10 p-4">
          <Keyboard className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-100">{TYPED_FALLBACK}</p>
            <p className="mt-1 text-sm text-amber-100/80">For spoken answers, open this test in Google Chrome or Microsoft Edge.</p>
          </div>
        </div>
      );
    }
    if (mic === "blocked" || mic === "missing" || mic === "busy" || mic === "failed") return renderMicProblem(mic);
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        {mic === "ready" ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
        ) : mic === "checking" ? (
          <Loader2 className="h-5 w-5 shrink-0 text-gray-300 motion-safe:animate-spin" aria-hidden />
        ) : (
          <Mic className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
        )}
        <div className="min-w-0 flex-1" role="status">
          <p className="text-sm font-medium text-white">
            {mic === "ready" ? "Microphone ready" : mic === "checking" ? "Waiting for microphone permission…" : "Microphone"}
          </p>
          <p className="text-xs text-gray-400">
            {mic === "unsupported"
              ? "Your browser will ask for the microphone when the test starts."
              : mic === "ready"
                ? "Your answers will be transcribed as you speak."
                : "Allow the microphone so your answers can be transcribed."}
          </p>
        </div>
        {(mic === "unknown" || mic === "checking") && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void checkMic()}
            disabled={mic === "checking"}
            className="min-h-[44px] rounded-lg border-white/15 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
          >
            Check microphone
          </Button>
        )}
      </div>
    );
  };

  const renderVoiceCheck = () => {
    if (!caps) return null;
    if (!caps.tts || voiceIssue) {
      return (
        <Notice>{voiceIssue ?? "Your browser can't play the examiner's voice — the examiner's words will be shown on screen instead."}</Notice>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <Volume2 className="h-5 w-5 shrink-0 text-averna-cyan" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Examiner&apos;s voice</p>
          <p className="truncate text-xs text-gray-400">
            {voiceInfo
              ? voiceInfo.british
                ? voiceInfo.name
                : `${voiceInfo.name} — no British English voice is installed on this device`
              : "Your device's default English voice"}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void testSound()}
          disabled={soundChecking}
          className="min-h-[44px] rounded-lg border-white/15 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
        >
          {soundChecking ? (
            <Loader2 className="mr-1.5 h-4 w-4 motion-safe:animate-spin" aria-hidden />
          ) : (
            <Volume2 className="mr-1.5 h-4 w-4" aria-hidden />
          )}
          {soundChecking ? "Playing…" : "Test sound"}
        </Button>
      </div>
    );
  };

  const renderIntro = () => (
    <section aria-labelledby="speaking-intro-title" className="space-y-5">
      <div className="av-panel av-panel-hero rounded-3xl p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-averna-neon">{isMock ? "Mock exam · Speaking" : "Speaking practice"}</p>
        <h1 id="speaking-intro-title" ref={headingRef} tabIndex={-1} className="mt-1.5 text-2xl font-bold text-white outline-none sm:text-3xl">
          IELTS Speaking Test
        </h1>
        <p className="mt-1 text-sm text-gray-300">
          {set.title} · 3 parts · about 11–14 minutes
        </p>

        <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {([1, 2, 3] as const).map((p) => (
            <li key={p} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-averna-neon">
                Part {p} · {PART_INFO[p].time}
              </p>
              <p className="mt-1 font-semibold text-white">{PART_INFO[p].name}</p>
              <p className="mt-1 text-sm text-gray-400">{PART_INFO[p].about}</p>
            </li>
          ))}
        </ol>

        <ul className="mt-5 space-y-2.5 text-sm text-gray-300">
          <li className="flex gap-2.5">
            <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            The examiner asks every question out loud. Speak naturally, as you would to a real examiner.
          </li>
          <li className="flex gap-2.5">
            <Mic className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            {typedMode
              ? "After each question your answer box opens by itself — press Next when you've finished."
              : "Recording starts by itself after each question — press Next (or Space / Enter) when you've finished."}
          </li>
          {recordedMode && (
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
              {recordingNotice(server)}
            </li>
          )}
          <li className="flex gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            The examiner can&apos;t answer questions or explain words — just give your best answer.
          </li>
          <li className="flex gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            {isMock
              ? "Exam conditions: answers move on when the time is up, and the test can't be paused."
              : "Answers move on when the time is up. In practice you can skip the Part 2 preparation minute."}
          </li>
        </ul>
      </div>

      {savedCount > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-averna-neon/25 bg-averna-neon/[0.06] p-4 text-left sm:p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-averna-neon" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-white">
              {allSaved ? "All your answers are saved." : `Welcome back — ${savedCount} of ${total} answers are saved.`}
            </p>
            <p className="mt-0.5 text-sm text-gray-300">
              {allSaved
                ? "Submit them to get your result."
                : firstUnsaved
                  ? `The test continues from question ${firstUnsaved.index + 1} (Part ${firstUnsaved.part})${
                      firstUnsaved.kind === "long" ? ", with a new minute to prepare your task card" : ""
                    }.`
                  : "The test continues where it stopped."}
            </p>
          </div>
        </div>
      )}

      {!allSaved && (
        <div className="av-panel rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Before you start</h2>
          <div className="mt-3 space-y-3">
            {pausedReason && !recordedMode && <Notice>{RECORDING_PAUSED[pausedReason]}</Notice>}
            {renderMicCheck()}
            {renderVoiceCheck()}
          </div>
        </div>
      )}

      <div className="flex justify-stretch sm:justify-end">
        <Button
          type="button"
          size="lg"
          onClick={() => void onStart()}
          disabled={!caps || !serverReady || starting}
          className="glow-cta min-h-[52px] w-full rounded-xl bg-averna-primary px-8 text-base font-semibold text-white hover:bg-averna-light sm:w-auto"
        >
          {starting ? (
            <Loader2 className="mr-2 h-5 w-5 motion-safe:animate-spin" aria-hidden />
          ) : allSaved ? (
            <ArrowRight className="mr-2 h-5 w-5" aria-hidden />
          ) : typedMode ? (
            <Keyboard className="mr-2 h-5 w-5" aria-hidden />
          ) : (
            <Mic className="mr-2 h-5 w-5" aria-hidden />
          )}
          {allSaved ? "Submit My Answers" : savedCount > 0 ? "Continue the Test" : "Start Speaking Test"}
        </Button>
      </div>
    </section>
  );

  const renderStage = () => {
    const turn = activity.kind === "turn" ? activity : null;
    const item = activity.kind === "turn" || activity.kind === "saving" ? activity.item : null;
    const longTurn = item?.kind === "long";
    const caption = activity.kind === "examiner" ? activity.text : item && !longTurn ? item.question : "";
    const prepLeft = activity.kind === "prep" ? Math.max(0, activity.endsAt - now) : 0;

    return (
      <section aria-labelledby="speaking-stage-title" className="flex flex-1 flex-col items-center text-center">
        <ExaminerOrb state={orb} typed={typedMode} />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          Part {part} · {PART_INFO[part].name}
        </p>
        <h1 id="speaking-stage-title" ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-bold text-white outline-none sm:text-3xl">
          {stateLabel}
        </h1>
        {activity.kind === "prep" && <p className="mt-1 text-sm text-gray-400">{formatClock(prepLeft)} to think about what you&apos;re going to say</p>}

        {(voiceIssue || micIssue || serviceNotice) && (
          <div className="mt-5 w-full space-y-2">
            {voiceIssue && <Notice>{voiceIssue}</Notice>}
            {serviceNotice && <Notice>{serviceNotice}</Notice>}
            {micIssue && <Notice>{micIssue}</Notice>}
            {micIssue && recordable && typedMode && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => void reconnectMicrophone()}
                  disabled={mic === "checking"}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/15 px-4 text-sm font-medium text-gray-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60 disabled:opacity-60"
                >
                  {mic === "checking" ? (
                    <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
                  ) : (
                    <Mic className="h-4 w-4" aria-hidden />
                  )}
                  Try my microphone again
                </button>
              </div>
            )}
          </div>
        )}

        {caption && (
          <div className="av-panel mt-6 w-full rounded-2xl p-5 text-left sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{activity.kind === "examiner" ? "Examiner" : "Question"}</p>
            <p className="mt-2 text-lg leading-relaxed text-white sm:text-xl">{caption}</p>
          </div>
        )}

        {cardVisible && (
          <CueCard card={set.part2} notes={notes} onNotes={setNotes} editable={activity.kind === "prep"} notesRef={notesAreaRef} />
        )}

        {turn && typedMode && (
          <div className="mt-5 w-full text-left">
            <label htmlFor="speaking-typed-answer" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Your answer (typed)
            </label>
            <textarea
              id="speaking-typed-answer"
              ref={typedAreaRef}
              value={typed}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                typedRef.current = e.target.value;
                setTyped(e.target.value);
              }}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void endTurn("next");
                }
              }}
              rows={longTurn ? 8 : 5}
              spellCheck={false}
              autoComplete="off"
              placeholder="Type what you would say…"
              aria-describedby="speaking-typed-help"
              className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-base leading-relaxed text-white placeholder:text-gray-500 focus:border-averna-neon/50 focus:outline-none focus:ring-2 focus:ring-averna-neon/30"
            />
            <p id="speaking-typed-help" className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>
                {countWords(typed)} words · typed answers — the timing rules still apply
              </span>
              <span className="hidden sm:inline">Ctrl + Enter = Next</span>
            </p>
          </div>
        )}

        {turn && recordedMode && (
          <div className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left">
            <div className="flex items-center gap-3">
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-200">
                <span className="h-2 w-2 rounded-full bg-red-400 motion-safe:animate-pulse" aria-hidden />
                Recording
              </span>
              <LevelMeter recorder={answerRecorderRef.current} className="flex-1" />
            </div>
            <p className="mt-2 text-xs text-gray-400">Speak clearly — your answer is transcribed after you finish.</p>
          </div>
        )}

        {turn && inputMode === "speech" && showTranscript && (
          <div className="mt-5 w-full text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Live transcript</p>
            <div
              ref={transcriptBoxRef}
              className="mt-2 max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-gray-200"
            >
              {live.final || live.interim ? (
                <>
                  {live.final}
                  {live.final && live.interim ? " " : ""}
                  <span className="text-gray-500">{live.interim}</span>
                </>
              ) : (
                <span className="text-gray-500">Listening…</span>
              )}
            </div>
          </div>
        )}

        {turn && inputMode === "speech" && reconnecting && (
          <p className="mt-3 flex items-center gap-2 text-xs text-amber-200" role="status">
            <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> Transcription interrupted — reconnecting…
          </p>
        )}
      </section>
    );
  };

  const renderActions = () => {
    if (activity.kind === "turn") {
      const longTurn = activity.item.kind === "long";
      const limitMs = activity.max * 1000;
      const minMs = activity.min * 1000;
      const remainingMs = Math.max(0, limitMs - elapsedMs);
      const untilNext = Math.max(1, Math.ceil((minMs - elapsedMs) / 1000));
      const warn = remainingMs <= (longTurn ? 15000 : 10000);
      const left = Math.ceil(remainingMs / 1000);
      const hint = !canAdvance
        ? longTurn
          ? `Keep going — you can finish after ${formatClock(minMs)}.`
          : `Next unlocks in ${untilNext}s.`
        : warn
          ? longTurn
            ? `${left}s left — the examiner will stop you at 2:00.`
            : `Moving on in ${left}s.`
          : longTurn
            ? "Finish when you're done, or keep talking until the examiner stops you."
            : typedMode
              ? "Press Next (or Ctrl + Enter) when you've finished."
              : "Press Next — or Space / Enter — when you've finished.";
      const clock = longTurn ? formatClock(remainingMs) : formatClock(Math.floor(elapsedMs / 1000) * 1000);
      return (
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span
                role="timer"
                aria-label={longTurn ? `${clock} left` : `Answer time ${clock} of ${formatClock(limitMs)}`}
                className="inline-flex items-center gap-2 font-mono text-2xl font-bold tabular-nums text-white"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-averna-neon motion-safe:animate-pulse" aria-hidden />
                {clock}
              </span>
              <span className="text-xs text-gray-400" aria-hidden>
                {longTurn ? "left" : `of ${formatClock(limitMs)}`}
              </span>
            </div>
            <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300 ease-linear motion-reduce:transition-none",
                  warn ? "bg-amber-300/80" : "bg-averna-neon/70"
                )}
                style={{ width: `${Math.min(100, (elapsedMs / limitMs) * 100)}%` }}
              />
              {longTurn && <span className="absolute inset-y-0 w-px bg-white/50" style={{ left: `${(minMs / limitMs) * 100}%` }} />}
            </div>
            <p id="speaking-turn-hint" className={cn("mt-1.5 text-xs", warn && canAdvance ? "text-amber-200" : "text-gray-400")}>
              {hint}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => void endTurn("next")}
            disabled={!canAdvance}
            aria-describedby="speaking-turn-hint"
            className={cn(
              "min-h-[52px] min-w-[120px] shrink-0 rounded-xl bg-averna-primary px-6 text-base font-semibold text-white hover:bg-averna-light",
              canAdvance && "glow-cta"
            )}
          >
            {longTurn ? "Finish" : "Next"}
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
        </div>
      );
    }

    if (activity.kind === "prep") {
      const remainingMs = Math.max(0, activity.endsAt - now);
      const spanMs = Math.max(1, activity.endsAt - activity.startedAt);
      return (
        <div className="mx-auto flex w-full max-w-3xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span role="timer" aria-label={`${formatClock(remainingMs)} to prepare`} className="font-mono text-2xl font-bold tabular-nums text-white">
                {formatClock(remainingMs)}
              </span>
              <span className="text-xs text-gray-400" aria-hidden>
                to prepare
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
              <div
                className="h-full rounded-full bg-averna-cyan/70 transition-[width] duration-300 ease-linear motion-reduce:transition-none"
                style={{ width: `${(remainingMs / spanMs) * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {isMock ? "The examiner will ask you to start when the minute is up." : "Make notes on the card, or start as soon as you're ready."}
            </p>
          </div>
          {!isMock && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={endPrep}
              className="min-h-[52px] shrink-0 rounded-xl border-white/20 bg-transparent px-5 text-sm font-semibold text-white hover:bg-white/5 hover:text-white"
            >
              Skip preparation
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-[52px] w-full max-w-3xl items-center gap-2 text-sm text-gray-400">
        {activity.kind === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden /> Saving your answer…
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4 shrink-0 text-averna-cyan" aria-hidden />
            {`${ttsOn ? "Listen" : "Read the examiner's words"} — ${
              typedMode ? "your answer box opens" : "recording starts"
            } automatically when the examiner finishes.`}
          </>
        )}
      </div>
    );
  };

  /**
   * Recorded mode, uploads failed at the end: the candidate types those answers (prefilled with anything
   * this page has for them) and submits — typed answers are marked with the rest; an empty box is unanswered.
   */
  const renderUnsaved = () => {
    const n = unsaved.length;
    const failures = uploads ? Array.from<UploadFailure>(uploads.failures.values()) : [];
    // "unavailable" / "limit" / "too-many-takes" won't change on a retry; a lost connection, a server error or
    // an upload stopped by "Stop waiting" may.
    const canRetry = failures.some((f) => uploadRetryCanHelp(f.code));
    const why = stopped ? STOPPED_WHY[stopped] : submitError || "Check your connection.";
    const nothingAnswered = !answers.some((a) => a.transcript.trim()) && !unsaved.some((i) => (drafts[i] ?? "").trim());
    return (
      <section aria-labelledby="speaking-unsaved-title" className="error-surface rounded-2xl p-4 text-left sm:p-5">
        <div role="alert" className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="speaking-unsaved-title" className="text-sm font-semibold text-red-200">
              {n === 1 ? "One answer couldn't be uploaded." : `${n} answers couldn't be uploaded.`}
            </h2>
            <p className="mt-0.5 text-sm text-red-100/80">
              {why} Type what you said below — typed answers are marked with the rest of your test. An empty box counts as unanswered.
            </p>
          </div>
        </div>
        <ol className="mt-4 space-y-4">
          {unsaved.map((i) => {
            const item = items[i];
            if (!item) return null;
            return (
              <li key={i}>
                <label htmlFor={`speaking-unsaved-${i}`} className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Question {i + 1} · Part {item.part}
                </label>
                <p className="mt-1 text-sm font-medium text-white">{item.question}</p>
                <textarea
                  id={`speaking-unsaved-${i}`}
                  value={drafts[i] ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    const value = e.target.value;
                    setDrafts((prev: Record<number, string>) => ({ ...prev, [i]: value }));
                  }}
                  rows={item.kind === "long" ? 6 : 3}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="Type what you said…"
                  className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-base leading-relaxed text-white placeholder:text-gray-500 focus:border-averna-neon/50 focus:outline-none focus:ring-2 focus:ring-averna-neon/30"
                />
              </li>
            );
          })}
        </ol>
        {nothingAnswered && (
          <p className="mt-4 text-sm font-medium text-amber-100">
            {isMock
              ? "Nothing has been answered yet — if you submit now, this section scores 0."
              : "Nothing has been answered yet — type at least one answer so there's something to assess."}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            onClick={submitWithTyped}
            className="glow-cta min-h-[48px] rounded-xl bg-averna-primary px-6 text-white hover:bg-averna-light"
          >
            <ArrowRight className="mr-2 h-4 w-4" aria-hidden />
            Submit My Answers
          </Button>
          {canRetry && (
            <button
              type="button"
              onClick={retryUploads}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border border-red-400/40 px-4 text-sm font-medium text-red-200 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> Try Uploading Again
            </button>
          )}
        </div>
      </section>
    );
  };

  const renderEnd = () => {
    if (result) return <ResultView result={result} answers={answers} headingRef={headingRef} />;
    return (
      <section aria-labelledby="speaking-end-title" className="space-y-5">
        <div className="av-panel av-panel-hero rounded-3xl p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto h-11 w-11 text-averna-neon" aria-hidden />
          <h1 id="speaking-end-title" ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-bold text-white outline-none sm:text-3xl">
            That&apos;s the end of the Speaking test
          </h1>
          <p className="mt-1 text-sm text-gray-400">{set.title}</p>
          <dl className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Questions answered</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-white">
                {answeredCount}
                <span className="text-base font-medium text-gray-400"> / {total}</span>
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total speaking time</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-white">{formatClock(speakingSeconds * 1000)}</dd>
            </div>
          </dl>
          <div className="mt-6 min-h-[24px]" aria-live="polite">
            {submitState === "uploading" && (
              <div className="mx-auto max-w-sm">
                <p className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
                  {uploads && uploads.total > 0
                    ? `Uploading your answers — ${uploads.done} of ${uploads.total} saved…`
                    : "Uploading your answers…"}
                </p>
                {uploads && uploads.total > 0 && (
                  <div
                    role="progressbar"
                    aria-label="Answers uploaded"
                    aria-valuemin={0}
                    aria-valuemax={uploads.total}
                    aria-valuenow={uploads.done}
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className="h-full rounded-full bg-averna-neon/70 transition-[width] duration-300 motion-reduce:transition-none"
                      style={{ width: `${Math.round((uploads.done / uploads.total) * 100)}%` }}
                    />
                  </div>
                )}
                {uploads?.retrying && (
                  <p className="mt-2 text-xs text-amber-200">The connection dropped — retrying. Keep this page open.</p>
                )}
                {uploadWaitLong && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xs text-gray-400">
                      This is taking longer than it should. You can stop waiting and type the answers that haven&apos;t been saved
                      yet — the saved ones are kept.
                    </p>
                    <button
                      type="button"
                      onClick={stopWaiting}
                      className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/15 px-4 text-sm font-medium text-gray-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
                    >
                      <Keyboard className="h-4 w-4" aria-hidden /> Stop waiting and type the remaining answers
                    </button>
                  </div>
                )}
              </div>
            )}
            {submitState === "submitting" && (
              <p className="inline-flex items-center gap-2 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
                {onSubmit ? "Submitting your answers…" : "Assessing your answers — this can take a few seconds…"}
              </p>
            )}
            {submitState === "submitted" && !saved && (
              <p className="inline-flex items-center gap-2 text-sm text-averna-neon">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Your Speaking answers have been submitted.
              </p>
            )}
            {saved && (
              <p className="inline-flex items-center gap-2 text-sm text-averna-neon">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> This test was already saved — your progress is up to date.
              </p>
            )}
          </div>
        </div>

        {submitState === "upload-failed" && renderUnsaved()}
        {submitState === "error" && (
          <ErrorBox title="Your test hasn't been submitted yet." detail={submitError} actionLabel="Try Again" onAction={() => void submit()} />
        )}
        {submitState === "empty" && (
          <ErrorBox
            title="We didn't catch any speech."
            detail={
              typedMode
                ? "All your answers were empty, so there's nothing to assess. Take the test again and answer each question."
                : "Nothing was transcribed, so there's nothing to assess. Check that your microphone is on and not muted, then take the test again."
            }
            actionLabel="Start Again"
            onAction={restart}
          />
        )}
        {saved?.outcome && <SessionOutcomeCard outcome={saved.outcome} />}
        {saved?.testId && !onSubmit && (
          <div className="flex justify-center">
            <Link
              href={speakingResultHref(saved.testId)}
              className="glow-hover inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-averna-neon/30 bg-averna-neon/[0.07] px-4 text-sm font-semibold text-averna-neon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
            >
              See full result
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        )}
        {!onSubmit && (submitState === "error" || submitState === "empty" || saved) && <ExitLinks />}
      </section>
    );
  };

  return (
    <div className="exam-shell fixed inset-0 z-[70] flex flex-col bg-[#040b09] text-gray-100">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_50%_0%,rgba(11,143,106,0.16),transparent_70%)]"
      />

      <header className="relative flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#07130f]/95 px-3 py-2 backdrop-blur sm:gap-3 sm:px-5">
        {exitHref && !isMock && (
          <Link
            href={exitHref}
            onClick={confirmExit}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Exit
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white sm:text-base">IELTS Speaking{isMock ? " · Mock exam" : ""}</p>
          <p className="truncate text-xs text-gray-400">{set.title}</p>
        </div>
        {view === "test" && inputMode === "speech" && (
          <button
            type="button"
            onClick={() => setShowTranscript((v: boolean) => !v)}
            aria-pressed={showTranscript}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon/60",
              showTranscript ? "border-averna-neon/40 bg-averna-neon/10 text-averna-neon" : "border-white/15 text-gray-300 hover:border-averna-neon/40 hover:text-white"
            )}
          >
            <span
              className={cn("h-3.5 w-3.5 rounded-[4px] border", showTranscript ? "border-averna-neon bg-averna-neon" : "border-gray-400")}
              aria-hidden
            />
            Show transcript
          </button>
        )}
      </header>

      <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-[#06110d]/90 px-4 py-2 sm:px-5">
        <PartProgress part={part} stage={view === "intro" ? "before" : view === "test" ? "during" : "after"} />
        <div className="flex items-center gap-3">
          {view === "test" && <UploadStatus uploads={uploads} />}
          <p className="text-xs font-medium tabular-nums text-gray-400">
            {view === "intro"
              ? `${total} questions`
              : view === "test"
                ? `Question ${Math.min(total, Math.max(1, asked))} of ${total}`
                : `${answeredCount} of ${total} answered`}
          </p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
          {view === "intro" && renderIntro()}
          {view === "test" && renderStage()}
          {view === "end" && renderEnd()}
        </div>
      </div>

      {view === "test" && (
        <footer className="relative shrink-0 border-t border-white/10 bg-[#07130f]/95 px-4 py-3 backdrop-blur sm:px-6">{renderActions()}</footer>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

export default SpeakingExamRunner;
