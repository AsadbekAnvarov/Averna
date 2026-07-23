import { db } from "@/lib/db";

/**
 * Mission Control — Phase 2 analytics (read-only).
 *
 * Prediction engine (M7), teacher intelligence (M10) and feature heatmap (M6).
 * Everything is derived from data that already exists and involves no writes and
 * no schema changes. Projections are honest, simple trend extrapolations shown
 * with a confidence estimate — never presented as certainty. Uzbek UI strings.
 */

const DAY = 86_400_000;

// ---------- shared: simple least-squares linear fit ----------
function linfit(y: number[]): { slope: number; intercept: number; r2: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, r2: 0 };
  const xs = y.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (y[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : Math.max(0, Math.min(1, (sxy * sxy) / (sxx * syy)));
  return { slope, intercept, r2 };
}

/** Bucket dated items into 8 rolling weekly counts, oldest → newest. */
function weeklyBuckets(dates: Date[], now = Date.now()): number[] {
  const buckets = new Array(8).fill(0);
  for (const d of dates) {
    const age = now - new Date(d).getTime();
    const wk = Math.floor(age / (7 * DAY));
    if (wk >= 0 && wk < 8) buckets[7 - wk] += 1;
  }
  return buckets;
}

function weeklySum(items: { date: Date; value: number }[], now = Date.now()): number[] {
  const buckets = new Array(8).fill(0);
  for (const it of items) {
    const age = now - new Date(it.date).getTime();
    const wk = Math.floor(age / (7 * DAY));
    if (wk >= 0 && wk < 8) buckets[7 - wk] += it.value;
  }
  return buckets;
}

// ==================== M7 — Prediction Engine ====================
export interface Prediction {
  id: string;
  label: string;
  unit: string;
  current: number;
  predicted: number;
  trendPct: number | null;
  confidence: number;
  series: number[];
}

function project(id: string, label: string, unit: string, series: number[]): Prediction {
  const { slope, intercept, r2 } = linfit(series);
  const n = series.length;
  const predictedRaw = intercept + slope * n;
  const predicted = Math.max(0, Math.round(predictedRaw));
  const current = series[n - 1] ?? 0;
  const trendPct = current === 0 ? (predicted > 0 ? 100 : null) : Math.round(((predicted - current) / current) * 100);
  const nonZero = series.filter((v) => v > 0).length;
  const confidence = nonZero >= 4 ? Math.max(50, Math.min(92, Math.round(50 + r2 * 42))) : 55;
  return { id, label, unit, current, predicted, trendPct, confidence, series };
}

export async function getPredictions(): Promise<Prediction[]> {
  const since = new Date(Date.now() - 56 * DAY);

  const [students, tests, payments] = await Promise.all([
    db.student.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.iELTSTest.findMany({ where: { completedAt: { gte: since } }, select: { completedAt: true } }),
    db.payment.findMany({ where: { status: "COMPLETED", createdAt: { gte: since } }, select: { amount: true, createdAt: true } }),
  ]);

  return [
    project("students", "Yangi oʻquvchilar", "hafta", weeklyBuckets(students.map((s) => s.createdAt))),
    project("tests", "Topshirilgan testlar", "hafta", weeklyBuckets(tests.map((t) => t.completedAt))),
    project(
      "revenue",
      "Daromad (ball)",
      "hafta",
      weeklySum(payments.map((p) => ({ date: p.createdAt, value: p.amount }))),
    ),
  ];
}

// ==================== M10 — Teacher Intelligence ====================
export interface TeacherInsight {
  id: string;
  name: string;
  band: number | null;
  students: number;
  reviewed: number;
  pending: number;
  avgReviewHrs: number | null;
  avgFeedbackLen: number;
  avgRating: number | null;
  flags: string[];
}

export async function getTeacherIntelligence(): Promise<TeacherInsight[]> {
  const since = new Date(Date.now() - 60 * DAY);

  const [teachers, graded, pendingSubs, ratings] = await Promise.all([
    db.teacher.findMany({
      select: { id: true, ieltsBand: true, user: { select: { name: true } }, groups: { select: { students: { select: { id: true } } } } },
    }),
    db.homeworkSubmission.findMany({
      where: { gradedAt: { gte: since, not: null }, gradedBy: { not: null } },
      select: { gradedBy: true, submittedAt: true, gradedAt: true, feedback: true },
    }),
    db.homeworkSubmission.findMany({
      where: { status: "SUBMITTED" },
      select: { homework: { select: { teacherId: true } } },
    }),
    db.speakingSession.findMany({
      where: { rating: { not: null }, teacherId: { not: null } },
      select: { teacherId: true, rating: true },
    }),
  ]);

  const byTeacher = new Map<string, { hrs: number[]; fbLen: number[]; reviewed: number }>();
  for (const g of graded) {
    if (!g.gradedBy || !g.gradedAt) continue;
    const agg = byTeacher.get(g.gradedBy) ?? { hrs: [], fbLen: [], reviewed: 0 };
    agg.reviewed += 1;
    agg.hrs.push((new Date(g.gradedAt).getTime() - new Date(g.submittedAt).getTime()) / 3_600_000);
    agg.fbLen.push(g.feedback?.length ?? 0);
    byTeacher.set(g.gradedBy, agg);
  }

  const pendingByTeacher = new Map<string, number>();
  for (const s of pendingSubs) {
    const tid = s.homework?.teacherId;
    if (tid) pendingByTeacher.set(tid, (pendingByTeacher.get(tid) ?? 0) + 1);
  }

  const ratingByTeacher = new Map<string, number[]>();
  for (const r of ratings) {
    if (!r.teacherId || r.rating == null) continue;
    const arr = ratingByTeacher.get(r.teacherId) ?? [];
    arr.push(r.rating);
    ratingByTeacher.set(r.teacherId, arr);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const insights: TeacherInsight[] = teachers.map((t) => {
    const agg = byTeacher.get(t.id);
    const students = t.groups.reduce((s, g) => s + g.students.length, 0);
    const avgReviewHrs = agg && agg.hrs.length ? Math.round((avg(agg.hrs) as number) * 10) / 10 : null;
    const avgFeedbackLen = agg && agg.fbLen.length ? Math.round(avg(agg.fbLen) as number) : 0;
    const ratingArr = ratingByTeacher.get(t.id) ?? [];
    const avgRating = ratingArr.length ? Math.round((avg(ratingArr) as number) * 10) / 10 : null;
    const pending = pendingByTeacher.get(t.id) ?? 0;
    const reviewed = agg?.reviewed ?? 0;

    const flags: string[] = [];
    if (avgReviewHrs != null && avgReviewHrs > 48) flags.push("Sekin tekshiruv");
    if (reviewed >= 3 && avgFeedbackLen < 40) flags.push("Qisqa feedback");
    if (avgRating != null && avgRating < 3.5) flags.push("Past baholash");
    if (pending > 10) flags.push("Koʻp navbat");

    return {
      id: t.id,
      name: t.user?.name || "Oʻqituvchi",
      band: t.ieltsBand ?? null,
      students,
      reviewed,
      pending,
      avgReviewHrs,
      avgFeedbackLen,
      avgRating,
      flags,
    };
  });

  // Needs-attention first (more flags), then by pending.
  insights.sort((a, b) => b.flags.length - a.flags.length || b.pending - a.pending);
  return insights;
}

// ==================== M6 — Feature Heatmap ====================
export interface FeatureUsage {
  action: string;
  label: string;
  count: number;
  level: "green" | "yellow" | "red";
  pct: number;
}

const ACTION_LABEL_UZ: Record<string, string> = {
  IELTS_TEST_COMPLETED: "IELTS testlari",
  HOMEWORK_SUBMITTED: "Uy vazifalari",
  SPEAKING_SESSION_COMPLETED: "Gapirish mashqlari",
  DAILY_CHALLENGE: "Kunlik challenge",
  ACHIEVEMENT_UNLOCKED: "Yutuqlar",
};

function humanize(action: string): string {
  return (
    ACTION_LABEL_UZ[action] ??
    action
      .toLowerCase()
      .split(/[_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export async function getFeatureHeatmap(): Promise<FeatureUsage[]> {
  const since = new Date(Date.now() - 30 * DAY);
  const logs = await db.activityLog.findMany({ where: { createdAt: { gte: since } }, select: { action: true } });

  const counts = new Map<string, number>();
  for (const l of logs) counts.set(l.action, (counts.get(l.action) ?? 0) + 1);

  const entries = Array.from(counts.entries());
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map(([, c]) => c));

  return entries
    .map(([action, count]) => {
      const ratio = count / max;
      const level: FeatureUsage["level"] = ratio >= 0.6 ? "green" : ratio >= 0.25 ? "yellow" : "red";
      return { action, label: humanize(action), count, level, pct: Math.round(ratio * 100) };
    })
    .sort((a, b) => b.count - a.count);
}
