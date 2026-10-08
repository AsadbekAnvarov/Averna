import { db } from "@/lib/db";
import { AchievementType, IELTSModule, UserRole } from "@prisma/client";
import { isGenuineWriting } from "@/lib/utils";
import { randomUUID } from "crypto";
import { awardXp, advanceStreak, type StreakChange } from "@/lib/engine/xp-engine";
import { computeHomeworkXp, computeObjectiveXp, type XpResult } from "@/lib/engine/progression/xp";
import { XP_CONFIG, type SkillKey as ProgressionSkill } from "@/lib/engine/progression/config";
import { loadXpHistory, settleProgression, type SettledReward } from "@/lib/engine/progression/service";
import { reconcileSkillStates, celebrationFor } from "@/lib/engine/progress-engine";
import {
  recordLearningEvent,
  reconcileLearningProfile,
  testAccuracy,
  testCompletion,
  SKILL_CHANNEL,
  type Channel,
  type SkillKey,
} from "@/lib/engine/learning-dna";
import { buildAchievementSnapshot, evaluateAchievements } from "@/lib/engine/achievement-engine";
import { notifyUser } from "@/lib/notifications";

// ==================== STUDENT HELPERS ====================

export async function getStudentProfile(userId: string) {
  return await db.student.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      group: {
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      achievements: {
        include: {
          achievement: true,
        },
      },
    },
  });
}

/**
 * @deprecated Use `awardXp({ studentId, amount, source })` from
 * `lib/engine/xp-engine` — it is the single authority for XP and records an
 * audit entry. Kept as a thin alias so existing callers keep working; it treats
 * the movement as a generic learning award (advances the streak on a net gain).
 */
export async function updateStudentPoints(studentId: string, points: number) {
  await awardXp({ studentId, amount: points, source: points > 0 ? "test" : "legacy", skipLog: true });
  return db.student.findUnique({ where: { id: studentId } });
}

/** Re-exported for backward compatibility; the engine owns streak advancement. */
export const updateStudentStreak = advanceStreak;

// ==================== RANKING HELPERS ====================

/**
 * A student's global rank, computed on READ with a single indexed COUNT
 * (`@@index([totalPoints])`) instead of maintaining a `globalRank` column via
 * an O(N) rewrite on every points change. Students are ranked only once they
 * have points; ties share a rank (standard competition ranking).
 */
export async function getGlobalRank(totalPoints: number): Promise<number> {
  if (totalPoints <= 0) return 0;
  const above = await db.student.count({ where: { totalPoints: { gt: totalPoints } } });
  return above + 1;
}

/** A student's rank within their group, computed on read (same approach). */
export async function getGroupRank(groupId: string, totalPoints: number): Promise<number> {
  if (totalPoints <= 0) return 0;
  const above = await db.student.count({ where: { groupId, totalPoints: { gt: totalPoints } } });
  return above + 1;
}

/**
 * Batch recompute of the cached `globalRank`/`groupRank` columns. No longer on
 * the hot path (rank is computed on read); kept only for an optional
 * admin/cron refresh of the cached columns. Do NOT call this per points change.
 */
export async function updateRankings() {
  // Global rankings
  const allStudents = await db.student.findMany({
    orderBy: {
      totalPoints: "desc",
    },
  });

  for (let i = 0; i < allStudents.length; i++) {
    await db.student.update({
      where: { id: allStudents[i].id },
      data: { globalRank: i + 1 },
    });
  }

  // Group rankings
  const groups = await db.group.findMany();
  for (const group of groups) {
    const groupStudents = await db.student.findMany({
      where: { groupId: group.id },
      orderBy: {
        totalPoints: "desc",
      },
    });

    for (let i = 0; i < groupStudents.length; i++) {
      await db.student.update({
        where: { id: groupStudents[i].id },
        data: { groupRank: i + 1 },
      });
    }
  }
}

export async function getGlobalRankings(limit: number = 50) {
  return await db.student.findMany({
    orderBy: {
      totalPoints: "desc",
    },
    take: limit,
    include: {
      user: {
        select: {
          name: true,
          image: true,
        },
      },
      group: {
        select: {
          name: true,
        },
      },
    },
  });
}

