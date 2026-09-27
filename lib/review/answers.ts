/**
 * Readers for the stored Writing / Speaking attempt shapes (IELTSTest.answers):
 *
 *   exam-v2 Writing  { essay, prompt, promptId, promptTitle, taskType, testId, format,
 *                      examAttemptId? (Task 1 + Task 2 of one sitting), mock?, mockAttemptId?, auto? }
 *   legacy Writing   { essay, prompt, taskType, testId }
 *   exam-v2 Speaking { format, examId, title, inputMode, answers[{ part, question, transcript,
 *                      seconds, questionIndex? }], recordingKey?, mock?, mockAttemptId?, auto? }
 *   legacy Speaking  { question, transcript }
 *
 * Pure.
 */

import type { ReviewSkill, WritingTask } from "./scoring";

export const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
export const str = (x: unknown): string => (typeof x === "string" ? x : "");
export const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function answersOf(raw: unknown): Record<string, unknown> {
  return asRec(raw) ?? {};
}

export function taskTypeOf(answers: Record<string, unknown>): WritingTask | null {
  return answers.taskType === "task1" || answers.taskType === "task2" ? answers.taskType : null;
}

export function isMockAttempt(answers: Record<string, unknown>): boolean {
  return answers.mock === true;
}

export function mockAttemptIdOf(answers: Record<string, unknown>): string | null {
  return str(answers.mockAttemptId) || null;
}

/** Links the two Writing tasks written in one sitting (full Writing test, mock). */
export function examAttemptIdOf(answers: Record<string, unknown>): string | null {
  return str(answers.examAttemptId) || null;
}

/** A full Speaking test (Parts 1–3), not a legacy single-answer practice. */
export function isFullSpeakingTest(answers: Record<string, unknown>): boolean {
  return Array.isArray(answers.answers);
}

/**
 * The SpeakingRecording attemptKey of a recorded test: answers.recordingKey, or
 * "<mockAttemptId>-S" for a mock sitting (the key the mock runner records under).
 */
export function recordingKeyOf(answers: Record<string, unknown>): string | null {
  const key = str(answers.recordingKey);
  if (key) return key;
  const mock = mockAttemptIdOf(answers);
  return mock ? `${mock}-S` : null;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** First line of a text, shortened to `max` characters. */
export function excerpt(text: string, max = 90): string {
  const line = text.trim().split(/\n/)[0]?.trim() ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/** What the attempt was: the Writing prompt title or the Speaking set title. */
export function attemptTitle(skill: ReviewSkill, answers: Record<string, unknown>): string {
  if (skill === "WRITING") {
    return str(answers.promptTitle).trim() || excerpt(str(answers.prompt)) || "Writing task";
  }
  if (isFullSpeakingTest(answers)) return str(answers.title).trim() || "Speaking test";
  return excerpt(str(answers.question)) || "Speaking practice";
}
