/**
 * The placement test's optional Writing sample (120–150 words, 15 minutes).
 *
 * Assessed by the AI examiner (assessWritingTask) when OpenAI is configured
 * and the per-user "placement" AI limit allows it; otherwise — or when the
 * model call fails or takes longer than WRITING_AI_TIMEOUT_MS (35 s) — by the
 * offline heuristic. Either way the band is capped
 * for short samples and for automatic estimates (config.ts), so a short test
 * never overstates the level. Never throws.
 *
 * SERVER ONLY.
 */

import { assessWritingTask, hasOpenAI, heuristicWritingAssessment, type WritingAssessment } from "@/lib/ai";
import { cachedAi, guardAi } from "@/lib/engine/ai-guard";
import { MIN_AI_WORDS, WRITING_AI_TIMEOUT_MS } from "./config";
import { capWritingBand, countWords } from "./scoring";
import type { PlacementWritingPrompt, WritingCriteria } from "./types";

/**
 * `p`, or a rejection after `ms`. The model call itself isn't cancelled (lib/ai
 * owns the client) — its late answer is just not waited for.
 */
function withinTime<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export interface PlacementWritingAssessment {
  band: number;
  words: number;
  assessedBy: "ai" | "heuristic";
  criteria: WritingCriteria;
  feedback: string[];
}

const AI_CACHE_MS = 30 * 60_000;

/** FNV-1a — a short fingerprint so a retried submission reuses the same assessment. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const score = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 9 ? n : null;
};

function lines(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
}

/** The heuristic's length lines assume 150 / 250 words — not this task's 120–150. */
const LENGTH_LINE = /^(good length|too short)\b/i;

export async function assessPlacementWriting(o: {
  userId: string;
  attemptId: string;
  essay: string;
  prompt: PlacementWritingPrompt;
}): Promise<PlacementWritingAssessment> {
  const essay = o.essay.trim();
  const words = countWords(essay);
  let a: WritingAssessment | null = null;
  let assessedBy: "ai" | "heuristic" = "heuristic";

  if (words >= MIN_AI_WORDS && hasOpenAI() && guardAi(o.userId, "placement").ok) {
    const task =
      `${o.prompt.prompt}\n\n` +
      `(Placement test writing sample: the candidate had 15 minutes and was asked for ${o.prompt.minWords}–${o.prompt.maxWords} words. ` +
      `Do not penalise it for being shorter than a full Task 2 essay; judge the level of English it shows.)`;
    try {
      // One attempt, at most WRITING_AI_TIMEOUT_MS: no retry on this path — a slow or failed
      // examiner means the offline estimate, never a submit (or run page) that hits the 60 s limit.
      a = await withinTime(
        cachedAi(`placement-writing:${o.attemptId}:${fingerprint(essay)}`, AI_CACHE_MS, () => assessWritingTask(essay, "task2", task)),
        WRITING_AI_TIMEOUT_MS
      );
      assessedBy = "ai";
    } catch (e) {
      console.error("Placement writing: AI assessment failed or timed out, using the heuristic", e instanceof Error ? e.message : e);
      a = null;
    }
  }

  // The heuristic's own minimum is 150 words for "task1" — the closest to this task's target.
  const fallback = heuristicWritingAssessment(essay, "task1");
  if (!a || score(a.overallBand) == null) {
    a = fallback;
    assessedBy = "heuristic";
  }

  const criteria: WritingCriteria = {
    task: score(a.taskAchievement) ?? fallback.taskAchievement,
    coherence: score(a.coherenceCohesion) ?? fallback.coherenceCohesion,
    lexical: score(a.lexicalResource) ?? fallback.lexicalResource,
    grammar: score(a.grammarAccuracy) ?? fallback.grammarAccuracy,
  };
  const raw = score(a.overallBand) ?? (criteria.task + criteria.coherence + criteria.lexical + criteria.grammar) / 4;
  const band = capWritingBand(raw, words, assessedBy);

  const pool = [...lines(a.strengths).slice(0, 1), ...lines(a.recommendations), ...lines(a.weaknesses)];
  const feedback = (assessedBy === "heuristic" ? pool.filter((l) => !LENGTH_LINE.test(l)) : pool)
    .slice(0, 3)
    .map((l) => (l.length > 220 ? `${l.slice(0, 217)}…` : l));

  return { band, words, assessedBy, criteria, feedback };
}
