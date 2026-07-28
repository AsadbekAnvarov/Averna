/**
 * Learning DNA Engine (AVERNA-001) — public API.
 *
 * Averna's understanding of *how* each student learns. Every intelligent feature
 * in the platform is expected to consult this engine before making an educational
 * decision, so that recommendations, study plans, teacher insights and AI replies
 * all reason from one shared, evidence-backed model of the learner instead of
 * each inventing their own.
 *
 * ---------------------------------------------------------------------------
 * ARCHITECTURE
 * ---------------------------------------------------------------------------
 *
 *   config.ts           every threshold, label and tunable — no runtime config
 *   types.ts            the vocabulary (pure types, safe on the client)
 *   signals.ts          the ONLY file that reads the database
 *   metrics.ts          pure statistics over collected signals
 *   insights.ts         evidence-gated observations + honest data gaps
 *   recommendations.ts  actions, the adaptive study plan, change tracking
 *   engine.ts           orchestration, persistence, freshness, projections
 *   aggregate.ts        anonymous, k-suppressed platform analytics
 *
 * ---------------------------------------------------------------------------
 * THE TWO INVARIANTS
 * ---------------------------------------------------------------------------
 *
 * 1. NOTHING IS ASSERTED WITHOUT EVIDENCE. Each metric carries its sample size,
 *    a confidence grade and a plain-language `basis`. Below its threshold a value
 *    is withheld (`null`), never defaulted — and an insight that cannot cite
 *    numbers is never generated. This is why the engine's advice is specific to a
 *    person rather than generic.
 *
 * 2. IT IMPROVES WITHOUT CONFIGURATION. Accuracy comes from the confidence
 *    ladders in config.ts: as behaviour accumulates, metrics graduate from
 *    withheld to low to high confidence, more insight rules qualify to fire, and
 *    recommendations become sharper. The same student genuinely receives better
 *    guidance after a month than on day one, with nobody tuning anything.
 *
 * ---------------------------------------------------------------------------
 * INTEGRATING A NEW FEATURE
 * ---------------------------------------------------------------------------
 *
 *   // 1. Feed the engine from any learning surface (never throws):
 *   await recordLearningEvent({
 *     studentId, kind: "test", channel: "reading", skill: "READING",
 *     accuracy: 0.72, durationMin: 18, items: 40, correct: 29,
 *   });
 *
 *   // 2. Refresh the profile after verified learning:
 *   await reconcileLearningProfile(studentId);
 *
 *   // 3. Read it anywhere (cached per request, recomputed only when stale):
 *   const dna = await getLearningDna(studentId);
 *
 *   // 4. Ground an AI call in it:
 *   const context = await getDnaPromptContext(studentId);
 */

// --- Types ---
export type {
  Channel,
  Confidence,
  DnaAggregate,
  DnaChange,
  DnaCoverage,
  DnaDaypart,
  DnaDaypartPerf,
  DnaDurationBand,
  DnaEvent,
  DnaFocusProfile,
  DnaGrowth,
  DnaInsight,
  DnaLearningSpeed,
  DnaMistakeCategory,
  DnaMotivation,
  DnaPlanBlock,
  DnaPromptContext,
  DnaRecommendation,
  DnaScore,
  DnaSequencing,
  DnaSkillMetric,
  DnaStudyPlan,
  DnaStyleProfile,
  DnaStyleScore,
  DnaTeacherView,
  DnaTimingProfile,
  EventKind,
  InsightKind,
  LearningDnaProfile,
  LearningStyle,
  RecommendationKind,
  SkillKey,
  SkillStatus,
  Trend,
} from "./types";

export { DNA_VERSION } from "./types";

// --- Configuration (labels and thresholds the UI needs to explain itself) ---
export {
  AGGREGATE_K_THRESHOLD,
  ALL_SKILLS,
  ALL_STYLES,
  BAND_SKILLS,
  CHANNEL_LABEL,
  DAYPARTS,
  DAYPART_LABEL,
  DURATION_BANDS,
  SKILL_CHANNEL,
  SKILL_HREF,
  SKILL_LABEL,
  STYLE_CHANNELS,
  STYLE_HINT,
  STYLE_LABEL,
} from "./config";

// --- Write path ---
export { recordLearningEvent, recordLearningEvents } from "./engine";

// --- Compute & persist ---
export {
  computeLearningDna,
  persistLearningProfile,
  reconcileLearningProfile,
  refreshLearningDna,
} from "./engine";

// --- Read path ---
export { getDnaHistory, getDnaStudyPlan, getLearningDna } from "./engine";
export type { DnaHistoryPoint } from "./engine";

// --- Consumer projections ---
export { dnaSummaryLine, getDnaPromptContext, getDnaTeacherView } from "./engine";

// --- Admin analytics ---
export { getDnaAggregate } from "./aggregate";

// --- Escape hatches for advanced consumers (and for offline re-processing of
//     history with improved maths, which the pure metric layer makes safe) ---
export { collectSignals, tashkentParts, testAccuracy, testCompletion } from "./signals";
export type { DnaSignals } from "./signals";
export type { DnaBase } from "./insights";
export { describeDataGaps, generateInsights } from "./insights";
export { buildRecommendations, buildStudyPlan, computeChanges } from "./recommendations";
export type { DnaPrevious } from "./recommendations";
