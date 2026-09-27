/**
 * Mock exam results by group — loading. SERVER ONLY.
 *
 * The numbers are computed in ./mock-analytics-core.ts (pure); this file only
 * decides whose mocks the viewer may see and reads the rows:
 *
 *   - a teacher sees the groups they teach — one group, or all of them;
 *   - an admin sees every group (the page offers a group selector);
 *   - anyone else sees nothing.
 *
 * A fixed number of batched queries whatever the group size (no per-student
 * queries), every one of them capped:
 *
 *   1. groups of the viewer
 *   2. students of the chosen groups
 *   3. their finished + open attempts (light rows, newest first, capped)  ┐ in
 *      exact per-student totals of finished mocks (groupBy)               ┘ parallel
 *      — when the cap cut in, the latest mock of any student it cut off is
 *      fetched by (student, finishedAt), so nobody is ever shown as "never"
 *   4. results JSON of each student's latest mock (+ the recent mocks pooled
 *      for question types)
 *   5. the section rows those results point at: Reading / Listening attempts
 *      (question types), Writing tasks with their review, Speaking reviews
 *
 * Steps 4–5 degrade gracefully: a failure leaves those panels empty and the
 * page says which figures are missing.
 */

import { db } from "@/lib/db";
import type { Viewer } from "@/lib/access";
import {
  buildMockAnalytics,
  buildStudentRows,
  mockCsv,
  planDetail,
  planTests,
  summarizeGroup,
  type AttemptInput,
  type GroupMockSummary,
  type MockAnalytics,
  type ObjectiveTestInput,
  type SpeakingReviewInput,
  type StudentInput,
  type StudentTotals,
  type WritingTestInput,
} from "./mock-analytics-core";

export type {
  GroupMockSummary,
  MockAnalytics,
  StudentMockRow,
  NeedsMockRow,
  InProgressRow,
  KindStat,
  WeakKind,
  CriteriaBlock,
  SectionAverage,
  TrendPoint,
  DistributionBin,
} from "./mock-analytics-core";

const MAX_GROUPS = 500;
const MAX_STUDENTS = 600;
/** The CSV reads no detail rows, so it can afford a whole school. */
const MAX_EXPORT_STUDENTS = 5000;
const MAX_ATTEMPTS = 5000;
/** The group page card only needs overall bands and dates. */
const MAX_SUMMARY_ATTEMPTS = 3000;

export interface MockGroupOption {
  id: string;
  name: string;
}

export type MockScope =
  | {
      ok: true;
      role: "TEACHER" | "ADMIN";
      /** Every group the viewer may pick. */
      groups: MockGroupOption[];
      /** The chosen group; null = all of `groups`. */
      group: MockGroupOption | null;
      /** A ?group= was given that isn't one of `groups` (dropped). */
      unknownGroup: boolean;
    }
  | { ok: false; reason: "forbidden" | "no-teacher" };

/** A plausible id from ?group= (string, trimmed, bounded), else null. */
export function groupParam(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= 64 && s !== "all" ? s : null;
}

/** Which groups this viewer may analyse, and the one they asked for. */
export async function mockScope(viewer: Viewer, rawGroup: unknown): Promise<MockScope> {
  const role = viewer.role === "ADMIN" ? "ADMIN" : viewer.role === "TEACHER" ? "TEACHER" : null;
  if (!role) return { ok: false, reason: "forbidden" };
  let groups: MockGroupOption[];
  if (role === "ADMIN") {
    groups = await db.group.findMany({ select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }], take: MAX_GROUPS });
  } else {
    // Not lib/access teacherOf(): it reads a database error as "no profile".
    const teacher: { id: string } | null = await db.teacher.findUnique({ where: { userId: viewer.id }, select: { id: true } });
    if (!teacher) return { ok: false, reason: "no-teacher" };
    groups = await db.group.findMany({
      where: { teacherId: teacher.id },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: MAX_GROUPS,
    });
  }
  const wanted = groupParam(rawGroup);
  const group = wanted ? groups.find((g) => g.id === wanted) ?? null : null;
  return { ok: true, role, groups, group, unknownGroup: !!wanted && !group };
}

