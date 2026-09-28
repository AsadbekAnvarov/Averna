/**
 * Class statistics for Reading / Listening exam homework: accuracy per
 * question, the most common wrong answers, accuracy per question type and the
 * questions worth discussing in class — aggregated from the GradeItems stored
 * with each linked attempt (IELTSTest.aiAnalysis.items, see lib/ielts/submit.ts).
 *
 * Pure and deterministic (no database, relative imports only): the teacher's
 * homework page and the offline check run exactly this code.
 *
 * Two details matter for correctness:
 *  - "Choose TWO letters" (mcq-multi) is graded as one GradeItem per question,
 *    but the grader orders the slots (correct letters first), so a slot number
 *    says nothing about WHICH letter a student chose. Those groups are
 *    aggregated as a whole: marks earned, how many students found each correct
 *    letter, and which wrong letters were picked.
 *  - Partial papers (one passage / part) only contain their own questions, so
 *    every denominator is "attempts that contained this question", never the
 *    number of attempts overall; layout groups nobody saw are dropped.
 */

import type { ExamGroup, ExamQuestion, GradeItem, GroupKind } from "../ielts/types";
import { normalizeAnswer } from "../ielts/grading";

// ---------------------------------------------------------------------------
// Layout — how the paper groups its questions (optional; inferred when absent)
// ---------------------------------------------------------------------------

export interface StatsGroup {
  kind: GroupKind;
  /** Question numbers, ascending. */
  numbers: number[];
  /** mcq-multi: the question stem; other kinds: the summary / table / notes title. */
  title?: string;
  /** A short prompt per question (statement, stem, or the gap's line with "_____"). */
  prompts?: Record<number, string>;
  /** Shared option texts by lower-case key (matching, gap-box, mcq-multi). */
  options?: Record<string, string>;
  /** mcq: option texts per question, by lower-case key. */
  questionOptions?: Record<number, Record<string, string>>;
}

type LayoutQuestion = Pick<ExamQuestion, "n" | "text" | "options">;
type LayoutGroup = Pick<ExamGroup, "kind" | "title" | "options" | "template"> & { questions: LayoutQuestion[] };

const PROMPT_MAX = 180;