export async function getGroupRankings(groupId: string) {
  return await db.student.findMany({
    where: { groupId },
    orderBy: {
      totalPoints: "desc",
    },
    include: {
      user: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });
}

// ==================== HOMEWORK HELPERS ====================

export async function submitHomework(
  studentId: string,
  homeworkId: string,
  content: string
) {
  // Check if already submitted
  const existing = await db.homeworkSubmission.findUnique({
    where: {
      studentId_homeworkId: {
        studentId,
        homeworkId,
      },
    },
  });

  if (existing) {
    throw new Error("Homework already submitted");
  }

  // Get current submission count to determine position
  const submissionCount = await db.homeworkSubmission.count({
    where: { homeworkId },
  });

  const position = submissionCount + 1;

  // Get homework details for points calculation
  const homework = await db.homework.findUnique({
    where: { id: homeworkId },
  });

  if (!homework) {
    throw new Error("Homework not found");
  }

  // Anti-cheat: require genuine effort to earn points. Empty / spammy
  // submissions are still recorded for the teacher, but earn 0 points.
  const genuine = isGenuineWriting(content, XP_CONFIG.homework.minWords);

  // Teacher-set points plus a small early-submission bonus (XP_CONFIG.homework),
  // only when the work is genuine.
  const pointsAwarded = computeHomeworkXp(homework.points, position, genuine);

  // Create submission
  const submission = await db.homeworkSubmission.create({
    data: {
      studentId,
      homeworkId,
      content,
      position,
      pointsAwarded,
      status: "SUBMITTED",
    },
  });

  // Log activity
  await db.activityLog.create({
    data: {
      studentId,
      action: "HOMEWORK_SUBMITTED",
      details: {
        homeworkId,
        position,
        points: pointsAwarded,
      },
      points: pointsAwarded,
    },
  });

  // Credit the points now so they reach totalPoints / rankings (the activity
  // log above already feeds the weekly leagues, so both stay in sync). If a
  // teacher later adjusts the grade, gradeHomework() applies only the delta.
  if (pointsAwarded > 0) {
    // skipLog: this function already wrote its own ActivityLog row above.
    await awardXp({
      studentId,
      amount: pointsAwarded,
      source: "homework",
      skipLog: true,
      idempotencyKey: `homework:${submission.id}`,
      activity: String(homework.module),
      refId: submission.id,
      breakdown: { lines: [{ label: "Homework", amount: homework.points }, ...(pointsAwarded > homework.points ? [{ label: `Submitted #${position}`, amount: pointsAwarded - homework.points }] : [])] },
    });
  }
  await checkAndAwardAchievements(studentId);
  await settleProgression(studentId);

  // Learning DNA: homework is sustained, self-paced production — a different
  // behaviour from a timed test, and the only place we see how much language the
  // student writes voluntarily. Missing the deadline is recorded as a planning
  // signal rather than a knowledge one.
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const uniqueWords = new Set(
    content
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z']/g, ""))
      .filter(Boolean)
  ).size;
  await recordLearningEvent({
    studentId,
    kind: "homework",
    skill: homework.module as SkillKey,
    channel: SKILL_CHANNEL[homework.module as SkillKey],
    durationMin: null,
    words,
    diversity: words > 0 ? uniqueWords / words : null,
    difficulty: String(homework.difficulty),
    errorTags: Date.now() > homework.dueDate.getTime() ? ["time_pressure"] : [],
  });

  return submission;
}

export async function gradeHomework(
  submissionId: string,
  teacherId: string,
  feedback: string,
  adjustedPoints?: number
) {
  const submission = await db.homeworkSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const finalPoints = adjustedPoints ?? submission.pointsAwarded;
  // submitHomework() already credited submission.pointsAwarded to the student,
  // so here we only apply the difference (positive or negative) — otherwise
  // grading would double-credit the original award.
  const pointsDelta = finalPoints - submission.pointsAwarded;

  // Update submission
  const updated = await db.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      status: "GRADED",
      feedback,
      gradedBy: teacherId,
      gradedAt: new Date(),
      pointsAwarded: finalPoints,
    },
  });

  if (pointsDelta !== 0) {
    // A teacher re-grading isn't a new study event, so it must not touch the streak.
    await awardXp({ studentId: submission.studentId, amount: pointsDelta, source: "grade_adjust" });
  }

  return updated;
}

// ==================== ACHIEVEMENT HELPERS ====================

/**
 * Evaluate every achievement rule and award whatever is newly earned.
 *
 * Driven by the declarative rule table in lib/engine/achievement-engine, so the
 * thresholds here are identical to the ones the progress UIs display, and all
 * eight badges are actually reachable (three previously had no check at all).
 * Uses indexed counts instead of loading the student's whole history.
 */
