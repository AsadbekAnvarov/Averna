/**
 * A student's recent wrong answers by question type — shared by "Who needs
 * help today" (the "Matching headings: 4 of 5 wrong" reason) and the mini-task
 * builder (which type to practise). Pure: graded items and catalog summaries in.
 *
 * Each Reading / Listening attempt stores its graded items (aiAnalysis.items:
 * question number, group kind, correct). Matching is refined into headings /
 * information from the paper's per-part kinds (catalog summaries), the same
 * split the result page's "Your mistakes by type" uses. Per type, only the LAST
 * `window` questions count (newest attempts first), so an old weakness that has
 * been fixed drops out.
 */

import { PRACTICE_KIND_LABEL } from "@/lib/ielts/format";
import type { ExamSkill, ExamTestSummary, PracticeKind } from "@/lib/ielts/types";

export interface GradedItem {
  n: number;
  kind: string;
  correct: boolean;
}

export interface AttemptItems {
  skill: ExamSkill;
  /** Catalog id of the paper (answers.examId). */
  examId: string | null;
  items: GradedItem[];
}

export interface KindStat {
  skill: ExamSkill;
  kind: PracticeKind;
  label: string;
  /** Wrong (or blank) among the last `of` questions of this type. */
  wrong: number;
  of: number;
}

export type SummaryLookup = (skill: ExamSkill, examId: string) => Pick<ExamTestSummary, "partInfo"> | null | undefined;

const KNOWN = new Set<string>(Object.keys(PRACTICE_KIND_LABEL));
const SKILL_ORDER: ExamSkill[] = ["LISTENING", "READING"];

/** Matching → headings / information when the question's part has only that matching task. */
export function refineKind(kind: string, n: number, summary: Pick<ExamTestSummary, "partInfo"> | null | undefined): PracticeKind | null {
  if (!KNOWN.has(kind)) return null;
  if (kind !== "matching" || !summary) return kind as PracticeKind;
  const part = summary.partInfo.find((p) => n >= p.from && n <= p.to);
  const kinds = part?.kinds ?? [];
  const headings = kinds.includes("matching-headings");
  const info = kinds.includes("matching-information");
  const plain = kinds.includes("matching");
  if (headings && !info && !plain) return "matching-headings";
  if (info && !headings && !plain) return "matching-information";
  return "matching";
}

/**
 * Per (skill, type): wrong answers among the last `window` questions, newest
 * attempts first (`attempts` must be newest first). Types with no mistake are
 * left out. Sorted: most wrong, then the higher share wrong, then Listening
 * before Reading (a Listening part is the shorter task), then the label.
 */
export function kindStats(attempts: readonly AttemptItems[], lookup: SummaryLookup, window = 5): KindStat[] {
  const seen = new Map<string, { skill: ExamSkill; kind: PracticeKind; wrong: number; of: number }>();
  for (const a of attempts) {
    const summary = a.examId ? lookup(a.skill, a.examId) : null;
    // Within one attempt the later questions are the more recent ones.
    const items = [...a.items].filter((i) => Number.isFinite(i.n)).sort((x, y) => y.n - x.n);
    for (const it of items) {
      const kind = refineKind(it.kind, it.n, summary);
      if (!kind) continue;
      const key = `${a.skill}:${kind}`;
      const row = seen.get(key) ?? { skill: a.skill, kind, wrong: 0, of: 0 };
      if (row.of >= window) continue;
      row.of += 1;
      if (!it.correct) row.wrong += 1;
      seen.set(key, row);
    }
  }
  return Array.from(seen.values())
    .filter((r) => r.wrong > 0)
    .map((r) => ({ ...r, label: PRACTICE_KIND_LABEL[r.kind] }))
    .sort(
      (a, b) =>
        b.wrong - a.wrong ||
        b.wrong / b.of - a.wrong / a.of ||
        SKILL_ORDER.indexOf(a.skill) - SKILL_ORDER.indexOf(b.skill) ||
        (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)
    );
}

/** Graded items from a raw aiAnalysis.items projection ([n, kind, correct] triples or objects). */
export function parseItems(raw: unknown): GradedItem[] {
  if (!Array.isArray(raw)) return [];
  const out: GradedItem[] = [];
  for (const x of raw.slice(0, 80)) {
    const [n, kind, correct] = Array.isArray(x)
      ? x
      : x && typeof x === "object"
        ? [(x as Record<string, unknown>).n, (x as Record<string, unknown>).kind, (x as Record<string, unknown>).correct]
        : [];
    const num = typeof n === "number" ? n : typeof n === "string" ? Number(n) : NaN;
    if (!Number.isFinite(num) || typeof kind !== "string") continue;
    out.push({ n: num, kind, correct: correct === true || correct === "true" });
  }
  return out;
}
