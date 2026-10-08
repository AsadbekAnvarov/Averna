/** Bounded provider retry policy. A blocked budget does not consume an attempt. */
export const MAX_ASSESSMENT_ATTEMPTS = 5;
export const ASSESSMENT_LEASE_MS = 120_000;
export function retryDelayMs(attempts: number): number {
  return Math.min(6 * 60 * 60_000, 5 * 60_000 * 2 ** Math.max(0, attempts - 1));
}
export function assessmentEligible(module: string, answers: unknown, analysis: unknown, reviewed: boolean): boolean {
  const a = answers as Record<string, unknown> | null;
  const result = analysis as Record<string, unknown> | null;
  return module === "WRITING" && !reviewed && result?.source !== "ai"
    && !!a && typeof a.essay === "string" && !!a.essay.trim() && a.essay.length <= 20000
    && typeof a.prompt === "string" && !!a.prompt.trim() && a.prompt.length <= 10000
    && (a.taskType === "task1" || a.taskType === "task2")
    // Only single-task practice is supported; never partially update mock/exam aggregates.
    && !a.mockAttemptId && !a.examAttemptId;
}