export async function checkAndAwardAchievements(studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    select: {
      totalPoints: true,
      longestStreak: true,
      achievements: { select: { achievement: { select: { type: true } } } },
    },
  });
  if (!student) return;

  const earnedTypes = student.achievements.map((a) => a.achievement.type);
  const globalRank = await getGlobalRank(student.totalPoints);
  const snapshot = await buildAchievementSnapshot(studentId, {
    longestStreak: student.longestStreak,
    globalRank,
  });

  for (const type of evaluateAchievements(snapshot, earnedTypes)) {
    await awardAchievement(studentId, type);
  }
}

async function awardAchievement(
  studentId: string,
  achievementType: AchievementType
) {
  const achievement = await db.achievement.findUnique({
    where: { type: achievementType },
  });

  if (!achievement) return;

  // Award achievement
  await db.studentAchievement.create({
    data: {
      studentId,
      achievementId: achievement.id,
    },
  });

  // Award points (skipLog: an ACHIEVEMENT_UNLOCKED row is written below)
  await awardXp({ studentId, amount: achievement.points, source: "achievement", skipLog: true });

  // Log activity
  await db.activityLog.create({
    data: {
      studentId,
      action: "ACHIEVEMENT_UNLOCKED",
      details: {
        achievementType,
        achievementName: achievement.name,
      },
      points: achievement.points,
    },
  });
}

// ==================== IELTS TEST HELPERS ====================

/**
 * @deprecated Band-only XP estimate kept for backward compatibility. Submit
 * routes now score attempts with the Progression Engine
 * (lib/engine/progression/xp.ts) using accuracy, completion, quality and
 * history, and pass the full `xp` result to saveIELTSTest.
 */
export async function computeTestXpForStudent(
  studentId: string,
  module: IELTSModule,
  score: number,
  opts?: { difficulty?: string | null; contentKey?: string }
): Promise<number> {
  const history = await loadXpHistory(studentId, module as ProgressionSkill, opts?.contentKey);
  const accuracy = Math.max(0, Math.min(1, score / 9));
  return computeObjectiveXp({
    skill: module === "LISTENING" ? "LISTENING" : "READING",
    correct: Math.round(accuracy * 20),
    total: 20,
    answered: 20,
    band: score,
    difficulty: opts?.difficulty,
    history,
  }).xp;
}

export interface SaveTestResult {
  /** XP actually paid for this attempt. */
  pointsAwarded: number;
  /** The engine's explanation (null for zero-XP / override paths). */
  xp: XpResult | null;
  /** True when this submission was already processed (retry / double click). */
  duplicate: boolean;
  streak: StreakChange | null;
  /** Rewards (mission / challenges / badges) this attempt unlocked. */
  rewards: SettledReward[];
}

