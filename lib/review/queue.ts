/**
 * Teacher review queue — the Writing and Speaking attempts of the students a
 * viewer may review (lib/access: a teacher's groups, everyone for admins).
 *
 *   pending  = no TestReview yet, completed in the chosen window (30 days by
 *              default) and with something to review: an essay of 20+ words
 *              or any transcribed speech (aiAnalysis.wordCount, written by
 *              every Writing / Speaking submit path);
 *   reviewed = has a TestReview.
 *
 * Source of an attempt: homework (a HomeworkSubmission points at it — for a
 * full Writing test the submission points at Task 2, so Task 1 of that sitting
 * is homework too), mock (answers.mock) or practice. Pending work is ordered
 * homework and mock first, then oldest first; reviewed work newest review
 * first. 50 per page.
 *
 * The list is built in two steps: a light query of every candidate (ids and
 * dates only — sources, sorting and counts are resolved from it), then the full
 * rows of the visible page only.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { teacherOf, visibleStudentIds, type Viewer } from "@/lib/access";
import {
  aiBandOf,
  attemptLabel,
  MIN_REVIEW_ESSAY_WORDS,
  MIN_TASK_WORDS,
  type ReviewSkill,
} from "./scoring";
import {
  DEFAULT_FILTERS,
  REVIEW_PAGE_SIZE,
  type QueueFilters,
  type ReviewSource,
  type ReviewTab,
} from "./filters";
import {
  answersOf,
  asRec,
  attemptTitle,
  countWords,
  examAttemptIdOf,
  isFullSpeakingTest,
  num,
  recordingKeyOf,
  str,
  taskTypeOf,
} from "./answers";

const DAY_MS = 86_400_000;
/** Attempts considered per tab. The date window keeps real queues far below this. */
const MAX_CANDIDATES = 3000;

type Where = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

export interface ReviewContext {
  /** "all" for admins, the students of the teacher's groups otherwise. */
  studentIds: "all" | string[];
  /** Groups for the filter: the teacher's own, or every group for an admin. */
  groups: { id: string; name: string }[];
  /** The viewer's Teacher row (null for an admin without one). */
  teacherId: string | null;
}

/** Whose work this viewer may review; null for anyone who isn't a teacher or an admin. */
export async function reviewContext(viewer: Viewer): Promise<ReviewContext | null> {
  if (viewer.role !== "ADMIN" && viewer.role !== "TEACHER") return null;
  const teacher = await teacherOf(viewer.id);
  const groupsQuery: Promise<{ id: string; name: string }[]> =
    viewer.role === "ADMIN"
      ? db.group.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : teacher
        ? db.group.findMany({ where: { teacherId: teacher.id }, select: { id: true, name: true }, orderBy: { name: "asc" } })
        : Promise.resolve([]);
  const [studentIds, groups] = await Promise.all([
    visibleStudentIds(viewer),
    groupsQuery.catch((e: unknown) => {
      console.error("Review queue: groups failed:", e);
      return [] as { id: string; name: string }[];
    }),
  ]);
  return { studentIds, groups, teacherId: teacher?.id ?? null };
}

/** The filters with a group the viewer doesn't have dropped. */
function scoped(ctx: ReviewContext, f: QueueFilters): QueueFilters {
  return { ...f, group: f.group && ctx.groups.some((g) => g.id === f.group) ? f.group : null };
}

const nobody = (ctx: ReviewContext) => ctx.studentIds !== "all" && ctx.studentIds.length === 0;

function scopeWhere(ctx: ReviewContext, f: Pick<QueueFilters, "group" | "skill" | "days">): Where[] {
  const and: Where[] = [];
  if (ctx.studentIds !== "all") and.push({ studentId: { in: ctx.studentIds } });
  if (f.group) and.push({ student: { groupId: f.group } });
  and.push({ module: f.skill ?? { in: ["WRITING", "SPEAKING"] } });
  if (f.days > 0) and.push({ completedAt: { gte: new Date(Date.now() - f.days * DAY_MS) } });
  return and;
}

/**
 * Something to review. `strict` uses the stored word count (JSON number
 * filter); the fallback — only used if the database rejects that filter — uses
 * the band, since blank essays and silent tests are scored 0.
 */