function tidy(line: string, n: number): string {
  let s = line.trim();
  if (s.startsWith("|")) {
    s = s
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
      .join(" · ");
  }
  s = s.replace(/^#\s+/, "").replace(/^-\s+/, "");
  s = s.replace(/\[\[(\d+)\]\]/g, (_m, d: string) => (Number(d) === n ? "_____" : "…"));
  s = s.replace(/\s+/g, " ").trim();
  return s.length > PROMPT_MAX ? `${s.slice(0, PROMPT_MAX - 1).trimEnd()}…` : s;
}

function promptFor(g: LayoutGroup, q: LayoutQuestion): string | undefined {
  if (q.text && q.text.trim()) return tidy(q.text, q.n);
  if (g.template) {
    const line = g.template.split(/\r?\n/).find((l) => l.includes(`[[${q.n}]]`));
    if (line) return tidy(line, q.n);
  }
  return undefined;
}

function keyed(options: { key: string; text: string }[] | undefined): Record<string, string> | undefined {
  if (!options || !options.length) return undefined;
  const out: Record<string, string> = {};
  for (const o of options) out[o.key.trim().toLowerCase()] = o.text;
  return out;
}

/**
 * The layout of a paper (or of one part of it). Needs the full test (it reads
 * question texts and option lists) — server side only, for staff.
 */
export function statsLayout(test: { parts: { groups: LayoutGroup[] }[] }, partIndex: number | null): StatsGroup[] {
  const parts = partIndex == null ? test.parts : test.parts.slice(partIndex, partIndex + 1);
  return parts
    .flatMap((p) => p.groups)
    .map((g): StatsGroup => {
      const prompts: Record<number, string> = {};
      if (g.kind !== "mcq-multi") {
        for (const q of g.questions) {
          const p = promptFor(g, q);
          if (p) prompts[q.n] = p;
        }
      }
      let questionOptions: Record<number, Record<string, string>> | undefined;
      if (g.kind === "mcq") {
        questionOptions = {};
        for (const q of g.questions) questionOptions[q.n] = keyed(q.options) ?? {};
      }
      return {
        kind: g.kind,
        numbers: g.questions.map((q) => q.n).sort((a, b) => a - b),
        title: g.title?.trim() || undefined,
        prompts,
        options: keyed(g.options),
        questionOptions,
      };
    });
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface AnswerTally {
  /** Display form: "FALSE", "B", "iv", "river bank". */
  answer: string;
  count: number;
  /** Option text for letter / heading answers, when the layout is known. */
  label?: string;
}

interface EntryBase {
  /** Stable key: "q14" / "m21". */
  id: string;
  /** "Q14" / "Q21–22". */
  label: string;
  kind: GroupKind;
  /** First question number (paper order). */
  first: number;
  numbers: number[];
  /** Attempts that contained this question (or group). */
  attempts: number;
  /** Marks available across those attempts, and marks earned. */
  marks: number;
  earned: number;
  /** earned / marks as 0–100, rounded (0 without attempts). */
  pct: number;
  prompt?: string;
}

export interface QuestionStat extends EntryBase {
  type: "question";
  n: number;
  blank: number;
  /** Wrong because the answer broke the word limit. */
  overLimit: number;
  expected: string;
  expectedLabel?: string;
  accepted: string[];
  /** Most common wrong answers (blanks excluded), most frequent first. */
  wrong: AnswerTally[];
}

export interface MultiStat extends EntryBase {
  type: "multi";
  /** Marks per attempt (letters to choose). */
  perAttempt: number;
  /** Each correct letter and how many students chose it. */
  found: AnswerTally[];
  /** Wrong letters chosen, most frequent first. */
  wrongPicks: AnswerTally[];
  /** distribution[k] = attempts that earned k of the group's marks. */
  distribution: number[];
  /** Attempts with no letter chosen. */
  blank: number;
}

export type StatEntry = QuestionStat | MultiStat;

export interface KindStat {
  kind: GroupKind;
  /** Question numbers of this type. */
  questions: number;
  marks: number;
  earned: number;
  pct: number;
}

export interface ClassStats {
  /** Attempts with at least one graded question. */
  attempts: number;
  /** Distinct question numbers. */
  questions: number;
  /** Paper order. */
  entries: StatEntry[];
  /** Question types in paper order. */
  byKind: KindStat[];
  /** The lowest-scoring entries below the threshold, hardest first. */
  hardest: StatEntry[];
  /** Mean marks per attempt, and mean questions per attempt (one decimal). */
  meanCorrect: number;
  meanTotal: number;
}

export interface StatsAttempt {
  items: GradeItem[];
}

export interface StatsOptions {
  /** Max entries in `hardest` (default 5). */
  hardestCount?: number;
  /** Only entries scoring below this share are "hardest" (default 0.6). */
  hardBelow?: number;
  /** Wrong answers kept per question (default 3). */
  wrongCount?: number;
}

const ratio = (e: { earned: number; marks: number }) => (e.marks > 0 ? e.earned / e.marks : 1);
const pctOf = (earned: number, marks: number) => (marks > 0 ? Math.round((earned / marks) * 100) : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;
const lower = (s: string) => s.trim().toLowerCase();
const signature = (it: GradeItem) => it.accepted.map(lower).sort().join("|");

function rangeLabel(numbers: number[]): string {
  const a = numbers[0];
  const b = numbers[numbers.length - 1];
  return a === b ? `Q${a}` : `Q${a}–${b}`;
}

/** Group questions the layout doesn't cover: singles, and runs of one mcq-multi group. */
function inferGroups(numbers: number[], seen: Map<number, GradeItem>): StatsGroup[] {
  const out: StatsGroup[] = [];
  let i = 0;
  while (i < numbers.length) {
    const n = numbers[i];
    const it = seen.get(n) as GradeItem;
    if (it.kind !== "mcq-multi") {
      out.push({ kind: it.kind, numbers: [n] });
      i += 1;
      continue;
    }
    // Consecutive numbers sharing the same key set belong together; two
    // adjacent groups with an identical key set are split by the group size.
    const sig = signature(it);
    const size = Math.max(1, it.accepted.length);
    const run = [n];
    let j = i + 1;
    while (j < numbers.length && numbers[j] === numbers[j - 1] + 1) {
      const next = seen.get(numbers[j]) as GradeItem;
      if (next.kind !== "mcq-multi" || signature(next) !== sig) break;
      run.push(numbers[j]);
      j += 1;
    }
    for (let k = 0; k < run.length; k += size) out.push({ kind: "mcq-multi", numbers: run.slice(k, k + size) });
    i = j;
  }
  return out;
}

function resolveGroups(seen: Map<number, GradeItem>, layout: StatsGroup[] | null): StatsGroup[] {
  const covered = new Set<number>();
  const out: StatsGroup[] = [];
  for (const g of layout ?? []) {
    const numbers = g.numbers.filter((n) => seen.has(n) && !covered.has(n));
    if (!numbers.length) continue;
    // The attempts were graded as another kind (content changed since): infer instead.
    if (numbers.some((n) => seen.get(n)?.kind !== g.kind)) continue;
    numbers.forEach((n) => covered.add(n));
    out.push({ ...g, numbers });
  }
  const rest = Array.from(seen.keys())
    .filter((n) => !covered.has(n))
    .sort((a, b) => a - b);
  out.push(...inferGroups(rest, seen));
  return out.sort((a, b) => a.numbers[0] - b.numbers[0]);
}

function mostCommonForm(forms: Map<string, number>): string {
  let best = "";
  let bestCount = -1;
  for (const [form, count] of forms) {
    if (count > bestCount) {
      best = form;
      bestCount = count;
    }
  }
  return best;
}

function answerKey(kind: GroupKind, given: string): string {
  if (kind === "gap") return normalizeAnswer(given) || lower(given);
  return lower(given);
}

function optionLabel(g: StatsGroup, n: number, answer: string): string | undefined {
  if (!answer) return undefined;
  const key = lower(answer);
  if (g.kind === "mcq") return g.questionOptions?.[n]?.[key];
  if (g.kind === "matching" || g.kind === "gap-box" || g.kind === "mcq-multi") return g.options?.[key];
  return undefined;
}

type AttemptMap = Map<number, GradeItem>;

function questionEntries(g: StatsGroup, maps: AttemptMap[], seen: Map<number, GradeItem>, wrongCount: number): QuestionStat[] {
  return g.numbers.map((n): QuestionStat => {
    let attempts = 0;
    let correct = 0;
    let blank = 0;
    let overLimit = 0;
    const wrong = new Map<string, { count: number; forms: Map<string, number> }>();
    for (const m of maps) {
      const it = m.get(n);
      if (!it) continue;
      attempts += 1;
      if (it.correct) {
        correct += 1;
        continue;
      }
      if (it.overLimit) overLimit += 1;
      const given = it.given.trim();
      if (!given) {
        blank += 1;
        continue;
      }
      const key = answerKey(it.kind, given);
      const w = wrong.get(key) ?? { count: 0, forms: new Map<string, number>() };
      w.count += 1;
      w.forms.set(given, (w.forms.get(given) ?? 0) + 1);
      wrong.set(key, w);
    }
    const ref = seen.get(n) as GradeItem;
    const wrongList = Array.from(wrong.values())
      .map((w): AnswerTally => {
        const answer = mostCommonForm(w.forms);
        const label = optionLabel(g, n, answer);
        return label ? { answer, count: w.count, label } : { answer, count: w.count };
      })
      .sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer))
      .slice(0, wrongCount);
    const expectedLabel = optionLabel(g, n, ref.expected);
    return {
      type: "question",
      id: `q${n}`,
      label: `Q${n}`,
      kind: ref.kind,
      first: n,
      numbers: [n],
      n,
      attempts,
      marks: attempts,
      earned: correct,
      pct: pctOf(correct, attempts),
      blank,
      overLimit,
      expected: ref.expected,
      ...(expectedLabel ? { expectedLabel } : {}),
      accepted: ref.accepted,
      wrong: wrongList,
      ...(g.prompts?.[n] ? { prompt: g.prompts[n] } : {}),
    };
  });
}

function multiEntry(g: StatsGroup, maps: AttemptMap[], seen: Map<number, GradeItem>): MultiStat {
  const perAttempt = g.numbers.length;
  const accepted = (seen.get(g.numbers[0]) as GradeItem).accepted;
  const acceptedKeys = new Set(accepted.map(lower));
  let attempts = 0;
  let earned = 0;
  let blank = 0;
  const distribution: number[] = Array.from({ length: perAttempt + 1 }, () => 0);
  const found = new Map<string, number>();
  const wrongPicks = new Map<string, { answer: string; count: number }>();

  for (const m of maps) {
    const its = g.numbers.map((n) => m.get(n)).filter((x): x is GradeItem => !!x);
    if (!its.length) continue;
    attempts += 1;
    const got = Math.min(perAttempt, its.filter((i) => i.correct).length);
    earned += got;
    distribution[got] += 1;
    // The union of the slots' answers is exactly the set of letters chosen.
    const picks = new Map<string, string>();
    for (const it of its) {
      const given = it.given.trim();
      if (given) picks.set(lower(given), given);
    }
    if (!picks.size) blank += 1;
    for (const [key, answer] of picks) {
      if (acceptedKeys.has(key)) found.set(key, (found.get(key) ?? 0) + 1);
      else {
        const w = wrongPicks.get(key) ?? { answer, count: 0 };
        w.count += 1;
        wrongPicks.set(key, w);
      }
    }
  }

  const withLabel = (answer: string, count: number): AnswerTally => {
    const label = optionLabel(g, g.numbers[0], answer);
    return label ? { answer, count, label } : { answer, count };
  };
  const marks = attempts * perAttempt;
  return {
    type: "multi",
    id: `m${g.numbers[0]}`,
    label: rangeLabel(g.numbers),
    kind: "mcq-multi",
    first: g.numbers[0],
    numbers: g.numbers,
    attempts,
    marks,
    earned,
    pct: pctOf(earned, marks),
    perAttempt,
    found: accepted.map((a) => withLabel(a, found.get(lower(a)) ?? 0)),
    wrongPicks: Array.from(wrongPicks.values())
      .sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer))
      .map((w) => withLabel(w.answer, w.count)),
    distribution,
    blank,
    ...(g.title ? { prompt: g.title.length > PROMPT_MAX ? `${g.title.slice(0, PROMPT_MAX - 1).trimEnd()}…` : g.title } : {}),
  };
}

