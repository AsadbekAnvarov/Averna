/**
 * Server loader for "Who needs help today" (lib/teacher/needs-help.ts ranks).
 *
 * Scope: only the students of the teacher's own groups — the id list comes from
 * lib/access `teacherStudentIds`, and every query below is filtered by it (or by
 * the teacher's groups), so another teacher's students never appear.
 *
 * One batched set of queries (no per-student round trips): roster, last
 * activity (groupBy), recent homework with these students' submissions,
 * absences (groupBy), open peer-speaking reports (groupBy), Writing / Speaking
 * work waiting for review, forecast evidence and recent graded Reading /
 * Listening items (two SQL projections — never essays, answers or transcripts),
 * plus the cached catalog summaries. Each query fails soft (that signal is
 * simply missing). The result is cached per teacher and Tashkent day for five
 * minutes (`unstable_cache`, tag `needs-help:<teacherId>`, revalidated when the
 * teacher assigns a mini task or approves a review).
 *
 * SERVER ONLY.
 */

import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { teacherStudentIds } from "@/lib/access";
import { listListeningExams, listReadingExams } from "@/lib/ielts/catalog";
import type { ExamSkill, ExamTestSummary } from "@/lib/ielts/types";
import { isForStudent } from "@/lib/homework/audience";
import { MIN_REVIEW_ESSAY_WORDS } from "@/lib/review/scoring";
import { streakStatus } from "@/lib/engine/progression/streak";
import { SKILLS, type SkillKey } from "@/lib/engine/progression/config";
import { bandForecast, dayKeyOf, paceFromSessions, selectForecastResults, type EvidenceItem } from "@/lib/forecast/band-forecast";
import { tashkentDateKey, tashkentDayDiff } from "@/lib/utils";
import { kindStats, parseItems, type AttemptItems } from "./kind-stats";
import { NEEDS_HELP_RULES as R, rankNeedsHelp, type NeedsHelpRow, type StudentSignals } from "./needs-help";
import { needsHelpTag } from "./needs-help-tag";

const DAY = 86_400_000;
const CACHE_SECONDS = 300;
/** Recent graded Reading / Listening attempts read per student (enough for "last 5 of a type"). */
const ITEM_ATTEMPTS = 6;
const FORECAST_DAYS = 120;
const REVIEW_WINDOW_DAYS = 30;

export { needsHelpTag };

export interface NeedsHelpData {
  rows: NeedsHelpRow[];
  /** Students in the teacher's groups. */
  students: number;
  /** Tashkent day the list is for ("YYYY-MM-DD") — "Done for today" keys use it. */
  todayKey: string;
}

const num = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};

function soft<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  return p.catch((e: unknown) => {
    console.error(`Needs help: ${label} failed:`, e instanceof Error ? e.message : e);
    return fallback;
  });
}

type RosterRow = {
  id: string;
  userId: string;
  groupId: string | null;
  createdAt: Date;
  targetBand: string | null;
  currentStreak: number;
  streakFreezes: number;
  lastActiveDate: Date;
  user: { name: string | null } | null;
  group: { name: string } | null;
};
type HomeworkRow = { id: string; groupId: string; assigneeId: string | null; dueDate: Date; submissions: { studentId: string }[] };
type EvidenceRow = {
  studentId: string;
  module: string;
  score: number;
  completedAt: Date;
  timeSpent: number;
  contentKey: string | null;
  taskType: string | null;
  questions: string | null;
  words: string | null;
  seconds: string | null;
};
type ItemsRow = { studentId: string; module: string; examId: string | null; items: unknown };
type WaitingRow = { id: string; studentId: string; module: string; completedAt: Date };

async function lastActivity(ids: string[]): Promise<{ studentId: string; at: Date | null }[]> {
  const rows = await db.activityLog.groupBy({ by: ["studentId"], where: { studentId: { in: ids } }, _max: { createdAt: true } });
  return rows.map((r) => ({ studentId: r.studentId, at: r._max.createdAt ?? null }));
}

async function absencesSince(ids: string[], from: Date): Promise<{ studentId: string; count: number }[]> {
  const rows = await db.attendance.groupBy({
    by: ["studentId"],
    where: { studentId: { in: ids }, status: "ABSENT", date: { gte: from } },
    _count: { _all: true },
  });
  return rows.map((r) => ({ studentId: r.studentId, count: r._count._all }));
}

async function openReportCounts(ids: string[]): Promise<{ studentId: string; count: number }[]> {
  const rows = await db.speakingReport.groupBy({ by: ["reportedId"], where: { reportedId: { in: ids }, status: "OPEN" }, _count: { _all: true } });
  return rows.map((r) => ({ studentId: r.reportedId, count: r._count._all }));
}

