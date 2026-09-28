import { cache } from "react";
import type { IELTSModule } from "@prisma/client";
import { db } from "@/lib/db";
import { tashkentDateKey, tashkentDayDiff, tashkentDayStart } from "@/lib/utils";
import { awardXp, BUDGETED_ACTIONS, findAward } from "@/lib/engine/xp-engine";
import { notifyUser } from "@/lib/notifications";
import { listListeningExams, listReadingExams, listSpeakingSets } from "@/lib/ielts/catalog";
import { MISSION_CONFIG, SKILLS, SKILL_LABEL, STREAK_CONFIG, XP_CONFIG, type SkillKey } from "./config";
import { EMPTY_HISTORY, type XpHistory, type XpLine } from "./xp";
import { getLevelInfo, type LevelInfo } from "./levels";
import { nextStreakMilestone, streakStatus } from "./streak";
import {
  buildSkillProfile,
  parseTargetBand,
  skillInsight,
  weakestSkill,
  type SessionFact,
  type SkillSnapshot,
} from "./skills";
import { buildDailyMission, hashString, type DailyMission } from "./missions";
import { challengeState, pickDailyChallenge, pickWeeklyChallenge, type ChallengeState } from "./challenges";
import { examLevelForBand, recommendNext, type ContentHints, type Recommendation } from "./recommendations";
import { countContentKeys, pickFull, pickPart, pickSpeakingSet } from "./picks";
import { evaluateBadges, type BadgeSnapshot, type BadgeState } from "./badges";

/**
 * Progression service — the DB-facing half of the Progression Engine.
 *
 * Loads verified evidence (IELTSTest rows, activity, the XP ledger), feeds it to
 * the pure rule modules and settles earned rewards (mission bonus, challenges,
 * badges) through the idempotent XP ledger. UI code calls `getProgression` /
 * `buildSessionOutcome` and only renders what comes back — it never computes
 * XP, levels or missions itself.
 */

type Json = Record<string, unknown>;
const asRec = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const wordCount = (s: unknown) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

interface TestRow {
  id: string;
  module: IELTSModule;
  score: number;
  answers: unknown;
  aiAnalysis: unknown;
  timeSpent: number;
  completedAt: Date;
}

/** Content key the attempt belongs to (test id / prompt id), for repeat decay. */
export function contentKeyOf(answers: unknown): string | null {
  const a = asRec(answers);
  const k = a?.testId;
  return typeof k === "string" ? k : null;
}

/** Normalise one IELTSTest row into a SessionFact. */
export function toSessionFact(t: TestRow): SessionFact {
  const a = asRec(t.answers) ?? {};
  const ai = asRec(t.aiAnalysis) ?? {};
  const skill = t.module as SkillKey;
  let accuracy: number | null = null;
  if (skill === "READING" || skill === "LISTENING") {
    const pct = num(ai.percentage);
    if (pct != null) accuracy = pct / 100;
    else {
      const c = num(ai.correctCount) ?? num(a.lCorrect) ?? num(a.rCorrect);
      const tot = num(ai.totalQuestions) ?? num(a.lTotal) ?? num(a.rTotal);
      if (c != null && tot) accuracy = c / tot;
    }
  }
  let words: number | null = null;
  let seconds: number | null = null;
  let task: SessionFact["task"] = null;
  if (skill === "WRITING") {
    words = num(ai.wordCount) ?? (wordCount(a.essay) || null);
    task = a.taskType === "task1" ? "task1" : "task2";
  } else if (skill === "SPEAKING") {
    words = num(ai.wordCount);
    seconds = num(ai.seconds) ?? (t.timeSpent || null);
  }
  return {
    skill,
    band: t.score,
    accuracy: accuracy != null ? Math.max(0, Math.min(1, accuracy)) : null,
    words,
    seconds,
    task,
    dayKey: tashkentDateKey(t.completedAt),
    at: t.completedAt.getTime(),
  };
}

const TEST_SELECT = {
  id: true,
  module: true,
  score: true,
  answers: true,
  aiAnalysis: true,
  timeSpent: true,
  completedAt: true,
} as const;

