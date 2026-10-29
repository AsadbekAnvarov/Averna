/**
 * Instruction lines of a paper for the L1 hints fixture (21.4) — no keys,
 * options, question texts, passages or transcripts — and the count of
 * question-content items that L1_Hints would (wrongly) translate (21.3).
 */

import { l1Hint } from "../l1/hints";
import type { ExamTest } from "../ielts/types";
import { rangeText } from "./text";

export function instructionLines(test: ExamTest): string[] {
  const out: string[] = [];
  for (const p of test.parts) {
    for (const g of p.groups) {
      const ns = g.questions.map((q) => q.n);
      out.push(rangeText(Math.min(...ns), Math.max(...ns)));
      for (const raw of g.instructions.split("\n")) {
        // Question stems inside an instruction ("Which TWO … in France?") are content, not instructions.
        const line = raw
          .split(/(?<=[.?!])\s+/)
          .filter((s) => !s.trim().endsWith("?"))
          .join(" ")
          .trim();
        if (line) out.push(line);
      }
      if (g.answerRule) out.push(g.answerRule);
    }
  }
  return out;
}

/** Question content (group titles, shared options, question texts with ____, per-question options) that got a hint. */
export function contentHintCount(test: ExamTest): number {
  const texts: string[] = [];
  for (const p of test.parts) {
    for (const g of p.groups) {
      if (g.title) texts.push(g.title);
      g.options?.forEach((o) => texts.push(o.text));
      for (const q of g.questions) {
        if (q.text) texts.push(q.text.replace(/\[\[\d+\]\]/g, "____"));
        q.options?.forEach((o) => texts.push(o.text));
      }
    }
  }
  return texts.filter((t) => l1Hint(t, "uz") != null || l1Hint(t, "ru") != null).length;
}
