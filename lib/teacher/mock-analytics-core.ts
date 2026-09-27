/**
 * Mock exam results by group — the numbers behind /teacher/mock, its CSV
 * export and the summary card on the group page.
 *
 * Pure and deterministic: no database and relative imports only, so the page
 * (through lib/teacher/mock-analytics.ts), the sortable table in the browser
 * and the offline check all run exactly this code.
 *
 * Which mocks count:
 *  - "Where the group is now" (the average overall, section averages, band
 *    distribution, Writing / Speaking criteria) uses each student's LATEST
 *    finished mock, so a student who sat five mocks counts once.
 *  - Question types pool each student's last 3 finished mocks of the last 180
 *    days: one 40-question paper holds only a handful of questions of a type,
 *    so a single mock per student is too thin to rank types.
 *  - The monthly trend averages, per Tashkent calendar month, each student's
 *    last mock of that month.
 *  - A section with nothing answered (time ran out while away) scores 0 in
 *    the overall band, exactly as the mock reports it, but is left out of the
 *    section and criteria averages — it says nothing about the skill.
 *  - Criteria prefer the teacher's review (TestReview.criteria) over the AI
 *    examiner, criterion by criterion; Writing weighs Task 2 twice, like the
 *    Writing band, and an unreviewed task left blank (under 20 words, scored
 *    0 on every criterion) is left out rather than averaged in.
 *  - "vs target" is the mean of each student's own gap (their band minus
 *    their Student.targetBand), over the students who have both. The group
 *    target shown next to it is the mean target of the students with a mock.
 */

import { overallBand } from "../ielts/bands";
import { KIND_LABEL } from "../ielts/format";
// Type-only: lib/ielts/mock.ts is server-only (Prisma). The client table imports this file,
// so it must never take a value import from there.
import type { MockSection } from "../ielts/mock";
import type { GroupKind } from "../ielts/types";

export const SECTIONS: readonly MockSection[] = ["LISTENING", "READING", "WRITING", "SPEAKING"];

export const SECTION_LABEL: Record<MockSection, string> = {
  LISTENING: "Listening",
  READING: "Reading",
  WRITING: "Writing",
  SPEAKING: "Speaking",
};

export type ObjectiveSkill = "READING" | "LISTENING";
const OBJECTIVE: readonly ObjectiveSkill[] = ["LISTENING", "READING"];

const DAY_MS = 86_400_000;
/** Asia/Tashkent is UTC+5 all year (no daylight saving). */
const TZ_OFFSET_MS = 5 * 3_600_000;

export const MOCK_RULES = {
  /** No finished mock for this long → "needs a mock". */
  recentDays: 30,
  /** An open sitting untouched this long is stalled (lib/ielts/mock.ts abandons it when a new one starts). */
  stallMs: 24 * 3_600_000,
  trendMonths: 12,
  kindWindowDays: 180,
  kindMocksPerStudent: 3,
  /** A question type needs this many questions in the pool before it can be called weak. */
  minKindQuestions: 8,
  /** Types at or above this accuracy (%) are never listed as weak. */
  weakBelowPct: 80,
  weakestCount: 3,
  /** Reading / Listening section rows read for question types (newest first). */
  maxObjectiveTests: 400,
  /** Latest mocks whose Writing / Speaking criteria are read (newest first). */
  maxCriteriaMocks: 250,
  /** An essay under this many words is assessed as blank (all criteria 0) — lib/ielts/submit.ts. */
  blankEssayWords: 20,
} as const;

const KINDS = Object.keys(KIND_LABEL) as GroupKind[];
const KIND_SET = new Set<string>(KINDS);

// ---------------------------------------------------------------------------
// Inputs (rows as the loader reads them)
// ---------------------------------------------------------------------------

export interface StudentInput {
  id: string;
  name: string;
  groupId: string | null;
  groupName: string | null;
  /** Student.targetBand as stored (free text: "7", "6.5", "8.5+"). */
  targetBand: string | null;
}

/** A finished or active MockAttempt, without its results. */
export interface AttemptInput {
  id: string;
  studentId: string;
  status: string;
  overall: number | null;
  current: number;
  startedAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
}

/** IELTSTest row of a mock Reading / Listening section. */
export interface ObjectiveTestInput {
  id: string;
  module: string;
  aiAnalysis: unknown;
}

/** IELTSTest row of a mock Writing task, with the teacher's review when there is one. */
export interface WritingTestInput {
  id: string;
  aiAnalysis: unknown;
  review: { criteria: unknown } | null;
}

/** TestReview of a mock Speaking section. */
export interface SpeakingReviewInput {
  testId: string;
  criteria: unknown;
}

export interface MockAnalyticsInput {
  students: StudentInput[];
  /** Finished and active attempts of those students. */
  attempts: AttemptInput[];
  /** Raw MockAttempt.results by attempt id — the attempts planDetail() lists. */
  results: Map<string, unknown>;
  objectiveTests?: ObjectiveTestInput[];
  writingTests?: WritingTestInput[];
  speakingReviews?: SpeakingReviewInput[];
  /**
   * Exact per-student totals of finished mocks (a groupBy), for when `attempts`
   * is capped and may miss a student's older mocks.
   */
  totals?: Map<string, StudentTotals>;
  /** Epoch ms. */
  now: number;
  flags?: { studentsCapped?: boolean; attemptsCapped?: boolean; partial?: boolean; resultsFailed?: boolean };
}

export interface StudentTotals {
  count: number;
  /** Highest overall band. */
  best: number | null;
}

// ---------------------------------------------------------------------------
// Small readers
// ---------------------------------------------------------------------------

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
/** A band 0–9, or null. */
const bandOf = (x: unknown): number | null => {
  const n = num(x);
  return n !== null && n >= 0 && n <= 9 ? n : null;
};
const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const byName = (a: { name: string; id?: string }, b: { name: string; id?: string }) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || ((a.id ?? "") < (b.id ?? "") ? -1 : (a.id ?? "") > (b.id ?? "") ? 1 : 0);

