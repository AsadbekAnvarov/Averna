import { AchievementType } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Achievement Engine — one declarative rule table as the single source of truth
 * for both AWARDING a badge and showing PROGRESS toward it.
 *
 * Before this, thresholds lived in three places (the awarding switch in
 * db-helpers plus two separate progress switches in the UI). They had drifted:
 *   - LISTENING_MASTER, WRITING_GURU and EARLY_BIRD were displayed with progress
 *     but had NO awarding check at all — they could never actually unlock.
 *   - Homework was awarded on GRADED submissions but displayed from ALL of them.
 *   - Streak was awarded from currentStreak but displayed from longestStreak.
 * A rule table makes those disagreements impossible.
 *
 * Cost: the snapshot is built from cheap indexed counts instead of loading a
 * student's entire submission/test/session history on every save.
 */

export interface AchievementSnapshot {
  gradedHomework: number;
  firstPlaceHomework: number;
  speakingSessions: number;
  readingTests: number;
  listeningTests: number;
  writingHighScores: number;
  longestStreak: number;
  globalRank: number;
}

export interface AchievementRule {
  type: AchievementType;
  /** Value that unlocks the badge. */
  target: number;
  /** Current value from the snapshot — also drives the progress bars. */
  current: (s: AchievementSnapshot) => number;
}

/**
 * The rule table. To retune a badge, change it here once — awarding and every
 * progress display follow automatically.
 */
export const ACHIEVEMENT_RULES: AchievementRule[] = [
  { type: "HOMEWORK_MASTER", target: 50, current: (s) => s.gradedHomework },
  { type: "SPEAKING_CHAMPION", target: 50, current: (s) => s.speakingSessions },
  { type: "READING_EXPERT", target: 100, current: (s) => s.readingTests },
  { type: "LISTENING_MASTER", target: 100, current: (s) => s.listeningTests },
  { type: "WRITING_GURU", target: 20, current: (s) => s.writingHighScores },
  // Longest (not current) streak: once earned, a later break shouldn't erase it.
  { type: "STREAK_WARRIOR", target: 30, current: (s) => s.longestStreak },
  { type: "EARLY_BIRD", target: 10, current: (s) => s.firstPlaceHomework },
  // Rank is a threshold, not a tally: top-10 counts as complete.
  { type: "TOP_PERFORMER", target: 10, current: (s) => (s.globalRank > 0 && s.globalRank <= 10 ? 10 : 0) },
];

const RULE_BY_TYPE = new Map(ACHIEVEMENT_RULES.map((r) => [String(r.type), r]));

/**
 * Build the snapshot from cheap aggregate counts (all indexed columns).
 * `globalRank` is passed in because it is computed on read elsewhere.
 */
export async function buildAchievementSnapshot(
  studentId: string,
  opts: { longestStreak: number; globalRank: number }
): Promise<AchievementSnapshot> {
  const [gradedHomework, firstPlaceHomework, speakingSessions, readingTests, listeningTests, writingHighScores] =
    await Promise.all([
      db.homeworkSubmission.count({ where: { studentId, status: "GRADED" } }),
      db.homeworkSubmission.count({ where: { studentId, position: 1 } }),
      db.speakingSession.count({ where: { studentId } }),
      db.iELTSTest.count({ where: { studentId, module: "READING" } }),
      db.iELTSTest.count({ where: { studentId, module: "LISTENING" } }),
      db.iELTSTest.count({ where: { studentId, module: "WRITING", score: { gte: 7.5 } } }),
    ]);

  return {
    gradedHomework,
    firstPlaceHomework,
    speakingSessions,
    readingTests,
    listeningTests,
    writingHighScores,
    longestStreak: opts.longestStreak,
    globalRank: opts.globalRank,
  };
}

/** Types whose rule is satisfied and that the student hasn't earned yet. */
export function evaluateAchievements(
  snapshot: AchievementSnapshot,
  earnedTypes: Iterable<string>
): AchievementType[] {
  const earned = new Set(Array.from(earnedTypes, String));
  return ACHIEVEMENT_RULES.filter((r) => !earned.has(String(r.type)) && r.current(snapshot) >= r.target).map(
    (r) => r.type
  );
}

/** Progress for a badge — used by every progress UI so numbers always agree. */
export function achievementProgress(
  type: string,
  snapshot: AchievementSnapshot
): { current: number; target: number; percent: number } {
  const rule = RULE_BY_TYPE.get(type);
  if (!rule) return { current: 0, target: 1, percent: 0 };
  const current = rule.current(snapshot);
  const percent = Math.max(0, Math.min(100, Math.round((current / rule.target) * 100)));
  return { current, target: rule.target, percent };
}
