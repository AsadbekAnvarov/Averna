import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  ANALYSIS_WINDOW_DAYS,
  BAND_SKILLS,
  DAY_MS,
  PROFILE_STALE_EVENTS,
  PROFILE_STALE_MS,
  SKILL_LABEL,
  STYLE_HINT,
} from "./config";
import { describeDataGaps, generateInsights, type DnaBase } from "./insights";
import {
  computeConsistency,
  computeCoverage,
  computeFocus,
  computeGrowth,
  computeLearnerConfidence,
  computeLearningSpeed,
  computeMaturity,
  computeMistakes,
  computeMotivation,
  computeRetention,
  computeRevisionEfficiency,
  computeSequencing,
  computeSkillBalance,
  computeSkills,
  computeStyle,
  computeTiming,
  overallConfidence,
} from "./metrics";
import { buildRecommendations, buildStudyPlan, computeChanges, type DnaPrevious } from "./recommendations";
import { collectSignals, tashkentParts } from "./signals";
import {
  DNA_VERSION,
  type Confidence,
  type DnaPromptContext,
  type DnaSkillMetric,
  type DnaTeacherView,
  type LearningDnaProfile,
  type RecordEventInput,
} from "./types";

/**
 * Learning DNA Engine — orchestration and persistence (AVERNA-001).
 *
 * The public face of the engine. Everything else in Averna talks to this file.
 *
 * Responsibilities:
 *  - `recordLearningEvent` — the single write path into the sensor stream.
 *  - `computeLearningDna` — assemble a full profile from collected signals.
 *  - `reconcileLearningProfile` — compute, persist, and snapshot. Called after
 *    genuine learning events, mirroring how the Progress Engine reconciles skill
 *    states. Never throws: bookkeeping must not be able to fail a learning action.
 *  - `getLearningDna` — the read path, with lazy freshness.
 *  - `getDnaTeacherView` / `getDnaPromptContext` — narrow projections for the
 *    teacher panel and for AI prompts, so consumers never hold the whole profile.
 *
 * Freshness strategy: profiles are recomputed lazily on read when they are older
 * than `PROFILE_STALE_MS` *or* when enough new behaviour has landed since the last
 * computation. Recomputing on every event would put a multi-table analysis on the
 * hot path of every submission; recomputing on a schedule would need
 * infrastructure the platform doesn't have. Lazy freshness gives correct-enough
 * data with bounded cost and no cron.
 */

// ---------------------------------------------------------------------------
// Sensor write path
// ---------------------------------------------------------------------------

/**
 * Record one behavioural observation.
 *
 * Never throws and never blocks the caller's success path — a learning action
 * must always succeed even if telemetry is unavailable. Time buckets are computed
 * here, once, in Tashkent time so that every later query is a plain column read.
 */
export async function recordLearningEvent(input: RecordEventInput): Promise<void> {
  if (!input.studentId) return;
  try {
    const at = input.at ?? new Date();
    const parts = tashkentParts(at);
    const clamp01 = (v: number | null | undefined): number | null =>
      v == null || !Number.isFinite(v) ? null : Math.max(0, Math.min(1, v));

    await db.learningEvent.create({
      data: {
        studentId: input.studentId,
        kind: input.kind,
        skill: input.skill ?? null,
        channel: input.channel,
        accuracy: clamp01(input.accuracy),
        // Clamped to a sane ceiling: a client-reported duration is untrusted, and
        // one impossible value would distort the whole focus curve.
        durationMin:
          input.durationMin != null && Number.isFinite(input.durationMin)
            ? Math.max(0, Math.min(300, input.durationMin))
            : null,
        items: input.items ?? null,
        correct: input.correct ?? null,
        words: input.words != null ? Math.max(0, Math.min(20000, Math.round(input.words))) : null,
        diversity: clamp01(input.diversity),
        confidence: clamp01(input.confidence),
        difficulty: input.difficulty ?? null,
        // Deduplicated and bounded so a buggy caller can't bloat a row.
        errorTags: Array.from(new Set(input.errorTags ?? [])).slice(0, 12),
        origin: input.origin ?? "sensor",
        hourLocal: parts.hour,
        weekday: parts.weekday,
        dayKey: parts.dayKey,
        createdAt: at,
      },
    });
  } catch {
    /* telemetry is best-effort by design */
  }
}

