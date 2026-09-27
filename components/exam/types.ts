/**
 * Props contracts for the CD-IELTS runners. The mock exam orchestrator and the
 * practice pages both render these runners, so their props live here in one
 * place. Practice mode posts to the standalone submit routes and navigates to
 * the result page; mock mode hands the answers to `onSubmit`.
 */

import type { ClientListeningTest, ClientReadingTest, ExamAnswers, SpeakingExamSet } from "@/lib/ielts/types";
import type { WritingPrompt } from "@/lib/writing-data";
import type { SessionOutcome } from "@/lib/engine/progression/service";

export type RunnerMode = "practice" | "mock";

export interface SubmitMeta {
  /** Seconds actually spent. */
  timeSpent: number;
  /** True when the clock ran out and the runner submitted by itself. */
  auto: boolean;
}

export interface ReadingExamRunnerProps {
  test: ClientReadingTest;
  /** Practise one passage (index into test.parts). Omit for the full test. */
  partIndex?: number;
  mode: RunnerMode;
  /** Stable per-attempt id: idempotent submission + autosave key. */
  attemptId: string;
  /** Minutes for this run. Defaults: full test = test.timeLimit, one passage = 20. */
  minutes?: number;
  /** Absolute deadline (ms epoch) from the server — a refresh can't reset the clock (mock). */
  deadline?: number;
  initialAnswers?: ExamAnswers;
  /** Mock mode: receive the answers. Practice mode (omitted): POST /api/learning/reading/submit, then open the result page. */
  onSubmit?: (answers: ExamAnswers, meta: SubmitMeta) => Promise<void> | void;
  /** Mirror answers while working (the mock saves them server-side). */
  onAutosave?: (answers: ExamAnswers) => void;
  /** Practice: where "Leave" goes. */
  exitHref?: string;
}

export interface ListeningExamRunnerProps {
  test: ClientListeningTest;
  partIndex?: number;
  /** mock = exam conditions: the recording plays once, no pause/replay. practice = full audio controls. */
  mode: RunnerMode;
  attemptId: string;
  initialAnswers?: ExamAnswers;
  onSubmit?: (answers: ExamAnswers, meta: SubmitMeta) => Promise<void> | void;
  onAutosave?: (answers: ExamAnswers) => void;
  exitHref?: string;
}

export interface WritingEssays {
  task1: string;
  task2: string;
}

export interface WritingExamRunnerProps {
  task1: WritingPrompt;
  task2: WritingPrompt;
  mode: RunnerMode;
  attemptId: string;
  /** Default 60. */
  minutes?: number;
  deadline?: number;
  initial?: WritingEssays;
  onSubmit: (essays: WritingEssays, meta: SubmitMeta) => Promise<void> | void;
  onAutosave?: (essays: WritingEssays) => void;
  exitHref?: string;
}

export interface SpeakingAnswer {
  part: 1 | 2 | 3;
  question: string;
  transcript: string;
  /** Seconds the candidate spoke for this question. */
  seconds: number;
}

export interface SpeakingTestSubmission {
  setId: string;
  answers: SpeakingAnswer[];
  totalSeconds: number;
  /** "speech" = browser speech recognition; "typed" = fallback when recognition isn't available. */
  inputMode: "speech" | "typed";
}

export interface SpeakingCriteria {
  fluency: number;
  lexical: number;
  grammar: number;
  /** Not measurable from a transcript — null unless a teacher rates it. */
  pronunciation: number | null;
}

/** Response of POST /api/learning/speaking/test (practice mode). */
export interface SpeakingTestResult {
  testId: string;
  band: number;
  criteria: SpeakingCriteria;
  feedback: string[];
  perPart: { part: 1 | 2 | 3; words: number; seconds: number }[];
  xpAwarded: number;
  xpNotes: string[];
  outcome?: SessionOutcome | null;
  assessedBy: "ai" | "heuristic";
}

export interface SpeakingExamRunnerProps {
  set: SpeakingExamSet;
  mode: RunnerMode;
  attemptId: string;
  /** Mock: receive the transcripts. Practice (omitted): POST /api/learning/speaking/test and show the result. */
  onSubmit?: (submission: SpeakingTestSubmission) => Promise<void> | void;
  exitHref?: string;
}
