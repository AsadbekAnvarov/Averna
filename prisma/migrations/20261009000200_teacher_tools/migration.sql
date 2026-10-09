-- Controlled staging migration; deliberately NOT part of automatic deploy.sql.
CREATE TABLE IF NOT EXISTS "classroom_sessions" (
 "id" TEXT PRIMARY KEY, "groupId" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
 "createdBy" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
 "topic" TEXT NOT NULL CHECK(length("topic") BETWEEN 3 AND 160), "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK("status" IN ('OPEN','CLOSED')),
 "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "classroom_sessions_one_open" ON "classroom_sessions"("groupId") WHERE "status"='OPEN';
CREATE INDEX IF NOT EXISTS "classroom_sessions_groupId_openedAt_idx" ON "classroom_sessions"("groupId","openedAt");
CREATE TABLE IF NOT EXISTS "classroom_signals" (
 "id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL REFERENCES "classroom_sessions"("id") ON DELETE CASCADE,
 "studentId" TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
 "kind" TEXT NOT NULL CHECK("kind" IN ('UNDERSTOOD','EXAMPLE','QUESTION')), "question" TEXT NOT NULL DEFAULT '' CHECK(length("question")<=500),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK("version">0), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("sessionId","studentId")
);
CREATE TABLE IF NOT EXISTS "classroom_polls" (
 "id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL REFERENCES "classroom_sessions"("id") ON DELETE CASCADE,
 "prompt" TEXT NOT NULL CHECK(length("prompt") BETWEEN 5 AND 600), "options" JSONB NOT NULL CHECK(jsonb_typeof("options")='array' AND jsonb_array_length("options") BETWEEN 2 AND 4),
 "correct" INTEGER NOT NULL CHECK("correct">=0 AND "correct"<jsonb_array_length("options")),
 "explanation" TEXT NOT NULL CHECK(length("explanation") BETWEEN 10 AND 1200), "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK("status" IN ('OPEN','CLOSED')),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "classroom_polls_one_open" ON "classroom_polls"("sessionId") WHERE "status"='OPEN';
CREATE INDEX IF NOT EXISTS "classroom_polls_sessionId_createdAt_idx" ON "classroom_polls"("sessionId","createdAt");
CREATE TABLE IF NOT EXISTS "classroom_answers" (
 "id" TEXT PRIMARY KEY, "pollId" TEXT NOT NULL REFERENCES "classroom_polls"("id") ON DELETE CASCADE,
 "studentId" TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE, "option" INTEGER NOT NULL CHECK("option" BETWEEN 0 AND 3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("pollId","studentId")
);
CREATE TABLE IF NOT EXISTS "calibration_references" (
 "id" TEXT PRIMARY KEY, "authorId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
 "title" TEXT NOT NULL CHECK(length("title") BETWEEN 3 AND 120), "module" TEXT NOT NULL CHECK("module" IN ('TASK1','TASK2')),
 "prompt" TEXT NOT NULL CHECK(length("prompt") BETWEEN 20 AND 3000), "body" TEXT NOT NULL CHECK(length("body") BETWEEN 100 AND 20000),
 "scores" JSONB NOT NULL CHECK(jsonb_typeof("scores")='object'), "rationale" TEXT NOT NULL CHECK(length("rationale") BETWEEN 30 AND 4000),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "calibration_ratings" (
 "id" TEXT PRIMARY KEY, "referenceId" TEXT NOT NULL REFERENCES "calibration_references"("id") ON DELETE CASCADE,
 "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "scores" JSONB NOT NULL CHECK(jsonb_typeof("scores")='object'), "quote" TEXT NOT NULL CHECK(length("quote") BETWEEN 10 AND 500),
 "rationale" TEXT NOT NULL CHECK(length("rationale") BETWEEN 20 AND 2000), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("referenceId","userId")
);
CREATE INDEX IF NOT EXISTS "calibration_ratings_userId_createdAt_idx" ON "calibration_ratings"("userId","createdAt");
