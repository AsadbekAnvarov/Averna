/**
 * Learning DNA Engine — shared vocabulary (AVERNA-001).
 *
 * Every type the engine produces is designed to be *explainable*: no bare
 * number ever escapes the engine. A metric always travels with the sample size
 * it was computed from, a confidence grade, and a plain-language `basis` string
 * describing how it was derived — so a student, a teacher, an admin or another
 * engine can always answer "why does it say that?".
 *
 * Dependency-free by design — no imports, and the only runtime value is the
 * payload version constant — so this module is safe to import from client
 * components, server components, API routes and other engines alike without
 * dragging the database layer along with it.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** The learnable domains Averna tracks. The four IELTS modules plus the two
 *  cross-cutting foundations that the platform teaches separately. */
export type SkillKey = "READING" | "LISTENING" | "WRITING" | "SPEAKING" | "GRAMMAR" | "VOCABULARY";

/** How the material actually reached the learner. Channel — not subject — is
 *  what makes learning-style detection meaningful: the same Writing skill can be
 *  practised by reading models, by conversation, or by producing text. */
export type Channel =
  | "reading"
  | "audio"
  | "writing"
  | "speaking"
  | "flashcard"
  | "conversation"
  | "video"
  | "grammar";

/** The behavioural event families the sensor stream accepts. */
export type EventKind =
  | "test"
  | "review"
  | "homework"
  | "speaking"
  | "focus"
  | "ai_chat"
  | "checkin"
  | "game"
  | "lesson";

/** Learning styles are derived from channel performance + channel engagement.
 *  They are described as *preferences evidenced by results*, never as fixed
 *  personality traits — which is both more honest and more useful. */
export type LearningStyle = "visual" | "auditory" | "verbal" | "kinesthetic" | "analytical";

/**
 * How much the engine trusts a number.
 *
 * This is the mechanism that makes the engine get smarter over time without
 * manual configuration: a metric is born "insufficient", and only earns the
 * right to drive a recommendation once enough real behaviour supports it.
 */
export type Confidence = "insufficient" | "low" | "medium" | "high";

/** Five-way split of the day (Tashkent time), finer than the UI's greeting
 *  buckets because study performance differs between early morning and late
 *  morning, and between evening and night. */
export type DnaDaypart = "early" | "morning" | "afternoon" | "evening" | "night";

export type Trend = "rising" | "steady" | "falling";

/** A number the engine is willing to defend, with its receipts. */
export interface DnaScore {
  /** null means "not enough evidence" — never a silently-invented default. */
  value: number | null;
  confidence: Confidence;
  sampleSize: number;
  /** Plain-language derivation, shown in tooltips and teacher views. */
  basis: string;
}

// ---------------------------------------------------------------------------
// Sensor stream
// ---------------------------------------------------------------------------

/**
 * One normalised behavioural observation. Everything the engine reasons about —
 * whether it arrived from a live sensor call or was back-filled from a legacy
 * outcome row — is reduced to this single shape first. That reduction is what
 * lets one set of statistics answer questions across tests, reviews, homework,
 * speaking sessions and focus timers.
 */
export interface DnaEvent {
  at: Date;
  /** Tashkent hour 0-23 (pre-computed; never re-derived per request). */
  hour: number;
  /** Tashkent weekday, 0 = Sunday. */
  weekday: number;
  /** Tashkent calendar day, "YYYY-MM-DD". */
  dayKey: string;
  kind: EventKind;
  skill: SkillKey | null;
  channel: Channel;
  /** 0-1, comparable across every activity type. */
  accuracy: number | null;
  durationMin: number | null;
  items: number | null;
  correct: number | null;
  words: number | null;
  diversity: number | null;
  /** Self-reported only. The engine never fabricates a confidence reading. */
  confidence: number | null;
  difficulty: string | null;
  errorTags: string[];
  /** "sensor" = recorded live; "derived" = reconstructed from an outcome row. */
  origin: "sensor" | "derived";
}

