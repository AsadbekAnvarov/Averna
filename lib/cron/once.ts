/**
 * Run a scheduled job at most once per Tashkent day.
 *
 * Both Vercel projects deploy this repository and share the database, so both
 * crons fire (Hobby: somewhere in the same hour). The unique (job, day) row
 * makes the second call a no-op:
 *
 *   - `ready` is asked first: a project that can't run the job (its Telegram or
 *     Blob configuration is missing) returns { skipped } WITHOUT claiming the
 *     day, so the project that can still runs it;
 *   - only a unique violation (P2002) means "already claimed"; any other
 *     database error comes back as { error } (the route answers 500);
 *   - a `failed` run, or one still "running" after STALE_RUN_MS (killed at the
 *     route's 60 s maxDuration), is taken over by a compare-and-set — of two
 *     late invocations only one wins.
 *
 * SERVER ONLY.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { tashkentDateKey } from "@/lib/utils";

export type JobResult = Record<string, string | number | boolean | null>;

/** More than twice the cron route's maxDuration (60 s): a "running" row this old belongs to a killed invocation. */
export const STALE_RUN_MS = 3 * 60 * 1000;

export interface RunOnceOptions {
  /** Picks the Tashkent day (default: now). */
  now?: Date;
  /** Can this deployment run the job? When false, the day is not claimed. */
  ready?: () => boolean | Promise<boolean>;
}

export interface RunOnceResult {
  ran: boolean;
  result?: JobResult;
  /** The job threw, or the day couldn't be claimed (database error). */
  error?: string;
  /** Not run here, and the day left unclaimed for the other project. */
  skipped?: string;
  /** A failed or stale run of the same day was taken over. */
  takenOver?: boolean;
}

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2002";
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runOncePerDay(
  job: string,
  fn: () => Promise<JobResult>,
  options: RunOnceOptions | Date = {}
): Promise<RunOnceResult> {
  const opts: RunOnceOptions = options instanceof Date ? { now: options } : options;
  const day = tashkentDateKey(opts.now ?? new Date());

  if (opts.ready) {
    let ready: boolean;
    try {
      ready = await opts.ready();
    } catch (e) {
      console.error(`Cron ${job}: readiness check failed:`, e);
      return { ran: false, error: `readiness check failed: ${messageOf(e)}` };
    }
    if (!ready) return { ran: false, skipped: "not configured" };
  }

  let takenOver = false;
  try {
    await db.cronRun.create({ data: { job, day, status: "running" } });
  } catch (e) {
    if (!isUniqueViolation(e)) {
      console.error(`Cron ${job}: claiming ${day} failed:`, e);
      return { ran: false, error: `claim failed: ${messageOf(e)}` };
    }
    // Claimed already. Take over only a failed run or a stale "running" one — compare-and-set.
    try {
      const won: { count: number } = await db.cronRun.updateMany({
        where: {
          job,
          day,
          OR: [{ status: "failed" }, { status: "running", updatedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } }],
        },
        data: { status: "running", updatedAt: new Date() },
      });
      if (won.count !== 1) return { ran: false };
      takenOver = true;
    } catch (e2) {
      console.error(`Cron ${job}: taking over ${day} failed:`, e2);
      return { ran: false, error: `claim failed: ${messageOf(e2)}` };
    }
  }

  const finish = async (status: "done" | "failed", details: Prisma.InputJsonValue) => {
    // A row left "running" would be taken over (and the job re-run) after STALE_RUN_MS — so try twice.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await db.cronRun.update({ where: { job_day: { job, day } }, data: { status, details } });
        return;
      } catch (e) {
        if (attempt === 1) console.error(`Cron ${job}: recording "${status}" failed:`, e);
      }
    }
  };
  const extra = takenOver ? { takenOver: true } : {};

  try {
    const result = await fn();
    await finish("done", result as Prisma.InputJsonValue);
    return { ran: true, result, ...extra };
  } catch (e) {
    const error = messageOf(e);
    console.error(`Cron ${job} failed:`, e);
    await finish("failed", { error } as Prisma.InputJsonValue);
    return { ran: true, error, ...extra };
  }
}
