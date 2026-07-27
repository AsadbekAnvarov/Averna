-- ============================================================================
-- Learning DNA Engine (AVERNA-001) — additive schema.
-- ============================================================================
--
-- WHY THIS FILE EXISTS
--
-- The project deploys with `prisma db push`, which reconciles the WHOLE schema
-- on every build. That means one unrelated piece of drift between the database
-- and schema.prisma can block a deploy — and worse, "fixing" it with
-- `--accept-data-loss` would let a future build silently drop real data.
--
-- This script applies only the three new Learning DNA tables, explicitly and
-- additively. It contains no DROP, no ALTER of an existing table, and no column
-- change: there is nothing here that can lose data. Run it once and `db push`
-- has nothing left to add for this feature.
--
-- HOW TO RUN
--
--   Neon / Vercel Postgres console: paste and execute.
--   Or locally:  psql "$DATABASE_URL" -f prisma/sql/learning_dna.sql
--
-- Safe to run more than once — every statement is idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. learning_events — the append-only behavioural sensor stream
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

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "learning_events_studentId_createdAt_idx"
    ON "learning_events" ("studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "learning_events_studentId_kind_idx"
    ON "learning_events" ("studentId", "kind");
CREATE INDEX IF NOT EXISTS "learning_events_studentId_dayKey_idx"
    ON "learning_events" ("studentId", "dayKey");

-- ---------------------------------------------------------------------------
-- 2. learning_profiles — the living profile (one row per student)
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

    CONSTRAINT "learning_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "learning_profiles_studentId_key"
    ON "learning_profiles" ("studentId");
CREATE INDEX IF NOT EXISTS "learning_profiles_preferredStyle_idx"
    ON "learning_profiles" ("preferredStyle");
CREATE INDEX IF NOT EXISTS "learning_profiles_computedAt_idx"
    ON "learning_profiles" ("computedAt");

-- ---------------------------------------------------------------------------
-- 3. learning_profile_snapshots — one row per student per day, for trends
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

    CONSTRAINT "learning_profile_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "learning_profile_snapshots_studentId_dayKey_key"
    ON "learning_profile_snapshots" ("studentId", "dayKey");
CREATE INDEX IF NOT EXISTS "learning_profile_snapshots_dayKey_idx"
    ON "learning_profile_snapshots" ("dayKey");
CREATE INDEX IF NOT EXISTS "learning_profile_snapshots_studentId_dayKey_idx"
    ON "learning_profile_snapshots" ("studentId", "dayKey");

-- ---------------------------------------------------------------------------
-- 4. Foreign keys → students(id), cascading on delete
--
-- Added separately and guarded, because ADD CONSTRAINT has no IF NOT EXISTS in
-- PostgreSQL and this script must stay re-runnable.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'learning_events_studentId_fkey'
    ) THEN
        ALTER TABLE "learning_events"
            ADD CONSTRAINT "learning_events_studentId_fkey"
            FOREIGN KEY ("studentId") REFERENCES "students"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'learning_profiles_studentId_fkey'
    ) THEN
        ALTER TABLE "learning_profiles"
            ADD CONSTRAINT "learning_profiles_studentId_fkey"
            FOREIGN KEY ("studentId") REFERENCES "students"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'learning_profile_snapshots_studentId_fkey'
    ) THEN
        ALTER TABLE "learning_profile_snapshots"
            ADD CONSTRAINT "learning_profile_snapshots_studentId_fkey"
            FOREIGN KEY ("studentId") REFERENCES "students"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- Done. Nothing above can remove or modify existing data.
-- ============================================================================
