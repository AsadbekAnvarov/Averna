import { db } from "@/lib/db";
import { AchievementType, IELTSModule, UserRole } from "@prisma/client";

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

export async function updateStudentPoints(studentId: string, points: number) {
  const student = await db.student.update({
    where: { id: studentId },
    data: {
      totalPoints: {
        increment: points,
      },
    },
  });

  // Update rankings after points change
  await updateRankings();

  return student;
}

export async function updateStudentStreak(studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
  });

  if (!student) return null;

  const today = new Date();
  const lastActive = new Date(student.lastActiveDate);
  const daysDiff = Math.floor(
    (today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
  );

  let newStreak = student.currentStreak;

  if (daysDiff === 1) {
    // Continue streak
    newStreak = student.currentStreak + 1;
  } else if (daysDiff > 1) {
    // Streak broken
    newStreak = 1;
  }
  // If daysDiff === 0, already logged in today, don't change streak

  return await db.student.update({
    where: { id: studentId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, student.longestStreak),
      lastActiveDate: today,
    },
  });
}

// ==================== RANKING HELPERS ====================

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

  // Calculate points based on position
  let pointsAwarded = homework.points;
  if (position === 1) pointsAwarded += 10;
  else if (position === 2) pointsAwarded += 8;
  else if (position === 3) pointsAwarded += 6;

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

  // Award points to student
  await updateStudentPoints(submission.studentId, finalPoints);

  return updated;
}

// ==================== ACHIEVEMENT HELPERS ====================

export async function checkAndAwardAchievements(studentId: string) {
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      homeworkSubmissions: true,
      ieltsTests: true,
      speakingSessions: true,
      achievements: {
        include: {
          achievement: true,
        },
      },
    },
  });

  if (!student) return;

  const earnedAchievementTypes = student.achievements.map(
    (a) => a.achievement.type
  );

  // Check Homework Master (50 homework completed)
  if (
    student.homeworkSubmissions.filter((s) => s.status === "GRADED").length >=
      50 &&
    !earnedAchievementTypes.some((a) => a.type === "HOMEWORK_MASTER")
  ) {
    await awardAchievement(studentId, "HOMEWORK_MASTER");
  }

  // Check Speaking Champion (50 speaking sessions)
  if (
    student.speakingSessions.length >= 50 &&
    !earnedAchievementTypes.some((a) => a.type === "SPEAKING_CHAMPION")
  ) {
    await awardAchievement(studentId, "SPEAKING_CHAMPION");
  }

  // Check Reading Expert (100 reading tests)
  const readingTests = student.ieltsTests.filter(
    (t) => t.module === "READING"
  );
  if (
    readingTests.length >= 100 &&
    !earnedAchievementTypes.some((a) => a.type === "READING_EXPERT")
  ) {
    await awardAchievement(studentId, "READING_EXPERT");
  }

  // Check Streak Warrior (30 day streak)
  if (
    student.currentStreak >= 30 &&
    !earnedAchievementTypes.some((a) => a.type === "STREAK_WARRIOR")
  ) {
    await awardAchievement(studentId, "STREAK_WARRIOR");
  }

  // Check Top Performer (reach top 10 globally)
  if (
    student.globalRank <= 10 &&
    student.globalRank > 0 &&
    !earnedAchievementTypes.some((a) => a.type === "TOP_PERFORMER")
  ) {
    await awardAchievement(studentId, "TOP_PERFORMER");
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

  // Award points
  await updateStudentPoints(studentId, achievement.points);

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

export async function saveIELTSTest(
  studentId: string,
  module: IELTSModule,
  score: number,
  answers: any,
  aiAnalysis: any,
  timeSpent: number
) {
  const test = await db.iELTSTest.create({
    data: {
      studentId,
      module,
      score,
      answers,
      aiAnalysis,
      timeSpent,
    },
  });

  // Award points based on score
  const points = Math.round(score * 10);
  await updateStudentPoints(studentId, points);

  // Log activity
  await db.activityLog.create({
    data: {
      studentId,
      action: "IELTS_TEST_COMPLETED",
      details: {
        module,
        score,
      },
      points,
    },
  });

  // Check for achievements
  await checkAndAwardAchievements(studentId);

  return test;
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

  // Award points
  await updateStudentPoints(studentId, points);

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
