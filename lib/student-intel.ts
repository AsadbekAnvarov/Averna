import { db } from "@/lib/db";
import { cache } from "react";
import { predictBand } from "@/lib/utils";

/**
 * Student "companion" intelligence (read-only).
 *
 * - getExamReadiness (F3 AI Clone): per-skill predicted exam band + an "if your
 *   exam were tomorrow…" verdict and personalised recommendations.
 * - getMemoryTimeline (F1): a forgetting-curve estimate per skill — retention %,
 *   memory strength and the recommended next review.
 *
 * All derived from data already stored (IELTSTest module/score/completedAt).
 * Reuses the existing predictBand() so numbers stay consistent with the rest of
 * the dashboard. Student UI is English.
 */

const DAY = 86_400_000;

const MODULES = [
  { key: "READING", label: "Reading" },
  { key: "LISTENING", label: "Listening" },
  { key: "WRITING", label: "Writing" },
  { key: "SPEAKING", label: "Speaking" },
] as const;

type ModuleKey = (typeof MODULES)[number]["key"];

/**
 * Single source of truth for a student's IELTS test history.
 *
 * Wrapped in React.cache so that no matter how many dashboard widgets / lib
 * helpers ask for it during one server render, the DB is hit exactly ONCE per
 * request. Selects the lightweight superset ({id, module, score, completedAt})
 * every consumer needs — heavier fields (answers/aiAnalysis) stay out so the
 * shared payload is tiny. Ordered ascending by completedAt; consumers that need
 * newest-first should reverse locally.
 */
export const getStudentTests = cache(async (studentId: string) =>
  db.iELTSTest.findMany({
    where: { studentId },
    orderBy: { completedAt: "asc" },
    select: { id: true, module: true, score: true, completedAt: true },
  })
);

// ---------------- F3 — AI Clone / Exam Readiness ----------------
export interface SkillPrediction {
  key: ModuleKey;
  label: string;
  predicted: number | null;
  current: number | null;
  trend: "up" | "down" | "flat" | null;
  sampleSize: number;
}

export interface ExamReadiness {
  overall: number | null;
  confidence: string | null;
  perSkill: SkillPrediction[];
  weakest: SkillPrediction | null;
  narrative: string;
  recommendations: string[];
}

export const getExamReadiness = cache(async function getExamReadiness(studentId: string): Promise<ExamReadiness> {
  const tests = await getStudentTests(studentId);

  const perSkill: SkillPrediction[] = MODULES.map((m) => {
    const scores = tests.filter((t) => t.module === m.key).map((t) => t.score).filter((s) => s > 0);
    const p = predictBand(scores);
    return {
      key: m.key,
      label: m.label,
      predicted: p ? p.predicted : null,
      current: p ? p.current : null,
      trend: p ? p.trend : null,
      sampleSize: scores.length,
    };
  });

  const allScores = tests.map((t) => t.score).filter((s) => s > 0);
  const overallP = predictBand(allScores);

  const withData = perSkill.filter((s) => s.predicted != null);
  const weakest = withData.length
    ? withData.reduce((lo, s) => (s.predicted! < lo.predicted! ? s : lo))
    : null;

  let narrative = "Take a test in each skill and your AI clone will predict your exam bands.";
  if (withData.length && weakest) {
    const strong = withData.reduce((hi, s) => (s.predicted! > hi.predicted! ? s : hi));
    narrative =
      `If your exam were tomorrow, ${strong.label} would likely score around Band ${strong.predicted!.toFixed(1)}, ` +
      `while ${weakest.label} may stay near Band ${weakest.predicted!.toFixed(1)} — that's where focus pays off fastest.`;
  }

  const recommendations: string[] = [];
  if (weakest) recommendations.push(`Prioritise ${weakest.label} — it's your lowest predicted band right now.`);
  const up = withData.filter((s) => s.trend === "up").map((s) => s.label);
  if (up.length) recommendations.push(`Keep the momentum in ${up.join(" & ")} — you're trending up.`);
  const noData = perSkill.filter((s) => s.sampleSize === 0).map((s) => s.label);
  if (noData.length) recommendations.push(`No data yet for ${noData.join(", ")} — take one test so your clone can read it.`);

  return {
    overall: overallP ? overallP.predicted : null,
    confidence: overallP ? overallP.confidence : null,
    perSkill,
    weakest,
    narrative,
    recommendations,
  };
});

// ---------------- F1 — Memory Timeline ----------------
export type MemoryStatus = "mastered" | "strong" | "fading" | "forgotten";

export interface MemoryEntry {
  key: ModuleKey;
  label: string;
  sessions: number;
  firstDaysAgo: number;
  lastDaysAgo: number;
  avgBand: number;
  retention: number; // 0-100
  strengthDays: number;
  nextReviewDays: number; // 0 = review now
  status: MemoryStatus;
}

