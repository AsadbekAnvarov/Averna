/**
 * Speech metrics for recorded Speaking answers, from the transcription's word
 * timestamps: how long the candidate talked, the speech rate, and the long
 * pauses — the timing a transcript alone can't show. Plus the clean-up of a
 * raw transcription (Whisper's silence hallucinations) and the transparent
 * fluency estimate used when the AI examiner isn't available.
 *
 * Pure — no I/O. Used per answer by the answer route and in aggregate by
 * submitSpeakingTest (lib/ielts/submit.ts).
 */

export interface TimedWord {
  word: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
}

export interface TimedSegment {
  start: number;
  end: number;
  text: string;
  /** Probability that the segment is silence / non-speech. */
  noSpeechProb?: number;
  avgLogprob?: number;
}

/** A silent gap between two words longer than this is a "long pause". */
export const LONG_PAUSE_SEC = 1.5;

/** Stored in SpeakingRecording.metrics. */
export interface SpeechMetrics {
  /** Length of the recording (s). */
  durationSec: number;
  /** From the first word to the last (s) — how long the candidate actually talked. */
  speechSec: number;
  /** Timed words. */
  words: number;
  /** Words per minute of speechSec (0 when there's too little speech to tell). */
  wpm: number;
  /** Silent gaps between words longer than 1.5 s. */
  longPauses: number;
  /** Longest silent gap between two words (s). */
  longestPauseSec: number;
  /** Silence before the first word (s). */
  startDelaySec: number;
}

/** Totals over a whole test (IELTSTest.aiAnalysis.metrics). */
export interface SpeechMetricsTotal extends SpeechMetrics {
  /** Recorded answers the totals were built from. */
  answers: number;
  /** Long pauses per minute of speech. */
  pausesPerMin: number;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function computeSpeechMetrics(words: TimedWord[], durationSec: number | null): SpeechMetrics {
  const list = words
    .filter((w) => w && typeof w.word === "string" && w.word.trim() && finite(w.start) && finite(w.end))
    .map((w) => ({ start: Math.max(0, w.start), end: Math.max(0, w.start, w.end) }))
    .sort((a, b) => a.start - b.start);
  const lastEnd = list.reduce((m, w) => Math.max(m, w.end), 0);
  const duration = Math.max(0, finite(durationSec) ? durationSec : 0, lastEnd);
  if (!list.length) {
    return { durationSec: r1(duration), speechSec: 0, words: 0, wpm: 0, longPauses: 0, longestPauseSec: 0, startDelaySec: r1(duration) };
  }
  let reach = list[0].end;
  let longPauses = 0;
  let longest = 0;
  for (let i = 1; i < list.length; i++) {
    const gap = list[i].start - reach;
    if (gap > longest) longest = gap;
    if (gap > LONG_PAUSE_SEC) longPauses++;
    reach = Math.max(reach, list[i].end);
  }
  const speech = Math.max(0, reach - list[0].start);
  return {
    durationSec: r1(duration),
    speechSec: r1(speech),
    words: list.length,
    wpm: speech >= 1 ? Math.round(list.length / (speech / 60)) : 0,
    longPauses,
    longestPauseSec: r1(longest),
    startDelaySec: r1(list[0].start),
  };
}

/** Totals over several answers (speech rate over the summed speaking time). */
export function totalSpeechMetrics(list: SpeechMetrics[]): SpeechMetricsTotal {
  const sum = (f: (m: SpeechMetrics) => number) => list.reduce((s, m) => s + f(m), 0);
  const speech = sum((m) => m.speechSec);
  const words = sum((m) => m.words);
  const longPauses = sum((m) => m.longPauses);
  return {
    answers: list.length,
    durationSec: r1(sum((m) => m.durationSec)),
    speechSec: r1(speech),
    words,
    wpm: speech >= 1 ? Math.round(words / (speech / 60)) : 0,
    longPauses,
    longestPauseSec: r1(list.reduce((m, x) => Math.max(m, x.longestPauseSec), 0)),
    startDelaySec: list.length ? r1(sum((m) => m.startDelaySec) / list.length) : 0,
    pausesPerMin: speech >= 1 ? r1(longPauses / (speech / 60)) : 0,
  };
}

/** Stored metrics (a Json column) back into shape, or null. */
export function parseSpeechMetrics(x: unknown): SpeechMetrics | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (!finite(o.speechSec) || !finite(o.words)) return null;
  const n = (v: unknown) => (finite(v) && v >= 0 ? v : 0);
  return {
    durationSec: n(o.durationSec),
    speechSec: n(o.speechSec),
    words: Math.round(n(o.words)),
    wpm: Math.round(n(o.wpm)),
    longPauses: Math.round(n(o.longPauses)),
    longestPauseSec: n(o.longestPauseSec),
    startDelaySec: n(o.startDelaySec),
  };
}

/** Aggregate metrics (aiAnalysis.metrics) back into shape, or null. */
export function parseSpeechMetricsTotal(x: unknown): SpeechMetricsTotal | null {
  const m = parseSpeechMetrics(x);
  if (!m) return null;
  const o = x as Record<string, unknown>;
  return {
    ...m,
    answers: finite(o.answers) ? Math.max(0, Math.round(o.answers)) : 0,
    pausesPerMin: finite(o.pausesPerMin) ? Math.max(0, o.pausesPerMin) : m.speechSec >= 1 ? r1(m.longPauses / (m.speechSec / 60)) : 0,
  };
}

