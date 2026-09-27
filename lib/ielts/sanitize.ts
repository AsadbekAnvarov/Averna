/**
 * Strip answer keys and explanations before content is sent to the browser.
 * The CD-IELTS runners only ever receive these client shapes; grading happens
 * on the server against the full test.
 */

import type {
  ClientGroup,
  ClientListeningTest,
  ClientReadingTest,
  ExamGroup,
  ExamListeningTest,
  ExamReadingTest,
} from "./types";

export function toClientGroup(g: ExamGroup): ClientGroup {
  return {
    ...g,
    questions: g.questions.map(({ answer: _a, explanation: _e, ...q }) => q),
  };
}

export function toClientReading(test: ExamReadingTest, partIndex?: number): ClientReadingTest {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  return { ...test, parts: parts.map((p) => ({ ...p, groups: p.groups.map(toClientGroup) })) };
}

export function toClientListening(test: ExamListeningTest, partIndex?: number): ClientListeningTest {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  return { ...test, parts: parts.map((p) => ({ ...p, groups: p.groups.map(toClientGroup) })) };
}
