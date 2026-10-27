/**
 * "How it went" — numbers for a finished live call, from the transcript kept in the
 * browser. Pure and client-safe (reuses the peer-speaking fluency helpers).
 *
 *   talk time       the call's length
 *   your words      words in the student's own final transcripts
 *   words a minute  over the student's speaking time (the server's voice detection
 *                   start/stop per turn; ≈ 0.4 s a word when a turn has no timing),
 *                   null below 15 s of speech
 *   filler words    um, uh, like, you know … (lib/speaking/fluency.ts)
 *   longest answer  the student turn with the most words
 */
import { countFillers, countWords, topFillers, wordsPerMinute, type Filler } from "@/lib/speaking/fluency";

export interface LiveLogprob {
  token: string;
  logprob: number;
}

export interface LiveTurn {
  id: string;
  who: "me" | "ai";
  /** Final text of the turn. */
  text: string;
  /** Student turns: speaking time from the voice detector (ms), when known. */
  speechMs?: number | null;
  /** Student turns: per-token logprobs of the transcription, when the API sent them. */
  logprobs?: LiveLogprob[] | null;
}

export interface LiveStats {
  callSec: number;
  mySpeechSec: number;
  words: number;
  wpm: number | null;
  fillers: number;
  topFillers: [Filler, number][];
  longestAnswer: { words: number; text: string } | null;
  myTurns: number;
}

/** Speaking time credited per word when a turn has no voice-detector timing. */
export const MS_PER_WORD_ESTIMATE = 400;
const EXCERPT_CHARS = 160;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function liveStats(turns: readonly LiveTurn[], callSec: number): LiveStats {
  const mine = turns.filter((t) => t.who === "me" && t.text.trim());
  let words = 0;
  let speechMs = 0;
  let longest: { words: number; text: string } | null = null;
  for (const t of mine) {
    const w = countWords(t.text);
    words += w;
    speechMs += finite(t.speechMs) && t.speechMs > 0 ? t.speechMs : w * MS_PER_WORD_ESTIMATE;
    if (w > 0 && (!longest || w > longest.words)) {
      const text = t.text.replace(/\s+/g, " ").trim();
      longest = { words: w, text: text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS - 1).trimEnd()}…` : text };
    }
  }
  const call = Math.max(0, Math.round(finite(callSec) ? callSec : 0));
  // The student can't have spoken longer than the call lasted.
  const speechCapped = call > 0 ? Math.min(speechMs, call * 1000) : speechMs;
  const fillers = countFillers(mine.map((t) => t.text).join(" \n "));
  return {
    callSec: call,
    mySpeechSec: Math.round(speechCapped / 1000),
    words,
    wpm: wordsPerMinute(words, speechCapped),
    fillers: fillers.total,
    topFillers: topFillers(fillers),
    longestAnswer: longest,
    myTurns: mine.length,
  };
}

/** "3:05". */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Three short tips from the numbers alone — used without an AI key, when today's AI
 * tips are used up, or when the tips request fails. Deterministic.
 */
export function fallbackTips(s: LiveStats): string[] {
  const tips: string[] = [];
  if (s.wpm != null && s.wpm < 90) tips.push("Try to speak in longer phrases, not word by word. Aim for about 100–140 words a minute.");
  else if (s.wpm != null && s.wpm > 170) tips.push("Slow down a little so every word comes out clearly.");
  if (s.words > 0 && s.fillers >= 3 && s.fillers / s.words >= 0.04) {
    const top = s.topFillers[0]?.[0];
    tips.push(`You used ${s.fillers} filler words${top ? ` (most often "${top}")` : ""}. Pause silently instead, or say "Let me think…".`);
  }
  if (s.longestAnswer && s.longestAnswer.words < 25)
    tips.push("Give longer answers: add a reason and an example, with because… and for example….");
  else if (s.longestAnswer) tips.push(`Your longest answer had ${s.longestAnswer.words} words. Extend more answers like that one with reasons and examples.`);
  if (s.myTurns > 0 && s.myTurns < 4) tips.push("Ask your partner a question back now and then. It keeps the conversation going.");
  if (s.words === 0) tips.push("Next time, answer out loud in full sentences. The partner waits while you think.");
  tips.push("Before the next call, learn three new words for this topic and try to use them.");
  tips.push("Link your ideas with words such as however, on the other hand and as a result.");
  return [...new Set(tips)].slice(0, 3);
}
