
-- Durable Writing retry queue: no essay copies, FK deletion with the saved attempt.
CREATE TABLE IF NOT EXISTS "ai_assessment_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "testId" TEXT NOT NULL UNIQUE REFERENCES "ielts_tests"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ai_assessment_jobs_status_nextAttemptAt_idx"
  ON "ai_assessment_jobs"("status", "nextAttemptAt");
