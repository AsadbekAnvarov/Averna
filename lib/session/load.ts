/**
 * Server half of the Daily Session: reads the facts lib/session/daily-plan.ts
 * plans from. Cheap, indexed queries only, cached per request (the Today tab
 * shares loadSessions / getDashboardHomework with the rest of the page). It
 * never settles rewards or writes anything.
 */
import { cache } from "react";
import { db } from "@/lib/db";
import { tashkentDateKey, tashkentDayDiff, tashkentDayStart } from "@/lib/utils";
import { getDashboardHomework } from "@/lib/dashboard/data";
import { SKILLS } from "@/lib/engine/progression/config";
import { buildSkillProfile, parseTargetBand } from "@/lib/engine/progression/skills";
import { hashString } from "@/lib/engine/progression/missions";
import { activityForSkill } from "@/lib/engine/progression/recommendations";
import { contentHints, loadSessions } from "@/lib/engine/progression/service";
import { streakStatus } from "@/lib/engine/progression/streak";
import { SPEAKING_ITEM, type DailyPlanFacts, type FocusTasks, type TodayActivity } from "@/lib/session/daily-plan";

/** ActivityLog actions that can tick a session step. */
export const SESSION_ACTIONS = [
  "SRS_REVIEW",
  "WARMUP_COMPLETED",
  "IELTS_TEST_COMPLETED",
  "HOMEWORK_SUBMITTED",
  "SPEAKING_SESSION_COMPLETED",
  "DAILY_CHALLENGE",
];

type Json = Record<string, unknown>;
const rec = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function toTodayActivity(l: { action: string; details: unknown }): TodayActivity {
  const d = rec(l.details);
  return {
    action: l.action,
    module: str(d.module),
    score: num(d.score),
    homeworkId: str(d.homeworkId),
    count: num(d.count),
    kind: str(d.kind),
  };
}

export interface SessionPerson {
  firstName: string;
  streak: number;
}

export interface DailySessionData {
  facts: DailyPlanFacts;
  person: SessionPerson;
}

/** The facts for today's session, or null when the student doesn't exist. */
export const getDailySessionData = cache(async (studentId: string): Promise<DailySessionData | null> => {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      groupId: true,
      targetBand: true,
      currentStreak: true,
      streakFreezes: true,
      lastActiveDate: true,
      user: { select: { name: true } },
    },
  });
  if (!student) return null;

  const now = new Date();
  const dayKey = tashkentDateKey(now);
  const dayStart = tashkentDayStart(now);
  const [sessions, logs, dueWords, hw] = await Promise.all([
    loadSessions(studentId),
    db.activityLog.findMany({
      where: { studentId, createdAt: { gte: dayStart }, action: { in: SESSION_ACTIONS } },
      select: { action: true, details: true },
      take: 200,
    }),
    db.reviewItem.count({ where: { studentId, dueAt: { lte: now } } }).catch(() => 0),
    getDashboardHomework(studentId, student.groupId),
  ]);

  // The morning picture: today's own results don't reshuffle today's plan.
  const before = sessions.filter((s) => s.fact.dayKey !== dayKey);
  const targetBand = parseTargetBand(student.targetBand);
  const profile = buildSkillProfile(before.map((s) => s.fact), targetBand, dayStart.getTime());
  const hints = await contentHints(before, profile, now.getTime());
  const snap = (k: (typeof SKILLS)[number]) => profile.find((p) => p.skill === k);
  const plan = (k: (typeof SKILLS)[number], short = false) => {
    const a = activityForSkill(k, snap(k), hints, { short });
    return { title: a.title, href: a.href, minutes: a.estMinutes };
  };
  const tasks: FocusTasks = {
    READING: [plan("READING")],
    LISTENING: [plan("LISTENING")],
    WRITING: [plan("WRITING", true)],
    SPEAKING: [SPEAKING_ITEM, plan("SPEAKING")],
  };

  const activities = logs.map(toTodayActivity);
  const submittedIds = Array.from(
    new Set(activities.filter((a) => a.action === "HOMEWORK_SUBMITTED" && a.homeworkId).map((a) => a.homeworkId as string))
  );
  const doneRows = submittedIds.length
    ? await db.homework.findMany({ where: { id: { in: submittedIds.slice(0, 5) } }, select: { id: true, title: true } }).catch(() => [])
    : [];
  const first = hw.shown[0];

  const gap = tashkentDayDiff(now, new Date(student.lastActiveDate));
  const status = streakStatus(student.currentStreak, gap, student.streakFreezes ?? 0);

  return {
    facts: {
      dayKey,
      now: now.getTime(),
      seed: hashString(student.id),
      targetBand,
      dueWords,
      homework: first ? { id: first.id, title: first.title, dueAt: new Date(first.dueDate).toISOString() } : null,
      homeworkDoneToday: doneRows,
      skills: profile.map((p) => ({ skill: p.skill, label: p.label, sessions: p.sessions, recentAvg: p.recentAvg, daysSince: p.daysSince })),
      tasks,
      activities,
    },
    person: {
      firstName: (student.user.name ?? "there").split(" ")[0] || "there",
      streak: status === "broken" ? 0 : student.currentStreak,
    },
  };
});