function reviewableWhere(strict: boolean): Where {
  return strict
    ? {
        OR: [
          { module: "WRITING", aiAnalysis: { path: ["wordCount"], gte: MIN_REVIEW_ESSAY_WORDS } },
          { module: "SPEAKING", aiAnalysis: { path: ["wordCount"], gt: 0 } },
        ],
      }
    : { score: { gt: 0 } };
}

function tabWhere(ctx: ReviewContext, f: Pick<QueueFilters, "group" | "skill" | "days">, tab: ReviewTab, strict: boolean): Where {
  const and = scopeWhere(ctx, f);
  if (tab === "pending") {
    and.push({ review: { is: null } });
    and.push(reviewableWhere(strict));
  } else {
    and.push({ review: { isNot: null } });
  }
  return { AND: and };
}

async function withFallback<T>(run: (strict: boolean) => Promise<T>): Promise<T> {
  try {
    return await run(true);
  } catch (e) {
    console.error("Review queue: word-count filter failed, retrying with the band fallback:", e);
    return run(false);
  }
}

// ---------------------------------------------------------------------------
// Candidates (light), sources and order
// ---------------------------------------------------------------------------

interface Candidate {
  id: string;
  studentId: string;
  skill: ReviewSkill;
  completedAt: Date;
  reviewedAt: Date | null;
  source: ReviewSource;
  homeworkTitle: string | null;
}

type LightRow = { id: string; studentId: string; module: string; completedAt: Date; review: { updatedAt: Date } | null };

async function candidates(ctx: ReviewContext, f: QueueFilters, tab: ReviewTab): Promise<{ rows: LightRow[]; truncated: boolean }> {
  if (nobody(ctx)) return { rows: [], truncated: false };
  const rows: LightRow[] = await withFallback((strict) =>
    db.iELTSTest.findMany({
      where: tabWhere(ctx, f, tab, strict),
      select: { id: true, studentId: true, module: true, completedAt: true, review: { select: { updatedAt: true } } },
      // Pending keeps the OLDEST work when the cap is hit (it is served first).
      orderBy: [{ completedAt: tab === "pending" ? "asc" : "desc" }, { id: "asc" }],
      take: MAX_CANDIDATES,
    })
  );
  return { rows, truncated: rows.length >= MAX_CANDIDATES };
}

const homeworkTitleOf = (h: { title?: string | null; contentTitle?: string | null } | null | undefined) =>
  (h?.title || h?.contentTitle || "Homework").trim();

/** Homework / mock / practice for each id. Never throws (an unknown source reads as practice). */
async function sourcesOf(ids: string[]): Promise<Map<string, { source: ReviewSource; homeworkTitle: string | null }>> {
  const out = new Map<string, { source: ReviewSource; homeworkTitle: string | null }>();
  if (!ids.length) return out;
  const [mocks, subs] = await Promise.all([
    db.iELTSTest
      .findMany({ where: { id: { in: ids }, answers: { path: ["mock"], equals: true } }, select: { id: true } })
      .catch((e: unknown) => {
        console.error("Review queue: mock lookup failed:", e);
        return [] as { id: string }[];
      }),
    db.homeworkSubmission
      .findMany({
        where: { testId: { in: ids } },
        select: { testId: true, homework: { select: { title: true, contentTitle: true, contentKind: true } } },
      })
      .catch((e: unknown) => {
        console.error("Review queue: homework lookup failed:", e);
        return [] as never[];
      }),
  ]);

  const homework = new Map<string, string>();
  const examTask2: string[] = [];
  for (const s of subs as { testId: string | null; homework: { title: string | null; contentTitle: string | null; contentKind: string | null } | null }[]) {
    if (!s.testId) continue;
    homework.set(s.testId, homeworkTitleOf(s.homework));
    if (s.homework?.contentKind === "WRITING_EXAM") examTask2.push(s.testId);
  }
  if (examTask2.length) {
    const wanted = new Set(ids);
    for (const [id, title] of await sittingTask1s(examTask2, homework)) if (wanted.has(id) && !homework.has(id)) homework.set(id, title);
  }

  const mockIds = new Set(mocks.map((m) => m.id));
  for (const id of ids) {
    const hw = homework.get(id);
    out.set(id, hw !== undefined ? { source: "homework", homeworkTitle: hw } : { source: mockIds.has(id) ? "mock" : "practice", homeworkTitle: null });
  }
  return out;
}

