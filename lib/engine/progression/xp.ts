/**
 * XP rules — pure, dependency-free scoring for every learning activity.
 *
 * Pipeline (same for every skill, only the first stage differs):
 *
 *   activity volume ─► accuracy / quality ─► completion ─► difficulty
 *        ─► first-attempt / improvement / personal-best bonuses
 *        ─► repeat decay ─► poor-attempt & variety rules ─► integrity trust
 *        ─► daily budget taper ─► final XP
 *
 * Every step is recorded as a human-readable line, so the student can always
 * see WHY an attempt earned what it did (and the server stores that breakdown
 * in the XP ledger). The frontend never computes XP — it only shows these lines.
 */

import { XP_CONFIG } from "./config";

export interface XpLine {
  label: string;
  /** Flat XP added (bonuses) … */
  amount?: number;
  /** … or a multiplier applied to the running total. */
  factor?: number;
}

export interface XpResult {
  xp: number;
  lines: XpLine[];
  /** Student-facing notes (why XP was reduced / withheld, how to earn more). */
  notes: string[];
}

/** What the server knows about the student's history before this attempt. */
export interface XpHistory {
  /** Average band of the last few attempts in this skill (0 = no history). */
  recentAvg: number;
  /** Best band ever in this skill (0 = none). */
  bestBand: number;
  /** Previous attempts of this exact content (test id / prompt). */
  contentAttempts: number;
  /** Earlier poor attempts in this skill today. */
  poorAttemptsToday: number;
  /** Earlier sessions in this skill today. */
  skillSessionsToday: number;
  /** Learning XP already earned today (for the daily budget). */
  earnedToday: number;
  /** Integrity trust multiplier (0..1), from the Integrity Engine. */
  trust?: number;
}

