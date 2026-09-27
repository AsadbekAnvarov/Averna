/**
 * Run a scheduled job at most once per Tashkent day.
 *
 * Both Vercel projects deploy this repository and share the database, so both
 * crons fire; the unique (job, day) row makes the second call a no-op.
 * SERVER ONLY.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { tashkentDateKey } from "@/lib/utils";

export type JobResult = Record<string, string | number | boolean | null>;

export async function runOncePerDay(
  job: string,
  fn: () => Promise<JobResult>,
  now: Date = new Date()
): Promise<{ ran: boolean; result?: JobResult; error?: string }> {
  const day = tashkentDateKey(now);
  try {
    await db.cronRun.create({ data: { job, day, status: "running" } });
  } catch {
    // Unique violation: already ran (or is running) today. A run stuck in
    // "running" for over an hour (crashed invocation) may be retried.
    const row = await db.cronRun.findUnique({ where: { job_day: { job, day } } }).catch(() => null);
    const stale = row && row.status === "running" && Date.now() - row.updatedAt.getTime() > 60 * 60 * 1000;
    if (!stale) return { ran: false };
    await db.cronRun.update({ where: { job_day: { job, day } }, data: { status: "running" } }).catch(() => null);
  }
  try {
    const result = await fn();
    await db.cronRun
      .update({ where: { job_day: { job, day } }, data: { status: "done", details: result as Prisma.InputJsonValue } })
      .catch(() => null);
    return { ran: true, result };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.cronRun
      .update({ where: { job_day: { job, day } }, data: { status: "failed", details: { error } as Prisma.InputJsonValue } })
      .catch(() => null);
    return { ran: true, error };
  }
}
