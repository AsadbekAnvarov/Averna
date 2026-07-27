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
-- End of additive deploy script. Nothing above can remove or modify data.
-- ============================================================================