export const EMPTY_HISTORY: XpHistory = {
  recentAvg: 0,
  bestBand: 0,
  contentAttempts: 0,
  poorAttemptsToday: 0,
  skillSessionsToday: 0,
  earnedToday: 0,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const r2 = (n: number) => Math.round(n * 100) / 100;

export function accuracyMultiplier(accuracy: number): number {
  const { floor, exponent } = XP_CONFIG.accuracy;
  return floor + (1 - floor) * Math.pow(clamp(accuracy, 0, 1), exponent);
}

export function bandQuality(band: number, q: { floor: number; from: number; span: number }): number {
  return q.floor + (1 - q.floor) * clamp((band - q.from) / q.span, 0, 1);
}

export function repeatFactor(previousAttempts: number): number {
  const d = XP_CONFIG.repeatDecay;
  const n = Math.max(0, Math.floor(previousAttempts));
  return n < d.length ? d[n] : XP_CONFIG.repeatFloor;
}

/**
 * Daily budget taper: returns how much of `raw` is actually paid given what was
 * already earned today. Piecewise-linear, so there is never a cliff.
 */
export function applyDailyBudget(raw: number, earnedToday: number): number {
  const { soft, hard, softRate, hardRate } = XP_CONFIG.dailyBudget;
  // `at` and the limits are in PAID XP (what the student has actually earned
  // today); `remaining` is raw XP still to convert.
  let remaining = Math.max(0, raw);
  let at = Math.max(0, earnedToday);
  let paid = 0;
  const band = (limit: number, rate: number) => {
    if (remaining <= 0 || at >= limit) return;
    const rawToFill = (limit - at) / rate;
    const used = Math.min(remaining, rawToFill);
    paid += used * rate;
    at += used * rate;
    remaining -= used;
  };
  band(soft, 1);
  band(hard, softRate);
  if (remaining > 0) paid += remaining * hardRate;
  return paid;
}

/** Shared tail of the pipeline: bonuses, decay, rules, trust, budget. */
function finish(
  subtotal: number,
  lines: XpLine[],
  notes: string[],
  h: XpHistory,
  band: number,
  opts: { accuracy?: number } = {}
): XpResult {
  let xp = subtotal;

  if (h.contentAttempts === 0 && xp > 0) {
    const bonus = Math.round(xp * XP_CONFIG.firstAttemptBonus);
    if (bonus > 0) {
      xp += bonus;
      lines.push({ label: "First attempt", amount: bonus });
    }
  }
  if (h.recentAvg > 0 && band > h.recentAvg) {
    const bonus = Math.round(
      Math.min(XP_CONFIG.improvement.max, (band - h.recentAvg) * XP_CONFIG.improvement.perBand)
    );
    if (bonus > 0) {
      xp += bonus;
      lines.push({ label: "Beat your recent average", amount: bonus });
    }
  }
  if (h.bestBand > 0 && band > h.bestBand) {
    xp += XP_CONFIG.personalBest;
    lines.push({ label: "New personal best", amount: XP_CONFIG.personalBest });
  }

  const rep = repeatFactor(h.contentAttempts);
  if (rep < 1) {
    xp *= rep;
    lines.push({ label: `Repeat attempt #${h.contentAttempts + 1}`, factor: rep });
    notes.push("Retakes earn less — try new material for full XP.");
  }

  const poor = XP_CONFIG.poorAttempt;
  if (opts.accuracy != null && opts.accuracy < poor.accuracy && h.poorAttemptsToday >= poor.freeAttempts) {
    xp *= poor.multiplier;
    lines.push({ label: "Several low-accuracy attempts today", factor: poor.multiplier });
    notes.push("Slow down and review your mistakes — careful attempts earn much more.");
  }

  const variety = XP_CONFIG.sameSkillPerDay;
  if (h.skillSessionsToday >= variety.full) {
    xp *= variety.multiplier;
    lines.push({ label: "Same skill many times today", factor: variety.multiplier });
    notes.push("Switch to another skill to earn full XP again.");
  }

  if (h.trust != null && h.trust < 0.995) {
    const t = clamp(h.trust, 0, 1);
    xp *= t;
    lines.push({ label: "Integrity check", factor: r2(t) });
  }

  const beforeBudget = xp;
  xp = applyDailyBudget(xp, h.earnedToday);
  if (beforeBudget > 0 && xp < beforeBudget - 0.5) {
    lines.push({ label: "Daily limit taper", factor: r2(xp / beforeBudget) });
    notes.push("You've studied a lot today — XP tapers off and resets tomorrow.");
  }

  return { xp: Math.max(0, Math.round(xp)), lines, notes };
}

// ---------------------------------------------------------------------------
// Reading / Listening
// ---------------------------------------------------------------------------

export interface ObjectiveXpInput {
  skill: "READING" | "LISTENING";
  correct: number;
  total: number;
  answered: number;
  band: number;
  difficulty?: string | null;
  /** Extra multiplier (e.g. mock-exam sections). */
  multiplier?: number;
  history: XpHistory;
}

export function computeObjectiveXp(i: ObjectiveXpInput): XpResult {
  const lines: XpLine[] = [];
  const notes: string[] = [];
  const total = Math.max(0, Math.floor(i.total));
  if (total === 0 || i.answered <= 0 || i.correct <= 0) {
    notes.push(
      i.answered <= 0 ? "Answer the questions to earn XP." : "Get at least one answer right to earn XP."
    );
    return { xp: 0, lines, notes };
  }
  const cfg = XP_CONFIG.objective[i.skill];
  const items = Math.min(total, cfg.maxItems);
  const base = items * cfg.perItem;
  lines.push({ label: `${items} questions`, amount: base });

  const accuracy = clamp(i.correct / total, 0, 1);
  const acc = accuracyMultiplier(accuracy);
  lines.push({ label: `Accuracy ${Math.round(accuracy * 100)}%`, factor: r2(acc) });

  const completionRatio = clamp(i.answered / total, 0, 1);
  const comp = XP_CONFIG.completion.floor + (1 - XP_CONFIG.completion.floor) * completionRatio;
  if (comp < 0.999) {
    lines.push({ label: `Completed ${Math.round(completionRatio * 100)}%`, factor: r2(comp) });
    notes.push("Finish every question to earn full XP.");
  }

  const diff = XP_CONFIG.difficulty[i.difficulty ?? "Medium"] ?? 1;
  if (diff !== 1) lines.push({ label: `${i.difficulty} material`, factor: diff });

  let subtotal = base * acc * comp * diff;
  if (i.multiplier && i.multiplier !== 1) {
    subtotal *= i.multiplier;
    lines.push({ label: "Mock exam section", factor: i.multiplier });
  }
  return finish(subtotal, lines, notes, i.history, i.band, { accuracy });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export interface WritingXpInput {
  task: "task1" | "task2";
  words: number;
  band: number;
  genuine: boolean;
  onTopic: boolean;
  coherence?: number | null;
  multiplier?: number;
  history: XpHistory;
}

export function computeWritingXp(i: WritingXpInput): XpResult {
  const lines: XpLine[] = [];
  const notes: string[] = [];
  const cfg = XP_CONFIG.writing[i.task];
  if (!i.onTopic) {
    notes.push("Your essay looks off-topic — answer the prompt to earn XP.");
    return { xp: 0, lines, notes };
  }
  if (!i.genuine || i.words < cfg.minWords) {
    notes.push(
      `Write at least ${cfg.minWords} meaningful words to earn XP (the IELTS target is ${cfg.targetWords}).`
    );
    return { xp: 0, lines, notes };
  }
  lines.push({ label: i.task === "task1" ? "Writing Task 1" : "Writing Task 2", amount: cfg.base });

  const length = Math.pow(Math.min(1, i.words / cfg.targetWords), XP_CONFIG.writing.lengthExponent);
  if (length < 0.999) {
    lines.push({ label: `${i.words}/${cfg.targetWords} words`, factor: r2(length) });
    notes.push(`Reach ${cfg.targetWords} words for full XP — short essays lose marks in the real exam too.`);
  }
  const quality = bandQuality(i.band, XP_CONFIG.writing.quality);
  lines.push({ label: `Band ${i.band.toFixed(1)} quality`, factor: r2(quality) });

  let subtotal = cfg.base * length * quality;
  const sb = XP_CONFIG.writing.structureBonus;
  if (i.coherence != null && i.coherence >= sb.minCriterion && length >= 0.999) {
    subtotal += sb.xp;
    lines.push({ label: "Clear structure", amount: sb.xp });
  }
  if (i.multiplier && i.multiplier !== 1) {
    subtotal *= i.multiplier;
    lines.push({ label: "Mock exam section", factor: i.multiplier });
  }
  return finish(subtotal, lines, notes, i.history, i.band);
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

export interface SpeakingXpInput {
  seconds: number;
  words: number;
  band: number;
  history: XpHistory;
  /** A full Speaking test (Parts 1–3): larger base, longer target. */
  fullTest?: boolean;
  /** Answers were typed (no speech recognition in this browser): half XP. */
  typed?: boolean;
  /** Extra multiplier (e.g. mock-exam sections). */
  multiplier?: number;
}

export function computeSpeakingXp(i: SpeakingXpInput): XpResult {
  const lines: XpLine[] = [];
  const notes: string[] = [];
  const cfg = XP_CONFIG.speaking;
  const base = i.fullTest ? cfg.fullTest.base : cfg.base;
  const target = i.fullTest ? cfg.fullTest.targetSeconds : cfg.targetSeconds;
  const seconds = clamp(Math.round(i.seconds), 0, i.fullTest ? cfg.fullTest.maxSeconds : cfg.maxSeconds);
  if (seconds < cfg.minSeconds || i.words < cfg.minWords) {
    notes.push(`Speak for at least ${cfg.minSeconds} seconds (${cfg.minWords}+ words) to earn XP.`);
    return { xp: 0, lines, notes };
  }
  lines.push({ label: i.fullTest ? "Full Speaking test" : "Speaking practice", amount: base });
  const duration = Math.min(1, seconds / target);
  if (duration < 0.999) {
    lines.push({ label: `${seconds}s of ${target}s`, factor: r2(duration) });
    notes.push(
      i.fullTest
        ? `Develop your answers — about ${Math.round(target / 60)} minutes of speech across the three parts earns full XP.`
        : `Aim for a ${Math.round(target / 60)}-minute answer — that's the IELTS Part 2 length.`
    );
  }
  const quality = bandQuality(i.band, cfg.quality);
  lines.push({ label: `Band ${i.band.toFixed(1)} quality`, factor: r2(quality) });

  let subtotal = base * duration * quality;
  const wpm = i.words / (seconds / 60);
  if (wpm > cfg.maxWpm) {
    subtotal *= cfg.implausibleMultiplier;
    lines.push({ label: "Unusual speaking rate", factor: cfg.implausibleMultiplier });
    notes.push("The transcript came in faster than natural speech, so XP was reduced.");
  }
  if (i.typed) {
    subtotal *= cfg.typedMultiplier;
    lines.push({ label: "Typed answers", factor: cfg.typedMultiplier });
    notes.push("Typed answers earn half XP — use a browser with a microphone to practise real speaking.");
  }
  if (i.multiplier && i.multiplier !== 1) {
    subtotal *= i.multiplier;
    lines.push({ label: "Mock exam section", factor: i.multiplier });
  }
  return finish(subtotal, lines, notes, i.history, i.band);
}

// ---------------------------------------------------------------------------
// Small activities
// ---------------------------------------------------------------------------

export function computeDailyQuizXp(correct: number): number {
  const q = XP_CONFIG.dailyQuiz;
  return clamp(Math.floor(correct), 0, q.questions) * q.perCorrect;
}

export function computeSrsReviewXp(intervalDays: number): number {
  const s = XP_CONFIG.srs;
  return Math.min(s.maxPerReview, s.base + Math.floor(Math.max(0, intervalDays) / s.intervalDivisor));
}

export function computeHomeworkXp(basePoints: number, position: number, genuine: boolean): number {
  if (!genuine) return 0;
  const bonus = XP_CONFIG.homework.positionBonus[position - 1] ?? 0;
  return Math.max(0, Math.round(basePoints)) + bonus;
}

// ---------------------------------------------------------------------------
// Estimates (for missions / recommendations — same engine, typical inputs)
// ---------------------------------------------------------------------------

export type EstimateKind =
  | "reading" // a Reading test of `questions` questions (default 30 — the older short tests)
  | "readingPassage" // one passage of a full paper (≈13 questions, 20 min)
  | "readingFull" // a full Academic Reading paper (40 questions, 60 min)
  | "listening" // a Listening test of `questions` questions (default 8 — the older short tests)
  | "listeningPart" // one part of a full paper (10 questions)
  | "listeningFull" // a full Listening paper (40 questions)
  | "writingTask1"
  | "writingTask2"
  | "writingExam" // Task 1 + Task 2 in one 60-minute sitting
  | "speaking" // one 2-minute answer to the AI examiner
  | "speakingTest" // a full Speaking test, Parts 1–3
  | "mock" // the full mock exam: all four sections, each × mock.sectionMultiplier
  | "dailyQuiz"
  | "flashcards";

export interface EstimateOptions {
  /** Questions in the linked paper / part (defaults to the real exam format). */
  questions?: number;
  /** Difficulty of the linked material ("Easy" | "Medium" | "Hard"; default Medium). */
  difficulty?: string | null;
  /** Earlier attempts of exactly this content — repeat decay applies (default 0). */
  attempts?: number;
}

/**
 * The "typical good attempt" every estimate assumes: 75% correct, band 6.5,
 * answers of normal length. Question counts follow the real formats — a full
 * paper has 40 questions, a Reading passage about 13 (40 over 3 passages), a
 * Listening part 10.
 */
const TYPICAL = {
  accuracy: 0.75,
  band: 6.5,
  questions: { reading: 30, readingPassage: 13, readingFull: 40, listening: 8, listeningPart: 10, listeningFull: 40 },
  words: { task1: 160, task2: 260 },
  speaking: { seconds: 120, words: 220 },
  /** Parts 1–3: about 7 minutes of the candidate's own speech at a natural ~100 wpm. */
  speakingTest: { seconds: 420, words: 700 },
} as const;

type Scorer = (h: XpHistory) => XpResult;

const objectiveAttempt =
  (skill: "READING" | "LISTENING", questions: number, difficulty?: string | null, multiplier?: number): Scorer =>
  (h) => {
    const total = Math.max(1, Math.round(questions));
    return computeObjectiveXp({
      skill,
      correct: Math.round(total * TYPICAL.accuracy),
      total,
      answered: total,
      band: TYPICAL.band,
      difficulty: difficulty ?? "Medium",
      multiplier,
      history: h,
    });
  };

const writingAttempt =
  (task: "task1" | "task2", multiplier?: number): Scorer =>
  (h) =>
    computeWritingXp({ task, words: TYPICAL.words[task], band: TYPICAL.band, genuine: true, onTopic: true, multiplier, history: h });

const speakingTestAttempt =
  (multiplier?: number): Scorer =>
  (h) =>
    computeSpeakingXp({ ...TYPICAL.speakingTest, band: TYPICAL.band, fullTest: true, multiplier, history: h });

/**
 * Attempts that are scored one after another in the same sitting (the Writing
 * test's two tasks, the mock's four sections). Each is paid separately, and
 * each sees the XP the earlier ones already earned today — exactly as the
 * submit routes load the history — so the daily-budget taper is included.
 */
function paidInSequence(h: XpHistory, scorers: Scorer[]): number {
  let earned = h.earnedToday;
  let total = 0;
  for (const score of scorers) {
    const xp = score({ ...h, earnedToday: earned }).xp;
    total += xp;
    earned += xp;
  }
  return total;
}

/**
 * "Potential XP" shown before an activity. Computed with the real calculators
 * using a typical good attempt (see TYPICAL; first attempt unless `attempts`
 * says otherwise), so the promise on a mission card always matches what the
 * engine actually pays for the linked activity.
 */
export function estimateXp(kind: EstimateKind, opts: EstimateOptions = {}): number {
  const h: XpHistory = { ...EMPTY_HISTORY, contentAttempts: Math.max(0, Math.floor(opts.attempts ?? 0)) };
  const q = (fallback: number) => (opts.questions != null && opts.questions > 0 ? opts.questions : fallback);
  switch (kind) {
    case "reading":
    case "readingPassage":
    case "readingFull":
      return objectiveAttempt("READING", q(TYPICAL.questions[kind]), opts.difficulty)(h).xp;
    case "listening":
    case "listeningPart":
    case "listeningFull":
      return objectiveAttempt("LISTENING", q(TYPICAL.questions[kind]), opts.difficulty)(h).xp;
    case "writingTask1":
      return writingAttempt("task1")(h).xp;
    case "writingTask2":
      return writingAttempt("task2")(h).xp;
    case "writingExam":
      return paidInSequence(h, [writingAttempt("task1"), writingAttempt("task2")]);
    case "speaking":
      return computeSpeakingXp({ ...TYPICAL.speaking, band: TYPICAL.band, history: h }).xp;
    case "speakingTest":
      return speakingTestAttempt()(h).xp;
    case "mock": {
      // Exam order (lib/ielts/mock.ts): Listening → Reading → Writing → Speaking.
      const m = XP_CONFIG.mock.sectionMultiplier;
      return paidInSequence(h, [
        objectiveAttempt("LISTENING", TYPICAL.questions.listeningFull, opts.difficulty, m),
        objectiveAttempt("READING", TYPICAL.questions.readingFull, opts.difficulty, m),
        writingAttempt("task1", m),
        writingAttempt("task2", m),
        speakingTestAttempt(m),
      ]);
    }
    case "dailyQuiz":
      return computeDailyQuizXp(4);
    case "flashcards":
      return Math.min(XP_CONFIG.srs.dailyCap, 10 * computeSrsReviewXp(2));
  }
}
