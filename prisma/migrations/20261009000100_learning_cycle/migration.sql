-- Explicit controlled migration. Not appended to legacy deploy.sql: preview builds
-- must not silently modify a production DB. Enable LEARNING_CYCLE only after staging.
CREATE TABLE IF NOT EXISTS "learning_cycles" (
 "id" TEXT PRIMARY KEY, "originalId" TEXT NOT NULL UNIQUE REFERENCES "ielts_tests"("id") ON DELETE CASCADE,
 "plan" JSONB NOT NULL CHECK (jsonb_typeof("plan") = 'object'), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "learning_cycles_createdAt_idx" ON "learning_cycles"("createdAt");
CREATE TABLE IF NOT EXISTS "learning_cycle_entries" (
 "id" TEXT PRIMARY KEY, "cycleId" TEXT NOT NULL REFERENCES "learning_cycles"("id") ON DELETE CASCADE,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('REVISION','TRANSFER')), "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','SUBMITTED')),
 "body" TEXT NOT NULL CHECK (length("body") BETWEEN 1 AND 20000), "reflection" TEXT NOT NULL DEFAULT '' CHECK (length("reflection") <= 1500),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE ("cycleId","kind")
);
CREATE INDEX IF NOT EXISTS "learning_cycle_entries_status_createdAt_idx" ON "learning_cycle_entries"("status","createdAt");
CREATE TABLE IF NOT EXISTS "learning_cycle_reviews" (
 "id" TEXT PRIMARY KEY, "entryId" TEXT NOT NULL UNIQUE REFERENCES "learning_cycle_entries"("id") ON DELETE CASCADE,
 "reviewerId" TEXT REFERENCES "users"("id") ON DELETE SET NULL, "reviewerName" TEXT NOT NULL,
 "outcomes" JSONB NOT NULL CHECK (jsonb_typeof("outcomes") = 'array'), "comment" TEXT NOT NULL CHECK (length("comment") BETWEEN 10 AND 2000),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
