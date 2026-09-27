/**
 * Placement (entry) test — shared shapes.
 *
 * Pure types and constants: safe for server code, client components
 * (`import type`) and the offline content check. Relative imports only, so the
 * offline check can compile this file without the "@/" path alias.
 */

import type {
  ClientGroup,
  ClientListeningTest,
  ClientReadingTest,
  ExamAnswers,
  ExamListeningTest,
  ExamOption,
  ExamReadingTest,
} from "../ielts/types";

/** The sections of one sitting, in order. */
export const PLACEMENT_SECTIONS = ["GRAMMAR", "LISTENING", "READING", "WRITING"] as const;
export type PlacementSection = (typeof PLACEMENT_SECTIONS)[number];

/** The levels the test can report (it has no C2 items, so it never claims C2). */
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type Cefr = (typeof CEFR_LEVELS)[number];

export const GV_TOPICS = [
  "tenses",
  "articles",
  "prepositions",
  "conditionals",
  "modals",
  "passive",
  "word-formation",
  "collocations",
  "academic-vocabulary",
] as const;
export type GvTopic = (typeof GV_TOPICS)[number];

// ---------------------------------------------------------------------------
// Content (server only — these shapes carry the answer key)
// ---------------------------------------------------------------------------

/** One Grammar & Vocabulary item. */
export interface GvItem {
  /** Question number 1–30, in order of difficulty. */
  n: number;
  level: Cefr;
  topic: GvTopic;
  /** The sentence, with the gap written as "_____". */
  text: string;
  /** A–D. */
  options: ExamOption[];
  /** The correct option key. */
  answer: string;
  /** One line: the rule behind the answer (shown after the test without the item itself). */
  explanation: string;
}

export interface PlacementWritingPrompt {
  id: string;
  title: string;
  prompt: string;
  tips: string[];
  minWords: number;
  maxWords: number;
}

/** One complete version of the test. A form that has been sat is never edited — add a new form instead. */
export interface PlacementForm {
  id: string;
  grammar: GvItem[];
  listening: ExamListeningTest;
  reading: ExamReadingTest;
  writing: PlacementWritingPrompt;
}

// ---------------------------------------------------------------------------
// PlacementAttempt JSON columns
// ---------------------------------------------------------------------------

/** PlacementAttempt.plan */
export interface PlacementPlan {
  v: 1;
  /** PlacementForm id. */
  form: string;
  sections: PlacementSection[];
}

/**
 * PlacementAttempt.draft — the RUNNING section: its server clock plus the
 * autosaved work. Cleared (DB NULL) whenever a section is submitted, so a
 * draft always belongs to `current`.
 */
export interface PlacementDraft {
  /** Index into plan.sections. */
  section: number;
  /** ms epoch */
  startedAt: number;
  /** ms epoch */
  deadline: number;
  /** Grammar & Vocabulary / Listening / Reading. */
  answers?: ExamAnswers;
  /** Writing. */
  essay?: string;
}

export interface CorrectTotal {
  correct: number;
  total: number;
}

export interface WritingCriteria {
  task: number;
  coherence: number;
  lexical: number;
  grammar: number;
}

export interface PlacementSectionResult {
  section: PlacementSection;
  /** CEFR estimate for this section. */
  cefr: Cefr;
  /** Continuous level (A1 = 1 … C1 = 5.x) used for the weighted overall level. */
  index: number;
  /** IELTS band estimate (capped for short sections). Grammar & Vocabulary: its band equivalent. */
  band: number;
  correct?: number;
  total?: number;
  answered?: number;
  /** Counted in the overall level. False for skipped Writing and for Listening with no answer at all. */
  scored: boolean;
  skipped?: boolean;
  /** Nothing was answered / written. */
  blank?: boolean;
  /** The clock ran out: marked from the autosave. */
  auto?: boolean;
  // Grammar & Vocabulary
  byLevel?: Partial<Record<Cefr, CorrectTotal>>;
  byTopic?: Partial<Record<GvTopic, CorrectTotal>>;
  /** Item numbers answered wrongly or left blank. */
  missed?: number[];
  // Writing
  words?: number;
  assessedBy?: "ai" | "heuristic";
  criteria?: WritingCriteria;
  feedback?: string[];
  essay?: string;
  submittedAt: string;
}

