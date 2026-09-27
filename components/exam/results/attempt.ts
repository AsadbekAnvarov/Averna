/**
 * Reading a saved exam-v2 Reading / Listening attempt back out of its
 * IELTSTest row (the shape written by submitObjectiveExam in
 * lib/ielts/submit.ts), plus the small formatting helpers the result pages
 * share. Pure and dependency-free — safe on the server and in the browser.
 */

import type { ExamAnswers, ExamSkill, GradeItem, GroupKind } from "@/lib/ielts/types";

export type ObjectiveSkill = Extract<ExamSkill, "READING" | "LISTENING">;
export type KindStats = Partial<Record<GroupKind, { correct: number; total: number }>>;

export interface ObjectiveAttempt {
  skill: ObjectiveSkill;
  /** Catalog id of the paper (getReadingExam / getListeningExam). */
  examId: string;
  /** Repeat-decay key: "<examId>" or "<examId>#p<n>". */
  contentKey: string;
  /** Practised part (0-based index into test.parts) or null for the whole paper. */
  part: number | null;
  title: string;
  answers: ExamAnswers;
  mock: boolean;
  mockAttemptId: string | null;
  /** Submitted by the runner when the clock ran out. */
  auto: boolean;
  band: number;
  correct: number;
  total: number;
  answered: number;
  percentage: number;
  byKind: KindStats;
  /** Graded questions in number order. */
  items: GradeItem[];
}

export const GROUP_KINDS: GroupKind[] = ["tfng", "ynng", "mcq", "mcq-multi", "matching", "gap", "gap-box"];
const KIND_SET = new Set<string>(GROUP_KINDS);

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const str = (x: unknown): string => (typeof x === "string" ? x : "");

/** True for any row saved in the exam-v2 format (Reading, Listening, Writing and Speaking all use it). */
export function isExamV2(answers: unknown): boolean {
  return asRec(answers)?.format === "exam-v2";
}

function parseItem(x: unknown): GradeItem | null {
  const o = asRec(x);
  if (!o) return null;
  const n = num(o.n);
  const kind = str(o.kind);
  if (n == null || !KIND_SET.has(kind) || typeof o.correct !== "boolean") return null;
  const expected = str(o.expected);
  const accepted = Array.isArray(o.accepted) ? o.accepted.filter((a): a is string => typeof a === "string") : [];
  const explanation = str(o.explanation).trim();
  return {
    n,
    kind: kind as GroupKind,
    correct: o.correct,
    given: str(o.given),
    expected,
    accepted: accepted.length ? accepted : expected ? [expected] : [],
    ...(explanation ? { explanation } : {}),
    ...(o.overLimit === true ? { overLimit: true } : {}),
  };
}

function parseAnswers(x: unknown): ExamAnswers {
  const out: ExamAnswers = {};
  for (const [k, v] of Object.entries(asRec(x) ?? {})) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((s): s is string => typeof s === "string");
  }
  return out;
}

function kindsFromItems(items: GradeItem[]): KindStats {
  const out: KindStats = {};
  for (const it of items) {
    const k = out[it.kind] ?? { correct: 0, total: 0 };
    k.total += 1;
    if (it.correct) k.correct += 1;
    out[it.kind] = k;
  }
  return out;
}

function parseKinds(x: unknown): KindStats | null {
  const o = asRec(x);
  if (!o) return null;
  const out: KindStats = {};
  for (const kind of GROUP_KINDS) {
    const s = asRec(o[kind]);
    const correct = num(s?.correct);
    const total = num(s?.total);
    if (correct != null && total != null && total > 0) out[kind] = { correct: Math.max(0, Math.min(correct, total)), total };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The attempt stored in an IELTSTest row, or null when the row isn't an
 * exam-v2 Reading / Listening attempt (legacy practice, Writing, Speaking …).
 */
export function parseObjectiveAttempt(row: {
  module: string;
  score: number;
  answers: unknown;
  aiAnalysis: unknown;
}): ObjectiveAttempt | null {
  if (row.module !== "READING" && row.module !== "LISTENING") return null;
  const a = asRec(row.answers);
  if (!a || a.format !== "exam-v2") return null;

  const contentKey = str(a.testId);
  const examId = str(a.examId) || contentKey.replace(/#p\d+$/, "");
  if (!examId) return null;

  const rawPart = num(a.part);
  const keyPart = /#p(\d+)$/.exec(contentKey);
  const part =
    rawPart != null && Number.isInteger(rawPart) && rawPart >= 0
      ? rawPart
      : keyPart
        ? Math.max(0, Number(keyPart[1]) - 1)
        : null;

  const ai = asRec(row.aiAnalysis) ?? {};
  const items = (Array.isArray(ai.items) ? ai.items : [])
    .map(parseItem)
    .filter((it): it is GradeItem => it !== null)
    .sort((x, y) => x.n - y.n);

  const total = num(ai.totalQuestions) ?? items.length;
  const correct = num(ai.correctCount) ?? items.filter((i) => i.correct).length;
  const answered = num(ai.answeredCount) ?? items.filter((i) => i.given.trim()).length;
  const band = Number.isFinite(row.score) ? row.score : num(ai.band) ?? 0;

  return {
    skill: row.module,
    examId,
    contentKey: contentKey || examId,
    part,
    title: str(a.title).trim(),
    answers: parseAnswers(a.answers),
    mock: a.mock === true,
    mockAttemptId: str(a.mockAttemptId) || null,
    auto: a.auto === true,
    band,
    correct,
    total,
    answered,
    percentage: num(ai.percentage) ?? (total > 0 ? Math.round((correct / total) * 1000) / 10 : 0),
    byKind: parseKinds(ai.byKind) ?? kindsFromItems(items),
    items,
  };
}

// ---------------------------------------------------------------------------
// Labels, links and formatting
// ---------------------------------------------------------------------------

export function skillWord(skill: ObjectiveSkill): "Reading" | "Listening" {
  return skill === "READING" ? "Reading" : "Listening";
}

/** "passage" / "part". */
export function partNoun(skill: ObjectiveSkill): string {
  return skill === "READING" ? "passage" : "part";
}

/** "Passage 2" / "Part 3" / "Full test". */
export function scopeLabel(skill: ObjectiveSkill, part: number | null): string {
  if (part == null) return "Full test";
  return `${skill === "READING" ? "Passage" : "Part"} ${part + 1}`;
}

export function libraryHref(skill: ObjectiveSkill): string {
  return skill === "READING" ? "/learning/reading" : "/learning/listening";
}

/** Practice URL without an attempt id — the practice page issues a fresh one (a new attempt). */
export function practiceHref(skill: ObjectiveSkill, examId: string, part?: number | null): string {
  const base = `${libraryHref(skill)}/${encodeURIComponent(examId)}`;
  return part == null ? base : `${base}?part=${part}`;
}

export function resultHref(skill: ObjectiveSkill, testRowId: string): string {
  return `${libraryHref(skill)}/result/${encodeURIComponent(testRowId)}`;
}

/** "54 min 10 s", "45 s", "1 h 5 min"; "—" when unknown. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (s === 0) return "—";
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return sec ? `${m} min ${sec} s` : `${m} min`;
}

/** Student.targetBand is free text ("7", "7.0", "6.5+") — a valid half band, or null. */
export function parseTargetBand(raw: unknown): number | null {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;
  return Math.round(n * 2) / 2;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
