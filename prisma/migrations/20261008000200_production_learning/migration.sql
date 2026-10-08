-- CreateTable
CREATE TABLE "mistake_entries" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "wrong" TEXT NOT NULL,
    "right" TEXT NOT NULL,
    "note" TEXT,
    "sourceTestId" TEXT,
    "practiceCount" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mistake_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_tokens" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mistake_entries_studentId_createdAt_idx" ON "mistake_entries"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "account_tokens_userId_purpose_idx" ON "account_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "account_tokens_expiresAt_idx" ON "account_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");

-- AddForeignKey
ALTER TABLE "mistake_entries" ADD CONSTRAINT "mistake_entries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
