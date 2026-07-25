import { db } from "@/lib/db";

/**
 * Integrity Engine — quantifies how much a submission looks like genuine effort.
 *
 * Goal is protecting educational integrity, NOT punishing students: it returns a
 * `trust` multiplier (0..1) plus the signals that produced it and a plain-language
 * explanation, so any reduction can always be explained to the learner.
 *
 * ENFORCING (S4): submit routes call `assessSubmission` BEFORE awarding, then
 * `applyTrust` turns the verdict into an XP multiplier and `logAssessment`
 * records the outcome. Safety rails: soft signals are floored (never zero an
 * honest attempt), the student is always told why, and INTEGRITY_ENFORCE=false
 * reverts to shadow mode without a code change.
 */

export type IntegritySignalCode =
  | "guessing" // accuracy statistically indistinguishable from random
  | "too_fast" // less time per item than physically plausible
  | "low_coverage" // most questions left unanswered
  | "burst" // many scored submissions in a very short window
  | "off_topic" // essay does not address the prompt
  | "low_effort"; // essay fails the genuine-writing check

export interface IntegritySignal {
  code: IntegritySignalCode;
  /** How much this signal reduced trust (0..1). */
  weight: number;
  /** Student-facing, non-accusatory wording. */
  message: string;
}

export interface IntegrityVerdict {
  /** Reward multiplier: 1 = fully trusted, 0 = no reward. */
  trust: number;
  signals: IntegritySignal[];
  /** Empty when nothing looks wrong. */
  explanation: string;
}

export interface SubmissionFacts {
  studentId: string;
  module: string;
  /** Correct answers (server-computed only — never client-reported). */
  correct?: number;
  /** Total scored questions. */
  total?: number;
  /** How many questions the student actually answered. */
  answered?: number;
  /** Seconds spent, already clamped server-side. Client-influenced → weak signal. */
  timeSpent?: number;
  /** Probability of a correct guess (0.25 for 4-option MCQ, ~0.33 for T/F/NG). */
  chanceLevel?: number;
  /** Essay checks, when the module is WRITING. */
  essay?: { genuine: boolean; onTopic: boolean };
}

/**
 * Master switch (S4). Set INTEGRITY_ENFORCE=false in the environment to fall
 * back to shadow mode without a code change — verdicts keep being recorded, but
 * rewards stop being scaled.
 */
export const INTEGRITY_ENFORCED = process.env.INTEGRITY_ENFORCE !== "false";

/**
 * Floor for reward scaling. Soft signals (pace, guessing, coverage) are
 * heuristics about *how* an attempt looked, so they reduce XP but never erase
 * it — a student who genuinely rushed still gets credit for the work. Hard
 * signals (off-topic / low-effort writing) are separately gated to zero XP by
 * the submit routes, and are exempt from this floor.
 */
const SOFT_TRUST_FLOOR = 0.25;
const HARD_SIGNALS: IntegritySignalCode[] = ["off_topic", "low_effort"];

/** Minimum seconds a human plausibly needs per question, even skimming. */
const MIN_SECONDS_PER_ITEM = 2;
/** Scored submissions within this window before "burst" triggers. */
const BURST_WINDOW_MS = 5 * 60 * 1000;
const BURST_LIMIT = 4;

/**
 * Assess one submission. Pure apart from an optional burst lookup, so it is easy
 * to reason about and safe to call on every submit.
 */
