-- ============================================================================
-- Listening part boundaries of supplied whole recordings
-- (.kiro/specs/new-tests-articles-listening-parts). One row per paper; the
-- paper and its listening_audio row are never touched. Additive and rerunnable.
-- ============================================================================
CREATE TABLE IF NOT EXISTS "listening_part_segments" (
    "testId"          TEXT NOT NULL,
    "recordingSha256" TEXT NOT NULL,
    "durationMs"      INTEGER NOT NULL,
    "candidates"      JSONB,
    "segments"        JSONB,
    "verifiedById"    TEXT,
    "verifiedAt"      TIMESTAMP(3),
    "revision"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listening_part_segments_pkey" PRIMARY KEY ("testId"),
    CONSTRAINT "listening_part_segments_verifiedById_fkey"
        FOREIGN KEY ("verifiedById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);