import { db } from "@/lib/db";
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

// ---------------- F3 — AI Clone / Exam Readiness ----------------
export interface SkillPrediction {
  key: ModuleKey;
  label: string;
  predicted: number | null;
  current: number | null;
  trend: "up" | "down" | "steady" | null;
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

export async function getExamReadiness(studentId: string): Promise<ExamReadiness> {
  const tests = await db.iELTSTest.findMany({
    where: { studentId },
    orderBy: { completedAt: "asc" },
    select: { module: true, score: true },
  });

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
}

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
  const tests = await db.iELTSTest.findMany({
    where: { studentId },
    select: { module: true, score: true, completedAt: true },
  });
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