export async function assessSubmission(facts: SubmissionFacts): Promise<IntegrityVerdict> {
  const signals: IntegritySignal[] = [];
  const total = facts.total ?? 0;
  const correct = facts.correct ?? 0;

  // --- Guessing: is the score distinguishable from random answering? ---
  // Uses a normal approximation to the binomial: z <= 1 means the result sits
  // within one standard deviation of pure chance, i.e. no evidence of knowledge.
  if (total >= 8 && facts.chanceLevel && facts.chanceLevel > 0 && facts.chanceLevel < 1) {
    const p = facts.chanceLevel;
    const expected = total * p;
    const sd = Math.sqrt(total * p * (1 - p));
    const z = sd > 0 ? (correct - expected) / sd : 0;
    if (z <= 1) {
      signals.push({
        code: "guessing",
        weight: 0.6,
        message: "This score is close to what random answering would produce.",
      });
    }
  }

  // --- Too fast: physically implausible pace ---
  if (total > 0 && facts.timeSpent != null && facts.timeSpent > 0) {
    const perItem = facts.timeSpent / total;
    if (perItem < MIN_SECONDS_PER_ITEM) {
      signals.push({
        code: "too_fast",
        weight: 0.5,
        message: "The answers came in faster than the questions can be read.",
      });
    }
  }

  // --- Low coverage: most of the test skipped ---
  if (total >= 5 && facts.answered != null && facts.answered / total < 0.5) {
    signals.push({
      code: "low_coverage",
      weight: 0.3,
      message: "Most questions were left unanswered.",
    });
  }

  // --- Essay quality gates (already enforced elsewhere; recorded here too) ---
  if (facts.essay) {
    if (!facts.essay.onTopic) {
      signals.push({ code: "off_topic", weight: 0.8, message: "The essay does not address the prompt." });
    }
    if (!facts.essay.genuine) {
      signals.push({ code: "low_effort", weight: 0.8, message: "The essay is too short or repetitive to assess." });
    }
  }

  // --- Burst: an implausible number of scored submissions in minutes ---
  try {
    const since = new Date(Date.now() - BURST_WINDOW_MS);
    const recent = await db.iELTSTest.count({
      where: { studentId: facts.studentId, completedAt: { gte: since } },
    });
    if (recent >= BURST_LIMIT) {
      signals.push({
        code: "burst",
        weight: 0.4,
        message: "Several tests were submitted within a few minutes.",
      });
    }
  } catch {
    /* never fail a submission because integrity data is unavailable */
  }

  // Combine multiplicatively so multiple weak signals compound gently rather
  // than a single signal zeroing the reward outright.
  let trust = 1;
  for (const s of signals) trust *= 1 - s.weight;
  trust = Math.max(0, Math.min(1, Number(trust.toFixed(3))));

  return {
    trust,
    signals,
    explanation: signals.length ? signals.map((s) => s.message).join(" ") : "",
  };
}

export interface TrustApplication {
  /** Multiplier to apply to earned XP (1 when nothing looks wrong). */
  multiplier: number;
  /** True when the reward was actually reduced. */
  reduced: boolean;
  /** Student-facing reason, safe to show in the UI. */
  notice?: string;
}

/**
 * Turn a verdict into a reward multiplier (S4 — enforcement).
 *
 * Soft signals are floored so an honest-but-rushed attempt is never zeroed, the
 * whole thing is disabled by INTEGRITY_ENFORCE=false, and a plain-language
 * reason is always returned so the decision can be explained to the student.
 */
export function applyTrust(verdict: IntegrityVerdict): TrustApplication {
  if (!INTEGRITY_ENFORCED || verdict.signals.length === 0) {
    return { multiplier: 1, reduced: false };
  }

  const hasHard = verdict.signals.some((s) => HARD_SIGNALS.includes(s.code));
  const multiplier = hasHard ? verdict.trust : Math.max(SOFT_TRUST_FLOOR, verdict.trust);

  if (multiplier >= 0.995) return { multiplier: 1, reduced: false };

  return {
    multiplier,
    reduced: true,
    notice: `${verdict.explanation} XP for this attempt was reduced — take your time and it counts fully next time.`,
  };
}

/**
 * Record a verdict (shadow mode) or the enforced outcome.
 *
 * Deliberately written to AuditLog, not ActivityLog: ActivityLog is the
 * student-facing engagement ledger (it drives streak heatmaps, squad
 * contributions and the "Recent Activity" feed), so moderation data must never
 * go there. AuditLog is admin-facing and already surfaced at /admin/logs.
 */
export async function logAssessment(
  facts: SubmissionFacts,
  verdict: IntegrityVerdict,
  awardedXp: number
): Promise<void> {
  if (verdict.signals.length === 0) return; // only record anomalies
  try {
    await db.auditLog.create({
      data: {
        actorId: facts.studentId,
        actorName: "Integrity Engine (shadow)",
        role: "SYSTEM",
        action: "INTEGRITY_SHADOW",
        detail: JSON.stringify({
          module: facts.module,
          trust: verdict.trust,
          signals: verdict.signals.map((s) => s.code),
          explanation: verdict.explanation,
          correct: facts.correct ?? null,
          total: facts.total ?? null,
          answered: facts.answered ?? null,
          timeSpent: facts.timeSpent ?? null,
          awardedXp,
          enforced: INTEGRITY_ENFORCED,
          mode: INTEGRITY_ENFORCED ? "enforced" : "shadow",
        }).slice(0, 1500),
      },
    });
  } catch {
    /* auditing must never break a learning action */
  }
}
