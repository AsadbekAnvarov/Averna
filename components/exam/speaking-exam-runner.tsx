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
  RotateCcw,
  Sparkles,
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
import { formatClock, useLeaveGuard } from "./use-exam";
import type { SpeakingAnswer, SpeakingExamRunnerProps, SpeakingTestResult, SpeakingTestSubmission } from "./types";

// ---------------------------------------------------------------------------
// Script & timings
// ---------------------------------------------------------------------------

type Part = 1 | 2 | 3;
type InputMode = SpeakingTestSubmission["inputMode"];
type TurnKind = "short" | "long" | "followUp";
type EndReason = "next" | "timeout" | "cancel";

interface TurnItem {
  part: Part;
  question: string;
  kind: TurnKind;
}

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
  /** The recorder was started for this turn. */
  recording: boolean;
  /** Recognition failed during this turn and the candidate finished it by typing. */
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
type MicState = "unknown" | "checking" | "ready" | "blocked" | "missing" | "busy" | "unsupported";
type SubmitState = "idle" | "submitting" | "submitted" | "error" | "empty";
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

const MIC_PROBLEM: Record<"blocked" | "missing" | "busy", { title: string; detail: string }> = {
  blocked: {
    title: "Microphone access is blocked.",
    detail: "Allow the microphone for this site (use the icon in the address bar), then check again.",
  },
  missing: { title: "No microphone was found.", detail: "Connect a microphone or headset, then check again." },
  busy: { title: "Your microphone is busy.", detail: "Another app or tab is using it. Close it, then check again." },
};

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
      </section>

      <section aria-labelledby="speaking-criteria-title" className="av-panel rounded-2xl p-5 sm:p-6">
        <h2 id="speaking-criteria-title" className="text-sm font-semibold text-white">
          Band by criterion
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
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
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
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

