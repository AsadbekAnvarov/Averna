-- ============================================================================
-- Averna — deploy-time schema application (ADDITIVE ONLY)
-- ============================================================================
--
-- This file is run on every deploy by `npm run vercel-build`
-- (prisma db execute --file prisma/sql/deploy.sql).
--
-- WHY THIS EXISTS INSTEAD OF `prisma db push`
--
-- `prisma db push` reconciles the ENTIRE schema against the database on every
-- build. That makes a deploy hostage to any unrelated drift between the live
-- database and schema.prisma: a single pre-existing difference makes push refuse
-- with "Use the --accept-data-loss flag…", and adding that flag would let every
-- future build silently DROP real data.
--
-- This script instead applies only the additive changes the application needs.
-- There is no DROP, no ALTER of an existing column and no type change anywhere
-- in it, so it can never lose data and never fails on unrelated drift.
--
-- IDEMPOTENT BY CONSTRUCTION
--   Every statement is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT
--   EXISTS`. Foreign keys are declared INSIDE the CREATE TABLE, so they are
--   created exactly once with the table and never re-attempted on a later run.
--   Re-running the whole file is a safe no-op. (No `DO $$ … $$` blocks, so no
--   dollar-quoting for `prisma db execute` to mis-split.)
--
-- ADDING SOMETHING IN FUTURE
--   Append another `CREATE TABLE IF NOT EXISTS …` or
--   `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` (both additive and idempotent).
--   Never put a DROP here. For a deliberate destructive change, preview it with
--   `npm run db:drift` and apply it out-of-band via `npm run db:deploy:pushfull`.
--
-- ============================================================================
-- Learning DNA Engine (AVERNA-001)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- learning_events — append-only behavioural sensor stream
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "learning_events" (
    "id"          TEXT NOT NULL,
    "studentId"   TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "skill"       TEXT,
    "channel"     TEXT NOT NULL,
    "accuracy"    DOUBLE PRECISION,
    "durationMin" DOUBLE PRECISION,
    "items"       INTEGER,
    "correct"     INTEGER,
    "words"       INTEGER,
    "diversity"   DOUBLE PRECISION,
    "confidence"  DOUBLE PRECISION,
    "difficulty"  TEXT,
    "errorTags"   TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origin"      TEXT NOT NULL DEFAULT 'sensor',
    "hourLocal"   INTEGER NOT NULL,
    "weekday"     INTEGER NOT NULL,
    "dayKey"      TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_events_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "learning_events_studentId_createdAt_idx"
    ON "learning_events" ("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "learning_events_studentId_kind_idx"
    ON "learning_events" ("studentId", "kind");
CREATE INDEX IF NOT EXISTS "learning_events_studentId_dayKey_idx"
    ON "learning_events" ("studentId", "dayKey");

-- ---------------------------------------------------------------------------
-- learning_profiles — the living profile (one row per student)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "learning_profiles" (
    "id"                  TEXT NOT NULL,
    "studentId"           TEXT NOT NULL,
    "version"             INTEGER NOT NULL DEFAULT 1,
    "computedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataPoints"          INTEGER NOT NULL DEFAULT 0,
    "maturity"            INTEGER NOT NULL DEFAULT 0,
    "confidence"          TEXT NOT NULL DEFAULT 'insufficient',
    "preferredStyle"      TEXT,
    "styleConfidence"     TEXT NOT NULL DEFAULT 'insufficient',
    "focusMinutes"        INTEGER,
    "fatiguePointMin"     INTEGER,
    "idealLessonMin"      INTEGER,
    "optimalDaypart"      TEXT,
    "optimalHourStart"    INTEGER,
    "optimalHourEnd"      INTEGER,
    "confidenceScore"     INTEGER,
    "retentionScore"      INTEGER,
    "memoryHalfLifeDays"  DOUBLE PRECISION,
    "consistencyScore"    INTEGER,
    "motivationScore"     INTEGER,
    "motivationTrend"     TEXT,
    "learningSpeed"       DOUBLE PRECISION,
    "revisionEfficiency"  INTEGER,
    "skillBalance"        INTEGER,
    "strongestSkill"      TEXT,
    "weakestSkill"        TEXT,
    "fastestGrowingSkill" TEXT,
    "vocabularyGrowth"    INTEGER,
    "grammarGrowth"       INTEGER,
    "speakingConfidence"  INTEGER,
    "writingComplexity"   INTEGER,
    "readingSpeedWpm"     INTEGER,
    "listeningAccuracy"   INTEGER,
    "payload"             JSONB NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_profiles_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "learning_profiles_studentId_key"
    ON "learning_profiles" ("studentId");
CREATE INDEX IF NOT EXISTS "learning_profiles_preferredStyle_idx"
    ON "learning_profiles" ("preferredStyle");
CREATE INDEX IF NOT EXISTS "learning_profiles_computedAt_idx"
    ON "learning_profiles" ("computedAt");

-- ---------------------------------------------------------------------------
-- learning_profile_snapshots — one row per student per day, for trends
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "learning_profile_snapshots" (
    "id"               TEXT NOT NULL,
    "studentId"        TEXT NOT NULL,
    "dayKey"           TEXT NOT NULL,
    "maturity"         INTEGER NOT NULL,
    "confidenceScore"  INTEGER,
    "retentionScore"   INTEGER,
    "consistencyScore" INTEGER,
    "motivationScore"  INTEGER,
    "learningSpeed"    DOUBLE PRECISION,
    "focusMinutes"     INTEGER,
    "dataPoints"       INTEGER NOT NULL DEFAULT 0,
    "preferredStyle"   TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_profile_snapshots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_profile_snapshots_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "learning_profile_snapshots_studentId_dayKey_key"
    ON "learning_profile_snapshots" ("studentId", "dayKey");
CREATE INDEX IF NOT EXISTS "learning_profile_snapshots_dayKey_idx"
    ON "learning_profile_snapshots" ("dayKey");
CREATE INDEX IF NOT EXISTS "learning_profile_snapshots_studentId_dayKey_idx"
    ON "learning_profile_snapshots" ("studentId", "dayKey");

-- ============================================================================
-- Group roster — students who belong to a group but have no site account
-- (young learners the admin tracks by hand). Additive; never touches `students`.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "roster_students" (
    "id"         TEXT NOT NULL,
    "groupId"    TEXT NOT NULL,
    "fullName"   TEXT NOT NULL,
    "parentName" TEXT,
    "phone"      TEXT,
    "age"        INTEGER,
    "note"       TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roster_students_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roster_students_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "groups"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "roster_students_groupId_idx"
    ON "roster_students" ("groupId");

-- ============================================================================
-- Progression Engine — idempotent XP ledger. The unique (studentId,
-- idempotencyKey) index is what stops double clicks / retries / refreshes from
-- awarding XP twice. Additive; never touches existing tables.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "xp_transactions" (
    "id"             TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "source"         TEXT NOT NULL,
    "amount"         INTEGER NOT NULL,
    "activity"       TEXT,
    "refId"          TEXT,
    "breakdown"      JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "xp_transactions_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "xp_transactions_studentId_idempotencyKey_key"
    ON "xp_transactions" ("studentId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "xp_transactions_studentId_createdAt_idx"
    ON "xp_transactions" ("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "xp_transactions_refId_idx"
    ON "xp_transactions" ("refId");

-- ============================================================================
-- Real IELTS mock exam — one row per sitting (papers, section clock, autosave,
-- per-section results). Additive; never touches existing tables.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "mock_attempts" (
    "id"               TEXT NOT NULL,
    "studentId"        TEXT NOT NULL,
    "status"           TEXT NOT NULL DEFAULT 'active',
    "papers"           JSONB NOT NULL,
    "current"          INTEGER NOT NULL DEFAULT 0,
    "sectionStartedAt" TIMESTAMP(3),
    "sectionDeadline"  TIMESTAMP(3),
    "draft"            JSONB,
    "results"          JSONB NOT NULL DEFAULT '{}',
    "overall"          DOUBLE PRECISION,
    "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"       TIMESTAMP(3),
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "mock_attempts_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mock_attempts_studentId_status_idx"
    ON "mock_attempts" ("studentId", "status");
-- At most one active sitting per student (two tabs pressing Start at once).
CREATE UNIQUE INDEX IF NOT EXISTS "mock_attempts_one_active_per_student"
    ON "mock_attempts" ("studentId") WHERE "status" = 'active';

-- ============================================================================
-- Teaching tools (Phase 3): exam homework, teacher reviews, recorded Speaking,
-- pre-rendered Listening audio, placement test, Telegram, dictionary cache.
-- Additive only: new tables and new NULLABLE columns.
-- ============================================================================

-- Exam homework from the test library.
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "contentKind" TEXT;
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "contentId" TEXT;
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "contentPart" INTEGER;
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "contentTitle" TEXT;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "testId" TEXT;
ALTER TABLE "homework_submissions" ADD COLUMN IF NOT EXISTS "band" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "homework_submissions_testId_idx" ON "homework_submissions" ("testId");

CREATE TABLE IF NOT EXISTS "listening_audio" (
    "id"         TEXT NOT NULL,
    "testId"     TEXT NOT NULL,
    "partIndex"  INTEGER NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'ready',
    "url"        TEXT,
    "bytes"      INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "scriptHash" TEXT NOT NULL,
    "voiceModel" TEXT NOT NULL,
    "timeline"   JSONB,
    "error"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listening_audio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "listening_audio_testId_partIndex_key"
    ON "listening_audio" ("testId", "partIndex");

CREATE TABLE IF NOT EXISTS "speaking_recordings" (
    "id"            TEXT NOT NULL,
    "studentId"     TEXT NOT NULL,
    "attemptKey"    TEXT NOT NULL,
    "setId"         TEXT NOT NULL,
    "part"          INTEGER NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "question"      TEXT NOT NULL,
    "transcript"    TEXT NOT NULL,
    "words"         INTEGER NOT NULL DEFAULT 0,
    "durationMs"    INTEGER NOT NULL DEFAULT 0,
    "audioUrl"      TEXT,
    "audioBytes"    INTEGER NOT NULL DEFAULT 0,
    "mimeType"      TEXT,
    "metrics"       JSONB,
    "expiresAt"     TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_recordings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "speaking_recordings_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "speaking_recordings_studentId_attemptKey_questionIndex_key"
    ON "speaking_recordings" ("studentId", "attemptKey", "questionIndex");
CREATE INDEX IF NOT EXISTS "speaking_recordings_studentId_createdAt_idx"
    ON "speaking_recordings" ("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "speaking_recordings_expiresAt_idx"
    ON "speaking_recordings" ("expiresAt");

CREATE TABLE IF NOT EXISTS "test_reviews" (
    "id"         TEXT NOT NULL,
    "testId"     TEXT NOT NULL,
    "studentId"  TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "aiBand"     DOUBLE PRECISION,
    "band"       DOUBLE PRECISION NOT NULL,
    "criteria"   JSONB,
    "comment"    TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "test_reviews_testId_fkey"
        FOREIGN KEY ("testId") REFERENCES "ielts_tests"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "test_reviews_testId_key" ON "test_reviews" ("testId");
CREATE INDEX IF NOT EXISTS "test_reviews_studentId_idx" ON "test_reviews" ("studentId");
CREATE INDEX IF NOT EXISTS "test_reviews_reviewerId_createdAt_idx" ON "test_reviews" ("reviewerId", "createdAt");

CREATE TABLE IF NOT EXISTS "placement_attempts" (
    "id"             TEXT NOT NULL,
    "studentId"      TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'active',
    "plan"           JSONB NOT NULL,
    "current"        INTEGER NOT NULL DEFAULT 0,
    "draft"          JSONB,
    "results"        JSONB NOT NULL DEFAULT '{}',
    "cefr"           TEXT,
    "band"           DOUBLE PRECISION,
    "recommendation" TEXT,
    "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"     TIMESTAMP(3),
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "placement_attempts_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "placement_attempts_studentId_status_idx"
    ON "placement_attempts" ("studentId", "status");
CREATE INDEX IF NOT EXISTS "placement_attempts_finishedAt_idx"
    ON "placement_attempts" ("finishedAt");
-- At most one active placement sitting per student.
CREATE UNIQUE INDEX IF NOT EXISTS "placement_attempts_one_active_per_student"
    ON "placement_attempts" ("studentId") WHERE "status" = 'active';

CREATE TABLE IF NOT EXISTS "telegram_links" (
    "id"        TEXT NOT NULL,
    "chatId"    TEXT NOT NULL,
    "role"      TEXT NOT NULL,
    "userId"    TEXT,
    "studentId" TEXT,
    "language"  TEXT NOT NULL DEFAULT 'uz',
    "username"  TEXT,
    "firstName" TEXT,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "prefs"     JSONB,
    "linkedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "telegram_links_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "telegram_links_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "students"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_links_userId_key" ON "telegram_links" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_links_chatId_studentId_key" ON "telegram_links" ("chatId", "studentId");
CREATE INDEX IF NOT EXISTS "telegram_links_chatId_idx" ON "telegram_links" ("chatId");
CREATE INDEX IF NOT EXISTS "telegram_links_studentId_idx" ON "telegram_links" ("studentId");

CREATE TABLE IF NOT EXISTS "telegram_link_codes" (
    "code"        TEXT NOT NULL,
    "kind"        TEXT NOT NULL,
    "userId"      TEXT,
    "studentId"   TEXT,
    "createdById" TEXT,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_codes_pkey" PRIMARY KEY ("code")
);
CREATE INDEX IF NOT EXISTS "telegram_link_codes_userId_idx" ON "telegram_link_codes" ("userId");
CREATE INDEX IF NOT EXISTS "telegram_link_codes_studentId_idx" ON "telegram_link_codes" ("studentId");

CREATE TABLE IF NOT EXISTS "dictionary_entries" (
    "id"        TEXT NOT NULL,
    "word"      TEXT NOT NULL,
    "lang"      TEXT NOT NULL,
    "data"      JSONB NOT NULL,
    "source"    TEXT NOT NULL,
    "hits"      INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dictionary_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "dictionary_entries_word_lang_key" ON "dictionary_entries" ("word", "lang");

CREATE TABLE IF NOT EXISTS "cron_runs" (
    "id"        TEXT NOT NULL,
    "job"       TEXT NOT NULL,
    "day"       TEXT NOT NULL,
    "status"    TEXT NOT NULL DEFAULT 'running',
    "details"   JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cron_runs_job_day_key" ON "cron_runs" ("job", "day");

-- ============================================================================
-- Accounts: password change (sessions signed in before it end).
-- Additive only: a new NULLABLE column.
-- ============================================================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

-- ============================================================================
-- End of additive deploy script. Nothing above can remove or modify data.
-- ============================================================================