/** Recent verified sessions (newest 200) — the evidence every rule reasons over. */
export const loadSessions = cache(async (studentId: string) => {
  const rows = await db.iELTSTest.findMany({
    where: { studentId, score: { gt: 0 } },
    orderBy: { completedAt: "desc" },
    take: 200,
    select: TEST_SELECT,
  });
  return rows.map((r) => ({ row: r as TestRow, fact: toSessionFact(r as TestRow) }));
});

async function learningXpSince(studentId: string, since: Date): Promise<number> {
  const logs = await db.activityLog.findMany({
    where: { studentId, createdAt: { gte: since }, action: { in: BUDGETED_ACTIONS }, points: { gt: 0 } },
    select: { points: true },
  });
  return logs.reduce((s, l) => s + l.points, 0);
}

/**
 * Everything the XP rules need to know about a student's history BEFORE the
 * attempt being scored. Call before inserting the new attempt.
 */
export async function loadXpHistory(
  studentId: string,
  skill: SkillKey,
  contentKey?: string | null
): Promise<XpHistory> {
  const dayStart = tashkentDayStart();
  const [recent, best, attempts, todays, earnedToday] = await Promise.all([
    db.iELTSTest.findMany({
      where: { studentId, module: skill, score: { gt: 0 } },
      orderBy: { completedAt: "desc" },
      take: 3,
      select: { score: true },
    }),
    db.iELTSTest.aggregate({ where: { studentId, module: skill }, _max: { score: true } }),
    contentKey
      ? db.iELTSTest.count({ where: { studentId, module: skill, answers: { path: ["testId"], equals: contentKey } } })
      : Promise.resolve(0),
    db.iELTSTest.findMany({
      where: { studentId, module: skill, completedAt: { gte: dayStart } },
      select: TEST_SELECT,
    }),
    learningXpSince(studentId, dayStart),
  ]);
  const poorAttemptsToday = todays
    .map((t) => toSessionFact(t as TestRow))
    .filter((f) => f.accuracy != null && f.accuracy < XP_CONFIG.poorAttempt.accuracy).length;
  return {
    ...EMPTY_HISTORY,
    recentAvg: recent.length ? recent.reduce((a, b) => a + b.score, 0) / recent.length : 0,
    bestBand: best._max.score ?? 0,
    contentAttempts: attempts,
    poorAttemptsToday,
    skillSessionsToday: todays.length,
    earnedToday,
  };
}