export async function saveIELTSTest(
  studentId: string,
  module: IELTSModule,
  score: number,
  answers: any,
  aiAnalysis: any,
  timeSpent: number,
  options?: {
    /** Fixed XP (legacy callers / zero-XP attempts). Ignored when `xp` is given. */
    pointsOverride?: number;
    /** The Progression Engine's result for this attempt (preferred). */
    xp?: XpResult;
    contentKey?: string;
    difficulty?: string | null;
    /** Per-attempt id from the client; makes the whole save retry-safe. */
    idempotencyKey?: string;
    /** Integrity trust multiplier (0..1) — only applied to `pointsOverride`/legacy XP. */
    trustMultiplier?: number;
    /** Persist a Writing fallback retry in the SAME transaction as the attempt and XP. */
    writingRetryAt?: Date;
    /** Skip reward settlement (a caller saving several sections settles once, last). */
    skipSettle?: boolean;
    /** Extra fields for the ActivityLog entry (accuracy, mock flag …). */
    logDetails?: Record<string, string | number | boolean | null>;
    /**
     * Extra behavioural detail for the Learning DNA Engine that the outcome row
     * can't express: words read/produced, lexical diversity, the delivery channel
     * actually used, and observed mistake categories. Optional everywhere — the
     * engine reconstructs what it can without it.
     */
    dna?: {
      channel?: Channel;
      words?: number;
      diversity?: number;
      errorTags?: string[];
    };
  }
) {
  // Clamp untrusted/edge inputs so analytics and bands stay sane: timeSpent is
  // client-influenced (cap at 3h, floor at 0) and score must be a valid band 0-9.
  const safeTime = Math.max(0, Math.min(Math.round(Number(timeSpent) || 0), 3 * 60 * 60));
  const safeScore = Math.max(0, Math.min(Number(score) || 0, 9));

  // XP: prefer the engine's full result; otherwise a fixed override; otherwise
  // the legacy band estimate (scaled by integrity trust).
  const xpResult: XpResult | null = options?.xp ?? null;
  let points: number;
  if (xpResult) {
    points = xpResult.xp;
  } else if (options?.pointsOverride !== undefined) {
    points = Math.max(0, Math.round(options.pointsOverride));
  } else {
    const raw = await computeTestXpForStudent(studentId, module, safeScore, {
      difficulty: options?.difficulty,
      contentKey: options?.contentKey,
    });
    const trust = options?.trustMultiplier == null ? 1 : Math.max(0, Math.min(1, options.trustMultiplier));
    points = Math.max(0, Math.round(raw * trust));
  }

  // The test row, the ledger entry and the totalPoints increment commit
  // together. The ledger's unique key makes a retried submission a no-op that
  // returns the ORIGINAL test instead of creating a second one.
  const testId = randomUUID();
  const award = await awardXp({
    studentId,
    amount: points,
    source: "test",
    skipLog: true,
    idempotencyKey: options?.idempotencyKey ? `test:${options.idempotencyKey}` : undefined,
    activity: module,
    refId: testId,
    breakdown: xpResult ? { lines: xpResult.lines, notes: xpResult.notes } : { lines: [{ label: "Attempt", amount: points }] },
    atomicWith: [
      db.iELTSTest.create({
        data: { id: testId, studentId, module, score: safeScore, answers, aiAnalysis, timeSpent: safeTime,
          ...(module === "WRITING" && options?.writingRetryAt ? { assessmentJob: { create: { nextAttemptAt: options.writingRetryAt } } } : {}),
        },
      }),
    ],
  });

  if (award.duplicate) {
    let originalId = award.existingRefId ?? null;
    if (!originalId && options?.idempotencyKey) {
      // Pre-ledger fallback: the original attempt's ActivityLog row carries its test id.
      const log = await db.activityLog
        .findFirst({
          where: { studentId, details: { path: ["idem"], equals: `test:${options.idempotencyKey}` } },
          select: { details: true },
        })
        .catch(() => null);
      const id = (log?.details as { testId?: unknown } | null)?.testId;
      originalId = typeof id === "string" ? id : null;
    }
    const original = originalId
      ? await db.iELTSTest.findFirst({ where: { id: originalId, studentId } }).catch(() => null)
      : null;
    if (original) {
      const ledger = await db.xpTransaction.findFirst({ where: { studentId, refId: original.id } }).catch(() => null);
      return Object.assign(original, {
        pointsAwarded: ledger?.amount ?? 0,
        xp: null,
        duplicate: true,
        streak: null,
        rewards: [],
      } satisfies SaveTestResult);
    }
  }

  const test = await db.iELTSTest.findUnique({ where: { id: testId } });
  if (!test) throw new Error("This attempt was already submitted.");

  // Log activity (the student-facing feed + daily budget accounting)
  await db.activityLog.create({
    data: {
      studentId,
      action: "IELTS_TEST_COMPLETED",
      details: {
        module,
        score: safeScore,
        testId,
        ...(options?.logDetails ?? {}),
        // Same key the XP ledger uses, so the legacy (pre-ledger) duplicate
        // check in awardXp recognises a retried submission too.
        ...(options?.idempotencyKey ? { idem: `test:${options.idempotencyKey}` } : {}),
      },
      points,
    },
  });

  // Check for achievements
  await checkAndAwardAchievements(studentId);

  // Learning DNA (AVERNA-001): record the BEHAVIOUR behind the result — channel,
  // time of day, how long it took, how complete it was, which mistakes appeared.
  // The test row stores the outcome; this stores how the outcome was produced,
  // which is what personalisation actually needs. Never throws.
  const completion = testCompletion(answers, aiAnalysis);
  await recordLearningEvent({
    studentId,
    kind: "test",
    skill: module as SkillKey,
    channel: options?.dna?.channel ?? SKILL_CHANNEL[module as SkillKey],
    accuracy: testAccuracy(aiAnalysis, safeScore),
    durationMin: safeTime > 0 ? safeTime / 60 : null,
    items: completion.total,
    correct: null,
    words: options?.dna?.words,
    diversity: options?.dna?.diversity,
    difficulty: options?.difficulty ?? null,
    errorTags: [
      ...(options?.dna?.errorTags ?? []),
      // Reconstructable without any caller support: a materially incomplete
      // paper is a time-management signal, not a knowledge signal.
      ...(completion.answered != null &&
      completion.total != null &&
      completion.total >= 5 &&
      completion.answered / completion.total < 0.9
        ? ["time_pressure"]
        : []),
    ],
  });

  // Persist the mastery lifecycle and celebrate any stage the student just
  // reached. Derived from evidence, so it can't be faked; never throws.
  const advances = await reconcileSkillStates(studentId);
  if (advances.length > 0) {
    const owner = await db.student
      .findUnique({ where: { id: studentId }, select: { userId: true } })
      .catch(() => null);
    if (owner?.userId) {
      for (const a of advances) {
        const c = celebrationFor(a);
        if (c) await notifyUser(owner.userId, { type: "system", ...c });
      }
    }
  }

  // Progression Engine: pay any mission / challenge / badge reward this attempt
  // just completed (idempotent ledger keys — never double-pays). Never throws.
  const rewards = options?.skipSettle ? [] : await settleProgression(studentId);

  // Make sure a Learning DNA profile EXISTS for this student, so they appear in
  // platform-wide analytics from their first test onward. `skipIfFresh` keeps this
  // off the critical path in the normal case. Never throws.
  await reconcileLearningProfile(studentId, { skipIfFresh: true });

  // Attached to the test object so existing callers using `test.id` keep working.
  return Object.assign(test, {
    pointsAwarded: points,
    xp: xpResult,
    duplicate: false,
    streak: award.streak ?? null,
    rewards,
  } satisfies SaveTestResult);
}