export function SpeakingExamRunner({ set, mode, attemptId, onSubmit, exitHref }: SpeakingExamRunnerProps) {
  const isMock = mode === "mock";
  const followUp = set.part2.followUp?.trim() ?? "";
  const longMin = isMock ? TIMING.longMinMock : TIMING.longMinPractice;
  const total = useMemo(
    () =>
      set.part1.reduce((n, t) => n + t.questions.length, 0) + 1 + (set.part2.followUp?.trim() ? 1 : 0) + set.part3.questions.length,
    [set]
  );

  const [caps, setCaps] = useState<Capabilities | null>(null);
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
  const [saved, setSaved] = useState<{ outcome: SpeakingTestResult["outcome"] } | null>(null);

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

  const setInputMode = useCallback((m: InputMode) => {
    inputModeRef.current = m;
    setInputModeState(m);
  }, []);

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

  const checkMic = useCallback(async (): Promise<boolean> => {
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
  }, []);

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
      if (turnRef.current !== turn) return; // cancelled while the recorder was stopping
      turnRef.current = null;
      const transcript = (!turn.recording || turn.typedFallback ? typedRef.current : spoken).trim();
      const answer: SpeakingAnswer = {
        part: turn.item.part,
        question: turn.item.question,
        transcript,
        seconds: Math.max(0, Math.min(turn.max, seconds)),
      };
      answersRef.current = [...answersRef.current, answer];
      setAnswers(answersRef.current);
      if (reason === "timeout") announce(turn.item.kind === "long" ? "Time is up." : "Time is up for this answer.");
      turn.resolve(reason);
    },
    [announce]
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
        body: JSON.stringify({ ...submission, submissionId: attemptId }),
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
        setSaved({ outcome: (data as { outcome?: SpeakingTestResult["outcome"] }).outcome ?? null });
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
  }, [attemptId]);

  const finishTest = () => {
    setActivity({ kind: "idle" });
    setCardVisible(false);
    const list = answersRef.current;
    submissionRef.current = {
      setId: set.id,
      answers: list,
      totalSeconds: list.reduce((sum, a) => sum + a.seconds, 0),
      inputMode: inputModeRef.current,
    };
    setView("end");
    void submit();
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

  /** The candidate's turn: records (or takes typing) until Next or the time limit. */
  const answerTurn = (item: TurnItem, min: number, max: number) =>
    new Promise<EndReason>((resolve) => {
      const recorder = recorderRef.current;
      const speech = inputModeRef.current === "speech" && recorder !== null;
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
        typedFallback: false,
        ending: false,
        timer: null,
        resolve,
      };
      turnRef.current = handle;
      if (speech && recorder) recorder.start();
      handle.timer = setTimeout(() => void endTurn("timeout"), max * 1000);
      setNow(startedAt);
      setActivity({ kind: "turn", item, startedAt, min, max });
      // Keep it short while the microphone is open: a screen reader on speakers would be transcribed.
      announce(speech ? "Your turn." : "Your turn. Type what you would say.");
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

    answersRef.current = [];
    setAnswers([]);
    submissionRef.current = null;
    markRef.current = "";
    setNotes("");
    setTyped("");
    setLive(EMPTY_LIVE);
    setMicIssue(null);
    setResult(null);
    setSaved(null);
    setSubmitState("idle");
    setSubmitError("");
    setCardVisible(false);
    setPart(1);
    setAsked(0);
    setActivity({ kind: "idle" });
    setView("test");

    let n = 0;
    const ask = async (item: TurnItem, min: number, max: number) => {
      setAsked(n + 1);
      await step(say(item.question, signal));
      await step(answerTurn(item, min, max));
      n++;
    };

    try {
      await step(sleep(500, signal));

      // Part 1 — introduction and interview.
      await step(say(`${greeting()} ${LINES.part1}`, signal));
      for (const topic of set.part1) {
        await step(say(LINES.topic(inSentence(topic.topic)), signal));
        for (const q of topic.questions) await ask({ part: 1, question: q, kind: "short" }, TIMING.minAnswer, TIMING.part1Max);
      }

      // Part 2 — the long turn.
      setPart(2);
      await step(say(LINES.part2, signal));
      setAsked(n + 1);
      setCardVisible(true);
      await step(prepTime(TIMING.prep));
      await step(say(LINES.part2Go, signal));
      await step(answerTurn({ part: 2, question: set.part2.cue, kind: "long" }, longMin, TIMING.longMax));
      n++;
      await step(say(LINES.part2Stop, signal));
      setCardVisible(false);
      if (followUp) await ask({ part: 2, question: followUp, kind: "followUp" }, TIMING.minAnswer, TIMING.followUpMax);

      // Part 3 — discussion.
      setPart(3);
      await step(say(LINES.part3(inSentence(set.part3.theme)), signal));
      for (const q of set.part3.questions) await ask({ part: 3, question: q, kind: "short" }, TIMING.minAnswer, TIMING.part3Max);

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
      stopSpeaking();
      finishTest();
    }
  };

  const onStart = async () => {
    if (starting || !caps) return;
    primeSpeech(); // must run inside the click: lets iOS Safari speak later
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

  const switchToTyping = () => setInputMode("typed");
  const switchToMicrophone = async () => {
    setInputMode("speech");
    setMicIssue(null);
    if (caps?.media) await checkMic();
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

  const renderMicCheck = () => {
    if (!caps) {
      return (
        <p className="flex min-h-[44px] items-center gap-2 text-sm text-gray-400" role="status">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> Checking your browser…
        </p>
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
    if (typedMode) {
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
    if (mic === "blocked" || mic === "missing" || mic === "busy") {
      const p = MIC_PROBLEM[mic];
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
    }
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

        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
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

      <div className="av-panel rounded-2xl p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-white">Before you start</h2>
        <div className="mt-3 space-y-3">
          {renderMicCheck()}
          {renderVoiceCheck()}
        </div>
      </div>

      <div className="flex justify-stretch sm:justify-end">
        <Button
          type="button"
          size="lg"
          onClick={() => void onStart()}
          disabled={!caps || starting}
          className="glow-cta min-h-[52px] w-full rounded-xl bg-averna-primary px-8 text-base font-semibold text-white hover:bg-averna-light sm:w-auto"
        >
          {starting ? (
            <Loader2 className="mr-2 h-5 w-5 motion-safe:animate-spin" aria-hidden />
          ) : typedMode ? (
            <Keyboard className="mr-2 h-5 w-5" aria-hidden />
          ) : (
            <Mic className="mr-2 h-5 w-5" aria-hidden />
          )}
          Start Speaking Test
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

        {(voiceIssue || micIssue) && (
          <div className="mt-5 w-full space-y-2">
            {voiceIssue && <Notice>{voiceIssue}</Notice>}
            {micIssue && <Notice>{micIssue}</Notice>}
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

        {turn && !typedMode && showTranscript && (
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

        {turn && !typedMode && reconnecting && (
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
        {view === "test" && !typedMode && (
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
        <p className="text-xs font-medium tabular-nums text-gray-400">
          {view === "intro"
            ? `${total} questions`
            : view === "test"
              ? `Question ${Math.min(total, Math.max(1, asked))} of ${total}`
              : `${answeredCount} of ${total} answered`}
        </p>
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
