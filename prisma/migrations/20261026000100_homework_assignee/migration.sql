-- A homework row set for ONE student of its group (the teacher's one-button "mini task").
-- Nullable and additive: NULL = the whole group, exactly as before.
ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;
CREATE INDEX IF NOT EXISTS "homework_assigneeId_idx" ON "homework"("assigneeId");
