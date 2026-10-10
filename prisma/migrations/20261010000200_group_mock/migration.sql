-- Manual isolated-staging rollout; not automatic deploy.sql.
-- CreateTable
CREATE TABLE "mock_sessions" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'lobby',
    "distribution" TEXT NOT NULL DEFAULT 'unique',
    "pool" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "work" JSONB,
    "review" JSONB,
    "publishedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mock_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mock_sessions_code_key" ON "mock_sessions"("code");

-- CreateIndex
CREATE INDEX "mock_sessions_teacherId_createdAt_idx" ON "mock_sessions"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "mock_sessions_groupId_state_idx" ON "mock_sessions"("groupId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "mock_participants_attemptId_key" ON "mock_participants"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "mock_participants_sessionId_studentId_key" ON "mock_participants"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "mock_participants_sessionId_ordinal_key" ON "mock_participants"("sessionId", "ordinal");

-- AddForeignKey
ALTER TABLE "mock_sessions" ADD CONSTRAINT "mock_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_sessions" ADD CONSTRAINT "mock_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_participants" ADD CONSTRAINT "mock_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "mock_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_participants" ADD CONSTRAINT "mock_participants_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_participants" ADD CONSTRAINT "mock_participants_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "mock_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
