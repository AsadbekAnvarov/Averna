/**
 * Progression configuration — the ONE place to balance Averna.
 *
 * Every XP number, level threshold, streak rule, mission size, challenge reward
 * and milestone badge lives here as plain data. The engine modules next to this
 * file (xp.ts, levels.ts, streak.ts, missions.ts, challenges.ts, badges.ts) only
 * read these values, and the UI only ever displays numbers the engine returns —
 * so retuning the economy never means hunting magic numbers through components.
 *
 * This file must stay dependency-free (pure data) so it can be imported from
 * server code, client components and plain Node test scripts alike.
 */

export type SkillKey = "READING" | "LISTENING" | "WRITING" | "SPEAKING";
export const SKILLS: SkillKey[] = ["READING", "LISTENING", "WRITING", "SPEAKING"];

export const SKILL_LABEL: Record<SkillKey, string> = {
  READING: "Reading",
  LISTENING: "Listening",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

export const XP_CONFIG = {
  /**
   * Objective tests (Reading / Listening): XP scales with how much work the
   * paper actually contains, so a 30-question Reading test is worth more than a
   * 7-question Listening drill, and answering 3 questions is worth very little.
   */
  objective: {
    // Tuned for real 40-question papers: a full Reading test (60 min) pays
    // ~140 base XP and a full Listening test (~35 min) ~100, so XP per minute
    // stays level across skills and one paper can't blow the daily budget.
    READING: { perItem: 3.5, maxItems: 40 },
    LISTENING: { perItem: 2.5, maxItems: 40 },
  },
  /**
   * Accuracy multiplier = floor + (1 - floor) · accuracy^exponent.
   * 90% → ×0.89, 50% → ×0.47, 15% → ×0.23. Good work pays ~3–4× more than a
   * guess, but a genuine weak attempt still earns something (no fear of practice).
   */
  accuracy: { floor: 0.18, exponent: 1.35 },
  /** Completion multiplier = floor + (1 - floor) · answered/total. */
  completion: { floor: 0.4 },
  /** Harder material pays more; unknown difficulty is treated as Medium. */
  difficulty: { Easy: 0.85, Medium: 1, Hard: 1.2 } as Record<string, number>,

  /** +10% of the attempt's XP the first time a student meets this content. */
  firstAttemptBonus: 0.1,
  /** Beating your own recent average (band points above it). */
  improvement: { perBand: 16, max: 30 },
  /** Flat bonus for a new personal-best band in the skill. */
  personalBest: 15,
  /** Retaking the SAME content: 1st ×1, 2nd ×0.5, 3rd ×0.3, then ×0.2 … floor ×0.15. */
  repeatDecay: [1, 0.5, 0.3, 0.2],
  repeatFloor: 0.15,

  /** Repeated poor attempts (below `accuracy`) in one skill on one day are halved. */
  poorAttempt: { accuracy: 0.3, freeAttempts: 2, multiplier: 0.5 },
  /** Variety: after N sessions of the same skill in a day, further ones pay less. */
  sameSkillPerDay: { full: 4, multiplier: 0.6 },

  /**
   * Daily learning budget (Tashkent calendar day). XP up to `soft` is paid in
   * full, between soft and hard at `softRate`, above hard at `hardRate`. A
   * smooth taper, never a wall — studying more is always worth *something*.
   */
  dailyBudget: { soft: 450, hard: 800, softRate: 0.5, hardRate: 0.2 },

  writing: {
    task1: { base: 70, targetWords: 150, minWords: 80 },
    task2: { base: 110, targetWords: 250, minWords: 120 },
    /** Length factor = min(1, words/target)^exponent — a short essay is a partial essay. */
    lengthExponent: 1.5,
    /** Band → quality multiplier: floor + (1-floor)·clamp((band - from) / span). */
    quality: { floor: 0.35, from: 4, span: 4.5 },
    /** Bonus when the Coherence & Cohesion criterion shows a clear structure. */
    structureBonus: { minCriterion: 6.5, xp: 10 },
  },

  speaking: {
    base: 45,
    targetSeconds: 120,
    minSeconds: 30,
    minWords: 30,
    /** Above this rate the transcript is not plausible speech. */
    maxWpm: 230,
    implausibleMultiplier: 0.25,
    quality: { floor: 0.35, from: 4, span: 4.5 },
    maxSeconds: 600,
    /** A full Speaking test (Parts 1–3, 11–14 minutes) instead of one answer. */
    fullTest: { base: 95, targetSeconds: 420, maxSeconds: 1500 },
    typedMultiplier: 0.5,
  },

  /** Full mock exam sections pay a little more: they are timed, mixed practice. */
  mock: { sectionMultiplier: 1.2 },

  homework: { minWords: 25, positionBonus: [10, 8, 6] },

  dailyQuiz: { questions: 5, perCorrect: 5 },

  srs: { dailyCap: 60, base: 3, intervalDivisor: 4, maxPerReview: 12 },
} as const;

// ---------------------------------------------------------------------------
// LEVELS
// ---------------------------------------------------------------------------

/**
 * The XP curve. Gaps grow steadily (150 → 250 → 400 → 600 … → 10 000) so early
 * levels come quickly and later ones need weeks of real study. With the daily
 * budget above, a committed student (~250 XP/day) reaches Achiever in about a
 * month and Elite only after ~5–6 months of consistent learning.
 *
 * Thresholds are unchanged from the previous curve on purpose: existing
 * students keep their level and any level-gated rewards (Reward.minLevel).
 */
export const LEVEL_THRESHOLDS = [
  0, 150, 400, 800, 1400, 2200, 3300, 4800, 6800, 9500, 13000, 17500, 23000, 30000, 40000,
];

export interface TierConfig {
  id: string;
  name: string;
  /** Levels (1-based) that belong to this tier. */
  levels: number[];
  /** What reaching this tier means for an IELTS learner. */
  meaning: string;
  /** What the student should focus on while in this tier. */
  focus: string;
}

export const LEVEL_TIERS: TierConfig[] = [
  {
    id: "starter",
    name: "Starter",
    levels: [1, 2],
    meaning: "You're getting to know the IELTS format.",
    focus: "Try each of the four skills at least once.",
  },
  {
    id: "explorer",
    name: "Explorer",
    levels: [3, 4],
    meaning: "You practise regularly and know where you stand.",
    focus: "Find your weakest skill and give it extra time.",
  },
  {
    id: "builder",
    name: "Builder",
    levels: [5, 6],
    meaning: "You're building steady habits across all skills.",
    focus: "Keep a streak and write full-length essays.",
  },
  {
    id: "achiever",
    name: "Achiever",
    levels: [7, 8],
    meaning: "Your results are consistent, not lucky.",
    focus: "Push accuracy on harder material.",
  },
  {
    id: "advanced",
    name: "Advanced",
    levels: [9, 10],
    meaning: "You handle exam-level tasks with confidence.",
    focus: "Take timed mock exams and review every mistake.",
  },
  {
    id: "candidate",
    name: "IELTS Candidate",
    levels: [11, 12],
    meaning: "You train like someone sitting the real exam soon.",
    focus: "Close the gap between your weakest and strongest skill.",
  },
  {
    id: "specialist",
    name: "IELTS Specialist",
    levels: [13, 14],
    meaning: "Months of verified, high-quality practice.",
    focus: "Keep your skills retained — not just reached.",
  },
  {
    id: "elite",
    name: "Elite",
    levels: [15],
    meaning: "The top of Averna — long-term, consistent mastery.",
    focus: "Stay sharp and help your group grow.",
  },
];

// ---------------------------------------------------------------------------
// STREAK
// ---------------------------------------------------------------------------

export const STREAK_CONFIG = {
  /**
   * A day counts toward the streak only through meaningful learning. Logging in,
   * spending points or unlocking a badge never does.
   */
  qualifyingSources: ["test", "homework", "challenge", "srs_review"] as string[],
  /** Flashcards keep the streak alive only after a real review session. */
  srsMinReviewsPerDay: 10,
  milestones: [3, 7, 14, 30, 60, 100, 200, 365],
  /** Recovery: earn one streak freeze every N streak days, up to `maxFreezes`. */
  freezeEvery: 7,
  maxFreezes: 2,
};

// ---------------------------------------------------------------------------
// DAILY MISSION
// ---------------------------------------------------------------------------

export const MISSION_CONFIG = {
  /** Bonus for finishing every step of today's mission (once per day). */
  completionBonus: 50,
  /** A skill untouched for this many days is "neglected" and gets priority. */
  neglectDays: 4,
  /** Minutes per activity (estimates shown to the student). */
  minutes: {
    warmup: 3,
    /** One Reading passage — a third of the 60-minute paper. */
    reading: 20,
    readingFull: 60,
    /** One Listening part (10 questions). */
    listening: 10,
    /** A full Listening paper: ~30 minutes of audio + 2 minutes to check answers. */
    listeningFull: 35,
    writingTask1: 20,
    writingTask2: 40,
    writingExam: 60,
    /** One answer to the AI examiner. */
    speaking: 5,
    /** A full Speaking test, Parts 1–3 (11–14 minutes). */
    speakingTest: 14,
    flashcards: 5,
    homework: 20,
  },
  /**
   * "Bigger goals". Daily missions always use one passage / part; the
   * recommendation switches to the full timed paper (Writing: both tasks) once
   * a skill has `minSessions` results and is within `bandMargin` of the target
   * band. When all four skills are there, it becomes the full mock exam — at
   * most once every `mockCooldownDays`.
   */
  examReady: { minSessions: 3, bandMargin: 0.5, mockCooldownDays: 7 },
};

// ---------------------------------------------------------------------------
// DAILY / WEEKLY CHALLENGES
// ---------------------------------------------------------------------------

export type ChallengeMetric =
  | "skill_sessions" // number of sessions in `skill` (or any skill)
  | "skill_accuracy" // one session in `skill` at or above `threshold` accuracy (0-1)
  | "skill_band" // one session in `skill` at or above band `threshold`
  | "essay_words" // one Task 2 essay of at least `threshold` words
  | "speaking_seconds" // one speaking response of at least `threshold` seconds
  | "distinct_skills" // practise `target` different skills
  | "study_days"; // study on `target` different days

export interface ChallengeDef {
  id: string;
  title: string;
  detail: string;
  metric: ChallengeMetric;
  skill?: SkillKey;
  /** For session counts: how many; for threshold metrics: 1. */
  target: number;
  threshold?: number;
  /** Composite challenges: every part must be met. */
  parts?: { skill: SkillKey; target: number }[];
  xp: number;
  href: string;
}

export const DAILY_CHALLENGES: ChallengeDef[] = [
  { id: "d-read-80", title: "Precision Reader", detail: "Finish a Reading test with 80%+ accuracy.", metric: "skill_accuracy", skill: "READING", target: 1, threshold: 0.8, xp: 80, href: "/learning/reading" },
  { id: "d-listen-65", title: "Sharp Ears", detail: "Score band 6.5+ on a Listening test.", metric: "skill_band", skill: "LISTENING", target: 1, threshold: 6.5, xp: 60, href: "/learning/listening" },
  { id: "d-essay-250", title: "Full-Length Essay", detail: "Write a Writing Task 2 essay of 250+ words.", metric: "essay_words", skill: "WRITING", target: 1, threshold: 250, xp: 80, href: "/learning/writing/task2" },
  { id: "d-speak-120", title: "Two-Minute Talk", detail: "Give a 2-minute answer to the AI examiner.", metric: "speaking_seconds", skill: "SPEAKING", target: 1, threshold: 120, xp: 60, href: "/learning/examiner" },
  { id: "d-two-skills", title: "Mix It Up", detail: "Practise two different skills today.", metric: "distinct_skills", target: 2, xp: 50, href: "/learning" },
  { id: "d-listen-2", title: "Listening Double", detail: "Complete two Listening tests.", metric: "skill_sessions", skill: "LISTENING", target: 2, xp: 60, href: "/learning/listening" },
];

export const WEEKLY_CHALLENGES: ChallengeDef[] = [
  { id: "w-r3-l2", title: "Input Week", detail: "Complete 3 Reading + 2 Listening sessions.", metric: "skill_sessions", target: 5, parts: [{ skill: "READING", target: 3 }, { skill: "LISTENING", target: 2 }], xp: 300, href: "/learning" },
  { id: "w-w2-s2", title: "Output Week", detail: "Write 2 essays and complete 2 Speaking practices.", metric: "skill_sessions", target: 4, parts: [{ skill: "WRITING", target: 2 }, { skill: "SPEAKING", target: 2 }], xp: 300, href: "/learning" },
  { id: "w-all-four", title: "Complete Candidate", detail: "Practise all four IELTS skills this week.", metric: "distinct_skills", target: 4, xp: 250, href: "/learning" },
  { id: "w-5-days", title: "Five-Day Rhythm", detail: "Study on 5 different days this week.", metric: "study_days", target: 5, xp: 250, href: "/learning" },
];

// ---------------------------------------------------------------------------
// MILESTONE BADGES (evidence-based achievements)
// ---------------------------------------------------------------------------

export type BadgeMetric =
  | "reading_tests"
  | "reading_best_accuracy"
  | "listening_tests"
  | "listening_perfect"
  | "writing_essays"
  | "writing_good_essays"
  | "speaking_sessions"
  | "speaking_minutes"
  | "longest_streak"
  | "level"
  | "missions_completed"
  | "weekly_challenges"
  | "all_skills";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  skill: SkillKey | "GENERAL";
  metric: BadgeMetric;
  target: number;
  /** Small XP thank-you; badges are recognition, not an XP farm. */
  xp: number;
  tier: "bronze" | "silver" | "gold";
}

