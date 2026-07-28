import type { Channel, DnaDaypart, LearningStyle, SkillKey } from "./types";

/**
 * Learning DNA Engine — every tunable in one place.
 *
 * The engine deliberately has NO runtime configuration: thresholds live here as
 * named, documented constants so the behaviour is reproducible, reviewable in a
 * diff, and identical across every environment. "Becomes smarter over time
 * without manual configuration" means the *data* changes what the engine says —
 * not a knob someone has to turn.
 *
 * Every threshold below exists to stop the engine from making a claim it cannot
 * support. When tempted to lower one, lower the claim instead.
 */

export const DAY_MS = 86_400_000;

/** Tashkent (UTC+5, no DST) — the centre's operating timezone. */
export const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;

/** How far back behavioural analysis looks. Long enough to see a habit, short
 *  enough that last term's behaviour doesn't describe today's learner. */
export const ANALYSIS_WINDOW_DAYS = 90;

/** Recency window used for trend comparisons (this window vs the previous one). */
export const TREND_WINDOW_DAYS = 14;

/** Window used for consistency/coverage measurements. */
export const CONSISTENCY_WINDOW_DAYS = 28;

/** Hard cap on rows pulled per source. Protects latency on power users; the
 *  windows above already bound the semantics. */
export const MAX_EVENTS = 4000;
export const MAX_ROWS = 1000;

/** A profile older than this is recomputed on read (lazy freshness). */
export const PROFILE_STALE_MS = 6 * 60 * 60 * 1000;

/**
 * …or sooner, if this many new behavioural events have landed since.
 *
 * Set to 1 deliberately: ANY new learning invalidates the profile. That is what
 * lets the expensive recomputation live on the read path instead of the
 * submission path — a student who has just finished a test always sees a profile
 * that includes it, while a student who is only browsing pays nothing. The cost
 * is therefore proportional to real learning, not to page views.
 */
export const PROFILE_STALE_EVENTS = 1;

// ---------------------------------------------------------------------------
// Confidence ladders
// ---------------------------------------------------------------------------

export interface ConfidenceLadder {
  low: number;
  medium: number;
  high: number;
}

/**
 * Sample sizes at which a metric earns each confidence grade. Below `low`, the
 * metric reports `insufficient` and its value is withheld (null) rather than
 * shown with a caveat — a number on a premium dashboard reads as a fact, so an
 * unsupportable number must not be rendered at all.
 */
export const LADDERS: Record<string, ConfidenceLadder> = {
  /** Comparing performance across times of day needs several sessions per bucket. */
  timing: { low: 8, medium: 20, high: 45 },
  /** Fatigue curves need enough sessions across several length bands. */
  focus: { low: 6, medium: 15, high: 35 },
  /** Style detection compares channels, so it needs breadth as well as volume. */
  style: { low: 8, medium: 20, high: 50 },
  retention: { low: 5, medium: 20, high: 60 },
  confidence: { low: 5, medium: 15, high: 40 },
  consistency: { low: 7, medium: 14, high: 21 },
  motivation: { low: 6, medium: 16, high: 40 },
  speed: { low: 3, medium: 6, high: 12 },
  revision: { low: 5, medium: 20, high: 60 },
  growth: { low: 4, medium: 12, high: 30 },
  skill: { low: 2, medium: 5, high: 10 },
  sequence: { low: 6, medium: 16, high: 40 },
  maturity: { low: 10, medium: 30, high: 80 },
};

// ---------------------------------------------------------------------------
// Effect-size gates
// ---------------------------------------------------------------------------

/** Minimum sessions in a daypart before it can be named "your best time". */
export const MIN_SESSIONS_PER_DAYPART = 4;
/** Minimum accuracy advantage (points) for a daypart claim to be meaningful. */
export const MIN_DAYPART_ADVANTAGE = 5;
/** At least this many dayparts must have data, or there's nothing to compare. */
export const MIN_DAYPARTS_COMPARED = 2;

/** Minimum sessions in a duration band before it counts in the fatigue curve. */
export const MIN_SESSIONS_PER_BAND = 3;
/** Accuracy drop (points) that counts as genuine fatigue rather than noise. */
export const MIN_FATIGUE_DROP = 7;