/** The other rows (Task 1) of full-Writing-test homework sittings whose Task 2 carries the submission. */
async function sittingTask1s(task2Ids: string[], titles: Map<string, string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const task2: { id: string; studentId: string; answers: unknown }[] = await db.iELTSTest.findMany({
      where: { id: { in: task2Ids } },
      select: { id: true, studentId: true, answers: true },
    });
    const keys = task2
      .map((r) => ({ id: r.id, studentId: r.studentId, key: examAttemptIdOf(answersOf(r.answers)), title: titles.get(r.id) ?? "Homework" }))
      .filter((k): k is { id: string; studentId: string; key: string; title: string } => !!k.key);
    if (!keys.length) return out;
    const rows: { id: string; studentId: string; answers: unknown }[] = await db.iELTSTest.findMany({
      where: {
        module: "WRITING",
        OR: keys.map((k) => ({ studentId: k.studentId, answers: { path: ["examAttemptId"], equals: k.key } })),
      },
      select: { id: true, studentId: true, answers: true },
    });
    for (const r of rows) {
      const key = examAttemptIdOf(answersOf(r.answers));
      const k = keys.find((x) => x.studentId === r.studentId && x.key === key);
      if (k && k.id !== r.id) out.set(r.id, k.title);
    }
  } catch (e) {
    console.error("Review queue: sitting lookup failed:", e);
  }
  return out;
}

function withSources(
  rows: LightRow[],
  sources: Map<string, { source: ReviewSource; homeworkTitle: string | null }>,
  source: ReviewSource | null
): Candidate[] {
  const out: Candidate[] = [];
  for (const r of rows) {
    const s = sources.get(r.id) ?? { source: "practice" as const, homeworkTitle: null };
    if (source && s.source !== source) continue;
    out.push({
      id: r.id,
      studentId: r.studentId,
      skill: r.module === "SPEAKING" ? "SPEAKING" : "WRITING",
      completedAt: r.completedAt,
      reviewedAt: r.review?.updatedAt ?? null,
      source: s.source,
      homeworkTitle: s.homeworkTitle,
    });
  }
  return out;
}

/** Homework and mock first, then oldest first. */
function orderPending(list: Candidate[]): Candidate[] {
  const tier = (c: Candidate) => (c.source === "practice" ? 1 : 0);
  return list.sort(
    (a, b) => tier(a) - tier(b) || a.completedAt.getTime() - b.completedAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Newest review first. */
function orderReviewed(list: Candidate[]): Candidate[] {
  return list.sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0));
}

// ---------------------------------------------------------------------------
// Page rows
// ---------------------------------------------------------------------------

export interface QueueRow {
  testId: string;
  studentId: string;
  studentName: string;
  groupName: string | null;
  skill: ReviewSkill;
  /** "Writing Task 2", "Speaking test", "Speaking practice". */
  label: string;
  /** Prompt title / Speaking set title. */
  title: string;
  /** One of the two tasks of a full Writing test (or a mock's Writing section). */
  sitting: boolean;
  aiBand: number | null;
  /** The teacher's band (reviewed only). */
  band: number | null;
  words: number | null;
  /** Writing: the task's minimum length (150 / 250). */
  minWords: number | null;
  /** Speaking: seconds of speech. */
  seconds: number | null;
  /** Speaking: recorded audio still available / recorded but expired / not recorded. Writing: null. */
  audio: "available" | "expired" | "none" | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerName: string | null;
  source: ReviewSource;
  homeworkTitle: string | null;
}

type FullRow = {
  id: string;
  studentId: string;
  module: string;
  score: number;
  answers: unknown;
  aiAnalysis: unknown;
  timeSpent: number;
  completedAt: Date;
  student: { user: { name: string | null } | null; group: { name: string } | null } | null;
  review: { band: number; aiBand: number | null; reviewerId: string; updatedAt: Date } | null;
};

