import { db } from "@/lib/db";

/**
 * Admin Analytics Engine — institutional truth, not vanity metrics.
 *
 * Counts ("tests today", "new signups") tell an administrator that the platform
 * is busy; they do not tell them whether anyone is LEARNING. These metrics answer
 * the question the counts can't: how much activity is verified learning, how fast
 * students are advancing through mastery, whether knowledge is being retained,
 * and who is quietly slipping.
 *
 * Read-only and derived — no schema of its own. Every lookup that depends on a
 * recently added table is defensive, so the panel renders even before deploy.
 */

const DAY = 86_400_000;

export interface OutcomeMetrics {
  /** % of scored attempts in the window that passed the effort/integrity gates. */
  verifiedLearningRate: number | null;
  verifiedSample: number;
  /** Mastery stages advanced to verified+ in the last 7 days. */
  masteryAdvances: number | null;
  /** Spaced-repetition reviews completed in the last 7 days. */
  reviewsCompleted: number | null;
  /** Review items currently overdue across the platform. */
  reviewsOverdue: number | null;
  /** Students with real ability but no recent practice — knowledge decaying. */
  atRisk: number;
  /** Integrity anomalies recorded (shadow mode) in the window. */
  integrityFlags: number | null;
}

export async function getOutcomeMetrics(windowDays = 14): Promise<OutcomeMetrics> {
  const since = new Date(Date.now() - windowDays * DAY);
  const week = new Date(Date.now() - 7 * DAY);

  const [testLogs, advances, reviews, overdue, students, flags] = await Promise.all([
    // Verified-learning rate: an attempt that earned XP passed the effort gates
    // (server-scored, genuine, on-topic). Zero-point attempts did not.
    db.activityLog
      .findMany({
        where: { action: "IELTS_TEST_COMPLETED", createdAt: { gte: since } },
        select: { points: true },
      })
      .catch(() => [] as { points: number }[]),
    db.skillState
      .count({ where: { stageChangedAt: { gte: week }, stage: { in: ["verified", "mastered", "retained"] } } })
      .catch(() => null),
    db.activityLog.count({ where: { action: "SRS_REVIEW", createdAt: { gte: week } } }).catch(() => null),
    db.reviewItem.count({ where: { dueAt: { lte: new Date() } } }).catch(() => null),
    // At-risk: enough evidence of ability, but nothing practised recently.
    // A single grouped aggregate — never load every student's full test history.
    db.iELTSTest
      .groupBy({
        by: ["studentId"],
        where: { score: { gt: 0 } },
        _count: { _all: true },
        _max: { completedAt: true },
      })
      .catch(() => [] as { studentId: string; _count: { _all: number }; _max: { completedAt: Date | null } }[]),
    db.auditLog.count({ where: { action: "INTEGRITY_SHADOW", createdAt: { gte: since } } }).catch(() => null),
  ]);

  const sample = testLogs.length;
  const verified = testLogs.filter((l) => (l.points ?? 0) > 0).length;

  const now = Date.now();
  const atRisk = students.filter((g) => {
    if ((g._count?._all ?? 0) < 3) return false;
    const last = g._max?.completedAt ? new Date(g._max.completedAt).getTime() : null;
    return last != null && (now - last) / DAY > 14;
  }).length;

  return {
    verifiedLearningRate: sample > 0 ? Math.round((verified / sample) * 100) : null,
    verifiedSample: sample,
    masteryAdvances: advances,
    reviewsCompleted: reviews,
    reviewsOverdue: overdue,
    atRisk,
    integrityFlags: flags,
  };
}