const scopeGroupIds = (s: Extract<MockScope, { ok: true }>) => (s.group ? [s.group.id] : s.groups.map((g) => g.id));

type StudentRow = { id: string; groupId: string | null; targetBand: string | null; user: { name: string | null } | null };
type AttemptRow = {
  id: string;
  studentId: string;
  status: string;
  overall: number | null;
  current: number;
  startedAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
};

const ATTEMPT_SELECT = {
  id: true,
  studentId: true,
  status: true,
  overall: true,
  current: true,
  startedAt: true,
  finishedAt: true,
  updatedAt: true,
} as const;

type TotalsRow = { studentId: string; _count: { _all: number }; _max: { overall: number | null; finishedAt: Date | null } };

interface BaseRows {
  students: StudentInput[];
  attempts: AttemptInput[];
  totals: Map<string, StudentTotals>;
  studentsCapped: boolean;
  attemptsCapped: boolean;
}

/** Steps 1–3: the students of the scope, their finished / open attempts (no results) and exact totals. */
async function loadBase(scope: Extract<MockScope, { ok: true }>, maxStudents = MAX_STUDENTS): Promise<BaseRows> {
  const groupIds = scopeGroupIds(scope);
  const none: BaseRows = { students: [], attempts: [], totals: new Map(), studentsCapped: false, attemptsCapped: false };
  if (!groupIds.length) return none;
  const names = new Map(scope.groups.map((g) => [g.id, g.name]));
  const studentRows: StudentRow[] = await db.student.findMany({
    where: { groupId: { in: groupIds } },
    select: { id: true, groupId: true, targetBand: true, user: { select: { name: true } } },
    orderBy: [{ groupId: "asc" }, { id: "asc" }],
    take: maxStudents + 1,
  });
  const students = studentRows.slice(0, maxStudents).map((s) => ({
    id: s.id,
    name: s.user?.name?.trim() || "Student",
    groupId: s.groupId,
    groupName: s.groupId ? names.get(s.groupId) ?? null : null,
    targetBand: s.targetBand,
  }));
  const studentsCapped = studentRows.length > maxStudents;
  const ids = students.map((s) => s.id);
  if (!ids.length) return { ...none, students, studentsCapped };

  const [attemptRows, totalRows]: [AttemptRow[], TotalsRow[]] = await Promise.all([
    db.mockAttempt.findMany({
      where: { studentId: { in: ids }, status: { in: ["finished", "active"] } },
      select: ATTEMPT_SELECT,
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
      take: MAX_ATTEMPTS + 1,
    }),
    db.mockAttempt.groupBy({
      by: ["studentId"],
      where: { studentId: { in: ids }, status: "finished" },
      _count: { _all: true },
      _max: { overall: true, finishedAt: true },
    }),
  ]);
  const attemptsCapped = attemptRows.length > MAX_ATTEMPTS;
  const attempts: AttemptInput[] = attemptRows.slice(0, MAX_ATTEMPTS);

  if (attemptsCapped) {
    // The cap keeps the newest attempts: fetch the latest mock of every student it cut off.
    const loaded = new Map<string, number>();
    for (const a of attempts) {
      if (a.status === "finished" && a.finishedAt) loaded.set(a.studentId, Math.max(loaded.get(a.studentId) ?? 0, a.finishedAt.getTime()));
    }
    const missing = totalRows.filter((t) => t._max.finishedAt && (loaded.get(t.studentId) ?? 0) < t._max.finishedAt.getTime());
    if (missing.length) {
      const extra: AttemptRow[] = await db.mockAttempt.findMany({
        where: { status: "finished", OR: missing.map((t) => ({ studentId: t.studentId, finishedAt: t._max.finishedAt })) },
        select: ATTEMPT_SELECT,
      });
      const have = new Set(attempts.map((a) => a.id));
      attempts.push(...extra.filter((a) => !have.has(a.id)));
    }
  }

  return {
    students,
    attempts,
    totals: new Map(totalRows.map((t) => [t.studentId, { count: t._count._all, best: t._max.overall }])),
    studentsCapped,
    attemptsCapped,
  };
}

