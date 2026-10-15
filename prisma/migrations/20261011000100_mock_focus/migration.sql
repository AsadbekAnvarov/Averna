
-- Advisory visibility episodes; no changes to answers, clocks, results or existing attempts.
CREATE TABLE IF NOT EXISTS "mock_focus_events" (
 "id" TEXT NOT NULL PRIMARY KEY, "attemptId" TEXT NOT NULL REFERENCES "mock_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "eventId" TEXT NOT NULL, "kind" TEXT NOT NULL, "section" INTEGER NOT NULL,
 "leftAt" TIMESTAMP(3) NOT NULL, "returnedAt" TIMESTAMP(3), "durationMs" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "mock_focus_events_attemptId_eventId_key" ON "mock_focus_events"("attemptId", "eventId");
CREATE INDEX IF NOT EXISTS "mock_focus_events_attemptId_leftAt_idx" ON "mock_focus_events"("attemptId", "leftAt");