/** Record several observations in one round trip (batch submissions, games). */
export async function recordLearningEvents(inputs: RecordEventInput[]): Promise<void> {
  for (const input of inputs) {
    await recordLearningEvent(input);
  }
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/** Pick the headline skills. Preference is given to the four banded modules,
 *  because those are what an IELTS result is actually made of. */
function rankSkills(skills: DnaSkillMetric[]): {
  strongest: DnaSkillMetric | null;
  weakest: DnaSkillMetric | null;
  fastestGrowing: DnaSkillMetric | null;
  needsReinforcement: DnaSkillMetric[];
} {
  const touchedBand = skills.filter((s) => BAND_SKILLS.includes(s.key) && s.events > 0);
  const pool = touchedBand.length > 0 ? touchedBand : skills.filter((s) => s.events > 0);

  const strongest =
    pool.length > 0
      ? pool.reduce((hi, s) =>
          s.mastery > hi.mastery || (s.mastery === hi.mastery && (s.accuracy ?? 0) > (hi.accuracy ?? 0)) ? s : hi
        )
      : null;
  const weakest =
    pool.length > 0
      ? pool.reduce((lo, s) =>
          s.mastery < lo.mastery || (s.mastery === lo.mastery && (s.accuracy ?? 100) < (lo.accuracy ?? 100)) ? s : lo
        )
      : null;

  const growing = skills.filter((s) => s.velocity != null && s.velocity > 0);
  const fastestGrowing =
    growing.length > 0 ? growing.reduce((hi, s) => (s.velocity! > hi.velocity! ? s : hi)) : null;

  return {
    strongest,
    weakest,
    fastestGrowing,
    needsReinforcement: skills.filter((s) => s.status === "needs_reinforcement"),
  };
}

/** The snapshot the current profile is compared against — roughly a week back,
 *  falling back to the oldest available so a young profile still shows movement. */
async function loadPreviousSnapshot(studentId: string, todayKey: string): Promise<DnaPrevious | null> {
  try {
    const rows = await db.learningProfileSnapshot.findMany({
      where: { studentId, dayKey: { lt: todayKey } },
      orderBy: { dayKey: "desc" },
      take: 30,
      select: {
        dayKey: true,
        maturity: true,
        retentionScore: true,
        consistencyScore: true,
        motivationScore: true,
        confidenceScore: true,
      },
    });
    if (rows.length === 0) return null;

    const target = Date.now() - 7 * DAY_MS;
    // Closest snapshot to a week ago; a week is long enough for a real change and
    // short enough to still feel like "recently".
    let best = rows[0];
    let bestGap = Infinity;
    for (const row of rows) {
      const gap = Math.abs(new Date(`${row.dayKey}T00:00:00+05:00`).getTime() - target);
      if (gap < bestGap) {
        bestGap = gap;
        best = row;
      }
    }

    const daysAgo = Math.max(
      1,
      Math.round((Date.now() - new Date(`${best.dayKey}T00:00:00+05:00`).getTime()) / DAY_MS)
    );

    return {
      dayKey: best.dayKey,
      maturity: best.maturity,
      retentionScore: best.retentionScore,
      consistencyScore: best.consistencyScore,
      motivationScore: best.motivationScore,
      confidenceScore: best.confidenceScore,
      daysAgo,
    };
  } catch {
    return null;
  }
}

/**
 * Build a complete Learning DNA profile from scratch.
 *
 * The order here is the engine's dependency graph: raw signals → independent
 * metrics → composites that need those metrics → language (insights,
 * recommendations, plan) that needs the whole picture.
 */
export async function computeLearningDna(studentId: string): Promise<LearningDnaProfile> {
  const signals = await collectSignals(studentId);
  const events = signals.events;

  // --- Independent metrics ---
  const coverage = computeCoverage(signals);
  const style = computeStyle(events);
  const focus = computeFocus(events);
  const timing = computeTiming(events);
  const { score: retention, memoryHalfLifeDays } = computeRetention(signals);
  const learnerConfidence = computeLearnerConfidence(signals);
  const consistency = computeConsistency(signals);
  const motivation = computeMotivation(signals);
  const learningSpeed = computeLearningSpeed(signals);
  const revisionEfficiency = computeRevisionEfficiency(signals);
  const growth = computeGrowth(signals);
  const mistakes = computeMistakes(signals);
  const sequencing = computeSequencing(events);

  // --- Composites ---
  const skills = computeSkills(signals);
  const skillBalance = computeSkillBalance(skills);
  const maturity = computeMaturity(coverage, consistency, retention, revisionEfficiency, skillBalance);
  const { strongest, weakest, fastestGrowing, needsReinforcement } = rankSkills(skills);

  const confidence = overallConfidence(coverage, [
    style.confidence,
    focus.confidence,
    timing.confidence,
    retention.confidence,
    consistency.confidence,
    motivation.score.confidence,
    learningSpeed.score.confidence,
  ]);

  const base: DnaBase = {
    studentId,
    version: DNA_VERSION,
    computedAt: new Date().toISOString(),
    windowDays: ANALYSIS_WINDOW_DAYS,
    dataPoints: coverage.events,
    maturity,
    confidence,
    coverage,
    style,
    focus,
    timing,
    retention,
    memoryHalfLifeDays,
    learnerConfidence,
    consistency,
    motivation,
    learningSpeed,
    revisionEfficiency,
    skillBalance,
    skills,
    strongest,
    weakest,
    fastestGrowing,
    needsReinforcement,
    growth,
    mistakes,
    sequencing,
  };

  // --- Language & actions ---
  const previous = await loadPreviousSnapshot(studentId, tashkentParts(new Date()).dayKey);
  const { improvements, attention } = computeChanges(base, previous);

  return {
    ...base,
    insights: generateInsights(base),
    recommendations: buildRecommendations(base),
    plan: buildStudyPlan(base),
    improvements,
    attention,
    nextDataNeeded: describeDataGaps(base),
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Write the profile and today's snapshot.
 *
 * The scalar columns mirror values that also live inside `payload`. That
 * duplication is deliberate: reads want one row and one JSON parse, while
 * platform-wide admin aggregates want an indexed scan that never touches JSON.
 * `payload` is the source of truth; the columns are a projection of it.
 */
export async function persistLearningProfile(profile: LearningDnaProfile): Promise<void> {
  const dayKey = tashkentParts(new Date()).dayKey;

  const scalars = {
    version: profile.version,
    computedAt: new Date(profile.computedAt),
    dataPoints: profile.dataPoints,
    maturity: profile.maturity.value ?? 0,
    confidence: profile.confidence,

    preferredStyle: profile.style.preferred,
    styleConfidence: profile.style.confidence,
    focusMinutes: profile.focus.focusMinutes,
    fatiguePointMin: profile.focus.fatiguePointMin,
    idealLessonMin: profile.focus.idealLessonMin,
    optimalDaypart: profile.timing.optimalDaypart,
    optimalHourStart: profile.timing.optimalHourStart,
    optimalHourEnd: profile.timing.optimalHourEnd,

    confidenceScore: profile.learnerConfidence.value,
    retentionScore: profile.retention.value,
    memoryHalfLifeDays: profile.memoryHalfLifeDays,
    consistencyScore: profile.consistency.value,
    motivationScore: profile.motivation.score.value,
    motivationTrend: profile.motivation.trend,
    learningSpeed: profile.learningSpeed.bandsPerTenActiveDays,
    revisionEfficiency: profile.revisionEfficiency.value,
    skillBalance: profile.skillBalance.value,

    strongestSkill: profile.strongest ? profile.strongest.key : null,
    weakestSkill: profile.weakest ? profile.weakest.key : null,
    fastestGrowingSkill: profile.fastestGrowing ? profile.fastestGrowing.key : null,
    vocabularyGrowth: profile.growth.vocabulary.value,
    grammarGrowth: profile.growth.grammar.value,
    speakingConfidence: profile.growth.speakingConfidence.value,
    writingComplexity: profile.growth.writingComplexity.value,
    readingSpeedWpm: profile.growth.readingSpeedWpm.value,
    listeningAccuracy: profile.growth.listeningAccuracy.value,

    payload: profile as unknown as Prisma.InputJsonValue,
  };

  try {
    await db.learningProfile.upsert({
      where: { studentId: profile.studentId },
      create: { studentId: profile.studentId, ...scalars },
      update: scalars,
    });
  } catch {
    /* a profile that can't be cached is still returned to the caller */
  }

  // One snapshot per day: repeated reconciliations overwrite rather than pile up,
  // which keeps the trend series one point per day without any cleanup job.
  const snapshot = {
    maturity: profile.maturity.value ?? 0,
    confidenceScore: profile.learnerConfidence.value,
    retentionScore: profile.retention.value,
    consistencyScore: profile.consistency.value,
    motivationScore: profile.motivation.score.value,
    learningSpeed: profile.learningSpeed.bandsPerTenActiveDays,
    focusMinutes: profile.focus.focusMinutes,
    dataPoints: profile.dataPoints,
    preferredStyle: profile.style.preferred,
  };

  try {
    await db.learningProfileSnapshot.upsert({
      where: { studentId_dayKey: { studentId: profile.studentId, dayKey } },
      create: { studentId: profile.studentId, dayKey, ...snapshot },
      update: snapshot,
    });
  } catch {
    /* history is valuable but never load-bearing */
  }
}

/**
 * Recompute and persist. The engine's equivalent of `reconcileSkillStates` —
 * call it after verified learning, never on page load.
 *
 * Returns null instead of throwing so a caller in a submission path can invoke it
 * without a try/catch and without risking the student's work.
 *
 * `skipIfFresh` exists for callers on a latency-sensitive path. A full
 * recomputation is ~10 queries, which would roughly double the cost of a test
 * submission — and it's redundant, because the read path recomputes on any new
 * behaviour anyway. With `skipIfFresh` a submission only pays for the
 * recomputation when there is no profile yet (so the learner is represented in
 * platform aggregates from their very first test) or when the stored one is
 * genuinely old. Freshness for the student is unaffected.
 */
export async function reconcileLearningProfile(
  studentId: string,
  opts?: { skipIfFresh?: boolean }
): Promise<LearningDnaProfile | null> {
  try {
    if (opts?.skipIfFresh) {
      const row = await db.learningProfile
        .findUnique({ where: { studentId }, select: { version: true, computedAt: true } })
        .catch(() => null);
      const recent =
        row != null &&
        row.version === DNA_VERSION &&
        Date.now() - row.computedAt.getTime() <= PROFILE_STALE_MS;
      if (recent) return null;
    }

    const profile = await computeLearningDna(studentId);
    await persistLearningProfile(profile);
    return profile;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

/** Whether a stored profile still represents current behaviour. */
async function isStale(studentId: string, version: number, computedAt: Date): Promise<boolean> {
  if (version !== DNA_VERSION) return true;
  if (Date.now() - computedAt.getTime() > PROFILE_STALE_MS) return true;

  // Cheap indexed counts: has enough new behaviour landed to change the picture?
  const [sensorSince, activitySince] = await Promise.all([
    db.learningEvent.count({ where: { studentId, createdAt: { gt: computedAt } } }).catch(() => 0),
    db.activityLog.count({ where: { studentId, createdAt: { gt: computedAt } } }).catch(() => 0),
  ]);
  return Math.max(sensorSince, activitySince) >= PROFILE_STALE_EVENTS;
}

/**
 * The profile for a student, recomputed only when it has gone stale.
 *
 * Wrapped in React.cache so that however many widgets on a page ask for the
 * Learning DNA during one server render, the work happens exactly once.
 */
export const getLearningDna = cache(async function getLearningDna(
  studentId: string
): Promise<LearningDnaProfile> {
  try {
    const row = await db.learningProfile.findUnique({
      where: { studentId },
      select: { version: true, computedAt: true, payload: true },
    });

    if (row && row.payload) {
      const stale = await isStale(studentId, row.version, row.computedAt);
      if (!stale) {
        return row.payload as unknown as LearningDnaProfile;
      }
      const fresh = await computeLearningDna(studentId);
      // Persist in the background of this request; the caller already has its answer.
      await persistLearningProfile(fresh);
      return fresh;
    }
  } catch {
    /* fall through to a live computation */
  }

  const profile = await computeLearningDna(studentId);
  await persistLearningProfile(profile);
  return profile;
});

/** Force a recomputation, ignoring the cached row (used by the refresh action). */
export async function refreshLearningDna(studentId: string): Promise<LearningDnaProfile> {
  const profile = await computeLearningDna(studentId);
  await persistLearningProfile(profile);
  return profile;
}

/** The adaptive plan on its own, for consumers that only need today's actions. */
export async function getDnaStudyPlan(studentId: string) {
  const profile = await getLearningDna(studentId);
  return profile.plan;
}

export interface DnaHistoryPoint {
  dayKey: string;
  maturity: number;
  motivation: number | null;
  retention: number | null;
  consistency: number | null;
  confidence: number | null;
}

/**
 * The student's own DNA history — the series behind every trend line in the UI.
 *
 * A profile alone can only say what a learner is like today. This is what lets
 * the platform show that motivation is recovering or that retention is genuinely
 * improving, which is the difference between a dashboard and a growth story.
 */
export async function getDnaHistory(studentId: string, days = 60): Promise<DnaHistoryPoint[]> {
  try {
    // Filtered by `dayKey`, not `createdAt`: dayKey is the indexed business key
    // for a snapshot, and because rows are upserted per day it's the only field
    // guaranteed to describe the day the numbers actually belong to.
    const sinceKey = tashkentParts(Date.now() - days * DAY_MS).dayKey;
    const rows = await db.learningProfileSnapshot.findMany({
      where: { studentId, dayKey: { gte: sinceKey } },
      orderBy: { dayKey: "asc" },
      select: {
        dayKey: true,
        maturity: true,
        motivationScore: true,
        retentionScore: true,
        consistencyScore: true,
        confidenceScore: true,
      },
    });
    return rows.map((r) => ({
      dayKey: r.dayKey,
      maturity: r.maturity,
      motivation: r.motivationScore,
      retention: r.retentionScore,
      consistency: r.consistencyScore,
      confidence: r.confidenceScore,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Teacher projection
// ---------------------------------------------------------------------------

function describeScore(value: number | null, labels: [string, string, string, string]): string {
  if (value == null) return "Not established yet";
  if (value >= 75) return labels[0];
  if (value >= 55) return labels[1];
  if (value >= 35) return labels[2];
  return labels[3];
}

/**
 * What a teacher needs in thirty seconds, phrased for a professional.
 *
 * Contains no learner-authored content — only measurements and the strategy they
 * imply — so it is safe to show in a staff room, and every claim degrades to
 * "not established yet" rather than guessing.
 */
export async function getDnaTeacherView(studentId: string): Promise<DnaTeacherView> {
  const [profile, student] = await Promise.all([
    getLearningDna(studentId),
    db.student
      .findUnique({ where: { id: studentId }, select: { user: { select: { name: true } } } })
      .catch(() => null),
  ]);

  const strongHabits: string[] = [];
  const weakHabits: string[] = [];
  const strategy: string[] = [];

  // --- Habits, each one a measurement ---
  if (profile.consistency.value != null && profile.consistency.value >= 65) {
    strongHabits.push(`Studies consistently — ${profile.coverage.activeDays} active days in the last month`);
  } else if (profile.consistency.value != null && profile.consistency.value < 45) {
    weakHabits.push(`Irregular schedule — only ${profile.coverage.activeDays} active days in the last month`);
  }

  if (profile.revisionEfficiency.value != null && profile.revisionEfficiency.value >= 65) {
    strongHabits.push("Reviews effectively — material moves into long-term memory");
  } else if (profile.revisionEfficiency.value != null && profile.revisionEfficiency.value < 45) {
    weakHabits.push("Reviews aren't sticking — items keep lapsing to short intervals");
  }

  if (profile.focus.fatiguePointMin != null) {
    weakHabits.push(
      `Accuracy falls ${profile.focus.declinePoints} points beyond ~${profile.focus.fatiguePointMin} minutes in one sitting`
    );
  }

  if (profile.retention.value != null && profile.retention.value >= 70) {
    strongHabits.push(`Strong retention (${profile.retention.value}%)`);
  } else if (profile.retention.value != null && profile.retention.value < 55) {
    weakHabits.push(
      `Forgets quickly — recall halves in about ${profile.memoryHalfLifeDays != null ? Math.round(profile.memoryHalfLifeDays) : "a few"} days`
    );
  }

  const untouched = profile.skills.filter((s) => BAND_SKILLS.includes(s.key) && s.events === 0);
  if (untouched.length > 0 && profile.coverage.tests >= 3) {
    weakHabits.push(`Avoids ${untouched.map((s) => s.label).join(" and ")} entirely`);
  }

  // --- Teaching strategy, derived only from what has been measured ---
  if (profile.style.preferred != null) {
    strategy.push(`Explain new material through ${profile.style.label?.toLowerCase()}: ${STYLE_HINT[profile.style.preferred]}`);
  }
  if (profile.focus.idealLessonMin != null) {
    strategy.push(`Keep single activities to about ${profile.focus.idealLessonMin} minutes, then change task or take a break.`);
  }
  if (profile.timing.optimalLabel != null) {
    strategy.push(`Schedule demanding work in the ${profile.timing.optimalLabel.toLowerCase()} where possible — ${profile.timing.advantagePoints} points better accuracy.`);
  }
  if (profile.sequencing.liftPoints != null && profile.sequencing.liftPoints >= 4) {
    strategy.push(`Open the lesson with a short review — measurably worth ${profile.sequencing.liftPoints} accuracy points for this student.`);
  }
  if (profile.weakest) {
    strategy.push(`Prioritise ${profile.weakest.label}: ${profile.weakest.reason}.`);
  }
  if (profile.mistakes[0]) {
    strategy.push(`Recurring issue to correct directly: ${profile.mistakes[0].label} (${profile.mistakes[0].occurrences} occurrences).`);
  }
  if (profile.motivation.trend === "falling") {
    strategy.push("Motivation is falling — set one small, achievable target rather than a catch-up plan.");
  }
  if (strategy.length === 0) {
    strategy.push(
      `Not enough behavioural data yet (${profile.coverage.events} recorded activities). Encourage varied, timed practice so the profile can form.`
    );
  }

  return {
    studentId,
    name: student?.user?.name ?? "Student",
    learnsBestBy: profile.style.label ?? "Not established yet",
    bestTime:
      profile.timing.optimalHourStart != null && profile.timing.optimalHourEnd != null
        ? `${String(profile.timing.optimalHourStart).padStart(2, "0")}:00–${String(profile.timing.optimalHourEnd).padStart(2, "0")}:00`
        : "Not established yet",
    attentionSpan:
      profile.focus.idealLessonMin != null
        ? `~${profile.focus.idealLessonMin} min${profile.focus.fatiguePointMin != null ? ` (drops after ${profile.focus.fatiguePointMin} min)` : ""}`
        : "Not established yet",
    motivation: {
      label: describeScore(profile.motivation.score.value, ["High", "Steady", "Low", "At risk"]),
      trend: profile.motivation.trend,
      score: profile.motivation.score.value,
    },
    efficiency: {
      label: describeScore(profile.revisionEfficiency.value, ["Excellent", "Good", "Inefficient", "Poor"]),
      score: profile.revisionEfficiency.value,
    },
    confidence: {
      label: describeScore(profile.learnerConfidence.value, ["Confident", "Settled", "Hesitant", "Anxious"]),
      score: profile.learnerConfidence.value,
    },
    strongHabits,
    weakHabits,
    strategy,
    recentChanges: [...profile.improvements.slice(0, 3), ...profile.attention.slice(0, 3)],
    maturity: profile.maturity.value ?? 0,
    dataConfidence: profile.confidence,
    updatedAt: profile.computedAt,
  };
}

// ---------------------------------------------------------------------------
// AI projection
// ---------------------------------------------------------------------------

const CONFIDENCE_CAVEAT: Record<Confidence, string> = {
  insufficient:
    "There is not enough behavioural data yet — do not state preferences as facts; ask the student instead.",
  low: "This profile is based on limited data; present observations as tentative.",
  medium: "This profile is reasonably well evidenced; present observations as likely patterns.",
  high: "This profile is well evidenced; you can state these patterns directly.",
};

/**
 * The grounding block handed to every AI feature (Mentor, Second Brain, Future
 * Simulator, study-plan generation).
 *
 * Deliberately small and fact-only. The point is that no model call anywhere in
 * Averna has to guess how a student learns — and, just as importantly, that a
 * model is told when NOT to claim a pattern, which is how confident-sounding
 * hallucinated advice gets prevented at the source.
 */
export async function getDnaPromptContext(studentId: string): Promise<DnaPromptContext> {
  let profile: LearningDnaProfile;
  try {
    profile = await getLearningDna(studentId);
  } catch {
    return {
      available: false,
      confidence: "insufficient",
      summary: "No Learning DNA profile is available for this student.",
      facts: [],
      cautions: [CONFIDENCE_CAVEAT.insufficient],
    };
  }

  const facts: string[] = [];

  if (profile.style.preferred != null) {
    facts.push(`Learns best through ${profile.style.label} (${profile.style.basis}).`);
  }
  if (profile.timing.optimalLabel != null) {
    facts.push(
      `Performs best in the ${profile.timing.optimalLabel.toLowerCase()} (${profile.timing.advantagePoints} accuracy points above other times).`
    );
  }
  if (profile.focus.idealLessonMin != null) {
    facts.push(
      `Effective session length is about ${profile.focus.idealLessonMin} minutes${
        profile.focus.fatiguePointMin != null ? `; accuracy declines beyond ${profile.focus.fatiguePointMin} minutes` : ""
      }.`
    );
  }
  if (profile.retention.value != null) {
    facts.push(
      `Retention ${profile.retention.value}%${
        profile.memoryHalfLifeDays != null ? `, recall half-life about ${Math.round(profile.memoryHalfLifeDays)} days` : ""
      }.`
    );
  }
  if (profile.strongest) facts.push(`Strongest skill: ${profile.strongest.label} (${profile.strongest.reason}).`);
  if (profile.weakest) facts.push(`Weakest skill: ${profile.weakest.label} (${profile.weakest.reason}).`);
  if (profile.learnerConfidence.value != null) facts.push(`Confidence ${profile.learnerConfidence.value}/100.`);
  if (profile.consistency.value != null) {
    facts.push(`Consistency ${profile.consistency.value}/100 (${profile.coverage.activeDays} active days in the last month).`);
  }
  if (profile.motivation.score.confidence !== "insufficient") {
    facts.push(`Motivation is ${profile.motivation.trend} (${profile.motivation.basis}).`);
  }
  if (profile.sequencing.liftPoints != null) {
    facts.push(
      profile.sequencing.liftPoints >= 0
        ? `Scores ${profile.sequencing.liftPoints} points higher when a session starts with review.`
        : `Scores ${Math.abs(profile.sequencing.liftPoints)} points higher when practice comes before review.`
    );
  }
  if (profile.mistakes.length > 0) {
    facts.push(`Recurring mistakes: ${profile.mistakes.map((m) => `${m.label} (${m.occurrences}x)`).join(", ")}.`);
  }
  const untouched = profile.skills.filter((s) => BAND_SKILLS.includes(s.key) && s.events === 0);
  if (untouched.length > 0) {
    facts.push(`Has never attempted: ${untouched.map((s) => SKILL_LABEL[s.key]).join(", ")}.`);
  }

  const cautions = [CONFIDENCE_CAVEAT[profile.confidence]];
  if (profile.nextDataNeeded.length > 0) {
    cautions.push(`Unmeasured for this student: ${profile.nextDataNeeded.slice(0, 2).join(" ")}`);
  }

  return {
    available: facts.length > 0,
    confidence: profile.confidence,
    summary:
      facts.length > 0
        ? `Learning DNA (maturity ${profile.maturity.value ?? 0}/100, ${profile.dataPoints} observations, confidence ${profile.confidence}).`
        : `No behavioural patterns established yet (${profile.dataPoints} observations).`,
    facts,
    cautions,
  };
}

/** One-line summary for compact surfaces (notification copy, list rows). */
export function dnaSummaryLine(profile: LearningDnaProfile): string {
  const parts: string[] = [];
  if (profile.style.label) parts.push(profile.style.label);
  if (profile.focus.idealLessonMin != null) parts.push(`${profile.focus.idealLessonMin}-min focus`);
  if (profile.timing.optimalLabel) parts.push(`best in the ${profile.timing.optimalLabel.toLowerCase()}`);
  if (profile.retention.value != null) parts.push(`${profile.retention.value}% retention`);
  return parts.length > 0
    ? parts.join(" · ")
    : `Learning DNA forming — ${profile.dataPoints} observations so far`;
}