/**
 * Aggregate the class's attempts. `layout` (from statsLayout) adds question
 * prompts, option texts and exact group boundaries; without it groups are
 * inferred from the items.
 */
export function aggregateClassStats(
  attempts: StatsAttempt[],
  layout?: StatsGroup[] | null,
  opts: StatsOptions = {}
): ClassStats {
  const hardestCount = opts.hardestCount ?? 5;
  const hardBelow = opts.hardBelow ?? 0.6;
  const wrongCount = opts.wrongCount ?? 3;

  const maps: AttemptMap[] = [];
  for (const a of attempts) {
    const m: AttemptMap = new Map();
    for (const it of a.items ?? []) if (Number.isFinite(it.n) && !m.has(it.n)) m.set(it.n, it);
    if (m.size) maps.push(m);
  }
  const seen = new Map<number, GradeItem>();
  for (const m of maps) for (const [n, it] of m) if (!seen.has(n)) seen.set(n, it);

  const groups = resolveGroups(seen, layout ?? null);
  const entries: StatEntry[] = groups.flatMap((g): StatEntry[] =>
    g.kind === "mcq-multi" ? [multiEntry(g, maps, seen)] : questionEntries(g, maps, seen, wrongCount)
  );

  const kinds = new Map<GroupKind, KindStat>();
  for (const e of entries) {
    const k = kinds.get(e.kind) ?? { kind: e.kind, questions: 0, marks: 0, earned: 0, pct: 0 };
    k.questions += e.numbers.length;
    k.marks += e.marks;
    k.earned += e.earned;
    kinds.set(e.kind, k);
  }
  const byKind = Array.from(kinds.values()).map((k) => ({ ...k, pct: pctOf(k.earned, k.marks) }));

  const hardest = entries
    .filter((e) => e.attempts > 0 && ratio(e) < hardBelow)
    .sort((a, b) => ratio(a) - ratio(b) || b.attempts - a.attempts || a.first - b.first)
    .slice(0, hardestCount);

  let correctSum = 0;
  let totalSum = 0;
  for (const m of maps) {
    totalSum += m.size;
    for (const it of m.values()) if (it.correct) correctSum += 1;
  }

  return {
    attempts: maps.length,
    questions: seen.size,
    entries,
    byKind,
    hardest,
    meanCorrect: maps.length ? round1(correctSum / maps.length) : 0,
    meanTotal: maps.length ? round1(totalSum / maps.length) : 0,
  };
}

/** Entries grouped by question type (types in paper order, entries in paper order). */
export function entriesByKind(stats: ClassStats): { kind: KindStat; entries: StatEntry[] }[] {
  return stats.byKind.map((kind) => ({ kind, entries: stats.entries.filter((e) => e.kind === kind.kind) }));
}