/** Student.targetBand is free text ("7", "7.0", "6.5+") — a half band 1–9, or null. */
export function parseTarget(raw: unknown): number | null {
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 1 || n > 9) return null;
  return Math.round(n * 2) / 2;
}

/** When the attempt finished (older rows without finishedAt fall back to their last update). */
function finishedTime(a: AttemptInput): number {
  return (a.finishedAt ?? a.updatedAt ?? a.startedAt).getTime();
}

interface ParsedSection {
  band: number | null;
  testIds: string[];
  /** Speaking: the transcript criteria stored with the result. */
  criteria: Partial<Record<"fluency" | "lexical" | "grammar", number>> | null;
}

/** One section of MockAttempt.results (see MockSectionResult in lib/ielts/mock.ts). */
function sectionOf(results: Record<string, unknown> | null | undefined, s: MockSection): ParsedSection | null {
  const r = asRec(results?.[s]);
  if (!r) return null;
  const testIds = Array.isArray(r.testIds)
    ? r.testIds.filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const c = asRec(r.criteria);
  let criteria: ParsedSection["criteria"] = null;
  if (c) {
    criteria = {};
    for (const k of ["fluency", "lexical", "grammar"] as const) {
      const v = bandOf(c[k]);
      if (v !== null) criteria[k] = v;
    }
  }
  return { band: bandOf(r.band), testIds, criteria };
}

/** Per-kind marks of a Reading / Listening attempt: aiAnalysis.byKind, else counted from its items. */
export function kindStatsOf(aiAnalysis: unknown): Map<GroupKind, { correct: number; total: number }> | null {
  const ai = asRec(aiAnalysis);
  if (!ai) return null;
  const out = new Map<GroupKind, { correct: number; total: number }>();
  const byKind = asRec(ai.byKind);
  if (byKind) {
    for (const kind of KINDS) {
      const s = asRec(byKind[kind]);
      const correct = num(s?.correct);
      const total = num(s?.total);
      if (correct !== null && total !== null && total > 0) {
        out.set(kind, { correct: Math.max(0, Math.min(Math.round(correct), Math.round(total))), total: Math.round(total) });
      }
    }
  }
  if (!out.size && Array.isArray(ai.items)) {
    for (const it of ai.items) {
      const o = asRec(it);
      const kind = typeof o?.kind === "string" ? o.kind : "";
      if (!o || !KIND_SET.has(kind) || typeof o.correct !== "boolean") continue;
      const k = out.get(kind as GroupKind) ?? { correct: 0, total: 0 };
      k.total += 1;
      if (o.correct) k.correct += 1;
      out.set(kind as GroupKind, k);
    }
  }
  return out.size ? out : null;
}

// ---------------------------------------------------------------------------
// What to load
// ---------------------------------------------------------------------------

export interface DetailPlan {
  /** Latest finished attempt of each student. */
  latest: Map<string, AttemptInput>;
  /** Finished attempts of each student, newest first. */
  finished: Map<string, AttemptInput[]>;
  /** Attempts pooled for question types (each student's last 3 in the window), newest first. */
  kindAttempts: AttemptInput[];
  /** Latest attempts whose criteria are read, newest first (capped). */
  criteriaAttempts: AttemptInput[];
  /** Every attempt whose results JSON is needed. */
  attemptIds: string[];
}