export async function getMemoryTimeline(studentId: string): Promise<MemoryEntry[]> {
  const tests = await getStudentTests(studentId);
  const now = Date.now();

  const entries: MemoryEntry[] = [];
  for (const m of MODULES) {
    const rows = tests.filter((t) => t.module === m.key);
    if (rows.length === 0) continue;

    const times = rows.map((r) => r.completedAt.getTime());
    const firstDaysAgo = Math.floor((now - Math.min(...times)) / DAY);
    const lastDaysAgo = Math.floor((now - Math.max(...times)) / DAY);
    const sessions = rows.length;
    const avgBand = rows.reduce((a, b) => a + b.score, 0) / rows.length;

    // Memory strength (stability, in days) grows with repetition & mastery.
    const strengthDays = 3 * (1 + Math.log2(sessions + 1)) * (0.6 + 0.4 * (avgBand / 9));
    const retention = Math.exp(-lastDaysAgo / strengthDays); // 0-1
    // Days from last study until retention decays to 0.7; minus time already elapsed.
    const nextReviewDays = Math.max(0, Math.round(-strengthDays * Math.log(0.7) - lastDaysAgo));

    let status: MemoryStatus;
    if (retention > 0.85 && sessions >= 3) status = "mastered";
    else if (retention > 0.6) status = "strong";
    else if (retention > 0.35) status = "fading";
    else status = "forgotten";

    entries.push({
      key: m.key,
      label: m.label,
      sessions,
      firstDaysAgo,
      lastDaysAgo,
      avgBand: Math.round(avgBand * 10) / 10,
      retention: Math.round(retention * 100),
      strengthDays: Math.round(strengthDays),
      nextReviewDays,
      status,
    });
  }

  // Most urgent (lowest retention) first.
  return entries.sort((a, b) => a.retention - b.retention);
}



// ---------------- Learning Verification lifecycle (Phase 3b) ----------------
// Evidence-based mastery: a skill advances stages only with repeated, spaced,
// genuine test evidence (not one lucky result), and slips back if it starts to
// be forgotten. Derived from the shared test history — no schema, no writes.
export type SkillStage = "locked" | "learning" | "practicing" | "verified" | "mastered" | "retained";

const STAGE_ORDER: SkillStage[] = ["locked", "learning", "practicing", "verified", "mastered", "retained"];
const STAGE_LABEL: Record<SkillStage, string> = {
  locked: "Not started",
  learning: "Learning",
  practicing: "Practicing",
  verified: "Verified",
  mastered: "Mastered",
  retained: "Retained",
};
const STAGE_MASTERY: Record<SkillStage, number> = {
  locked: 0, learning: 25, practicing: 45, verified: 65, mastered: 88, retained: 100,
};

export interface SkillStageInfo {
  key: ModuleKey;
  label: string;
  stage: SkillStage;
  stageLabel: string;
  mastery: number; // 0-100, derived from the stage
  sessions: number;
  distinctDays: number;
  bestBand: number;
  recentAvg: number;
  retention: number; // 0-100
}

export async function getSkillStages(studentId: string): Promise<SkillStageInfo[]> {
  const tests = await getStudentTests(studentId);
  const now = Date.now();

  return MODULES.map((m) => {
    const rows = tests.filter((t) => t.module === m.key && t.score > 0);
    if (rows.length === 0) {
      return { key: m.key, label: m.label, stage: "locked" as SkillStage, stageLabel: STAGE_LABEL.locked, mastery: 0, sessions: 0, distinctDays: 0, bestBand: 0, recentAvg: 0, retention: 0 };
    }

    const scores = rows.map((r) => r.score);
    const sessions = rows.length;
    const bestBand = Math.max(...scores);
    const recent = rows.slice(-3);
    const recentAvg = recent.reduce((a, b) => a + b.score, 0) / recent.length;
    const distinctDays = new Set(rows.map((r) => r.completedAt.toISOString().slice(0, 10))).size;
    const times = rows.map((r) => r.completedAt.getTime());
    const lastDaysAgo = Math.floor((now - Math.max(...times)) / DAY);
    const spanDays = Math.floor((Math.max(...times) - Math.min(...times)) / DAY);

    // Light forgetting curve (same shape as the Memory Timeline).
    const strengthDays = 3 * (1 + Math.log2(sessions + 1)) * (0.6 + 0.4 * (recentAvg / 9));
    const retention = Math.exp(-lastDaysAgo / strengthDays); // 0-1

    // Evidence ladder.
    let idx = 1; // learning
    if (sessions >= 3) idx = Math.max(idx, 2); // practicing
    if (sessions >= 2 && bestBand >= 6) idx = Math.max(idx, 3); // verified
    if (sessions >= 4 && distinctDays >= 3 && recentAvg >= 6.5) idx = Math.max(idx, 4); // mastered
    if (idx >= 4 && spanDays >= 21 && retention >= 0.8 && lastDaysAgo <= 30) idx = 5; // retained
    // Forgetting decay: can't claim verified+ once retention has collapsed.
    if (retention < 0.4) idx = Math.min(idx, 2);

    const stage = STAGE_ORDER[idx];
    return {
      key: m.key,
      label: m.label,
      stage,
      stageLabel: STAGE_LABEL[stage],
      mastery: STAGE_MASTERY[stage],
      sessions,
      distinctDays,
      bestBand: Math.round(bestBand * 10) / 10,
      recentAvg: Math.round(recentAvg * 10) / 10,
      retention: Math.round(retention * 100),
    };
  });
}