/** Input accepted by `recordLearningEvent`. Time fields are computed for you. */
export interface RecordEventInput {
  studentId: string;
  kind: EventKind;
  channel: Channel;
  skill?: SkillKey | null;
  accuracy?: number | null;
  durationMin?: number | null;
  items?: number | null;
  correct?: number | null;
  words?: number | null;
  diversity?: number | null;
  confidence?: number | null;
  difficulty?: string | null;
  errorTags?: string[];
  origin?: "sensor" | "derived";
  at?: Date;
}

// ---------------------------------------------------------------------------
// Profile components
// ---------------------------------------------------------------------------

/** Which signal families the engine has actually seen. Drives both the maturity
 *  score and the honest "what I still need to learn about you" list. */
export interface DnaCoverage {
  events: number;
  sensorEvents: number;
  tests: number;
  reviews: number;
  homework: number;
  speaking: number;
  focusSessions: number;
  checkins: number;
  activeDays: number;
  historySpanDays: number;
  skillsTouched: number;
  /** 0-100: breadth of behavioural evidence available. */
  completeness: number;
}

export interface DnaStyleScore {
  style: LearningStyle;
  label: string;
  /** 0-100 blended performance + engagement score. */
  score: number;
  /** Mean accuracy in this style's channels, 0-100. null if untested. */
  accuracy: number | null;
  /** Share of all behaviour spent in this style's channels, 0-100. */
  share: number;
  events: number;
  channels: Channel[];
}

export interface DnaStyleProfile {
  preferred: LearningStyle | null;
  label: string | null;
  confidence: Confidence;
  scores: DnaStyleScore[];
  /** Gap between the top two styles — the reason we can (or can't) call it. */
  margin: number | null;
  basis: string;
}

export interface DnaDurationBand {
  label: string;
  fromMin: number;
  toMin: number | null;
  sessions: number;
  accuracy: number | null;
}

export interface DnaFocusProfile {
  /** Session length at which this learner performs best, in minutes. */
  focusMinutes: number | null;
  /** Where accuracy measurably falls off. null = no decline detected yet. */
  fatiguePointMin: number | null;
  /** Recommended single-sitting lesson length. */
  idealLessonMin: number | null;
  /** Pearson r between session length and accuracy (-1..1). */
  durationAccuracyCorr: number | null;
  /** Accuracy points lost after the fatigue point. */
  declinePoints: number | null;
  bands: DnaDurationBand[];
  medianSessionMin: number | null;
  confidence: Confidence;
  sampleSize: number;
  basis: string;
}

export interface DnaDaypartPerf {
  daypart: DnaDaypart;
  label: string;
  fromHour: number;
  toHour: number;
  sessions: number;
  /** 0-100. */
  accuracy: number | null;
  share: number;
}

export interface DnaTimingProfile {
  optimalDaypart: DnaDaypart | null;
  optimalLabel: string | null;
  optimalHourStart: number | null;
  optimalHourEnd: number | null;
  /** Accuracy advantage of the best daypart over the rest, in points. */
  advantagePoints: number | null;
  worstDaypart: DnaDaypart | null;
  dayparts: DnaDaypartPerf[];
  /** Weekday indices (0=Sun) the learner reliably shows up on. */
  reliableWeekdays: number[];
  confidence: Confidence;
  sampleSize: number;
  basis: string;
}

export interface DnaMotivation {
  score: DnaScore;
  trend: Trend;
  /** Percentage change in learning volume, recent window vs the one before. */
  deltaPercent: number | null;
  recentActiveDays: number;
  previousActiveDays: number;
  daysSinceLastActivity: number | null;
  basis: string;
}

export interface DnaLearningSpeed {
  score: DnaScore;
  /** Band points gained per 10 active study days. */
  bandsPerTenActiveDays: number | null;
  label: "rapid" | "steady" | "gradual" | "plateaued" | null;
  totalBandGain: number | null;
  activeDays: number;
}