async function pageRows(items: Candidate[]): Promise<QueueRow[]> {
  if (!items.length) return [];
  const tests: FullRow[] = await db.iELTSTest.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    select: {
      id: true,
      studentId: true,
      module: true,
      score: true,
      answers: true,
      aiAnalysis: true,
      timeSpent: true,
      completedAt: true,
      student: { select: { user: { select: { name: true } }, group: { select: { name: true } } } },
      review: { select: { band: true, aiBand: true, reviewerId: true, updatedAt: true } },
    },
  });
  const byId = new Map(tests.map((t) => [t.id, t]));

  const reviewerIds = Array.from(new Set(tests.map((t) => t.review?.reviewerId).filter((x): x is string => !!x)));
  const recordingKeys = tests
    .filter((t) => t.module === "SPEAKING")
    .map((t) => {
      const a = answersOf(t.answers);
      const setId = str(a.examId);
      return { studentId: t.studentId, attemptKey: recordingKeyOf(a), ...(setId ? { setId } : {}) };
    })
    .filter((k): k is { studentId: string; attemptKey: string; setId?: string } => !!k.attemptKey);

  const [reviewers, recordings] = await Promise.all([
    reviewerIds.length
      ? db.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } }).catch(() => [] as never[])
      : Promise.resolve([] as never[]),
    recordingKeys.length
      ? db.speakingRecording
          .findMany({ where: { OR: recordingKeys }, select: { studentId: true, attemptKey: true, audioUrl: true, expiresAt: true } })
          .catch(() => [] as never[])
      : Promise.resolve([] as never[]),
  ]);
  const reviewerName = new Map((reviewers as { id: string; name: string | null }[]).map((u) => [u.id, u.name]));
  const now = Date.now();
  const audio = new Map<string, "available" | "expired">();
  for (const r of recordings as { studentId: string; attemptKey: string; audioUrl: string | null; expiresAt: Date | null }[]) {
    const k = `${r.studentId}:${r.attemptKey}`;
    const live = !!r.audioUrl && (!r.expiresAt || r.expiresAt.getTime() > now);
    if (live) audio.set(k, "available");
    else if (!audio.has(k)) audio.set(k, "expired");
  }

  const out: QueueRow[] = [];
  for (const item of items) {
    const t = byId.get(item.id);
    if (!t) continue;
    const skill: ReviewSkill = t.module === "SPEAKING" ? "SPEAKING" : "WRITING";
    const a = answersOf(t.answers);
    const ai = asRec(t.aiAnalysis) ?? {};
    const taskType = skill === "WRITING" ? taskTypeOf(a) : null;
    const key = skill === "SPEAKING" ? recordingKeyOf(a) : null;
    out.push({
      testId: t.id,
      studentId: t.studentId,
      studentName: t.student?.user?.name?.trim() || "Student",
      groupName: t.student?.group?.name ?? null,
      skill,
      label: attemptLabel(skill, taskType, isFullSpeakingTest(a)),
      title: attemptTitle(skill, a),
      sitting: skill === "WRITING" && !!examAttemptIdOf(a),
      aiBand: t.review ? t.review.aiBand ?? aiBandOf(skill, ai) : aiBandOf(skill, ai) ?? t.score,
      band: t.review?.band ?? null,
      words: skill === "WRITING" ? num(ai.wordCount) ?? countWords(str(a.essay)) : num(ai.wordCount),
      minWords: taskType ? MIN_TASK_WORDS[taskType] : null,
      seconds: skill === "SPEAKING" ? num(ai.seconds) ?? t.timeSpent : null,
      audio: skill === "SPEAKING" ? (key ? audio.get(`${t.studentId}:${key}`) ?? "none" : "none") : null,
      submittedAt: t.completedAt,
      reviewedAt: t.review?.updatedAt ?? null,
      reviewerName: t.review ? reviewerName.get(t.review.reviewerId) ?? null : null,
      source: item.source,
      homeworkTitle: item.homeworkTitle,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface QueueStats {
  writing: number;
  speaking: number;
  homework: number;
  mock: number;
  practice: number;
}

export interface ReviewQueue {
  /** The filters actually applied (unknown group dropped, page clamped). */
  filters: QueueFilters;
  groups: { id: string; name: string }[];
  /** Attempts in each tab under the current filters (null when that tab wasn't counted). */
  counts: { pending: number; reviewed: number | null };
  /** That tab hit the candidate cap (its count is a lower bound). */
  capped: { pending: boolean; reviewed: boolean };
  /** Breakdown of the current tab. */
  stats: QueueStats;
  rows: QueueRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  /** The current tab hit the candidate cap — narrow the filters. */
  truncated: boolean;
  /** The viewer is a teacher without a Teacher profile. */
  noTeacherProfile: boolean;
}

function statsOf(list: Candidate[]): QueueStats {
  const s: QueueStats = { writing: 0, speaking: 0, homework: 0, mock: 0, practice: 0 };
  for (const c of list) {
    if (c.skill === "WRITING") s.writing++;
    else s.speaking++;
    s[c.source]++;
  }
  return s;
}

/**
 * The review queue for a teacher / admin (null for anyone else). `pageSize`
 * and `countOtherTab` let the dashboard card ask for just the top pending items.
 */
export async function getReviewQueue(
  viewer: Viewer,
  filters: QueueFilters,
  opts: { pageSize?: number; countOtherTab?: boolean } = {}
): Promise<ReviewQueue | null> {
  const ctx = await reviewContext(viewer);
  if (!ctx) return null;
  const f = scoped(ctx, filters);
  const pageSize = Math.max(1, opts.pageSize ?? REVIEW_PAGE_SIZE);
  const countOther = opts.countOtherTab !== false;

  const [pending, reviewed] = await Promise.all([
    f.tab === "pending" || countOther ? candidates(ctx, f, "pending") : Promise.resolve(null),
    f.tab === "reviewed" || countOther ? candidates(ctx, f, "reviewed") : Promise.resolve(null),
  ]);
  const sources = await sourcesOf([...(pending?.rows ?? []), ...(reviewed?.rows ?? [])].map((r) => r.id));
  const pendingList = pending ? orderPending(withSources(pending.rows, sources, f.source)) : null;
  const reviewedList = reviewed ? orderReviewed(withSources(reviewed.rows, sources, f.source)) : null;

  const list = (f.tab === "pending" ? pendingList : reviewedList) ?? [];
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, f.page), pages);
  const rows = await pageRows(list.slice((page - 1) * pageSize, page * pageSize));

  return {
    filters: { ...f, page },
    groups: ctx.groups,
    counts: { pending: pendingList?.length ?? 0, reviewed: reviewedList ? reviewedList.length : null },
    capped: { pending: !!pending?.truncated, reviewed: !!reviewed?.truncated },
    stats: statsOf(list),
    rows,
    total: list.length,
    page,
    pages,
    pageSize,
    truncated: !!(f.tab === "pending" ? pending?.truncated : reviewed?.truncated),
    noTeacherProfile: viewer.role === "TEACHER" && !ctx.teacherId,
  };
}

/**
 * The next pending attempt after `currentTestId` in queue order under the same
 * filters — `preferId` (the other task of the same Writing sitting) first when
 * it is still pending. null when nothing is left. Never throws.
 */
export async function nextPendingReview(
  viewer: Viewer,
  currentTestId: string,
  filters: Partial<QueueFilters> = {},
  preferId?: string | null
): Promise<string | null> {
  try {
    const ctx = await reviewContext(viewer);
    if (!ctx) return null;
    const f = scoped(ctx, { ...DEFAULT_FILTERS, ...filters, tab: "pending", page: 1 });
    const { rows } = await candidates(ctx, f, "pending");
    const sources = await sourcesOf(rows.map((r) => r.id));
    const list = orderPending(withSources(rows, sources, f.source)).filter((c) => c.id !== currentTestId);
    if (preferId && list.some((c) => c.id === preferId)) return preferId;
    return list[0]?.id ?? null;
  } catch (e) {
    console.error("nextPendingReview failed:", e);
    return null;
  }
}

/**
 * Attempts waiting for this viewer's review (last `days` days, every group,
 * skill and source) — for a nav badge. 0 for non-staff. Never throws.
 */
export async function pendingReviewCount(viewer: Viewer, days = DEFAULT_FILTERS.days): Promise<number> {
  try {
    const ctx = await reviewContext(viewer);
    if (!ctx || nobody(ctx)) return 0;
    const f = { group: null, skill: null, days };
    const n: number = await withFallback((strict) => db.iELTSTest.count({ where: tabWhere(ctx, f, "pending", strict) }));
    return n;
  } catch (e) {
    console.error("pendingReviewCount failed:", e);
    return 0;
  }
}

export interface PendingReviewSummary {
  total: number;
  stats: QueueStats;
  /** The first items in queue order (homework / mock first, then oldest). */
  top: QueueRow[];
  truncated: boolean;
  noTeacherProfile: boolean;
}

/** Top of the pending queue for the dashboard card. null for non-staff. */
export async function pendingReviewSummary(viewer: Viewer, take = 3): Promise<PendingReviewSummary | null> {
  const q = await getReviewQueue(viewer, { ...DEFAULT_FILTERS }, { pageSize: take, countOtherTab: false });
  if (!q) return null;
  return { total: q.counts.pending, stats: q.stats, top: q.rows, truncated: q.truncated, noTeacherProfile: q.noTeacherProfile };
}