// ---------------- F2 — Knowledge Galaxy ----------------
export interface GalaxyPlanet {
  key: ModuleKey;
  label: string;
  href: string;
  tests: number;
  avgBand: number;
  mastery: number; // 0-100 (now evidence-based, from the verification stage)
  locked: boolean;
  stage: SkillStage;
  stageLabel: string;
}

const MODULE_HREF: Record<ModuleKey, string> = {
  READING: "/learning/reading",
  LISTENING: "/learning/listening",
  WRITING: "/learning/writing",
  SPEAKING: "/learning/speaking",
};

export async function getGalaxy(studentId: string): Promise<GalaxyPlanet[]> {
  const stages = await getSkillStages(studentId);
  return stages.map((s) => ({
    key: s.key,
    label: s.label,
    href: MODULE_HREF[s.key],
    tests: s.sessions,
    avgBand: s.recentAvg,
    mastery: s.mastery,
    locked: s.stage === "locked",
    stage: s.stage,
    stageLabel: s.stageLabel,
  }));
}

// ---------------- F10 — Monthly Recap ("Wrapped") ----------------
export interface MonthlyRecap {
  monthLabel: string;
  tests: number;
  activeDays: number;
  points: number;
  achievements: number;
  thisAvg: number | null;
  bandDelta: number | null;
  topModule: string | null;
  hasData: boolean;
}

export async function getMonthlyRecap(studentId: string): Promise<MonthlyRecap> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [tests, activity, achievements] = await Promise.all([
    getStudentTests(studentId),
    db.activityLog.findMany({
      where: { studentId, createdAt: { gte: startOfMonth } },
      select: { createdAt: true, points: true },
    }),
    db.studentAchievement.count({ where: { studentId, unlockedAt: { gte: startOfMonth } } }),
  ]);

  const thisMonth = tests.filter((t) => t.completedAt >= startOfMonth);
  const prevMonth = tests.filter((t) => t.completedAt >= startOfPrev && t.completedAt < startOfMonth);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const thisAvg = avg(thisMonth.map((t) => t.score));
  const prevAvg = avg(prevMonth.map((t) => t.score));
  const bandDelta = thisAvg != null && prevAvg != null ? Math.round((thisAvg - prevAvg) * 10) / 10 : null;

  const days = new Set(activity.map((a) => new Date(a.createdAt).toISOString().slice(0, 10)));
  const points = activity.reduce((s, a) => s + (a.points || 0), 0);

  // top module this month
  const modCount = new Map<string, number>();
  for (const t of thisMonth) modCount.set(t.module, (modCount.get(t.module) ?? 0) + 1);
  let topModule: string | null = null;
  let topN = 0;
  const LABEL: Record<string, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };
  for (const [mod, n] of modCount) if (n > topN) { topN = n; topModule = LABEL[mod] ?? mod; }

  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(startOfMonth);

  return {
    monthLabel,
    tests: thisMonth.length,
    activeDays: days.size,
    points,
    achievements,
    thisAvg: thisAvg != null ? Math.round(thisAvg * 10) / 10 : null,
    bandDelta,
    topModule,
    hasData: thisMonth.length > 0 || activity.length > 0,
  };
}



// ---------------- F6 — Graduation ----------------
export interface Graduation {
  reached: boolean;
  current: number | null;
  target: number | null;
  toGo: number | null;
  tests: number;
  achievements: number;
  bandDelta: number | null;
  firstBand: number | null;
}

export async function getGraduation(studentId: string, targetBand?: string | null): Promise<Graduation> {
  const [tests, achievements] = await Promise.all([
    getStudentTests(studentId),
    db.studentAchievement.count({ where: { studentId } }),
  ]);
  const scores = tests.map((t) => t.score).filter((s) => s > 0);
  const p = predictBand(scores);
  const current = p ? p.current : null;
  const target = targetBand ? parseFloat(targetBand.replace(/[^0-9.]/g, "")) || null : null;
  const firstBand = scores.length ? Math.round(scores[0] * 10) / 10 : null;
  const bandDelta = current != null && firstBand != null ? Math.round((current - firstBand) * 10) / 10 : null;
  const reached = current != null && target != null && current >= target;
  const toGo = current != null && target != null && !reached ? Math.round((target - current) * 10) / 10 : null;

  return { reached, current, target, toGo, tests: tests.length, achievements, bandDelta, firstBand };
}
