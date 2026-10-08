/** Durable single-task Writing retries. No XP re-award and no teacher grade overwrite. */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assessWritingTask, hasOpenAI } from "@/lib/ai";
import { validateWritingAssessment } from "@/lib/assessment-writing";
import { guardAi } from "@/lib/engine/ai-guard";
import { ASSESSMENT_LEASE_MS, MAX_ASSESSMENT_ATTEMPTS, assessmentEligible, retryDelayMs } from "./retry-policy";

export async function processWritingRetry(testId?: string): Promise<string> {
  if (!hasOpenAI()) return "unconfigured";
  const now = new Date();
  const due = { ...(testId ? { testId } : {}), OR: [
    { status: "pending", nextAttemptAt: { lte: now } },
    { status: "running", leaseUntil: { lte: now } },
  ] };
  const job = await db.aiAssessmentJob.findFirst({ where: due, orderBy: { nextAttemptAt: "asc" } });
  if (!job) return "idle";
  const token = randomUUID();
  const won = await db.aiAssessmentJob.updateMany({
    where: { id: job.id, ...due },
    data: { status: "running", leaseToken: token, leaseUntil: new Date(Date.now() + ASSESSMENT_LEASE_MS) },
  });
  if (won.count !== 1) return "busy";
  const fence = { id: job.id, status: "running", leaseToken: token };
  const finish = async (status: string, lastError: string | null = null, delay = 0) => {
    await db.aiAssessmentJob.updateMany({ where: fence, data: {
      status, lastError, nextAttemptAt: new Date(Date.now() + delay), leaseToken: null, leaseUntil: null,
    } });
    return status;
  };
  let attempts = job.attempts;
  try {
    if (attempts >= MAX_ASSESSMENT_ATTEMPTS) return await finish("failed", "attempt_limit");
    const test = await db.iELTSTest.findUnique({ where: { id: job.testId }, include: {
      review: { select: { testId: true } }, student: { select: { userId: true } },
    } });
    if (!test || !assessmentEligible(test.module, test.answers, test.aiAnalysis, !!test.review)) return await finish("skipped");
    const limit = await guardAi(test.student.userId, "writing-submit");
    if (!limit.ok) return await finish("pending", "budget_unavailable", Math.max(300, limit.retryAfterSeconds ?? 300) * 1000);
    const started = await db.aiAssessmentJob.updateMany({ where: fence, data: { attempts: { increment: 1 } } });
    if (started.count !== 1) return "superseded";
    attempts++;
    const answers = test.answers as { essay: string; prompt: string; taskType: "task1" | "task2" };
    const result = await assessWritingTask(answers.essay, answers.taskType, answers.prompt);
    if (result.source !== "ai") throw new Error("No AI result");
    const assessment = validateWritingAssessment(result, answers.essay);
    return await db.$transaction(async tx => {
      // Lock the lease first. A superseded worker cannot write results or notify.
      const committed = await tx.aiAssessmentJob.updateMany({ where: { ...fence, leaseUntil: { gt: new Date() } }, data: {
        status: "done", leaseToken: null, leaseUntil: null, lastError: null,
      } });
      if (committed.count !== 1) return "superseded";
      await tx.$queryRaw`SELECT "id" FROM "ielts_tests" WHERE "id" = ${test.id} FOR UPDATE`;
      const current = await tx.iELTSTest.findUnique({ where: { id: test.id }, include: { review: { select: { testId: true } } } });
      if (!current || !assessmentEligible(current.module, current.answers, current.aiAnalysis, !!current.review)) {
        await tx.aiAssessmentJob.update({ where: { id: job.id }, data: { status: "skipped" } });
        return "skipped";
      }
      await tx.iELTSTest.update({ where: { id: test.id }, data: {
        score: assessment.overallBand,
        aiAnalysis: { ...assessment, wordCount: answers.essay.trim().split(/\s+/).length } as Prisma.InputJsonValue,
      } });
      // Teacher owns GRADED homework; only refresh ungraded practice estimates.
      await tx.homeworkSubmission.updateMany({ where: { testId: test.id, status: { not: "GRADED" } }, data: { band: assessment.overallBand } });
      // In-app notice is atomic with done, so a retry cannot duplicate it.
      await tx.notification.create({ data: {
        userId: test.student.userId, type: "grade", title: "Writing feedback is ready",
        message: "Your saved essay now has AI-assisted practice feedback. Your XP has not changed.",
        link: `/learning/writing/result/${test.id}`,
      } });
      return "done";
    }, { timeout: 10000 });
  } catch {
    // Store error codes only, never provider bodies, essays or credentials.
    return await finish(attempts >= MAX_ASSESSMENT_ATTEMPTS ? "failed" : "pending", "assessment_unavailable", retryDelayMs(attempts));
  }
}
