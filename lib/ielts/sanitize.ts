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

/** These supplied HTML papers print the question number inside the stem too.
 * Keep source rows/fingerprints intact; the runner already renders that badge. */
function suppliedGroup(g: ExamGroup, id: string): ClientGroup {
  if (!id.startsWith("cdi-vol10-")) return toClientGroup(g);
  return toClientGroup({ ...g, questions: g.questions.map(q => ({ ...q,
    text: q.text?.replace(new RegExp(`^${q.n}(?:[.)]\\s*|\\s+)`), ""),
  })) });
}

export function toClientReading(test: ExamReadingTest, partIndex?: number): ClientReadingTest {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  return { ...test, parts: parts.map((p) => ({ ...p, groups: p.groups.map(g => suppliedGroup(g, test.id)) })) };
}

export function toClientListening(test: ExamListeningTest, partIndex?: number): ClientListeningTest {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  return { ...test, parts: parts.map((p) => ({ ...p, groups: p.groups.map(g => suppliedGroup(g, test.id)) })) };
}
