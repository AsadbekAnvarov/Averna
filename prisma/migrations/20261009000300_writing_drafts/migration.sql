-- Explicit staging-first migration. Do not add to legacy automatic deploy.sql.
CREATE TABLE "writing_drafts" (
  "id" TEXT NOT NULL, "studentId" TEXT NOT NULL, "scope" TEXT NOT NULL,
  "promptHash" TEXT NOT NULL, "essay" TEXT NOT NULL, "attemptId" TEXT NOT NULL,
  "timeLeft" INTEGER NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "writing_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "writing_drafts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "writing_drafts_bounds" CHECK (char_length("essay") <= 20000 AND "timeLeft" BETWEEN 0 AND 2400 AND "version" >= 1)
);
CREATE UNIQUE INDEX "writing_drafts_studentId_scope_key" ON "writing_drafts"("studentId", "scope");

-- Supports the bounded recent-evidence query. Review index build time on staging.
CREATE INDEX "ielts_tests_studentId_completedAt_idx" ON "ielts_tests"("studentId", "completedAt");
