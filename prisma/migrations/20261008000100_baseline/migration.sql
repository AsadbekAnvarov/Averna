-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'PARENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('PENDING', 'SUBMITTED', 'GRADED', 'LATE');

-- CreateEnum
CREATE TYPE "IELTSModule" AS ENUM ('WRITING', 'READING', 'LISTENING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('HOMEWORK_MASTER', 'SPEAKING_CHAMPION', 'READING_EXPERT', 'WRITING_GURU', 'LISTENING_MASTER', 'TOP_PERFORMER', 'STREAK_WARRIOR', 'EARLY_BIRD');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "personalGoal" TEXT,
    "level" TEXT,
    "phone" TEXT,
    "nativeLanguage" TEXT,
    "targetBand" TEXT,
    "bio" TEXT,
    "enrolledAt" TIMESTAMP(3),
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "globalRank" INTEGER NOT NULL DEFAULT 0,
    "groupRank" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "streakFreezes" INTEGER NOT NULL DEFAULT 1,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "cosmetics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featuredCosmetic" TEXT,
    "cosmeticBoxAt" TIMESTAMP(3),
    "lastActiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "specialty" TEXT,
    "ieltsBand" DOUBLE PRECISION,
    "isSecondTeacher" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "description" TEXT,
    "level" TEXT,
    "schedule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_students" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "parentName" TEXT,
    "phone" TEXT,
    "age" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "module" "IELTSModule" NOT NULL,
    "contentKind" TEXT,
    "contentId" TEXT,
    "contentPart" INTEGER,
    "contentTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_submissions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "HomeworkStatus" NOT NULL DEFAULT 'SUBMITTED',
    "position" INTEGER,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "gradedBy" TEXT,
    "testId" TEXT,
    "band" DOUBLE PRECISION,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "homework_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ielts_tests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "module" "IELTSModule" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "answers" JSONB NOT NULL,
    "aiAnalysis" JSONB,
    "timeSpent" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ielts_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_achievements" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_sessions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "duration" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,
    "rating" INTEGER,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetDays" INTEGER NOT NULL,
    "stake" INTEGER NOT NULL,
    "reward" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_student_links" (
    "id" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parent_student_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quotes" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_slots" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "topic" TEXT,
    "studentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "teacherId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'system',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "comment" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reaction" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cost" INTEGER NOT NULL,
    "icon" TEXT,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_redemptions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_queue" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "roomId" TEXT,
    "topic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_rooms" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "studentAId" TEXT NOT NULL,
    "studentAName" TEXT NOT NULL,
    "studentBId" TEXT NOT NULL,
    "studentBName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "speaking_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_messages" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_signals" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_logs" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_notes" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_templates" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homework_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "groupId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TOPUP',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_items" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'vocab',
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_states" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "previousStage" TEXT,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "distinctDays" INTEGER NOT NULL DEFAULT 0,
    "bestBand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recentAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retention" INTEGER NOT NULL DEFAULT 0,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_materials" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "vocabulary" JSONB,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedTest" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'READING',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "topic" TEXT,
    "level" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "skill" TEXT,
    "channel" TEXT NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "durationMin" DOUBLE PRECISION,
    "items" INTEGER,
    "correct" INTEGER,
    "words" INTEGER,
    "diversity" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "difficulty" TEXT,
    "errorTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origin" TEXT NOT NULL DEFAULT 'sensor',
    "hourLocal" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_profiles" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "maturity" INTEGER NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'insufficient',
    "preferredStyle" TEXT,
    "styleConfidence" TEXT NOT NULL DEFAULT 'insufficient',
    "focusMinutes" INTEGER,
    "fatiguePointMin" INTEGER,
    "idealLessonMin" INTEGER,
    "optimalDaypart" TEXT,
    "optimalHourStart" INTEGER,
    "optimalHourEnd" INTEGER,
    "confidenceScore" INTEGER,
    "retentionScore" INTEGER,
    "memoryHalfLifeDays" DOUBLE PRECISION,
    "consistencyScore" INTEGER,
    "motivationScore" INTEGER,
    "motivationTrend" TEXT,
    "learningSpeed" DOUBLE PRECISION,
    "revisionEfficiency" INTEGER,
    "skillBalance" INTEGER,
    "strongestSkill" TEXT,
    "weakestSkill" TEXT,
    "fastestGrowingSkill" TEXT,
    "vocabularyGrowth" INTEGER,
    "grammarGrowth" INTEGER,
    "speakingConfidence" INTEGER,
    "writingComplexity" INTEGER,
    "readingSpeedWpm" INTEGER,
    "listeningAccuracy" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_profile_snapshots" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "maturity" INTEGER NOT NULL,
    "confidenceScore" INTEGER,
    "retentionScore" INTEGER,
    "consistencyScore" INTEGER,
    "motivationScore" INTEGER,
    "learningSpeed" DOUBLE PRECISION,
    "focusMinutes" INTEGER,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "preferredStyle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_transactions" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "activity" TEXT,
    "refId" TEXT,
    "breakdown" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "papers" JSONB NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "sectionStartedAt" TIMESTAMP(3),
    "sectionDeadline" TIMESTAMP(3),
    "draft" JSONB,
    "results" JSONB NOT NULL DEFAULT '{}',
    "overall" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_audio" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "partIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "url" TEXT,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "scriptHash" TEXT NOT NULL,
    "voiceModel" TEXT NOT NULL,
    "timeline" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listening_audio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_recordings" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptKey" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "words" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "audioUrl" TEXT,
    "audioBytes" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT,
    "metrics" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaking_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_reviews" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "aiBand" DOUBLE PRECISION,
    "band" DOUBLE PRECISION NOT NULL,
    "criteria" JSONB,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" JSONB NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "draft" JSONB,
    "results" JSONB NOT NULL DEFAULT '{}',
    "cefr" TEXT,
    "band" DOUBLE PRECISION,
    "recommendation" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "username" TEXT,
    "firstName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "prefs" JSONB,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_link_codes" (
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "studentId" TEXT,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "dictionary_entries" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dictionary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cron_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE INDEX "students_groupId_idx" ON "students"("groupId");

-- CreateIndex
CREATE INDEX "students_totalPoints_idx" ON "students"("totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_userId_key" ON "teachers"("userId");

-- CreateIndex
CREATE INDEX "groups_teacherId_idx" ON "groups"("teacherId");

-- CreateIndex
CREATE INDEX "roster_students_groupId_idx" ON "roster_students"("groupId");

-- CreateIndex
CREATE INDEX "homework_groupId_idx" ON "homework"("groupId");

-- CreateIndex
CREATE INDEX "homework_teacherId_idx" ON "homework"("teacherId");

-- CreateIndex
CREATE INDEX "homework_dueDate_idx" ON "homework"("dueDate");

-- CreateIndex
CREATE INDEX "homework_submissions_homeworkId_idx" ON "homework_submissions"("homeworkId");

-- CreateIndex
CREATE INDEX "homework_submissions_status_idx" ON "homework_submissions"("status");

-- CreateIndex
CREATE INDEX "homework_submissions_testId_idx" ON "homework_submissions"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "homework_submissions_studentId_homeworkId_key" ON "homework_submissions"("studentId", "homeworkId");

-- CreateIndex
CREATE INDEX "ielts_tests_studentId_idx" ON "ielts_tests"("studentId");

-- CreateIndex
CREATE INDEX "ielts_tests_module_idx" ON "ielts_tests"("module");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_type_key" ON "achievements"("type");

-- CreateIndex
CREATE INDEX "student_achievements_studentId_idx" ON "student_achievements"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "student_achievements_studentId_achievementId_key" ON "student_achievements"("studentId", "achievementId");

-- CreateIndex
CREATE INDEX "speaking_sessions_studentId_idx" ON "speaking_sessions"("studentId");

-- CreateIndex
CREATE INDEX "speaking_sessions_date_idx" ON "speaking_sessions"("date");

-- CreateIndex
CREATE INDEX "commitments_studentId_idx" ON "commitments"("studentId");

-- CreateIndex
CREATE INDEX "activity_logs_studentId_idx" ON "activity_logs"("studentId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "parent_student_links_studentId_idx" ON "parent_student_links"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_student_links_parentEmail_studentId_key" ON "parent_student_links"("parentEmail", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quotes_date_key" ON "daily_quotes"("date");

-- CreateIndex
CREATE INDEX "daily_quotes_date_idx" ON "daily_quotes"("date");

-- CreateIndex
CREATE INDEX "tutor_slots_teacherId_idx" ON "tutor_slots"("teacherId");

-- CreateIndex
CREATE INDEX "tutor_slots_studentId_idx" ON "tutor_slots"("studentId");

-- CreateIndex
CREATE INDEX "attendance_groupId_date_idx" ON "attendance"("groupId", "date");

-- CreateIndex
CREATE INDEX "attendance_studentId_idx" ON "attendance"("studentId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "grades_studentId_idx" ON "grades"("studentId");

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "messages_receiverId_idx" ON "messages"("receiverId");

-- CreateIndex
CREATE INDEX "reward_redemptions_studentId_idx" ON "reward_redemptions"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_queue_studentId_key" ON "speaking_queue"("studentId");

-- CreateIndex
CREATE INDEX "speaking_messages_roomId_idx" ON "speaking_messages"("roomId");

-- CreateIndex
CREATE INDEX "speaking_signals_roomId_idx" ON "speaking_signals"("roomId");

-- CreateIndex
CREATE INDEX "lesson_logs_groupId_idx" ON "lesson_logs"("groupId");

-- CreateIndex
CREATE INDEX "student_notes_teacherId_studentId_idx" ON "student_notes"("teacherId", "studentId");

-- CreateIndex
CREATE INDEX "homework_templates_teacherId_idx" ON "homework_templates"("teacherId");

-- CreateIndex
CREATE INDEX "announcements_scope_idx" ON "announcements"("scope");

-- CreateIndex
CREATE INDEX "payments_studentId_idx" ON "payments"("studentId");

-- CreateIndex
CREATE INDEX "review_items_studentId_dueAt_idx" ON "review_items"("studentId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_items_studentId_itemKey_key" ON "review_items"("studentId", "itemKey");

-- CreateIndex
CREATE INDEX "skill_states_studentId_idx" ON "skill_states"("studentId");

-- CreateIndex
CREATE INDEX "skill_states_stage_idx" ON "skill_states"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "skill_states_studentId_skill_key" ON "skill_states"("studentId", "skill");

-- CreateIndex
CREATE INDEX "study_materials_module_idx" ON "study_materials"("module");

-- CreateIndex
CREATE UNIQUE INDEX "daily_articles_date_key" ON "daily_articles"("date");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "GeneratedTest_module_published_idx" ON "GeneratedTest"("module", "published");

-- CreateIndex
CREATE INDEX "learning_events_studentId_createdAt_idx" ON "learning_events"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "learning_events_studentId_kind_idx" ON "learning_events"("studentId", "kind");

-- CreateIndex
CREATE INDEX "learning_events_studentId_dayKey_idx" ON "learning_events"("studentId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "learning_profiles_studentId_key" ON "learning_profiles"("studentId");

-- CreateIndex
CREATE INDEX "learning_profiles_preferredStyle_idx" ON "learning_profiles"("preferredStyle");

-- CreateIndex
CREATE INDEX "learning_profiles_computedAt_idx" ON "learning_profiles"("computedAt");

-- CreateIndex
CREATE INDEX "learning_profile_snapshots_dayKey_idx" ON "learning_profile_snapshots"("dayKey");

-- CreateIndex
CREATE INDEX "learning_profile_snapshots_studentId_dayKey_idx" ON "learning_profile_snapshots"("studentId", "dayKey");

-- CreateIndex
CREATE UNIQUE INDEX "learning_profile_snapshots_studentId_dayKey_key" ON "learning_profile_snapshots"("studentId", "dayKey");

-- CreateIndex
CREATE INDEX "xp_transactions_studentId_createdAt_idx" ON "xp_transactions"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "xp_transactions_refId_idx" ON "xp_transactions"("refId");

-- CreateIndex
CREATE UNIQUE INDEX "xp_transactions_studentId_idempotencyKey_key" ON "xp_transactions"("studentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "mock_attempts_studentId_status_idx" ON "mock_attempts"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "listening_audio_testId_partIndex_key" ON "listening_audio"("testId", "partIndex");

-- CreateIndex
CREATE INDEX "speaking_recordings_studentId_createdAt_idx" ON "speaking_recordings"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "speaking_recordings_expiresAt_idx" ON "speaking_recordings"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_recordings_studentId_attemptKey_questionIndex_key" ON "speaking_recordings"("studentId", "attemptKey", "questionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "test_reviews_testId_key" ON "test_reviews"("testId");

-- CreateIndex
CREATE INDEX "test_reviews_studentId_idx" ON "test_reviews"("studentId");

-- CreateIndex
CREATE INDEX "test_reviews_reviewerId_createdAt_idx" ON "test_reviews"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "placement_attempts_studentId_status_idx" ON "placement_attempts"("studentId", "status");

-- CreateIndex
CREATE INDEX "placement_attempts_finishedAt_idx" ON "placement_attempts"("finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_userId_key" ON "telegram_links"("userId");

-- CreateIndex
CREATE INDEX "telegram_links_chatId_idx" ON "telegram_links"("chatId");

-- CreateIndex
CREATE INDEX "telegram_links_studentId_idx" ON "telegram_links"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_chatId_studentId_key" ON "telegram_links"("chatId", "studentId");

-- CreateIndex
CREATE INDEX "telegram_link_codes_userId_idx" ON "telegram_link_codes"("userId");

-- CreateIndex
CREATE INDEX "telegram_link_codes_studentId_idx" ON "telegram_link_codes"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_entries_word_lang_key" ON "dictionary_entries"("word", "lang");

-- CreateIndex
CREATE UNIQUE INDEX "cron_runs_job_day_key" ON "cron_runs"("job", "day");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_students" ADD CONSTRAINT "roster_students_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework" ADD CONSTRAINT "homework_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_gradedBy_fkey" FOREIGN KEY ("gradedBy") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ielts_tests" ADD CONSTRAINT "ielts_tests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_sessions" ADD CONSTRAINT "speaking_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_links" ADD CONSTRAINT "parent_student_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_slots" ADD CONSTRAINT "tutor_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_slots" ADD CONSTRAINT "tutor_slots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_logs" ADD CONSTRAINT "lesson_logs_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_logs" ADD CONSTRAINT "lesson_logs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_templates" ADD CONSTRAINT "homework_templates_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_states" ADD CONSTRAINT "skill_states_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_profiles" ADD CONSTRAINT "learning_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_profile_snapshots" ADD CONSTRAINT "learning_profile_snapshots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_attempts" ADD CONSTRAINT "mock_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_recordings" ADD CONSTRAINT "speaking_recordings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_reviews" ADD CONSTRAINT "test_reviews_testId_fkey" FOREIGN KEY ("testId") REFERENCES "ielts_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_attempts" ADD CONSTRAINT "placement_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
