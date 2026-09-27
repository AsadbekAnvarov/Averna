/**
 * Placement test settings — the rules of the test live here, in one place.
 *
 * Pure constants and tiny helpers: safe for server code, client components and
 * the offline content check (relative imports only).
 */

import type { Cefr, PlacementSection } from "./types";

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export const PLACEMENT_HUB_HREF = "/learning/placement";
export const placementRunHref = (attemptId: string) => `${PLACEMENT_HUB_HREF}/${encodeURIComponent(attemptId)}`;
export const placementResultHref = (attemptId: string) => `${PLACEMENT_HUB_HREF}/result/${encodeURIComponent(attemptId)}`;

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** Minutes on the section clock. Listening follows its recording (see LISTENING_BUFFER_MINUTES). */
export const SECTION_MINUTES: Record<Exclude<PlacementSection, "LISTENING">, number> = {
  GRAMMAR: 15,
  READING: 15,
  WRITING: 15,
};
/**
 * Listening has no clock of its own (the runner ends the section after the
 * recording and the 2-minute check). The server window is the estimated
 * recording + checking time plus this buffer: browser voices differ in speed,
 * and the student may play the sound check first.
 */
export const LISTENING_BUFFER_MINUTES = 6;
/** Answers still count this long after the deadline (network, the runner's own auto-submit). */
export const GRACE_MS = 2 * 60_000;
/** Days before a finished test can be taken again (an admin can allow it earlier). */
export const RETAKE_DAYS = 14;
/** "Not now" on the dashboard card hides it for this long (localStorage). */
export const PROMPT_DISMISS_DAYS = 7;
export const PROMPT_DISMISS_KEY = "averna-placement-prompt-until";

/** Rough length of a sitting without the optional Writing (15 more minutes), for the intro copy. */
export const TOTAL_MINUTES_CORE = 40;

export function retakeOpensAt(finishedAt: Date): Date {
  return new Date(finishedAt.getTime() + RETAKE_DAYS * 86_400_000);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Weights of the overall level. Sections that don't count (skipped Writing,
 * Listening with no answer at all) drop out and the rest are renormalised.
 */
export const SECTION_WEIGHTS: Record<PlacementSection, number> = {
  GRAMMAR: 0.4,
  READING: 0.25,
  LISTENING: 0.25,
  WRITING: 0.1,
};

/**
 * Grammar & Vocabulary raw score (out of 30; other lengths are scaled to 30)
 * → CEFR: the lowest score for each level, highest level first. The 30 items
 * rise from A1 to C1 (6 per level), so a B1 learner typically gets most of A1–A2,
 * about half of B1 and a few harder items right.
 */
export const GV_THRESHOLDS: { cefr: Cefr; min: number }[] = [
  { cefr: "C1", min: 26 },
  { cefr: "B2", min: 21 },
  { cefr: "B1", min: 16 },
  { cefr: "A2", min: 10 },
  { cefr: "A1", min: 0 },
];
export const GV_SCALE = 30;

/**
 * Highest band a short section can show. Listening and Reading raw scores are
 * scaled to 40 with the IELTS conversion tables, but 10–12 questions on one
 * everyday recording or one short article can't evidence a band above this.
 */
export const BAND_CAP: Record<"LISTENING" | "READING" | "WRITING", number> = {
  LISTENING: 7.5,
  READING: 7.5,
  WRITING: 7.5,
};
/**
 * Listening is one everyday, Part 1-style conversation — the easiest kind of
 * IELTS recording. Candidates score about a band higher on Part 1 than on a
 * full paper, so its scaled band is lowered by this much (then capped).
 */
export const LISTENING_BAND_OFFSET = -1;
/**
 * Reading is one general-interest article rather than an Academic passage, so
 * its scaled raw score is converted with the General Training table.
 */
export const READING_TABLE: "academic" | "general" = "general";
/** An automatic (non-AI) Writing estimate can't confirm more than this. */
export const HEURISTIC_WRITING_CAP = 6;
/** Very short Writing samples can't show a higher band ("fewer than `under` words → at most `cap`"). */
export const WRITING_LENGTH_CAPS: { under: number; cap: number }[] = [
  { under: 20, cap: 2.5 },
  { under: 60, cap: 4 },
  { under: 100, cap: 5.5 },
];
/** Writing samples shorter than this aren't sent to the AI examiner (nothing to assess). */
export const MIN_AI_WORDS = 30;