/** Newest first; the id breaks ties so the order never depends on the input order. */
const newestFirst = (a: AttemptInput, b: AttemptInput) =>
  finishedTime(b) - finishedTime(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function planDetail(attempts: AttemptInput[], now: number): DetailPlan {
  const finished = new Map<string, AttemptInput[]>();
  for (const a of attempts) {
    if (a.status !== "finished") continue;
    const list = finished.get(a.studentId) ?? [];
    list.push(a);
    finished.set(a.studentId, list);
  }
  const latest = new Map<string, AttemptInput>();
  const kindAttempts: AttemptInput[] = [];
  const since = now - MOCK_RULES.kindWindowDays * DAY_MS;
  for (const [studentId, list] of finished) {
    list.sort(newestFirst);
    latest.set(studentId, list[0]);
    kindAttempts.push(...list.filter((a) => finishedTime(a) >= since).slice(0, MOCK_RULES.kindMocksPerStudent));
  }
  kindAttempts.sort(newestFirst);
  const criteriaAttempts = Array.from(latest.values()).sort(newestFirst).slice(0, MOCK_RULES.maxCriteriaMocks);
  const ids = new Set<string>();
  for (const a of latest.values()) ids.add(a.id);
  for (const a of kindAttempts) ids.add(a.id);
  return { latest, finished, kindAttempts, criteriaAttempts, attemptIds: Array.from(ids) };
}

export interface TestPlan {
  objective: string[];
  writing: string[];
  speaking: string[];
  /** The question-type pool hit maxObjectiveTests. */
  objectiveCapped: boolean;
  /** More latest mocks than maxCriteriaMocks. */
  criteriaCapped: boolean;
}

function asResults(raw: unknown): Record<string, unknown> | null {
  return asRec(raw);
}

/** The IELTSTest / TestReview rows the aggregation needs, from the loaded results. */
export function planTests(plan: DetailPlan, results: Map<string, unknown>): TestPlan {
  const objective: string[] = [];
  let objectiveCapped = false;
  const seen = new Set<string>();
  for (const a of plan.kindAttempts) {
    const res = asResults(results.get(a.id));
    for (const skill of OBJECTIVE) {
      const id = sectionOf(res, skill)?.testIds[0];
      if (!id || seen.has(id)) continue;
      if (objective.length >= MOCK_RULES.maxObjectiveTests) {
        objectiveCapped = true;
        continue;
      }
      seen.add(id);
      objective.push(id);
    }
  }
  const writing: string[] = [];
  const speaking: string[] = [];
  for (const a of plan.criteriaAttempts) {
    const res = asResults(results.get(a.id));
    writing.push(...(sectionOf(res, "WRITING")?.testIds.slice(0, 2) ?? []));
    const s = sectionOf(res, "SPEAKING")?.testIds[0];
    if (s) speaking.push(s);
  }
  return { objective, writing, speaking, objectiveCapped, criteriaCapped: plan.latest.size > plan.criteriaAttempts.length };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface MockRef {
  attemptId: string;
  overall: number | null;
  /** ISO time the mock finished. */
  finishedAt: string;
}

export interface LatestMock extends MockRef {
  bands: Record<MockSection, number | null>;
  /** Nothing was answered in the section (scored 0). */
  blank: Record<MockSection, boolean>;
  /** IELTSTest id of each section's result page (Writing: Task 2). */
  tests: Record<MockSection, string | null>;
}

export interface ActiveMock {
  attemptId: string;
  /** The section in progress (null once past Speaking). */
  section: MockSection | null;
  sectionIndex: number;
  startedAt: string;
  updatedAt: string;
  /** Untouched for 24 h — the student will be given a new sitting when they return. */
  stalled: boolean;
}

export interface StudentMockRow {
  studentId: string;
  name: string;
  groupId: string | null;
  groupName: string | null;
  target: number | null;
  /** Finished mocks. */
  count: number;
  latest: LatestMock | null;
  /** Highest overall (the most recent on a tie); attemptId null when that mock wasn't loaded (capped). */
  best: { attemptId: string | null; overall: number } | null;
  /** Latest overall minus the previous finished mock's. */
  change: number | null;
  /** Latest overall minus the student's target band. */
  vsTarget: number | null;
  /** Whole days since the latest finished mock. */
  daysSince: number | null;
  active: ActiveMock | null;
}

export interface MockKpis {
  students: number;
  /** Students with at least one finished mock. */
  withMock: number;
  /** …of them, finished one in the last 30 days. */
  recent: number;
  /** Finished mocks in total. */
  finished: number;
  /** Open sittings that aren't stalled. */
  inProgress: number;
  /** Mean of each student's latest overall band (unrounded). */
  averageOverall: number | null;
  /**
   * The group's target: the mean target of the students with a mock and a
   * target (of every student with a target while nobody has a mock). Unrounded.
   */
  target: number | null;
  targetStudents: number;
  /** Mean of each student's latest overall minus their own target. */
  targetGap: number | null;
  /** Students with a mock and a target whose latest overall reaches it. */
  onTarget: number;
  withMockAndTarget: number;
  needsMock: number;
  /** …of whom have a sitting open right now. */
  needsMockInProgress: number;
}

export interface SectionAverage {
  section: MockSection;
  label: string;
  average: number | null;
  /** Latest mocks contributing (blank sections excluded). */
  students: number;
  blank: number;
  /** Mean of (section band − own target) over the contributing students who have a target. */
  vsTarget: number | null;
}

export interface DistributionBin {
  /** "≤4.0", "4.5" … "8.0+". */
  label: string;
  band: number;
  count: number;
  isTarget: boolean;
}

export interface TrendPoint {
  /** "2026-04" (Tashkent calendar month). */
  key: string;
  /** "Apr". */
  label: string;
  /** "April 2026". */
  long: string;
  year: number;
  /** Mean of each student's last overall of the month; null for a month without mocks. */
  average: number | null;
  students: number;
  mocks: number;
}

export interface TeachingTip {
  focus: string;
  tip: string;
}

export interface KindStat {
  skill: ObjectiveSkill;
  kind: GroupKind;
  label: string;
  correct: number;
  total: number;
  /** Whole percent. */
  pct: number;
  sections: number;
  students: number;
}

export interface WeakKind extends KindStat {
  tip: TeachingTip;
}

export interface KindBreakdown {
  /** Lowest accuracy first. */
  reading: KindStat[];
  listening: KindStat[];
  weakest: WeakKind[];
  sections: Record<ObjectiveSkill, number>;
  students: number;
  capped: boolean;
}

export interface CriterionAverage {
  key: string;
  label: string;
  average: number | null;
  students: number;
  note?: string;
}

export interface CriteriaBlock {
  criteria: CriterionAverage[];
  /** Latest mocks contributing. */
  sections: number;
  /** …of which a teacher reviewed (at least one task for Writing). */
  reviewed: number;
}

export interface NeedsMockRow {
  studentId: string;
  name: string;
  groupName: string | null;
  reason: "never" | "stale";
  lastFinishedAt: string | null;
  daysSince: number | null;
  active: ActiveMock | null;
}

export interface InProgressRow extends ActiveMock {
  studentId: string;
  name: string;
  groupName: string | null;
}

export interface MockAnalytics {
  generatedAt: string;
  kpis: MockKpis;
  sections: SectionAverage[];
  distribution: { bins: DistributionBin[]; total: number };
  trend: { points: TrendPoint[]; change: number | null };
  kinds: KindBreakdown;
  criteria: { writing: CriteriaBlock; speaking: CriteriaBlock; capped: boolean };
  students: StudentMockRow[];
  needsMock: NeedsMockRow[];
  inProgress: InProgressRow[];
  flags: { studentsCapped: boolean; attemptsCapped: boolean; partial: boolean; resultsFailed: boolean };
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

function activeOf(a: AttemptInput, now: number): ActiveMock {
  const idx = Math.max(0, Math.floor(a.current || 0));
  return {
    attemptId: a.id,
    section: SECTIONS[idx] ?? null,
    sectionIndex: idx,
    startedAt: a.startedAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    stalled: now - a.updatedAt.getTime() > MOCK_RULES.stallMs,
  };
}

/** The most recently touched open sitting of each student. */
function activeByStudent(attempts: AttemptInput[]): Map<string, AttemptInput> {
  const out = new Map<string, AttemptInput>();
  for (const a of attempts) {
    if (a.status !== "active") continue;
    const prev = out.get(a.studentId);
    if (!prev || a.updatedAt.getTime() > prev.updatedAt.getTime()) out.set(a.studentId, a);
  }
  return out;
}

function latestMock(a: AttemptInput, raw: unknown): LatestMock {
  const res = asResults(raw);
  const bands = {} as Record<MockSection, number | null>;
  const blank = {} as Record<MockSection, boolean>;
  const tests = {} as Record<MockSection, string | null>;
  for (const s of SECTIONS) {
    const sec = sectionOf(res, s);
    bands[s] = sec?.band ?? null;
    blank[s] = !!sec && sec.testIds.length === 0;
    tests[s] = sec ? (s === "WRITING" ? sec.testIds[1] ?? sec.testIds[0] ?? null : sec.testIds[0] ?? null) : null;
  }
  let overall = a.overall !== null ? bandOf(a.overall) : null;
  if (overall === null && res && SECTIONS.every((s) => bands[s] !== null)) {
    overall = overallBand(SECTIONS.map((s) => bands[s] as number));
  }
  return { attemptId: a.id, overall, finishedAt: new Date(finishedTime(a)).toISOString(), bands, blank, tests };
}

export function buildStudentRows(
  students: StudentInput[],
  attempts: AttemptInput[],
  results: Map<string, unknown>,
  now: number,
  plan: DetailPlan = planDetail(attempts, now),
  totals?: Map<string, StudentTotals>
): StudentMockRow[] {
  const open = activeByStudent(attempts);
  return students.map((st) => {
    const list = plan.finished.get(st.id) ?? [];
    const last = plan.latest.get(st.id) ?? null;
    const latest = last ? latestMock(last, results.get(last.id)) : null;
    let bestAttempt: AttemptInput | null = null;
    for (const a of list) {
      const o = bandOf(a.overall);
      if (o === null) continue;
      const b = bestAttempt ? bandOf(bestAttempt.overall) ?? -1 : -1;
      if (!bestAttempt || o > b || (o === b && finishedTime(a) > finishedTime(bestAttempt))) bestAttempt = a;
    }
    const loadedBest = bestAttempt ? bandOf(bestAttempt.overall) : null;
    const total = totals?.get(st.id);
    const exactBest = total ? bandOf(total.best) : null;
    // A better mock outside the loaded rows (capped): its band is known exactly, its id isn't.
    const best =
      exactBest !== null && (loadedBest === null || exactBest > loadedBest)
        ? { attemptId: null, overall: exactBest }
        : bestAttempt && loadedBest !== null
          ? { attemptId: bestAttempt.id, overall: loadedBest }
          : null;
    const target = parseTarget(st.targetBand);
    const prev = list[1] ? bandOf(list[1].overall) : null;
    const act = open.get(st.id);
    return {
      studentId: st.id,
      name: st.name,
      groupId: st.groupId,
      groupName: st.groupName,
      target,
      count: Math.max(list.length, total?.count ?? 0),
      latest,
      best,
      change: latest?.overall != null && prev !== null ? latest.overall - prev : null,
      vsTarget: latest?.overall != null && target !== null ? latest.overall - target : null,
      daysSince: last ? Math.max(0, Math.floor((now - finishedTime(last)) / DAY_MS)) : null,
      active: act ? activeOf(act, now) : null,
    };
  });
}

/** Mean of the students' targets, unrounded (null when nobody set one). */
export function groupTarget(students: { targetBand: string | null }[]): { target: number | null; students: number } {
  const targets = students.map((s) => parseTarget(s.targetBand)).filter((t): t is number => t !== null);
  return { target: mean(targets), students: targets.length };
}

/** The target the averages are compared with: that of the students who have a mock (see MockKpis.target). */
function comparableTarget(rows: StudentMockRow[]): { target: number | null; students: number } {
  const withMock = rows.filter((r) => r.latest && r.target !== null).map((r) => r.target as number);
  const pool = withMock.length ? withMock : rows.filter((r) => r.target !== null).map((r) => r.target as number);
  return { target: mean(pool), students: pool.length };
}

// ---------------------------------------------------------------------------
// Snapshot: sections, distribution
// ---------------------------------------------------------------------------

function sectionAverages(rows: StudentMockRow[]): SectionAverage[] {
  return SECTIONS.map((s) => {
    const values: number[] = [];
    const gaps: number[] = [];
    let blank = 0;
    for (const r of rows) {
      if (!r.latest) continue;
      if (r.latest.blank[s]) {
        blank += 1;
        continue;
      }
      const b = r.latest.bands[s];
      if (b === null) continue;
      values.push(b);
      if (r.target !== null) gaps.push(b - r.target);
    }
    return {
      section: s,
      label: SECTION_LABEL[s],
      average: mean(values),
      students: values.length,
      blank,
      vsTarget: mean(gaps),
    };
  });
}

const BIN_BANDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];

function binIndex(band: number): number {
  const h = Math.round(band * 2) / 2;
  if (h <= 4) return 0;
  if (h >= 8) return BIN_BANDS.length - 1;
  return Math.round((h - 4) * 2);
}

export function bandDistribution(overalls: number[], target: number | null): { bins: DistributionBin[]; total: number } {
  const counts = BIN_BANDS.map(() => 0);
  for (const o of overalls) counts[binIndex(o)] += 1;
  const t = target === null ? -1 : binIndex(target);
  return {
    bins: BIN_BANDS.map((band, i) => ({
      label: i === 0 ? "≤4.0" : i === BIN_BANDS.length - 1 ? "8.0+" : band.toFixed(1),
      band,
      count: counts[i],
      isTarget: i === t,
    })),
    total: overalls.length,
  };
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthOf(t: number): { y: number; m: number } {
  const d = new Date(t + TZ_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}
const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

/** "YYYY-MM-DD" of an ISO time in Tashkent. */
export function tashkentDateKey(iso: string): string {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10) : "";
}

export function monthlyTrend(attempts: AttemptInput[], now: number): { points: TrendPoint[]; change: number | null } {
  const { y, m } = monthOf(now);
  const months: { key: string; y: number; m: number }[] = [];
  for (let i = MOCK_RULES.trendMonths - 1; i >= 0; i--) {
    const total = y * 12 + m - i;
    const yy = Math.floor(total / 12);
    const mm = total - yy * 12;
    months.push({ key: monthKey(yy, mm), y: yy, m: mm });
  }
  const wanted = new Set(months.map((x) => x.key));
  const perMonth = new Map<string, Map<string, { t: number; overall: number }>>();
  const mocks = new Map<string, number>();
  for (const a of attempts) {
    if (a.status !== "finished") continue;
    const overall = bandOf(a.overall);
    if (overall === null) continue;
    const t = finishedTime(a);
    const p = monthOf(t);
    const key = monthKey(p.y, p.m);
    if (!wanted.has(key)) continue;
    mocks.set(key, (mocks.get(key) ?? 0) + 1);
    const students = perMonth.get(key) ?? new Map<string, { t: number; overall: number }>();
    const prev = students.get(a.studentId);
    if (!prev || t > prev.t) students.set(a.studentId, { t, overall });
    perMonth.set(key, students);
  }
  const first = months.findIndex((x) => perMonth.has(x.key));
  if (first < 0) return { points: [], change: null };
  const points = months.slice(first).map((x): TrendPoint => {
    const values = Array.from(perMonth.get(x.key)?.values() ?? []).map((v) => v.overall);
    return {
      key: x.key,
      label: MONTH_SHORT[x.m],
      long: `${MONTH_LONG[x.m]} ${x.y}`,
      year: x.y,
      average: mean(values),
      students: values.length,
      mocks: mocks.get(x.key) ?? 0,
    };
  });
  const withData = points.filter((p) => p.average !== null);
  const change =
    withData.length >= 2 ? (withData[withData.length - 1].average as number) - (withData[0].average as number) : null;
  return { points, change };
}

// ---------------------------------------------------------------------------
// Question types
// ---------------------------------------------------------------------------

const TIPS: Record<ObjectiveSkill, Record<GroupKind, TeachingTip>> = {
  READING: {
    tfng: {
      focus: "FALSE vs NOT GIVEN",
      tip: "Give statement pairs on one paragraph: students underline the exact line, then justify FALSE (contradicted) or NOT GIVEN (never said) aloud.",
    },
    ynng: {
      focus: "The writer's view, not the facts",
      tip: "Have students highlight stance words (should, clearly, it is doubtful) in an opinion text, then defend NO vs NOT GIVEN in pairs.",
    },
    mcq: {
      focus: "Locate first, then eliminate",
      tip: "Model finding the lines before reading the options; cross out options that are true but off-question or copy the passage word for word.",
    },
    "mcq-multi": {
      focus: "Check every option on its own",
      tip: "Turn each option into a TRUE / FALSE check against the text, and insist on exactly the number of letters asked.",
    },
    matching: {
      focus: "Main idea over keywords",
      tip: "For headings, drill first-and-last-sentence skimming; for information matching, make students confirm the meaning, not just a shared word.",
    },
    gap: {
      focus: "Exact words within the limit",
      tip: "Run quick copy-exact drills: every answer comes from the passage, fits the grammar of the gap and stays within the word limit.",
    },
    "gap-box": {
      focus: "Predict, then match the paraphrase",
      tip: "Before showing the box, students predict each gap's word class and meaning, then match by paraphrase rather than the passage's own word.",
    },
  },
  LISTENING: {
    tfng: {
      focus: "Wait for the final position",
      tip: "Play clips where speakers change their minds; students note the final view before they choose.",
    },
    ynng: {
      focus: "Opinion signals",
      tip: "Pause after phrases like “I'm not convinced” or “I'd agree” and ask: is that a view or a fact?",
    },
    mcq: {
      focus: "Wait for the decision",
      tip: "Use the preview time to underline how the options differ; replay the distractor moments after but, actually and in the end.",
    },
    "mcq-multi": {
      focus: "Tick and cross as you listen",
      tip: "Students mark each option accepted or rejected while the speakers discuss it, then choose exactly the number of letters asked.",
    },
    matching: {
      focus: "Follow the order of the items",
      tip: "Practise hearing synonyms of the options, and moving straight on after a missed item — the recording follows the question order.",
    },
    gap: {
      focus: "Spelling, numbers and plurals",
      tip: "Short dictations of names, numbers, dates and plurals; before each part, students predict the answer type of every gap.",
    },
    "gap-box": {
      focus: "Meaning, not sound",
      tip: "Pre-teach likely paraphrases of the box options; students cross off each option once it has been used.",
    },
  },
};

export function teachingTip(skill: ObjectiveSkill, kind: GroupKind): TeachingTip {
  return TIPS[skill][kind];
}

function kindBreakdown(
  plan: DetailPlan,
  results: Map<string, unknown>,
  tests: ObjectiveTestInput[],
  capped: boolean
): KindBreakdown {
  const rows = new Map(tests.map((t) => [t.id, t]));
  type Acc = { correct: number; total: number; sections: number; students: Set<string> };
  const acc: Record<ObjectiveSkill, Map<GroupKind, Acc>> = { READING: new Map(), LISTENING: new Map() };
  const sections: Record<ObjectiveSkill, number> = { READING: 0, LISTENING: 0 };
  const students = new Set<string>();
  const seen = new Set<string>();
  for (const a of plan.kindAttempts) {
    const res = asResults(results.get(a.id));
    for (const skill of OBJECTIVE) {
      const id = sectionOf(res, skill)?.testIds[0];
      if (!id || seen.has(id)) continue;
      const row = rows.get(id);
      if (!row || (row.module && row.module !== skill)) continue;
      const kinds = kindStatsOf(row.aiAnalysis);
      if (!kinds) continue;
      seen.add(id);
      sections[skill] += 1;
      students.add(a.studentId);
      for (const [kind, k] of kinds) {
        const x = acc[skill].get(kind) ?? { correct: 0, total: 0, sections: 0, students: new Set<string>() };
        x.correct += k.correct;
        x.total += k.total;
        x.sections += 1;
        x.students.add(a.studentId);
        acc[skill].set(kind, x);
      }
    }
  }
  const list = (skill: ObjectiveSkill): KindStat[] =>
    Array.from(acc[skill].entries())
      .map(([kind, x]) => ({
        skill,
        kind,
        label: KIND_LABEL[kind],
        correct: x.correct,
        total: x.total,
        pct: Math.round((x.correct / x.total) * 100),
        sections: x.sections,
        students: x.students.size,
      }))
      .sort((p, q) => p.correct / p.total - q.correct / q.total || q.total - p.total || KINDS.indexOf(p.kind) - KINDS.indexOf(q.kind));
  const reading = list("READING");
  const listening = list("LISTENING");
  const weakest = [...reading, ...listening]
    .filter((k) => k.total >= MOCK_RULES.minKindQuestions && (k.correct / k.total) * 100 < MOCK_RULES.weakBelowPct)
    .sort((p, q) => p.correct / p.total - q.correct / q.total || q.total - p.total || (p.skill < q.skill ? -1 : p.skill > q.skill ? 1 : 0))
    .slice(0, MOCK_RULES.weakestCount)
    .map((k) => ({ ...k, tip: teachingTip(k.skill, k.kind) }));
  return { reading, listening, weakest, sections, students: students.size, capped };
}

// ---------------------------------------------------------------------------
// Writing / Speaking criteria
// ---------------------------------------------------------------------------

const WRITING_CRITERIA = [
  { key: "taskAchievement", label: "Task Achievement / Response" },
  { key: "coherenceCohesion", label: "Coherence & Cohesion" },
  { key: "lexicalResource", label: "Lexical Resource" },
  { key: "grammarAccuracy", label: "Grammatical Range & Accuracy" },
] as const;

const SPEAKING_CRITERIA = [
  { key: "fluency", label: "Fluency & Coherence" },
  { key: "lexical", label: "Lexical Resource" },
  { key: "grammar", label: "Grammatical Range & Accuracy" },
  { key: "pronunciation", label: "Pronunciation" },
] as const;

type WritingKey = (typeof WRITING_CRITERIA)[number]["key"];
type SpeakingKey = (typeof SPEAKING_CRITERIA)[number]["key"];

/** One task's criteria: the review's band where the teacher gave one, else the AI examiner's. */
function writingTaskCriteria(t: WritingTestInput | undefined): Partial<Record<WritingKey, number>> | null {
  if (!t) return null;
  const review = asRec(t.review?.criteria);
  const ai = asRec(t.aiAnalysis);
  if (!t.review) {
    // A task left blank is assessed 0 on every criterion — it says nothing about the skill.
    const words = num(ai?.wordCount);
    const zeros = WRITING_CRITERIA.every(({ key }) => num(ai?.[key]) === 0);
    if ((words !== null && words < MOCK_RULES.blankEssayWords) || zeros) return null;
  }
  const out: Partial<Record<WritingKey, number>> = {};
  for (const { key } of WRITING_CRITERIA) {
    const v = bandOf(review?.[key]) ?? bandOf(ai?.[key]);
    if (v !== null) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Task 2 counts twice, as in the Writing band; a missing task leaves the other one. */
function weighted(t1: number | undefined, t2: number | undefined): number | null {
  if (t1 !== undefined && t2 !== undefined) return (t1 + 2 * t2) / 3;
  return t2 ?? t1 ?? null;
}

function average(values: Map<string, number[]>, key: string): { average: number | null; students: number } {
  const v = values.get(key) ?? [];
  return { average: mean(v), students: v.length };
}

function criteriaAverages(
  plan: DetailPlan,
  results: Map<string, unknown>,
  writingTests: WritingTestInput[],
  speakingReviews: SpeakingReviewInput[]
): { writing: CriteriaBlock; speaking: CriteriaBlock; capped: boolean } {
  const wRows = new Map(writingTests.map((t) => [t.id, t]));
  const sReviews = new Map(speakingReviews.map((r) => [r.testId, r]));
  const w = new Map<string, number[]>();
  const s = new Map<string, number[]>();
  const push = (m: Map<string, number[]>, k: string, v: number) => m.set(k, [...(m.get(k) ?? []), v]);
  const counts = { wSections: 0, wReviewed: 0, sSections: 0, sReviewed: 0 };

  for (const a of plan.criteriaAttempts) {
    const res = asResults(results.get(a.id));

    const wSec = sectionOf(res, "WRITING");
    if (wSec && wSec.testIds.length) {
      const [id1, id2] = wSec.testIds;
      const t1 = wRows.get(id1);
      const t2 = id2 ? wRows.get(id2) : undefined;
      const c1 = writingTaskCriteria(t1);
      const c2 = writingTaskCriteria(t2);
      let any = false;
      for (const { key } of WRITING_CRITERIA) {
        const v = weighted(c1?.[key], c2?.[key]);
        if (v === null) continue;
        push(w, key, v);
        any = true;
      }
      if (any) {
        counts.wSections += 1;
        if ((t1 && t1.review) || (t2 && t2.review)) counts.wReviewed += 1;
      }
    }

    const sSec = sectionOf(res, "SPEAKING");
    if (sSec && sSec.testIds.length) {
      const review = sReviews.get(sSec.testIds[0]);
      const rc = asRec(review?.criteria);
      let any = false;
      for (const { key } of SPEAKING_CRITERIA) {
        const fromReview = bandOf(rc?.[key]);
        const v = key === "pronunciation" ? fromReview : fromReview ?? sSec.criteria?.[key] ?? null;
        if (v === null) continue;
        push(s, key, v);
        any = true;
      }
      if (any) {
        counts.sSections += 1;
        if (review) counts.sReviewed += 1;
      }
    }
  }

  return {
    writing: {
      criteria: WRITING_CRITERIA.map((c) => ({ key: c.key, label: c.label, ...average(w, c.key) })),
      sections: counts.wSections,
      reviewed: counts.wReviewed,
    },
    speaking: {
      criteria: SPEAKING_CRITERIA.map((c) => ({
        key: c.key,
        label: c.label,
        ...average(s, c.key),
        ...(c.key === "pronunciation" ? { note: "Rated by teachers only — transcripts can't show it" } : {}),
      })),
      sections: counts.sSections,
      reviewed: counts.sReviewed,
    },
    capped: plan.latest.size > plan.criteriaAttempts.length,
  };
}

// ---------------------------------------------------------------------------
// Who needs a mock
// ---------------------------------------------------------------------------

/** Finished a mock within the last 30 × 24 h. */
function isRecent(r: StudentMockRow, now: number): boolean {
  return !!r.latest && now - new Date(r.latest.finishedAt).getTime() <= MOCK_RULES.recentDays * DAY_MS;
}

/**
 * No finished mock in the last 30 days, or never. Students with nothing open
 * come first (never before the longest gap); those already sitting one last.
 */
function needsMock(rows: StudentMockRow[], now: number): NeedsMockRow[] {
  const out: NeedsMockRow[] = rows
    .filter((r) => !isRecent(r, now))
    .map((r) => ({
      studentId: r.studentId,
      name: r.name,
      groupName: r.groupName,
      reason: r.latest ? ("stale" as const) : ("never" as const),
      lastFinishedAt: r.latest?.finishedAt ?? null,
      daysSince: r.daysSince,
      active: r.active,
    }));
  const working = (n: NeedsMockRow) => (n.active && !n.active.stalled ? 1 : 0);
  return out.sort(
    (a, b) =>
      working(a) - working(b) ||
      (a.reason === b.reason ? 0 : a.reason === "never" ? -1 : 1) ||
      (b.daysSince ?? 0) - (a.daysSince ?? 0) ||
      byName({ name: a.name, id: a.studentId }, { name: b.name, id: b.studentId })
  );
}

function inProgress(rows: StudentMockRow[]): InProgressRow[] {
  return rows
    .filter((r): r is StudentMockRow & { active: ActiveMock } => r.active !== null)
    .map((r) => ({ ...r.active, studentId: r.studentId, name: r.name, groupName: r.groupName }))
    .sort(
      (a, b) =>
        Number(a.stalled) - Number(b.stalled) ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        byName({ name: a.name, id: a.studentId }, { name: b.name, id: b.studentId })
    );
}

// ---------------------------------------------------------------------------
// Everything
// ---------------------------------------------------------------------------

export function buildMockAnalytics(input: MockAnalyticsInput): MockAnalytics {
  const { students, attempts, results, now } = input;
  const ids = new Set(students.map((s) => s.id));
  const mine = attempts.filter((a) => ids.has(a.studentId));
  const plan = planDetail(mine, now);
  const tests = planTests(plan, results);
  const rows = buildStudentRows(students, mine, results, now, plan, input.totals);
  const { target, students: targetStudents } = comparableTarget(rows);

  const latestOveralls = rows.map((r) => r.latest?.overall).filter((o): o is number => typeof o === "number");
  const withTarget = rows.filter((r) => r.vsTarget !== null);
  const needs = needsMock(rows, now);
  const open = inProgress(rows);

  const kpis: MockKpis = {
    students: rows.length,
    withMock: rows.filter((r) => r.latest).length,
    recent: rows.filter((r) => isRecent(r, now)).length,
    finished: rows.reduce((n, r) => n + r.count, 0),
    inProgress: open.filter((o) => !o.stalled).length,
    averageOverall: mean(latestOveralls),
    target,
    targetStudents,
    targetGap: mean(withTarget.map((r) => r.vsTarget as number)),
    onTarget: withTarget.filter((r) => (r.vsTarget as number) >= 0).length,
    withMockAndTarget: withTarget.length,
    needsMock: needs.length,
    needsMockInProgress: needs.filter((n) => n.active && !n.active.stalled).length,
  };

  return {
    generatedAt: new Date(now).toISOString(),
    kpis,
    sections: sectionAverages(rows),
    distribution: bandDistribution(latestOveralls, target),
    trend: monthlyTrend(mine, now),
    kinds: kindBreakdown(plan, results, input.objectiveTests ?? [], tests.objectiveCapped),
    criteria: criteriaAverages(plan, results, input.writingTests ?? [], input.speakingReviews ?? []),
    students: sortStudentRows(rows, DEFAULT_SORT.key, DEFAULT_SORT.dir),
    needsMock: needs,
    inProgress: open,
    flags: {
      studentsCapped: !!input.flags?.studentsCapped,
      attemptsCapped: !!input.flags?.attemptsCapped,
      partial: !!input.flags?.partial,
      resultsFailed: !!input.flags?.resultsFailed,
    },
  };
}

// ---------------------------------------------------------------------------
// Group page card
// ---------------------------------------------------------------------------

export interface GroupMockSummary {
  students: number;
  withMock: number;
  averageOverall: number | null;
  /** ISO time of the group's most recent finished mock. */
  latestAt: string | null;
  needsMock: number;
  inProgress: number;
}

/** The summary card from the light attempt rows only (no results needed). */
export function summarizeGroup(studentIds: string[], attempts: AttemptInput[], now: number): GroupMockSummary {
  const students: StudentInput[] = studentIds.map((id) => ({ id, name: id, groupId: null, groupName: null, targetBand: null }));
  const ids = new Set(studentIds);
  const mine = attempts.filter((a) => ids.has(a.studentId));
  const rows = buildStudentRows(students, mine, new Map(), now);
  const overalls = rows.map((r) => r.latest?.overall).filter((o): o is number => typeof o === "number");
  const latest = rows.reduce<string | null>((acc, r) => (r.latest && (!acc || r.latest.finishedAt > acc) ? r.latest.finishedAt : acc), null);
  return {
    students: rows.length,
    withMock: rows.filter((r) => r.latest).length,
    averageOverall: mean(overalls),
    latestAt: latest,
    needsMock: needsMock(rows, now).length,
    inProgress: rows.filter((r) => r.active && !r.active.stalled).length,
  };
}

// ---------------------------------------------------------------------------
// Sorting (the student table)
// ---------------------------------------------------------------------------

export type StudentSortKey = "name" | "group" | "date" | "overall" | MockSection | "best" | "vsTarget" | "count";
export type SortDir = "asc" | "desc";

export const DEFAULT_SORT: { key: StudentSortKey; dir: SortDir } = { key: "overall", dir: "desc" };

/** The direction a column sorts in when first chosen: text A→Z, numbers and dates highest / newest first. */
export function defaultDir(key: StudentSortKey): SortDir {
  return key === "name" || key === "group" ? "asc" : "desc";
}

function sortValue(r: StudentMockRow, key: StudentSortKey): string | number | null {
  switch (key) {
    case "name":
      return r.name;
    case "group":
      return r.groupName;
    case "date":
      return r.latest ? new Date(r.latest.finishedAt).getTime() : null;
    case "overall":
      return r.latest?.overall ?? null;
    case "best":
      return r.best?.overall ?? null;
    case "vsTarget":
      return r.vsTarget;
    case "count":
      return r.count;
    default:
      return r.latest?.bands[key] ?? null;
  }
}

/** A sorted copy. Empty values always sink to the bottom; ties fall back to the name. */
export function sortStudentRows(rows: StudentMockRow[], key: StudentSortKey, dir: SortDir): StudentMockRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else if (typeof va === "string" && typeof vb === "string") {
      const c = va.localeCompare(vb, "en", { sensitivity: "base" });
      if (c) return sign * c;
    } else if (va !== vb) {
      return sign * ((va as number) - (vb as number));
    }
    return byName({ name: a.name, id: a.studentId }, { name: b.name, id: b.studentId });
  });
}

// ---------------------------------------------------------------------------
// Formatting + links (shared by the page, the table and the CSV)
// ---------------------------------------------------------------------------

/** "6.5" / "—". */
export function formatBand(x: number | null | undefined): string {
  return typeof x === "number" && Number.isFinite(x) ? x.toFixed(1) : "—";
}

/** "+0.5" / "−0.3" / "±0.0" (null when unknown). */
export function formatDelta(x: number | null | undefined): string | null {
  if (typeof x !== "number" || !Number.isFinite(x)) return null;
  // Round the magnitude so −0.25 and +0.25 both move away from zero (Math.round(−2.5) is −2).
  const r = Math.round(Math.abs(x) * 10 + 1e-9) / 10;
  if (r === 0) return "±0.0";
  return `${x > 0 ? "+" : "−"}${r.toFixed(1)}`;
}

export function mockResultHref(attemptId: string): string {
  return `/learning/mock-exam/result/${encodeURIComponent(attemptId)}`;
}

const SECTION_RESULT: Record<MockSection, string> = {
  LISTENING: "/learning/listening/result/",
  READING: "/learning/reading/result/",
  WRITING: "/learning/writing/result/",
  SPEAKING: "/learning/speaking-test/result/",
};

/** The section's own result page (these allow the student's teacher). */
export function sectionResultHref(section: MockSection, testId: string): string {
  return SECTION_RESULT[section] + encodeURIComponent(testId);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export const CSV_HEADER = ["Student", "Group", "Date", "Overall", "Listening", "Reading", "Writing", "Speaking", "Mocks"];

/**
 * One RFC 4180 cell. Text that a spreadsheet would run as a formula (a
 * student can name themselves "=HYPERLINK(…)") is prefixed with an apostrophe.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "number") {
    s = Number.isFinite(v) ? String(v) : "";
  } else {
    s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  }
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** "mock-results-ielts-7-evening-2026-09-27.csv" — ASCII only, safe in a Content-Disposition header. */
export function exportFileName(groupName: string | null, now: number): string {
  const slug =
    (groupName ?? "all-groups")
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "group";
  return `mock-results-${slug}-${tashkentDateKey(new Date(now).toISOString())}.csv`;
}

const csvBand = (x: number | null | undefined) => (typeof x === "number" && Number.isFinite(x) ? x.toFixed(1) : "");

/** One row per student (their latest finished mock), by group then name. */
export function mockCsv(rows: StudentMockRow[]): string {
  const sorted = [...rows].sort(
    (a, b) =>
      (a.groupName ?? "").localeCompare(b.groupName ?? "", "en", { sensitivity: "base" }) ||
      byName({ name: a.name, id: a.studentId }, { name: b.name, id: b.studentId })
  );
  return toCsv([
    CSV_HEADER,
    ...sorted.map((r) => [
      r.name,
      r.groupName ?? "",
      r.latest ? tashkentDateKey(r.latest.finishedAt) : "",
      csvBand(r.latest?.overall),
      ...SECTIONS.map((s) => csvBand(r.latest?.bands[s])),
      r.count,
    ]),
  ]);
}
