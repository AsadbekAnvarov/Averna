import { processWritingRetry } from "./writing-queue";
export interface BatchResult { processed: number; outcomes: Record<string, number>; }
/** Sequential bounded batch; leases and budgets remain owned by the existing queue. */
export async function processAssessmentBatch(options: { limit?: number; deadlineMs?: number; process?: () => Promise<string>; now?: () => number } = {}): Promise<BatchResult> {
  const run = options.process ?? processWritingRetry;
  const now = options.now ?? Date.now;
  const deadline = now() + Math.max(0, Math.min(options.deadlineMs ?? 40_000, 40_000));
  const limit = Math.max(0, Math.min(Math.floor(options.limit ?? 2), 2));
  const result: BatchResult = { processed: 0, outcomes: {} };
  for (let i = 0; i < limit; i++) {
    // Leave ~22s for a provider call plus commit, under the hosting 60s deadline.
    if (deadline - now() < 22_000) break;
    const outcome = await run();
    result.outcomes[outcome] = (result.outcomes[outcome] ?? 0) + 1;
    if (["idle", "unconfigured", "busy"].includes(outcome)) break;
    result.processed++;
  }
  return result;
}