// ---------------------------------------------------------------------------
// Transcript clean-up
// ---------------------------------------------------------------------------

export interface CleanTranscript {
  text: string;
  words: TimedWord[];
  /** Segments dropped as silence. */
  droppedSegments: number;
}

const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Whisper's own "this was silence" rule (no_speech_threshold 0.6, logprob_threshold −1). */
function silent(s: TimedSegment): boolean {
  return (s.noSpeechProb ?? 0) > 0.6 && (s.avgLogprob ?? 0) < -1;
}

/**
 * Remove what the candidate didn't say: segments Whisper itself rates as
 * silence (it "hears" things like "Thank you." in a quiet room), and a
 * transcript that is only the examiner's question echoed back (the question
 * is passed as the transcription prompt).
 */
export function cleanTranscription(
  t: { text: string; words: TimedWord[]; segments: TimedSegment[] },
  prompt?: string
): CleanTranscript {
  let text = (t.text || "").trim();
  let words = Array.isArray(t.words) ? t.words : [];
  let droppedSegments = 0;
  const segments = Array.isArray(t.segments) ? t.segments : [];
  if (segments.length) {
    const kept = segments.filter((s) => !silent(s));
    droppedSegments = segments.length - kept.length;
    if (droppedSegments > 0) {
      text = kept
        .map((s) => (s.text || "").trim())
        .filter(Boolean)
        .join(" ");
      words = words.filter((w) => {
        const mid = (w.start + w.end) / 2;
        return kept.some((s) => mid >= s.start - 0.05 && mid <= s.end + 0.05);
      });
    }
  }
  const norm = normText(text);
  if (!norm || (prompt && norm === normText(prompt))) return { text: "", words: [], droppedSegments };
  return { text, words, droppedSegments };
}

/**
 * Keep only what was said within `maxSec` (the examiner stops the candidate
 * at the time limit). Only an over-long upload is affected; its transcript is
 * rebuilt from the timed words.
 */
export function clipToSeconds(c: CleanTranscript, maxSec: number): CleanTranscript {
  if (!c.words.some((w) => w.start > maxSec)) return c;
  const words = c.words.filter((w) => w.start <= maxSec);
  return { ...c, words, text: words.map((w) => w.word.trim()).filter(Boolean).join(" ") };
}

// ---------------------------------------------------------------------------
// Fluency without the AI examiner
// ---------------------------------------------------------------------------

/** Same linking phrases as the transcript heuristic (lib/utils scoreSpeaking). */
const LINKERS = [
  "because",
  "however",
  "although",
  "for example",
  "such as",
  "therefore",
  "in addition",
  "on the other hand",
  "firstly",
  "finally",
  "in my opinion",
];

/**
 * Fluency & Coherence estimated from the recording's timing — speech rate and
 * hesitation (long pauses) — plus a small coherence credit for linking
 * phrases. Transparent and deliberately conservative (3–8). Null when there
 * is too little speech to judge (the caller keeps its own heuristic).
 */
export function fluencyFromMetrics(total: SpeechMetricsTotal, transcript: string): number | null {
  if (total.words < 20 || total.speechSec < 15) return null;
  const wpm = total.wpm;
  let band =
    wpm >= 140 ? 7.5 : wpm >= 125 ? 7 : wpm >= 110 ? 6.5 : wpm >= 95 ? 6 : wpm >= 80 ? 5.5 : wpm >= 65 ? 5 : wpm >= 50 ? 4.5 : 4;
  const ppm = total.pausesPerMin;
  if (ppm >= 6) band -= 1.5;
  else if (ppm >= 4) band -= 1;
  else if (ppm >= 2.5) band -= 0.5;
  else if (ppm <= 1 && wpm >= 95) band += 0.5;
  if (total.longestPauseSec >= 6) band -= 0.5;
  const lower = transcript.toLowerCase();
  if (LINKERS.filter((l) => lower.includes(l)).length >= 3) band += 0.5;
  return Math.max(3, Math.min(8, Math.round(band * 2) / 2));
}

/** Feedback lines drawn from the recording's timing (shown with the heuristic assessment). */
export function metricsFeedback(total: SpeechMetricsTotal): string[] {
  const out: string[] = [];
  if (total.words < 20 || total.speechSec < 15) return out;
  if (total.wpm < 80) {
    out.push(`You spoke at about ${total.wpm} words per minute. Aim for 100–140: speak in longer phrases instead of a few words at a time.`);
  } else if (total.wpm > 190) {
    out.push(`You spoke very fast — about ${total.wpm} words per minute. Slow down a little so every word is clear.`);
  }
  if (total.longPauses >= 3 && total.pausesPerMin >= 2.5) {
    out.push(
      `You paused for more than ${LONG_PAUSE_SEC} seconds ${total.longPauses} times. When you need time to think, use a phrase like "That's an interesting question…" instead of silence.`
    );
  } else if (total.longestPauseSec >= 6) {
    out.push(`Your longest pause was ${Math.round(total.longestPauseSec)} seconds. If you lose your idea, paraphrase or give an example to keep going.`);
  }
  return out;
}