/** A previously processed submission (same client submissionId), if any. */
export async function findSubmittedTest(studentId: string, submissionId: unknown) {
  if (typeof submissionId !== "string" || !submissionId) return null;
  const award = await findAward(studentId, `test:${submissionId}`);
  if (!award?.refId) return null;
  return db.iELTSTest.findUnique({ where: { id: award.refId } }).catch(() => null);
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/** Monday (Tashkent) of the week containing `dayKey`, as the week key. */
export function weekKeyOf(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00+05:00`);
  const weekday = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getTime() - weekday * 86400000);
  return tashkentDateKey(monday);
}

function lastNDayKeys(n: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(tashkentDateKey(new Date(now.getTime() - i * 86400000)));
  return keys;
}

// ---------------------------------------------------------------------------
// The progression snapshot (one per request)
// ---------------------------------------------------------------------------

export interface WeekDay {
  dayKey: string;
  label: string;
  studied: boolean;
  isToday: boolean;
}

export interface StreakView {
  current: number;
  longest: number;
  freezes: number;
  status: ReturnType<typeof streakStatus>;
  nextMilestone: number | null;
  week: WeekDay[];
  studiedThisWeek: number;
}

export interface Progression {
  studentId: string;
  firstName: string;
  totalPoints: number;
  level: LevelInfo;
  targetBand: number;
  profile: SkillSnapshot[];
  insight: string;
  weakest: SkillSnapshot | null;
  mission: DailyMission;
  daily: ChallengeState;
  weekly: ChallengeState;
  recommendation: Recommendation;
  badges: BadgeState[];
  recentBadges: BadgeState[];
  streak: StreakView;
  todayXp: number;
  isNew: boolean;
  /** Reward ledger keys already paid (mission / challenge / badge). */
  paidKeys: string[];
  /** Concrete papers behind the mission / recommendation links (reused by the session outcome). */
  hints: ContentHints;
}

/**
 * Concrete material for mission and recommendation links, from the exam
 * catalog: the next Reading passage and Listening part (mission size), a full
 * paper of each (bigger goals) and a Speaking set — preferring material the
 * student hasn't met, judged by the content keys (answers.testId) of their
 * attempts in that skill. Never throws: when the catalog can't be read, the
 * links fall back to the library pages.
 */
async function contentHints(
  sessions: { row: TestRow }[],
  profile: SkillSnapshot[],
  now: number
): Promise<ContentHints> {
  try {
    const keysOf = (m: SkillKey) =>
      countContentKeys(sessions.filter((s) => s.row.module === m).map((s) => contentKeyOf(s.row.answers)));
    const levelOf = (m: SkillKey) => examLevelForBand(profile.find((p) => p.skill === m)?.recentAvg ?? 0);
    let lastMockAt: number | null = null;
    for (const { row } of sessions) {
      if (asRec(row.answers)?.mock === true) lastMockAt = Math.max(lastMockAt ?? 0, row.completedAt.getTime());
    }
    const [reading, listening, speaking] = await Promise.all([
      listReadingExams().catch(() => []),
      listListeningExams().catch(() => []),
      listSpeakingSets().catch(() => []),
    ]);
    const readingKeys = keysOf("READING");
    const listeningKeys = keysOf("LISTENING");
    return {
      readingPassage: pickPart(reading, readingKeys, { level: levelOf("READING") }),
      readingFull: pickFull(reading, readingKeys, { level: levelOf("READING") }),
      listeningPart: pickPart(listening, listeningKeys, { level: levelOf("LISTENING") }),
      listeningFull: pickFull(listening, listeningKeys, { level: levelOf("LISTENING") }),
      speakingSet: pickSpeakingSet(speaking, keysOf("SPEAKING")),
      mockAvailable: reading.some((t) => t.full) && listening.some((t) => t.full) && speaking.length > 0,
      daysSinceMock: lastMockAt == null ? null : Math.max(0, Math.floor((now - lastMockAt) / 86400000)),
    };
  } catch (e) {
    console.error("contentHints failed:", e);
    return {};
  }
}

/**
 * The full progression picture for the student dashboard. Cached per request
 * so every widget shares one set of queries.
 */
async function computeProgression(studentId: string): Promise<Progression | null> {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      groupId: true,
      totalPoints: true,
      targetBand: true,
      currentStreak: true,
      longestStreak: true,
      streakFreezes: true,
      lastActiveDate: true,
      user: { select: { name: true } },
    },
  });
  if (!student) return null;

  const now = new Date();
  const dayKey = tashkentDateKey(now);
  const dayStart = tashkentDayStart(now);
  const weekKey = weekKeyOf(dayKey);
  const weekStart = new Date(`${weekKey}T00:00:00+05:00`);
  const targetBand = parseTargetBand(student.targetBand);
  const seed = hashString(student.id);

  const [sessions, todayLogs, homeworkToday, homeworkDue, ledger, counts, recentLearningLogs] = await Promise.all([
    loadSessions(studentId),
    db.activityLog.findMany({
      where: { studentId, createdAt: { gte: dayStart } },
      select: { action: true, details: true, points: true },
    }),
    db.homeworkSubmission.count({ where: { studentId, submittedAt: { gte: dayStart } } }),
    student.groupId
      ? db.homework.findFirst({
          where: { groupId: student.groupId, dueDate: { gte: now }, submissions: { none: { studentId } } },
          orderBy: { dueDate: "asc" },
          select: { id: true, title: true, module: true },
        })
      : Promise.resolve(null),
    db.xpTransaction
      .findMany({
        where: {
          studentId,
          OR: [
            { idempotencyKey: { startsWith: "badge:" } },
            { idempotencyKey: { startsWith: "mission:" } },
            { idempotencyKey: { startsWith: "challenge:" } },
            { idempotencyKey: "badges:init" },
          ],
        },
        select: { idempotencyKey: true, createdAt: true },
      })
      .catch(() => [] as { idempotencyKey: string; createdAt: Date }[]),
    db.iELTSTest.groupBy({ by: ["module"], where: { studentId, score: { gt: 0 } }, _count: { _all: true } }),
    db.activityLog.findMany({
      where: {
        studentId,
        createdAt: { gte: new Date(now.getTime() - 8 * 86400000) },
        action: { in: BUDGETED_ACTIONS },
      },
      select: { createdAt: true, action: true, points: true, details: true },
    }),
  ]);

  const facts = sessions.map((s) => s.fact);
  const todayFacts = facts.filter((f) => f.dayKey === dayKey);
  const beforeToday = facts.filter((f) => f.dayKey !== dayKey);
  const profileNow = buildSkillProfile(facts, targetBand, now.getTime());
  const profileMorning = buildSkillProfile(beforeToday, targetBand, dayStart.getTime());
  const hints = await contentHints(sessions, profileNow, now.getTime());

  const srsReviewsToday = todayLogs
    .filter((l) => l.action === "SRS_REVIEW")
    .reduce((a, l) => a + (num(asRec(l.details)?.count) ?? 0), 0);

  const mission = buildDailyMission({
    dayKey,
    profile: profileMorning,
    today: {
      sessions: todayFacts,
      dailyQuizDone: todayLogs.some((l) => l.action === "DAILY_CHALLENGE"),
      srsReviewsToday,
      homeworkSubmittedToday: homeworkToday > 0,
    },
    homeworkDue: homeworkDue ? { id: homeworkDue.id, title: homeworkDue.title, module: String(homeworkDue.module) } : null,
    hints,
    seed,
  });

  const daily = challengeState(pickDailyChallenge(dayKey, seed, mission.focusSkill), "daily", dayKey, todayFacts);
  const weekly = challengeState(
    pickWeeklyChallenge(weekKey),
    "weekly",
    weekKey,
    facts.filter((f) => f.at >= weekStart.getTime())
  );

  const recommendation = recommendNext(profileNow, targetBand, { hints });

  // Badges
  const unlocked = new Map<string, number>();
  let missionsCompleted = 0;
  let weeklyDone = 0;
  for (const l of ledger) {
    if (l.idempotencyKey.startsWith("badge:")) unlocked.set(l.idempotencyKey.slice(6), l.createdAt.getTime());
    else if (l.idempotencyKey.startsWith("mission:")) missionsCompleted++;
    else if (l.idempotencyKey.startsWith("challenge:weekly:")) weeklyDone++;
  }
  const countOf = (m: SkillKey) => counts.find((c) => c.module === m)?._count._all ?? 0;
  const level = getLevelInfo(student.totalPoints);
  const snapshot: BadgeSnapshot = {
    reading_tests: countOf("READING"),
    reading_best_accuracy: profileNow.find((p) => p.skill === "READING")?.bestAccuracy ?? 0,
    listening_tests: countOf("LISTENING"),
    listening_perfect: facts.some((f) => f.skill === "LISTENING" && f.accuracy === 1) ? 1 : 0,
    writing_essays: countOf("WRITING"),
    writing_good_essays: facts.filter((f) => f.skill === "WRITING" && f.band >= 6.5).length,
    speaking_sessions: countOf("SPEAKING"),
    speaking_minutes: Math.floor(facts.filter((f) => f.skill === "SPEAKING").reduce((a, f) => a + (f.seconds ?? 0), 0) / 60),
    longest_streak: student.longestStreak,
    level: level.level,
    missions_completed: missionsCompleted,
    weekly_challenges: weeklyDone,
    all_skills: SKILLS.filter((s) => countOf(s) > 0).length,
  };
  const badges = evaluateBadges(snapshot, unlocked);
  const recentBadges = badges
    .filter((b) => b.unlockedAt != null)
    .sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0))
    .slice(0, 4);

  // Streak + week strip (days with meaningful, XP-earning learning)
  // A day counts exactly when it would count for the streak: an XP-earning
  // test / homework / daily challenge, or a real flashcard session.
  const studiedDays = new Set<string>();
  const srsPerDay = new Map<string, number>();
  for (const l of recentLearningLogs) {
    const k = tashkentDateKey(l.createdAt);
    if (l.action === "SRS_REVIEW") srsPerDay.set(k, (srsPerDay.get(k) ?? 0) + (num(asRec(l.details)?.count) ?? 0));
    else if (l.points > 0) studiedDays.add(k);
  }
  for (const [k, n] of srsPerDay) if (n >= STREAK_CONFIG.srsMinReviewsPerDay) studiedDays.add(k);
  const week: WeekDay[] = lastNDayKeys(7, now).map((k) => ({
    dayKey: k,
    label: new Date(`${k}T12:00:00+05:00`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "Asia/Tashkent" }),
    studied: studiedDays.has(k),
    isToday: k === dayKey,
  }));
  const gap = tashkentDayDiff(now, new Date(student.lastActiveDate));
  const status = streakStatus(student.currentStreak, gap, student.streakFreezes ?? 0);

  const todayXp = todayLogs.filter((l) => l.points > 0).reduce((a, l) => a + l.points, 0);

  return {
    studentId,
    firstName: (student.user.name ?? "there").split(" ")[0],
    totalPoints: student.totalPoints,
    level,
    targetBand,
    profile: profileNow,
    insight: skillInsight(profileNow),
    weakest: weakestSkill(profileNow),
    mission,
    daily,
    weekly,
    recommendation,
    badges,
    recentBadges,
    streak: {
      current: status === "broken" ? 0 : student.currentStreak,
      longest: student.longestStreak,
      freezes: student.streakFreezes ?? 0,
      status,
      nextMilestone: nextStreakMilestone(student.currentStreak),
      week,
      studiedThisWeek: week.filter((d) => d.studied).length,
    },
    todayXp,
    isNew: facts.length === 0,
    paidKeys: ledger.map((l) => l.idempotencyKey),
    hints,
  };
}

/**
 * Request-cached progression — every widget shares one computation. Any reward
 * the evidence already supports is settled first (idempotent), and the picture
 * is only recomputed when something was actually paid.
 */
export const getProgression = cache(async (studentId: string): Promise<Progression | null> => {
  const p = await computeProgression(studentId);
  if (!p) return null;
  const paid = await settleFrom(studentId, p);
  return paid.length ? computeProgression(studentId) : p;
});

// ---------------------------------------------------------------------------
// Settling earned rewards (idempotent — safe to call after every event)
// ---------------------------------------------------------------------------

export interface SettledReward {
  kind: "mission" | "challenge" | "badge";
  title: string;
  xp: number;
}

/**
 * Pay every reward the evidence now supports and hasn't been paid yet: the
 * Daily Mission bonus, daily/weekly challenge rewards and milestone badges.
 * Deterministic ledger keys make this safe to call repeatedly (and
 * concurrently). Reward XP never advances the streak. Never throws.
 */
export async function settleProgression(studentId: string): Promise<SettledReward[]> {
  try {
    const p = await computeProgression(studentId);
    return p ? await settleFrom(studentId, p) : [];
  } catch (e) {
    console.error("settleProgression failed:", e);
    return [];
  }
}

/**
 * True when the student has learning history from before their first XP-ledger
 * entry (i.e. they studied before the Progression Engine shipped). A new
 * student's first test and its ledger row are written in the same transaction,
 * so they are never "legacy".
 */
async function isLegacyStudent(studentId: string): Promise<boolean> {
  const [firstLedger, firstTest] = await Promise.all([
    db.xpTransaction.findFirst({ where: { studentId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }).catch(() => null),
    db.iELTSTest.aggregate({ where: { studentId }, _min: { completedAt: true } }),
  ]);
  const oldest = firstTest._min.completedAt;
  if (!oldest) return false;
  if (!firstLedger) return true;
  return oldest.getTime() < firstLedger.createdAt.getTime() - 60_000;
}

async function settleFrom(studentId: string, p: Progression): Promise<SettledReward[]> {
  const out: SettledReward[] = [];
  const paid = new Set(p.paidKeys);
  try {
    const pay = async (
      key: string,
      amount: number,
      source: "mission" | "challenge" | "achievement",
      activity: string,
      title: string,
      kind: SettledReward["kind"]
    ) => {
      if (paid.has(key)) return;
      const r = await awardXp({
        studentId,
        amount,
        source,
        idempotencyKey: key,
        activity,
        breakdown: { lines: [{ label: title, amount }] },
        details: { title },
        countsTowardStreak: false,
      });
      if (r.applied) out.push({ kind, title, xp: amount });
    };

    if (p.mission.allDone) {
      await pay(`mission:${p.mission.dayKey}`, MISSION_CONFIG.completionBonus, "mission", "MISSION", "Daily Mission complete", "mission");
    }
    for (const c of [p.daily, p.weekly]) {
      if (c.done) await pay(c.rewardKey, c.def.xp, "challenge", "CHALLENGE", `${c.scope === "daily" ? "Daily" : "Weekly"} challenge: ${c.def.title}`, "challenge");
    }
    // Existing students: badges their PRE-engine history already supports are
    // recorded as unlocked (so they display) but pay no XP — otherwise the
    // first page load would hand out hundreds of retroactive XP and reshuffle
    // the leaderboard. Only badges earned from new learning pay XP.
    if (!paid.has("badges:init")) {
      const legacy = await isLegacyStudent(studentId);
      if (legacy) {
        for (const b of p.badges) {
          if (b.earned && b.unlockedAt == null) {
            await awardXp({ studentId, amount: 0, source: "achievement", idempotencyKey: b.rewardKey, activity: "BADGE", countsTowardStreak: false });
            paid.add(b.rewardKey);
          }
        }
      }
      await awardXp({ studentId, amount: 0, source: "achievement", idempotencyKey: "badges:init", activity: "BADGE", countsTowardStreak: false });
    }
    for (const b of p.badges) {
      if (b.earned && b.unlockedAt == null) {
        await pay(b.rewardKey, b.def.xp, "achievement", "BADGE", `Badge unlocked: ${b.def.name}`, "badge");
      }
    }

    if (out.length) {
      const owner = await db.student.findUnique({ where: { id: studentId }, select: { userId: true } });
      if (owner) {
        // Calm, not noisy: several rewards at once become ONE notification.
        if (out.length > 2) {
          const total = out.reduce((a, r) => a + r.xp, 0);
          await notifyUser(owner.userId, {
            type: "system",
            title: `${out.length} milestones reached`,
            message: `${out.map((r) => r.title.replace(/^Badge unlocked: /, "")).slice(0, 4).join(", ")}${out.length > 4 ? "…" : ""}${total > 0 ? ` · +${total} XP` : ""}`,
            link: "/progress/achievements",
          });
        } else {
          for (const r of out) {
            await notifyUser(owner.userId, {
              type: "system",
              title: r.kind === "badge" ? "New badge" : r.kind === "mission" ? "Mission complete" : "Challenge complete",
              message: r.xp > 0 ? `${r.title} · +${r.xp} XP` : r.title,
              link: r.kind === "badge" ? "/progress/achievements" : "/dashboard",
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("settleProgression failed:", e);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Session outcome — "what improved, what's next"
// ---------------------------------------------------------------------------

export interface SessionOutcome {
  skill: SkillKey;
  skillLabel: string;
  band: number;
  accuracy: number | null;
  /** Recent average before vs including this attempt. */
  before: number | null;
  after: number;
  beforeAccuracy: number | null;
  afterAccuracy: number | null;
  personalBest: boolean;
  previousBest: number | null;
  xp: number | null;
  xpLines: XpLine[];
  xpNotes: string[];
  levelBefore: LevelInfo;
  levelAfter: LevelInfo;
  streak: number;
  mission: { completed: number; total: number; allDone: boolean; nextTitle: string | null };
  next: Recommendation;
  headline: string;
}

export async function buildSessionOutcome(studentId: string, testId: string): Promise<SessionOutcome | null> {
  try {
    const test = await db.iELTSTest.findFirst({ where: { id: testId, studentId }, select: TEST_SELECT });
    if (!test) return null;
    const row = test as TestRow;
    const fact = toSessionFact(row);
    const skill = fact.skill;

    const [previous, bestBefore, ledger, p] = await Promise.all([
      db.iELTSTest.findMany({
        where: { studentId, module: row.module, score: { gt: 0 }, completedAt: { lt: row.completedAt } },
        orderBy: { completedAt: "desc" },
        take: 3,
        select: TEST_SELECT,
      }),
      // All-time best before this attempt — the same rule the XP bonus uses.
      db.iELTSTest.aggregate({
        where: { studentId, module: row.module, completedAt: { lt: row.completedAt } },
        _max: { score: true },
      }),
      db.xpTransaction.findFirst({ where: { studentId, refId: testId } }).catch(() => null),
      getProgression(studentId),
    ]);
    if (!p) return null;
    const prevFacts = previous.map((r) => toSessionFact(r as TestRow));
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

    const before = round1(avg(prevFacts.slice(0, 3).map((f) => f.band)));
    const after = round1(avg([fact.band, ...prevFacts.slice(0, 2).map((f) => f.band)])) ?? fact.band;
    const accPrev = prevFacts.slice(0, 3).map((f) => f.accuracy).filter((a): a is number => a != null);
    const beforeAccuracy = accPrev.length ? Math.round((avg(accPrev) ?? 0) * 100) : null;
    const accAfter = [fact.accuracy, ...prevFacts.slice(0, 2).map((f) => f.accuracy)].filter((a): a is number => a != null);
    const afterAccuracy = fact.accuracy != null && accAfter.length ? Math.round((avg(accAfter) ?? 0) * 100) : null;
    const previousBest = bestBefore._max.score != null && bestBefore._max.score > 0 ? bestBefore._max.score : null;
    const personalBest = previousBest != null && fact.band > previousBest;

    const xp = ledger ? ledger.amount : null;
    const bd = asRec(ledger?.breakdown);
    const xpLines = Array.isArray(bd?.lines) ? (bd!.lines as XpLine[]) : [];
    const xpNotes = Array.isArray(bd?.notes) ? (bd!.notes as string[]) : [];

    // XP total just before this attempt = today's total minus everything the
    // ledger recorded from this attempt onward (correct on revisits, and not
    // confused by rewards settled in the same request).
    let pointsBefore = Math.max(0, p.totalPoints - (xp ?? 0));
    if (ledger) {
      const since = await db.xpTransaction
        .aggregate({ where: { studentId, createdAt: { gte: ledger.createdAt } }, _sum: { amount: true } })
        .catch(() => null);
      if (since?._sum.amount != null) pointsBefore = Math.max(0, p.totalPoints - since._sum.amount);
    }
    const levelBefore = getLevelInfo(pointsBefore);
    const levelAfter = getLevelInfo(pointsBefore + (xp ?? 0));
    const next = recommendNext(p.profile, p.targetBand, { justCompleted: skill, hints: p.hints });

    const label = SKILL_LABEL[skill];
    let headline = "Result saved.";
    if (personalBest) headline = `New personal best in ${label}.`;
    else if (before != null && after > before) headline = `Your ${label} is improving.`;
    else if (before == null) headline = `First ${label} result recorded — your baseline is set.`;
    else headline = "Solid practice — every attempt sharpens the next one.";

    return {
      skill,
      skillLabel: label,
      band: fact.band,
      accuracy: fact.accuracy != null ? Math.round(fact.accuracy * 100) : null,
      before,
      after,
      beforeAccuracy,
      afterAccuracy,
      personalBest,
      previousBest,
      xp,
      xpLines,
      xpNotes,
      levelBefore,
      levelAfter,
      streak: p.streak.current,
      mission: {
        completed: p.mission.completed,
        total: p.mission.total,
        allDone: p.mission.allDone,
        nextTitle: p.mission.nextStep?.title ?? null,
      },
      next,
      headline,
    };
  } catch (e) {
    console.error("buildSessionOutcome failed:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Activity history
// ---------------------------------------------------------------------------

export interface HistoryItem {
  id: string;
  title: string;
  detail: string | null;
  xp: number;
  at: number;
}
export interface HistoryDay {
  dayKey: string;
  label: string;
  items: HistoryItem[];
  xp: number;
}

const ACTION_TITLE: Record<string, string> = {
  HOMEWORK_SUBMITTED: "Homework submitted",
  DAILY_CHALLENGE: "Daily 5-question challenge",
  SRS_REVIEW: "Flashcard review",
  ACHIEVEMENT_UNLOCKED: "Achievement unlocked",
  MISSION_COMPLETED: "Daily Mission complete",
  CHALLENGE_COMPLETED: "Challenge complete",
  SPEAKING_SESSION_COMPLETED: "Speaking session",
  COMMITMENT_SUCCEEDED: "Weekly commitment met",
  BONUS_POINTS: "Teacher bonus",
  REWARD_REDEEMED: "Reward redeemed",
  REWARD_REFUNDED: "Reward refunded",
  COMMITMENT_STAKED: "Commitment stake",
  GRADE_ADJUSTED: "Homework grade adjusted",
};

/** Meaningful activity grouped by Tashkent day (newest first). */
export async function getActivityHistory(studentId: string, days = 7): Promise<HistoryDay[]> {
  const since = new Date(Date.now() - days * 86400000);
  const logs = await db.activityLog.findMany({
    where: { studentId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, action: true, details: true, points: true, createdAt: true },
  });
  const today = tashkentDateKey();
  const yesterday = tashkentDateKey(new Date(Date.now() - 86400000));
  const byDay = new Map<string, HistoryDay>();
  for (const l of logs) {
    const d = asRec(l.details) ?? {};
    if (l.action === "IELTS_TEST_COMPLETED" && l.points === 0 && d.module == null) continue;
    let title = ACTION_TITLE[l.action] ?? l.action.toLowerCase().replace(/_/g, " ");
    let detail: string | null = null;
    if (l.action === "IELTS_TEST_COMPLETED") {
      const m = String(d.module ?? "");
      title = `${SKILL_LABEL[m as SkillKey] ?? "IELTS"} ${d.mock ? "mock section" : m === "WRITING" ? "essay" : m === "SPEAKING" ? "practice" : "test"}`;
      const acc = num(d.accuracy);
      const score = num(d.score);
      detail = acc != null ? `${acc}% accuracy` : score != null ? `Band ${score.toFixed(1)}` : null;
    } else if (typeof d.title === "string") {
      title = d.title;
    } else if (l.action === "SRS_REVIEW" && num(d.count)) {
      detail = `${num(d.count)} cards`;
    } else if (l.action === "DAILY_CHALLENGE" && num(d.score) != null) {
      detail = `${num(d.score)}/${XP_CONFIG.dailyQuiz.questions} correct`;
    }
    const key = tashkentDateKey(l.createdAt);
    const label = key === today ? "Today" : key === yesterday ? "Yesterday" : new Date(`${key}T12:00:00+05:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "Asia/Tashkent" });
    const day = byDay.get(key) ?? { dayKey: key, label, items: [], xp: 0 };
    day.items.push({ id: l.id, title, detail, xp: l.points, at: l.createdAt.getTime() });
    if (l.points > 0) day.xp += l.points;
    byDay.set(key, day);
  }
  return Array.from(byDay.values());
}

