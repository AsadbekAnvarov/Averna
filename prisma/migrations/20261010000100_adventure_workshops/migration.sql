-- Manual isolated-staging migration. NOT appended to legacy automatic deploy.sql.
CREATE TABLE "adventure_workshops" (
  "id" TEXT PRIMARY KEY,
  "authorStudentId" TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "groupId" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "title" TEXT NOT NULL CHECK (char_length("title") BETWEEN 5 AND 100),
  "payload" JSONB NOT NULL CHECK (octet_length("payload"::text) <= 24000),
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK ("status" IN ('SUBMITTED','APPROVED','REJECTED')),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "feedback" TEXT CHECK (char_length("feedback") <= 800),
  "reviewerUserId" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "adventure_workshops_authorStudentId_requestId_key" ON "adventure_workshops"("authorStudentId", "requestId");
CREATE INDEX "adventure_workshops_groupId_status_updatedAt_idx" ON "adventure_workshops"("groupId", "status", "updatedAt");
