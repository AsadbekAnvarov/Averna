-- CreateTable
CREATE TABLE "finance_periods" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opening" JSONB NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closingSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_periods_pkey" PRIMARY KEY ("id"),
    CHECK ("status" IN ('OPEN','CLOSED') AND "month" ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')
);

-- CreateTable
CREATE TABLE "finance_staff" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "platformTeacherId" TEXT,
    "shareBps" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_staff_pkey" PRIMARY KEY ("id"),
    CHECK ("shareBps" IS NULL OR "shareBps" BETWEEN 0 AND 10000)
);

-- CreateTable
CREATE TABLE "finance_learners" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "groupName" TEXT NOT NULL,
    "platformStudentId" TEXT,
    "rosterStudentId" TEXT,
    "sourceKey" TEXT,
    "staffId" TEXT NOT NULL,
    "monthlyFee" DECIMAL(15,0) NOT NULL,
    "dueDay" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrolledOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_learners_pkey" PRIMARY KEY ("id"),
    CHECK ("monthlyFee" >= 0 AND "dueDay" BETWEEN 1 AND 28)
);

-- CreateTable
CREATE TABLE "finance_invoices" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "learnerName" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "amount" DECIMAL(15,0) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_invoices_pkey" PRIMARY KEY ("id"),
    CHECK ("amount" > 0 AND "shareBps" BETWEEN 0 AND 10000)
);

-- CreateTable
CREATE TABLE "finance_entries" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(15,0) NOT NULL,
    "earned" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL,
    "category" TEXT,
    "invoiceId" TEXT,
    "staffId" TEXT,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "reversesId" TEXT,
    "refundOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_entries_pkey" PRIMARY KEY ("id"),
    CHECK ("amount" <> 0 AND "kind" IN ('TUITION','OTHER_INCOME','EXPENSE','ADVANCE','SALARY','REFUND','REVERSAL') AND "channel" IN ('CASH','CARD','TERMINAL','TRANSFER')),
    CHECK (("kind" IN ('TUITION','OTHER_INCOME') AND "amount" > 0) OR ("kind" IN ('EXPENSE','ADVANCE','SALARY','REFUND') AND "amount" < 0) OR "kind"='REVERSAL'),
    CHECK ("kind" <> 'REVERSAL' OR "reversesId" IS NOT NULL),
    CHECK ("kind" NOT IN ('TUITION','REFUND') OR ("invoiceId" IS NOT NULL AND "staffId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "finance_accruals" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "amount" DECIMAL(15,0) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_leads" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "groupName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "appointmentAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_requests" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_periods_month_key" ON "finance_periods"("month");

-- CreateIndex
CREATE UNIQUE INDEX "finance_staff_platformTeacherId_key" ON "finance_staff"("platformTeacherId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_learners_platformStudentId_key" ON "finance_learners"("platformStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_learners_rosterStudentId_key" ON "finance_learners"("rosterStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_learners_sourceKey_key" ON "finance_learners"("sourceKey");

-- CreateIndex
CREATE INDEX "finance_learners_status_groupName_idx" ON "finance_learners"("status", "groupName");

-- CreateIndex
CREATE UNIQUE INDEX "finance_invoices_periodId_learnerId_key" ON "finance_invoices"("periodId", "learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_entries_reversesId_key" ON "finance_entries"("reversesId");

-- CreateIndex
CREATE INDEX "finance_entries_periodId_occurredAt_idx" ON "finance_entries"("periodId", "occurredAt");

-- CreateIndex
CREATE INDEX "finance_entries_staffId_idx" ON "finance_entries"("staffId");

-- CreateIndex
CREATE INDEX "finance_entries_invoiceId_idx" ON "finance_entries"("invoiceId");

-- CreateIndex
CREATE INDEX "finance_accruals_periodId_staffId_idx" ON "finance_accruals"("periodId", "staffId");

-- CreateIndex
CREATE INDEX "finance_leads_status_idx" ON "finance_leads"("status");

-- AddForeignKey
ALTER TABLE "finance_learners" ADD CONSTRAINT "finance_learners_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "finance_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "finance_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "finance_learners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "finance_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "finance_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "finance_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "finance_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "finance_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_entries" ADD CONSTRAINT "finance_entries_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "finance_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_accruals" ADD CONSTRAINT "finance_accruals_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "finance_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_accruals" ADD CONSTRAINT "finance_accruals_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "finance_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