export async function getStudentTestHistory(
  studentId: string,
  module?: IELTSModule
) {
  return await db.iELTSTest.findMany({
    where: {
      studentId,
      ...(module && { module }),
    },
    orderBy: {
      completedAt: "desc",
    },
    take: 50,
  });
}

// ==================== SPEAKING SESSION HELPERS ====================

export async function recordSpeakingSession(
  studentId: string,
  duration: number,
  teacherId?: string,
  rating?: number,
  feedback?: string
) {
  // Calculate points: 1 point per minute, bonus for high rating
  let points = duration;
  if (rating && rating >= 4) points += 10;

  const session = await db.speakingSession.create({
    data: {
      studentId,
      teacherId,
      duration,
      points,
      rating,
      feedback,
    },
  });

  // Award points (skipLog: a SPEAKING_SESSION_COMPLETED row is written below)
  await awardXp({ studentId, amount: points, source: "test", skipLog: true });

  // Log activity
  await db.activityLog.create({
    data: {
      studentId,
      action: "SPEAKING_SESSION_COMPLETED",
      details: {
        duration,
        rating,
      },
      points,
    },
  });

  // Check achievements
  await checkAndAwardAchievements(studentId);

  // Learning DNA: speaking is the activity learners avoid when they feel unsure,
  // so choosing it — and how long they sustain it — is one of the strongest
  // confidence signals available. A teacher's star rating is the accuracy proxy.
  await recordLearningEvent({
    studentId,
    kind: "speaking",
    skill: "SPEAKING",
    channel: "speaking",
    accuracy: rating != null ? rating / 5 : null,
    durationMin: duration > 0 ? duration : null,
  });

  return session;
}

// ==================== ANALYTICS HELPERS ====================

export async function getStudentAnalytics(studentId: string, days: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const activityLogs = await db.activityLog.findMany({
    where: {
      studentId,
      createdAt: {
        gte: since,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const tests = await db.iELTSTest.findMany({
    where: {
      studentId,
      completedAt: {
        gte: since,
      },
    },
    orderBy: {
      completedAt: "asc",
    },
  });

  const speakingSessions = await db.speakingSession.findMany({
    where: {
      studentId,
      date: {
        gte: since,
      },
    },
    orderBy: {
      date: "asc",
    },
  });

  const homework = await db.homeworkSubmission.findMany({
    where: {
      studentId,
      submittedAt: {
        gte: since,
      },
    },
    orderBy: {
      submittedAt: "asc",
    },
  });

  return {
    activityLogs,
    tests,
    speakingSessions,
    homework,
    totalPoints: activityLogs.reduce((sum, log) => sum + log.points, 0),
    totalTests: tests.length,
    totalSpeakingSessions: speakingSessions.length,
    totalHomework: homework.length,
  };
}