/** Step 3: results JSON by attempt id. */
async function loadResults(ids: string[]): Promise<Map<string, unknown>> {
  if (!ids.length) return new Map();
  const rows: { id: string; results: unknown }[] = await db.mockAttempt.findMany({
    where: { id: { in: ids } },
    select: { id: true, results: true },
  });
  return new Map(rows.map((r) => [r.id, r.results]));
}

function logged<T>(what: string, fallback: T, onFail: () => void) {
  return (e: unknown): T => {
    console.error(`Mock analytics: ${what} failed:`, e);
    onFail();
    return fallback;
  };
}

/** Everything /teacher/mock shows. Throws when the students or attempts can't be read. */
export async function getMockAnalytics(scope: Extract<MockScope, { ok: true }>, now = Date.now()): Promise<MockAnalytics> {
  const base = await loadBase(scope);
  let partial = false;
  let resultsFailed = false;
  const fail = () => {
    partial = true;
  };

  const plan = planDetail(base.attempts, now);
  const results = await loadResults(plan.attemptIds).catch(
    logged("results", new Map<string, unknown>(), () => {
      resultsFailed = true;
    })
  );
  const tests = planTests(plan, results);

  const [objectiveTests, writingTests, speakingReviews]: [ObjectiveTestInput[], WritingTestInput[], SpeakingReviewInput[]] =
    await Promise.all([
      tests.objective.length
        ? db.iELTSTest
            .findMany({ where: { id: { in: tests.objective } }, select: { id: true, module: true, aiAnalysis: true } })
            .catch(logged("question types", [] as ObjectiveTestInput[], fail))
        : Promise.resolve([] as ObjectiveTestInput[]),
      tests.writing.length
        ? db.iELTSTest
            .findMany({
              where: { id: { in: tests.writing } },
              select: { id: true, aiAnalysis: true, review: { select: { criteria: true } } },
            })
            .catch(logged("writing criteria", [] as WritingTestInput[], fail))
        : Promise.resolve([] as WritingTestInput[]),
      tests.speaking.length
        ? db.testReview
            .findMany({ where: { testId: { in: tests.speaking } }, select: { testId: true, criteria: true } })
            .catch(logged("speaking reviews", [] as SpeakingReviewInput[], fail))
        : Promise.resolve([] as SpeakingReviewInput[]),
    ]);

  return buildMockAnalytics({
    students: base.students,
    attempts: base.attempts,
    results,
    objectiveTests,
    writingTests,
    speakingReviews,
    totals: base.totals,
    now,
    flags: { studentsCapped: base.studentsCapped, attemptsCapped: base.attemptsCapped, partial, resultsFailed },
  });
}

/**
 * The CSV export: one row per student of the scope (their latest finished
 * mock, exact mock count). Refuses rather than truncating when the scope has
 * more than 5,000 students. Throws on a read failure.
 */
export async function getMockCsv(
  scope: Extract<MockScope, { ok: true }>,
  now = Date.now()
): Promise<{ ok: true; csv: string } | { ok: false; reason: "too-many" }> {
  const base = await loadBase(scope, MAX_EXPORT_STUDENTS);
  if (base.studentsCapped) return { ok: false, reason: "too-many" };
  const plan = planDetail(base.attempts, now);
  const results = await loadResults(Array.from(plan.latest.values()).map((a) => a.id));
  return { ok: true, csv: mockCsv(buildStudentRows(base.students, base.attempts, results, now, plan, base.totals)) };
}

/**
 * The group page's card: latest-mock average and who needs a mock. The caller
 * has already checked the viewer may see these students. Never throws (null).
 */
export async function getGroupMockSummary(studentIds: string[], now = Date.now()): Promise<GroupMockSummary | null> {
  try {
    const attempts: AttemptRow[] = studentIds.length
      ? await db.mockAttempt.findMany({
          where: { studentId: { in: studentIds }, status: { in: ["finished", "active"] } },
          select: ATTEMPT_SELECT,
          orderBy: [{ startedAt: "desc" }, { id: "asc" }],
          take: MAX_SUMMARY_ATTEMPTS,
        })
      : [];
    return summarizeGroup(studentIds, attempts, now);
  } catch (e) {
    console.error("Mock analytics: group summary failed:", e);
    return null;
  }
}