/** Minimum events in a style's channels before it can be "preferred". */
export const MIN_EVENTS_PER_STYLE = 4;
/** Minimum score gap between the top two styles before we name a preference. */
export const MIN_STYLE_MARGIN = 6;

/** Minimum sessions on each side of the priming comparison. */
export const MIN_PRIMING_SESSIONS = 3;
/** Accuracy lift (points) that makes a sequencing claim worth making. */
export const MIN_PRIMING_LIFT = 4;

/** Minimum occurrences before a mistake category is called "repeated". */
export const MIN_MISTAKE_OCCURRENCES = 3;

/** Volume change (%) that counts as a real motivation shift. */
export const MIN_MOTIVATION_SHIFT = 20;

/** Insights below this weight are dropped rather than padding the list. */
export const MIN_INSIGHT_WEIGHT = 25;
/** Never overwhelm: the dashboard shows the most actionable few. */
export const MAX_INSIGHTS = 7;
export const MAX_RECOMMENDATIONS = 6;

/** Privacy floor for admin aggregates: no figure is published unless it
 *  describes at least this many learners. */
export const AGGREGATE_K_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Labels & mappings
// ---------------------------------------------------------------------------

export const SKILL_LABEL: Record<SkillKey, string> = {
  READING: "Reading",
  LISTENING: "Listening",
  WRITING: "Writing",
  SPEAKING: "Speaking",
  GRAMMAR: "Grammar",
  VOCABULARY: "Vocabulary",
};

export const SKILL_HREF: Record<SkillKey, string> = {
  READING: "/learning/reading",
  LISTENING: "/learning/listening",
  WRITING: "/learning/writing",
  SPEAKING: "/learning/speaking",
  GRAMMAR: "/grammar",
  VOCABULARY: "/flashcards",
};

/** The four modules that carry an IELTS band. Grammar/Vocabulary are tracked as
 *  foundations and scored by accuracy, not band. */
export const BAND_SKILLS: SkillKey[] = ["READING", "LISTENING", "WRITING", "SPEAKING"];

export const ALL_SKILLS: SkillKey[] = [
  "READING",
  "LISTENING",
  "WRITING",
  "SPEAKING",
  "GRAMMAR",
  "VOCABULARY",
];

/** Default channel for a skill when a sensor call doesn't specify one. */
export const SKILL_CHANNEL: Record<SkillKey, Channel> = {
  READING: "reading",
  LISTENING: "audio",
  WRITING: "writing",
  SPEAKING: "speaking",
  GRAMMAR: "grammar",
  VOCABULARY: "flashcard",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  reading: "reading",
  audio: "listening to audio",
  writing: "writing practice",
  speaking: "speaking aloud",
  flashcard: "flashcard drilling",
  conversation: "conversation & roleplay",
  video: "video",
  grammar: "grammar drills",
};

/**
 * Style ← channels. A style is simply "the channels that share a cognitive
 * mode", which keeps the mapping defensible and easy to extend when a new
 * activity type is added to the platform.
 */
export const STYLE_CHANNELS: Record<LearningStyle, Channel[]> = {
  visual: ["reading", "video"],
  auditory: ["audio"],
  verbal: ["speaking", "conversation"],
  kinesthetic: ["flashcard"],
  analytical: ["writing", "grammar"],
};

/** Explicit, readable style descriptions used across all three dashboards. */
export const STYLE_LABEL: Record<LearningStyle, string> = {
  visual: "Visual reader",
  auditory: "Audio learner",
  verbal: "Verbal / spoken learner",
  kinesthetic: "Active recall learner",
  analytical: "Analytical writer",
};

export const STYLE_HINT: Record<LearningStyle, string> = {
  visual: "You get the most out of text you can scan, re-read and annotate.",
  auditory: "You absorb material fastest when you hear it.",
  verbal: "You consolidate knowledge by saying it out loud.",
  kinesthetic: "You learn by retrieving — testing yourself beats re-reading.",
  analytical: "You learn by producing and correcting structured language.",
};

export const ALL_STYLES: LearningStyle[] = [
  "visual",
  "auditory",
  "verbal",
  "kinesthetic",
  "analytical",
];