export interface PlacementRecommendation {
  /** Stable key from the table in config.ts. */
  key: string;
  course: string;
  /** Target band range of IELTS courses, e.g. "5.0–5.5". */
  target?: string;
  /** What PlacementAttempt.recommendation holds, e.g. "IELTS Foundation (target 5.0–5.5)". */
  label: string;
}

export interface StudyLink {
  label: string;
  href: string;
  reason: string;
}

export interface ReviewPoint {
  topic: GvTopic;
  level: Cefr;
  text: string;
  /** "gap": missed at or below the student's level; "next": the level above. */
  kind: "gap" | "next";
}

export interface PlacementSummary {
  cefr: Cefr;
  index: number;
  band: number;
  /** What was written to Student.level, e.g. "B1 · IELTS ≈ 5.0". */
  level: string;
  recommendation: PlacementRecommendation;
  /** Normalised weights of the sections that counted. */
  weights: Partial<Record<PlacementSection, number>>;
  strengths: string[];
  weaknesses: string[];
  studyFirst: StudyLink[];
  /** The rules behind missed Grammar & Vocabulary items (never the items or their keys). */
  review: ReviewPoint[];
}

/** PlacementAttempt.results */
export interface PlacementResults {
  sections: Partial<Record<PlacementSection, PlacementSectionResult>>;
  summary?: PlacementSummary;
  /** An admin allowed a retake before the waiting period ended (set on the latest finished attempt). */
  retake?: { allowedAt: string; by: string };
}

// ---------------------------------------------------------------------------
// Views (what the pages get)
// ---------------------------------------------------------------------------

export interface PlacementSectionView {
  section: PlacementSection;
  index: number;
  title: string;
  detail: string;
  /** Minutes to show (Listening: the estimated recording + checking time). */
  minutes: number;
  status: "done" | "current" | "upcoming";
  skipped?: boolean;
}

/** Client-safe content of the running section (no answer keys). */
export type PlacementContent =
  | { section: "GRAMMAR"; groups: ClientGroup[]; minutes: number }
  | { section: "LISTENING"; test: ClientListeningTest }
  | { section: "READING"; test: ClientReadingTest; minutes: number }
  | { section: "WRITING"; prompt: PlacementWritingPrompt; minutes: number };

export type PlacementStage =
  | { kind: "intro"; section: PlacementSection; index: number }
  | {
      kind: "running";
      section: PlacementSection;
      index: number;
      /** Server deadline (ms epoch). */
      deadline: number;
      content: PlacementContent;
      /** The autosaved work of this section. */
      draft: PlacementDraft | null;
    }
  | { kind: "finished" }
  | { kind: "abandoned" };

export interface PlacementView {
  attemptId: string;
  sections: PlacementSectionView[];
  stage: PlacementStage;
  startedAt: string;
}

export interface RetakeStatus {
  allowed: boolean;
  /** When a retake opens (ISO), null when there is nothing to wait for. */
  nextAt: string | null;
  /** An admin allowed an early retake. */
  override: boolean;
}

export interface PlacementResultView {
  attemptId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  sections: PlacementResults["sections"];
  summary: PlacementSummary | null;
  retake: RetakeStatus;
}

export interface PlacementOverview {
  active: { attemptId: string; current: number; sections: number; startedAt: string } | null;
  last: {
    attemptId: string;
    finishedAt: string;
    cefr: string | null;
    band: number | null;
    recommendation: string | null;
  } | null;
  retake: RetakeStatus;
}

/** The latest finished attempt of a student, for badges (teachers) and lists. */
export interface PlacementBadgeInfo {
  cefr: string;
  band: number | null;
  finishedAt: string;
}
