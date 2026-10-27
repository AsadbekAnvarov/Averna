/**
 * "Practise this type": a result page's wrong answers grouped by question type,
 * and for each type ONE part of ANOTHER paper of the same skill to practise it
 * — one the student hasn't done yet when there is one. Pure (catalog summaries
 * and the student's done keys come in as data).
 */

import { PRACTICE_KIND_LABEL } from "@/lib/ielts/format";
import type { ExamSkill, ExamTestSummary, GradeItem, PracticeKind } from "@/lib/ielts/types";

export interface PracticePick {
  testId: string;
  /** 0-based part, or null for the whole paper (single-recording Listening papers can't be split). */
  part: number | null;
  testTitle: string;
  partTitle: string | null;
}

export type CatalogEntry = Pick<ExamTestSummary, "id" | "skill" | "title" | "partInfo"> &
  Partial<Pick<ExamTestSummary, "recordingMode">>;

export interface PickInput {
  kind: PracticeKind;
  skill: ExamSkill;
  /** The paper of this result: never picked while another paper has the type. */
  currentTestId: string;
  /** Catalog summaries in catalog order (the order decides between equals). */
  catalog: readonly CatalogEntry[];
  /** The student's content keys: "<testId>" (whole paper) or "<testId>#p<n>" (n = part + 1). */
  done: ReadonlySet<string>;
}

/** Repeat key of a practised part (same as the IELTSTest answers.testId of a part attempt). */
export const partKey = (testId: string, part: number) => `${testId}#p${part + 1}`;

export function isDone(done: ReadonlySet<string>, testId: string, part: number | null): boolean {
  return done.has(testId) || (part != null && done.has(partKey(testId, part)));
}

/**
 * The part to practise `kind` on. Tiers, first match in catalog order wins:
 * another paper not done yet → another paper → this paper, not done → this paper.
 * Null when no part of that skill has the type.
 */
export function pickPracticePart({ kind, skill, currentTestId, catalog, done }: PickInput): PracticePick | null {
  let best: { tier: number; pick: PracticePick } | null = null;
  for (const t of catalog) {
    if (t.skill !== skill) continue;
    const whole = t.recordingMode === "whole" || t.partInfo.length <= 1;
    const parts = t.partInfo
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => Array.isArray(p.kinds) && p.kinds.includes(kind));
    if (!parts.length) continue;
    for (const { p, i } of whole ? parts.slice(0, 1) : parts) {
      const part = whole ? null : i;
      const other = t.id !== currentTestId;
      // A one-part paper may have been saved as its part ("#p1") or as the paper.
      const fresh = !isDone(done, t.id, part ?? 0);
      const tier = other ? (fresh ? 0 : 1) : fresh ? 2 : 3;
      if (!best || tier < best.tier) {
        best = { tier, pick: { testId: t.id, part, testTitle: t.title, partTitle: whole ? null : p.title || null } };
        if (tier === 0) return best.pick;
      }
    }
  }
  return best?.pick ?? null;
}

export interface MistakeRow {
  kind: PracticeKind;
  /** Wrong or blank. */
  wrong: number;
  total: number;
}

/**
 * Questions of this attempt per type, only types with a mistake; most mistakes
 * first, then paper order. `kindOf` refines an item's kind (matching headings /
 * information) from the paper; it defaults to the graded kind.
 */
export function mistakesByKind(items: readonly GradeItem[], kindOf?: (item: GradeItem) => PracticeKind): MistakeRow[] {
  const rows = new Map<PracticeKind, MistakeRow>();
  for (const it of [...items].sort((a, b) => a.n - b.n)) {
    const kind = kindOf?.(it) ?? it.kind;
    const row = rows.get(kind) ?? { kind, wrong: 0, total: 0 };
    row.total += 1;
    if (!it.correct) row.wrong += 1;
    rows.set(kind, row);
  }
  const ordered = Array.from(rows.values());
  return ordered
    .map((r, order) => ({ r, order }))
    .filter(({ r }) => r.wrong > 0)
    .sort((a, b) => b.r.wrong - a.r.wrong || a.order - b.order)
    .map(({ r }) => r);
}

/** "Practise matching headings" / "Practise True / False / Not Given". */
export function practiseLabel(kind: PracticeKind): string {
  const label = PRACTICE_KIND_LABEL[kind];
  const phrase = kind === "tfng" || kind === "ynng" ? label : label.charAt(0).toLowerCase() + label.slice(1);
  return `Practise ${phrase}`;
}