export interface DaypartDef {
  key: DnaDaypart;
  label: string;
  fromHour: number;
  /** Exclusive upper bound. `night` wraps past midnight. */
  toHour: number;
}

/**
 * Five dayparts. Split finer than the dashboard's greeting because performance
 * genuinely differs between 06:00 and 11:00, and between 19:00 and 23:30 —
 * which is precisely the difference a study-time recommendation turns on.
 */
export const DAYPARTS: DaypartDef[] = [
  { key: "early", label: "Early morning", fromHour: 5, toHour: 8 },
  { key: "morning", label: "Morning", fromHour: 8, toHour: 12 },
  { key: "afternoon", label: "Afternoon", fromHour: 12, toHour: 17 },
  { key: "evening", label: "Evening", fromHour: 17, toHour: 22 },
  { key: "night", label: "Late night", fromHour: 22, toHour: 5 },
];

export const DAYPART_LABEL: Record<DnaDaypart, string> = {
  early: "Early morning",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Late night",
};

/** Session-length bands for the fatigue curve. Chosen around the pedagogically
 *  meaningful breakpoints (a short drill, a focused block, an exam-length sit). */
export const DURATION_BANDS: { label: string; fromMin: number; toMin: number | null }[] = [
  { label: "under 15 min", fromMin: 0, toMin: 15 },
  { label: "15-30 min", fromMin: 15, toMin: 30 },
  { label: "30-45 min", fromMin: 30, toMin: 45 },
  { label: "45-60 min", fromMin: 45, toMin: 60 },
  { label: "over 60 min", fromMin: 60, toMin: null },
];

/**
 * Mistake categories the engine can recognise, with the fix it should suggest.
 * Sensor callers emit these slugs in `errorTags`; the engine also derives a few
 * of them from outcome patterns so the category list is useful from day one.
 */
export const MISTAKE_CATALOG: Record<string, { label: string; fix: string }> = {
  time_pressure: {
    label: "Unfinished under time pressure",
    fix: "Practise with a visible timer and answer easy questions first.",
  },
  rushed: {
    label: "Rushed answers",
    fix: "Slow down on the first pass — your accuracy climbs when you do.",
  },
  vocabulary_recall: {
    label: "Vocabulary recall",
    fix: "Shorter, more frequent review beats one long session.",
  },
  detail_questions: {
    label: "Detail & scanning questions",
    fix: "Underline the keyword in the question before scanning the text.",
  },
  inference: {
    label: "Inference & implied meaning",
    fix: "Practise True/False/Not Given sets and justify each answer aloud.",
  },
  articles: { label: "Articles (a / an / the)", fix: "Drill article rules with short gap-fills." },
  tenses: { label: "Tense consistency", fix: "Rewrite one paragraph in a fixed tense as a warm-up." },
  prepositions: { label: "Prepositions", fix: "Collect them as phrases, not single words." },
  word_form: { label: "Word forms", fix: "Learn each new word with its noun/verb/adjective family." },
  spelling: { label: "Spelling", fix: "Add misspellings straight to your review deck." },
  task_response: {
    label: "Task response / staying on topic",
    fix: "Spend 2 minutes planning before writing.",
  },
  coherence: { label: "Cohesion & linking", fix: "Aim for one linking device per paragraph, not per sentence." },
  fluency: { label: "Fluency & hesitation", fix: "Record 60-second answers daily; don't restart sentences." },
  pronunciation: { label: "Pronunciation", fix: "Drill the specific sounds flagged in your recordings." },
  grammar_range: { label: "Limited grammar range", fix: "Add one complex sentence per paragraph deliberately." },
  lexical_range: { label: "Limited vocabulary range", fix: "Replace two repeated words per essay with precise synonyms." },
};

/** Fallback label for an unrecognised tag — the engine still reports it rather
 *  than silently dropping a signal a future feature emitted. */
export function mistakeLabel(tag: string): string {
  const known = MISTAKE_CATALOG[tag];
  if (known) return known.label;
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mistakeFix(tag: string): string {
  const known = MISTAKE_CATALOG[tag];
  if (known) return known.fix;
  return "Add these to your Mistake Bank and review them with spaced repetition.";
}
