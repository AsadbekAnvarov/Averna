/**
 * "The source key scores 40 of 40": the source's own correctAnswers literal
 * (not the converted answers) is sent as a student's answers and graded by
 * the app's Exam_Grader, once with the first and once with the last
 * alternative of every answer. "Choose N" letters go in reverse order.
 */

import { gradeTest } from "../ielts/grading";
import type { ExamAnswers, ExamTest, GradeResult } from "../ielts/types";
import type { MultiPick } from "./groups";
import type { Literal } from "./literals";

export type KeyPick = "first" | "last";

function alternatives(v: Literal | undefined): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => (typeof x === "string" ? x : String(x)));
}

export function answersFromKey(test: ExamTest, key: Record<string, Literal>, pick: KeyPick, multiPicks: MultiPick[] = []): ExamAnswers {
  const out: ExamAnswers = {};
  for (const part of test.parts) {
    for (const g of part.groups) {
      if (g.kind === "mcq-multi") {
        const nums = g.questions.map((q) => q.n);
        const mp = multiPicks.find((m) => m.questionIds.length === nums.length && m.questionIds.every((n) => nums.includes(n)));
        const letters = mp
          ? mp.correctAnswers.map(String)
          : nums.flatMap((n) => alternatives(key[String(n)])).flatMap((x) => x.split(/[,\s/]+/)).filter(Boolean);
        out[String(nums[0])] = Array.from(new Set(letters)).reverse();
        continue;
      }
      for (const q of g.questions) {
        const alts = alternatives(key[String(q.n)]);
        if (alts.length) out[String(q.n)] = pick === "first" ? alts[0] : alts[alts.length - 1];
      }
    }
  }
  return out;
}

export interface KeyCheck {
  first: GradeResult;
  last: GradeResult;
  /** Question numbers not counted in either variant. */
  missed: number[];
}

export function checkKey(test: ExamTest, key: Record<string, Literal>, multiPicks: MultiPick[] = []): KeyCheck {
  const first = gradeTest(test, answersFromKey(test, key, "first", multiPicks));
  const last = gradeTest(test, answersFromKey(test, key, "last", multiPicks));
  const missed = Array.from(new Set([...first.items, ...last.items].filter((i) => !i.correct).map((i) => i.n))).sort((a, b) => a - b);
  return { first, last, missed };
}