async function waitingReviews(ids: string[], now: Date): Promise<WaitingRow[]> {
  const base = {
    studentId: { in: ids },
    module: { in: ["WRITING", "SPEAKING"] as ("WRITING" | "SPEAKING")[] },
    review: { is: null },
    completedAt: { gte: new Date(now.getTime() - REVIEW_WINDOW_DAYS * DAY), lte: new Date(now.getTime() - R.reviewDays * DAY) },
  };
  const select = { id: true, studentId: true, module: true, completedAt: true } as const;
  try {
    // The review queue's rule: an essay of 20+ words or any transcribed speech.
    return await db.iELTSTest.findMany({
      where: {
        ...base,
        OR: [
          { module: "WRITING", aiAnalysis: { path: ["wordCount"], gte: MIN_REVIEW_ESSAY_WORDS } },
          { module: "SPEAKING", aiAnalysis: { path: ["wordCount"], gt: 0 } },
        ],
      },
      select,
      orderBy: { completedAt: "asc" },
      take: 1000,
    });
  } catch {
    return db.iELTSTest.findMany({ where: { ...base, score: { gt: 0 } }, select, orderBy: { completedAt: "asc" }, take: 1000 });
  }
}

async function compute(teacherId: string, todayKey: string): Promise<NeedsHelpData> {
  const ids = await teacherStudentIds(teacherId);
  if (!ids.length) return { rows: [], students: 0, todayKey };
  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * DAY);
  const inIds = Prisma.join(ids);

  const [roster, activity, homework, absences, reports, waiting, evidence, objective, reading, listening] = await Promise.all([
    db.student.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        userId: true,
        groupId: true,
        createdAt: true,
        targetBand: true,
        currentStreak: true,
        streakFreezes: true,
        lastActiveDate: true,
        user: { select: { name: true } },
        group: { select: { name: true } },
      },
    }) as Promise<RosterRow[]>,
    soft("activity", lastActivity(ids), []),
    soft(
      "homework",
      db.homework.findMany({
        where: { group: { teacherId }, dueDate: { gte: since(R.missedHomeworkDays), lt: now } },
        select: { id: true, groupId: true, assigneeId: true, dueDate: true, submissions: { where: { studentId: { in: ids } }, select: { studentId: true } } },
        take: 2000,
      }) as Promise<HomeworkRow[]>,
      []
    ),
    soft("attendance", absencesSince(ids, since(R.absenceDays)), []),
    soft("reports", openReportCounts(ids), []),
    soft("reviews", waitingReviews(ids, now), []),
    soft(
      "forecast evidence",
      db.$queryRaw<EvidenceRow[]>`
        SELECT t."studentId", t."module"::text AS "module", t."score", t."completedAt", t."timeSpent",
          t."answers"->>'testId' AS "contentKey", t."answers"->>'taskType' AS "taskType",
          COALESCE(t."aiAnalysis"->>'totalQuestions', t."answers"->>'lTotal', t."answers"->>'rTotal') AS "questions",
          t."aiAnalysis"->>'wordCount' AS "words", t."aiAnalysis"->>'seconds' AS "seconds"
        FROM "ielts_tests" t
        WHERE t."studentId" IN (${inIds}) AND t."score" > 0 AND t."completedAt" >= ${since(FORECAST_DAYS)}
        ORDER BY t."completedAt" ASC
        LIMIT 20000`,
      []
    ),
    soft(
      "graded items",
      db.$queryRaw<ItemsRow[]>`
        WITH recent AS (
          SELECT t."id", t."studentId", t."completedAt",
            ROW_NUMBER() OVER (PARTITION BY t."studentId" ORDER BY t."completedAt" DESC, t."id" DESC) AS "rn"
          FROM "ielts_tests" t
          WHERE t."studentId" IN (${inIds}) AND t."module"::text IN ('READING', 'LISTENING') AND t."completedAt" >= ${since(60)}
        )
        SELECT r."studentId", t."module"::text AS "module", t."answers"->>'examId' AS "examId",
          (SELECT jsonb_agg(jsonb_build_array(i->'n', i->>'kind', i->'correct'))
             FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t."aiAnalysis"->'items') = 'array' THEN t."aiAnalysis"->'items' ELSE '[]'::jsonb END) i
          ) AS "items"
        FROM recent r JOIN "ielts_tests" t ON t."id" = r."id"
        WHERE r."rn" <= ${ITEM_ATTEMPTS}
        ORDER BY r."studentId", r."completedAt" DESC, r."id" DESC`,
      []
    ),
    soft("reading catalog", listReadingExams(), [] as ExamTestSummary[]),
    soft("listening catalog", listListeningExams(), [] as ExamTestSummary[]),
  ]);

  const lastActive = new Map(activity.map((a) => [a.studentId, a.at]));
  const absent = new Map(absences.map((a) => [a.studentId, a.count]));
  const openReports = new Map(reports.map((r) => [r.studentId, r.count]));
  const waitingBy = new Map<string, WaitingRow[]>();
  for (const w of waiting) waitingBy.set(w.studentId, [...(waitingBy.get(w.studentId) ?? []), w]);
  const evidenceBy = new Map<string, EvidenceItem[]>();
  for (const e of evidence) {
    if (!SKILLS.includes(e.module as SkillKey)) continue;
    const list = evidenceBy.get(e.studentId) ?? [];
    list.push({
      skill: e.module as SkillKey,
      band: Number(e.score),
      at: new Date(e.completedAt).getTime(),
      contentKey: e.contentKey,
      questions: num(e.questions),
      words: num(e.words),
      seconds: e.module === "SPEAKING" ? num(e.seconds) ?? (num(e.timeSpent) || null) : null,
      task: e.module === "WRITING" ? (e.taskType === "task1" ? "task1" : "task2") : null,
    });
    evidenceBy.set(e.studentId, list);
  }
  const itemsBy = new Map<string, AttemptItems[]>();
  for (const r of objective) {
    if (r.module !== "READING" && r.module !== "LISTENING") continue;
    const list = itemsBy.get(r.studentId) ?? [];
    list.push({ skill: r.module as ExamSkill, examId: r.examId, items: parseItems(r.items) });
    itemsBy.set(r.studentId, list);
  }
  const summaries = new Map<string, ExamTestSummary>();
  for (const s of [...reading, ...listening]) summaries.set(`${s.skill}:${s.id}`, s);
  const lookup = (skill: ExamSkill, examId: string) => summaries.get(`${skill}:${examId}`);

  const nowMs = now.getTime();
  const signals: StudentSignals[] = roster.map((s) => {
    const last = lastActive.get(s.id) ?? null;
    const daysInactive = last ? tashkentDayDiff(now, new Date(last)) : tashkentDayDiff(now, new Date(s.createdAt));

    const gap = tashkentDayDiff(now, new Date(s.lastActiveDate));
    const broken = streakStatus(s.currentStreak, gap, s.streakFreezes ?? 0) === "broken" && gap <= 3 && s.currentStreak >= R.brokenStreak;

    const joined = new Date(s.createdAt).getTime();
    const missedHomework = homework.filter(
      (h) =>
        h.groupId === s.groupId &&
        isForStudent(h, s.id) &&
        new Date(h.dueDate).getTime() > joined &&
        !h.submissions.some((x) => x.studentId === s.id)
    ).length;

    const target = Number.parseFloat(String(s.targetBand ?? ""));
    const hasTarget = Number.isFinite(target) && target >= 4 && target <= 9;
    const items = evidenceBy.get(s.id) ?? [];
    let fallingSkills: string[] = [];
    let forecast: StudentSignals["forecast"] = null;
    if (items.length >= 2) {
      const f = bandForecast({
        results: selectForecastResults(items),
        targetBand: hasTarget ? target : 7,
        now: nowMs,
        todayKey: dayKeyOf(nowMs),
        pace: paceFromSessions(items, nowMs),
      });
      fallingSkills = f.skills.filter((k) => k.trend === "down").map((k) => k.label);
      if (hasTarget && f.overall) forecast = { now: f.overall.now, target };
    }

    const weak = kindStats(itemsBy.get(s.id) ?? [], lookup, R.kindWindow)[0] ?? null;
    const w = waitingBy.get(s.id) ?? [];
    const oldest = w[0];
    return {
      id: s.id,
      userId: s.userId,
      name: s.user?.name?.trim() || "Student",
      group: s.group?.name ?? "No group",
      missedHomework,
      daysInactive,
      neverActive: !last,
      brokenStreak: broken ? s.currentStreak : 0,
      fallingSkills,
      forecast,
      weakKind: weak ? { kind: weak.kind, label: weak.label, wrong: weak.wrong, of: weak.of } : null,
      absences: absent.get(s.id) ?? 0,
      openReports: openReports.get(s.id) ?? 0,
      waitingReview: oldest
        ? {
            count: w.length,
            oldestDays: Math.floor((nowMs - new Date(oldest.completedAt).getTime()) / DAY),
            testId: oldest.id,
            skill: oldest.module === "SPEAKING" ? "SPEAKING" : "WRITING",
          }
        : null,
    };
  });

  return { rows: rankNeedsHelp(signals), students: roster.length, todayKey };
}

/** The teacher's needs-help list (cached five minutes per teacher and Tashkent day). */
export async function loadNeedsHelp(teacherId: string): Promise<NeedsHelpData> {
  const todayKey = tashkentDateKey();
  return unstable_cache(() => compute(teacherId, todayKey), ["needs-help-v1", teacherId, todayKey], {
    revalidate: CACHE_SECONDS,
    tags: [needsHelpTag(teacherId)],
  })();
}