export const BADGES: BadgeDef[] = [
  // Reading
  { id: "read-first", name: "First Passage", description: "Complete your first Reading test.", skill: "READING", metric: "reading_tests", target: 1, xp: 10, tier: "bronze" },
  { id: "read-80", name: "80% Reader", description: "Reach 80% accuracy on a Reading test.", skill: "READING", metric: "reading_best_accuracy", target: 80, xp: 25, tier: "silver" },
  { id: "read-90", name: "90% Reader", description: "Reach 90% accuracy on a Reading test.", skill: "READING", metric: "reading_best_accuracy", target: 90, xp: 40, tier: "gold" },
  { id: "read-10", name: "Reading Regular", description: "Complete 10 Reading tests.", skill: "READING", metric: "reading_tests", target: 10, xp: 30, tier: "silver" },
  // Listening
  { id: "listen-first", name: "First Listen", description: "Complete your first Listening test.", skill: "LISTENING", metric: "listening_tests", target: 1, xp: 10, tier: "bronze" },
  { id: "listen-perfect", name: "Perfect Section", description: "Answer every question of a Listening test correctly.", skill: "LISTENING", metric: "listening_perfect", target: 1, xp: 30, tier: "gold" },
  { id: "listen-10", name: "Listening Regular", description: "Complete 10 Listening sessions.", skill: "LISTENING", metric: "listening_tests", target: 10, xp: 30, tier: "silver" },
  // Writing
  { id: "write-first", name: "First Essay", description: "Submit your first assessed essay.", skill: "WRITING", metric: "writing_essays", target: 1, xp: 10, tier: "bronze" },
  { id: "write-5", name: "Five Essays", description: "Submit 5 assessed essays.", skill: "WRITING", metric: "writing_essays", target: 5, xp: 25, tier: "silver" },
  { id: "write-10", name: "Consistent Writer", description: "Submit 10 assessed essays.", skill: "WRITING", metric: "writing_essays", target: 10, xp: 40, tier: "gold" },
  { id: "write-good", name: "Band 6.5 Writer", description: "Score band 6.5+ on 3 essays.", skill: "WRITING", metric: "writing_good_essays", target: 3, xp: 40, tier: "gold" },
  // Speaking
  { id: "speak-first", name: "First Words", description: "Complete your first Speaking practice.", skill: "SPEAKING", metric: "speaking_sessions", target: 1, xp: 10, tier: "bronze" },
  { id: "speak-10", name: "Ten Conversations", description: "Complete 10 Speaking practices.", skill: "SPEAKING", metric: "speaking_sessions", target: 10, xp: 30, tier: "silver" },
  { id: "speak-30min", name: "30 Minutes Spoken", description: "Speak for 30 minutes in total.", skill: "SPEAKING", metric: "speaking_minutes", target: 30, xp: 40, tier: "gold" },
  // General
  { id: "all-skills", name: "Four-Skill Starter", description: "Practise all four IELTS skills.", skill: "GENERAL", metric: "all_skills", target: 4, xp: 25, tier: "silver" },
  { id: "streak-7", name: "7-Day Streak", description: "Study meaningfully 7 days in a row.", skill: "GENERAL", metric: "longest_streak", target: 7, xp: 30, tier: "silver" },
  { id: "streak-30", name: "30-Day Streak", description: "Study meaningfully 30 days in a row.", skill: "GENERAL", metric: "longest_streak", target: 30, xp: 80, tier: "gold" },
  { id: "level-2", name: "First Level Up", description: "Reach level 2.", skill: "GENERAL", metric: "level", target: 2, xp: 0, tier: "bronze" },
  { id: "mission-1", name: "Mission Complete", description: "Finish every step of a Daily Mission.", skill: "GENERAL", metric: "missions_completed", target: 1, xp: 0, tier: "bronze" },
  { id: "mission-10", name: "Mission Veteran", description: "Complete 10 Daily Missions.", skill: "GENERAL", metric: "missions_completed", target: 10, xp: 40, tier: "gold" },
  { id: "weekly-1", name: "Weekly Challenger", description: "Complete a Weekly Challenge.", skill: "GENERAL", metric: "weekly_challenges", target: 1, xp: 0, tier: "silver" },
];