export type SkillStatus = "strength" | "growing" | "needs_reinforcement" | "untouched";

export interface DnaSkillMetric {
  key: SkillKey;
  label: string;
  events: number;
  /** 0-100 mean accuracy across this skill's activity. */
  accuracy: number | null;
  band: number | null;
  bestBand: number | null;
  stage: string | null;
  stageLabel: string | null;
  /** 0-100 evidence-based mastery, reused from the Progress Engine's ladder. */
  mastery: number;
  /** 0-100 estimated retention right now. */
  retention: number;
  /** Band points gained from first to latest attempt. */
  improvement: number | null;
  /** Band points per 10 active days in this skill. */
  velocity: number | null;
  lastPracticedDaysAgo: number | null;
  status: SkillStatus;
  reason: string;
}

export interface DnaGrowth {
  vocabulary: DnaScore;
  grammar: DnaScore;
  speakingConfidence: DnaScore;
  writingComplexity: DnaScore;
  readingSpeedWpm: DnaScore;
  listeningAccuracy: DnaScore;
}

export interface DnaMistakeCategory {
  tag: string;
  label: string;
  occurrences: number;
  /** Share of all observed mistakes, 0-100. */
  share: number;
  skills: SkillKey[];
  /** Whether this is getting better, worse or holding. */
  trend: Trend | null;
  evidence: string;
  fix: string;
}

/**
 * Does the ORDER of activities change outcomes for this learner? The engine
 * looks for a "priming" effect: sessions preceded by review on the same day vs
 * sessions that weren't. This is what turns "review your vocabulary" from
 * generic advice into a measured, personal claim.
 */
export interface DnaSequencing {
  primedAccuracy: number | null;
  unprimedAccuracy: number | null;
  /** Accuracy points gained when review comes first. */
  liftPoints: number | null;
  primedSessions: number;
  unprimedSessions: number;
  confidence: Confidence;
  /** Skill that benefits most from being primed by review. */
  bestPrimedSkill: SkillKey | null;
  basis: string;
}

export type InsightKind =
  | "timing"
  | "focus"
  | "style"
  | "retention"
  | "consistency"
  | "motivation"
  | "skill"
  | "mistake"
  | "sequence"
  | "coverage";

/**
 * A behavioural observation about one specific learner.
 *
 * `evidence` is mandatory and non-empty by construction: an insight that cannot
 * cite the numbers behind it is never created (see insights.ts). This is the
 * structural guarantee behind "never generate generic advice".
 */
export interface DnaInsight {
  id: string;
  kind: InsightKind;
  title: string;
  text: string;
  evidence: string[];
  confidence: Confidence;
  /** Ranking weight, 0-100. Higher = more actionable for this learner now. */
  weight: number;
  tone: "positive" | "neutral" | "warning";
}

export type RecommendationKind =
  | "study_plan"
  | "lesson_order"
  | "review_timing"
  | "difficulty"
  | "homework"
  | "revision"
  | "mentor"
  | "motivation"
  | "weak_skill"
  | "exam_prep";

export interface DnaRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  detail: string;
  href: string;
  /** 0-100; consumers should respect this ordering. */
  priority: number;
  /** The DNA measurement this recommendation stands on. */
  basis: string;
  confidence: Confidence;
}

export interface DnaPlanBlock {
  order: number;
  label: string;
  skill: SkillKey | null;
  channel: Channel | null;
  minutes: number;
  purpose: string;
  href: string;
  /** Why this block is here, and why here in the order. */
  why: string;
}

export interface DnaStudyPlan {
  window: { startHour: number; endHour: number; label: string } | null;
  totalMinutes: number;
  blocks: DnaPlanBlock[];
  basis: string;
  confidence: Confidence;
}

/** A measured, recent change — used for both "Recent improvements" and
 *  "Areas requiring attention" so the two lists can never contradict. */