/**
 * IELTS band ↔ continuous CEFR index (A1 = 1, A2 = 2, B1 = 3, B2 = 4, C1 = 5,
 * C2 = 6), piecewise linear between these anchors. They follow the published
 * IELTS–CEFR alignment: 4.0–5.0 ≈ B1, 5.5–6.5 ≈ B2, 7.0–8.0 ≈ C1.
 */
export const BAND_INDEX_ANCHORS: [band: number, index: number][] = [
  [0, 1],
  [3, 2],
  [4, 3],
  [5.5, 4],
  [7, 5],
  [8.5, 6],
  [9, 6.33],
];
/** The overall IELTS estimate stays inside its CEFR level's band range (and OVERALL_BAND_RANGE). */
export const CEFR_BAND_RANGE: Record<Cefr, [number, number]> = {
  A1: [2, 2.5],
  A2: [3, 3.5],
  B1: [4, 5],
  B2: [5.5, 6.5],
  C1: [7, 8],
};
export const OVERALL_BAND_RANGE = { min: 2, max: 7.5 };
/** A section this far above / below the overall level is called a strength / weakness. */
export const STANDOUT_GAP = 0.5;

// ---------------------------------------------------------------------------
// Recommendation table
// ---------------------------------------------------------------------------

export interface RecommendationRule {
  key: string;
  levels: Cefr[];
  course: string;
  /** IELTS target band of the course. */
  target?: string;
  /** One sentence for the student's result page. */
  blurb: string;
  /** Admin page label (Uzbek). */
  uz: string;
}

export const RECOMMENDATIONS: RecommendationRule[] = [
  {
    key: "general",
    levels: ["A1", "A2"],
    course: "General English / Pre-IELTS",
    blurb: "Build everyday English first — grammar, vocabulary and confidence in all four skills — before exam training starts.",
    uz: "General English / Pre-IELTS",
  },
  {
    key: "foundation",
    levels: ["B1"],
    course: "IELTS Foundation",
    target: "5.0–5.5",
    blurb: "Learn how every part of IELTS works while you strengthen the grammar and vocabulary the exam expects.",
    uz: "IELTS Foundation (maqsad 5.0–5.5)",
  },
  {
    key: "intermediate",
    levels: ["B2"],
    course: "IELTS Intermediate",
    target: "6.0–6.5",
    blurb: "Exam strategies for each section, timed practice and regular Writing and Speaking feedback.",
    uz: "IELTS Intermediate (maqsad 6.0–6.5)",
  },
  {
    key: "advanced",
    levels: ["C1"],
    course: "IELTS Advanced",
    target: "7.0+",
    blurb: "Polish accuracy and range for a high band: full mock exams and detailed feedback on Writing and Speaking.",
    uz: "IELTS Advanced (maqsad 7.0+)",
  },
];

export function recommendationRule(cefr: Cefr): RecommendationRule {
  return RECOMMENDATIONS.find((r) => r.levels.includes(cefr)) ?? RECOMMENDATIONS[0];
}

export function recommendationLabel(rule: RecommendationRule): string {
  return rule.target ? `${rule.course} (target ${rule.target})` : rule.course;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const SECTION_TITLE: Record<PlacementSection, string> = {
  GRAMMAR: "Grammar & Vocabulary",
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
};

export const SECTION_TITLE_UZ: Record<PlacementSection, string> = {
  GRAMMAR: "Grammatika va lugʻat",
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
};

/** Where to practise each section (the library). */
export const SECTION_LIBRARY: Record<PlacementSection, string> = {
  GRAMMAR: "/grammar",
  LISTENING: "/learning/listening",
  READING: "/learning/reading",
  WRITING: "/learning/writing",
};

export const TOPIC_LABEL: Record<string, string> = {
  tenses: "Verb tenses",
  articles: "Articles (a / an / the)",
  prepositions: "Prepositions",
  conditionals: "Conditionals",
  modals: "Modal verbs",
  passive: "The passive",
  "word-formation": "Word formation",
  collocations: "Collocations",
  "academic-vocabulary": "Academic vocabulary",
};

/** Vocabulary topics are practised with flashcards; the rest in the grammar guide. */
export const VOCABULARY_TOPICS = ["word-formation", "collocations", "academic-vocabulary"];

/** "B1 · IELTS ≈ 5.0" — what Student.level gets. */
export function levelLabel(cefr: Cefr, band: number): string {
  return `${cefr} · IELTS ≈ ${band.toFixed(1)}`;
}