export interface DnaChange {
  id: string;
  label: string;
  detail: string;
  /** Signed magnitude of the change in its own natural unit. */
  delta: number | null;
  unit: string;
  direction: "up" | "down";
  href: string;
}

// ---------------------------------------------------------------------------
// The profile
// ---------------------------------------------------------------------------

/** Bumped whenever the payload shape changes, so stale rows are recomputed
 *  instead of mis-rendered. */
export const DNA_VERSION = 1;

export interface LearningDnaProfile {
  studentId: string;
  version: number;
  /** ISO timestamp — profiles are serialised through JSON columns and APIs. */
  computedAt: string;
  windowDays: number;

  dataPoints: number;
  /** 0-100 "how developed is this person as a learner" (not how high the band). */
  maturity: DnaScore;
  /** Overall trust in this profile as a whole. */
  confidence: Confidence;
  coverage: DnaCoverage;

  style: DnaStyleProfile;
  focus: DnaFocusProfile;
  timing: DnaTimingProfile;

  retention: DnaScore;
  /** Days until recall decays to ~50% without review. Lower = forgets faster. */
  memoryHalfLifeDays: number | null;
  learnerConfidence: DnaScore;
  consistency: DnaScore;
  motivation: DnaMotivation;
  learningSpeed: DnaLearningSpeed;
  revisionEfficiency: DnaScore;
  skillBalance: DnaScore;

  skills: DnaSkillMetric[];
  strongest: DnaSkillMetric | null;
  weakest: DnaSkillMetric | null;
  fastestGrowing: DnaSkillMetric | null;
  needsReinforcement: DnaSkillMetric[];

  growth: DnaGrowth;
  mistakes: DnaMistakeCategory[];
  sequencing: DnaSequencing;

  insights: DnaInsight[];
  recommendations: DnaRecommendation[];
  plan: DnaStudyPlan;

  improvements: DnaChange[];
  attention: DnaChange[];
  /** Honest list of the behaviour the engine still needs in order to sharpen
   *  this profile. Shown to students instead of inventing advice. */
  nextDataNeeded: string[];
}

// ---------------------------------------------------------------------------
// Consumer-facing views
// ---------------------------------------------------------------------------

/** Compact teacher briefing derived from the profile — no raw learner content. */
export interface DnaTeacherView {
  studentId: string;
  name: string;
  learnsBestBy: string;
  bestTime: string;
  attentionSpan: string;
  motivation: { label: string; trend: Trend; score: number | null };
  efficiency: { label: string; score: number | null };
  confidence: { label: string; score: number | null };
  strongHabits: string[];
  weakHabits: string[];
  strategy: string[];
  recentChanges: DnaChange[];
  maturity: number;
  dataConfidence: Confidence;
  updatedAt: string | null;
}

/** Anonymous, platform-wide aggregate for the admin panel. Never contains an
 *  identifier, a name, or any figure derived from fewer than K learners. */
export interface DnaAggregate {
  profiles: number;
  /** Minimum cohort size required before a figure is published. */
  kThreshold: number;
  suppressed: boolean;
  styles: { style: LearningStyle; label: string; count: number; share: number }[];
  avgFocusMinutes: number | null;
  avgIdealLessonMinutes: number | null;
  hardestSkills: { skill: SkillKey; label: string; avgAccuracy: number | null; learners: number }[];
  motivation: { rising: number; steady: number; falling: number };
  retention: { avg: number | null; strong: number; fading: number };
  avgLearningSpeed: number | null;
  avgConsistency: number | null;
  avgMaturity: number | null;
  dayparts: { daypart: DnaDaypart; label: string; count: number; share: number }[];
  maturityTrend: { dayKey: string; maturity: number; motivation: number | null }[];
}

/** Tight, token-cheap summary handed to AI features (Mentor, Second Brain,
 *  Future Simulator) so every model call is grounded in the same understanding. */
export interface DnaPromptContext {
  available: boolean;
  confidence: Confidence;
  summary: string;
  facts: string[];
  cautions: string[];
}
