/**
 * Delete expired Speaking recordings (audio files in Blob; the transcript rows
 * stay). Called once per day by /api/cron/daily.
 *
 * Rows whose `expiresAt` has passed and that still have an `audioUrl` are
 * handled in batches of 500: the files are deleted from the Blob store, then
 * `audioUrl` is cleared. A failed delete stops the run and leaves the rows as
 * they were, so tomorrow's run tries again (deleting a file twice is harmless).
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { blobConfigured, deleteBlobs } from "@/lib/storage/blob";
import type { JobResult } from "@/lib/cron/once";

const BATCH = 500;
/** At most this many batches per run (10 000 files) … */
const MAX_BATCHES = 20;
/** … and well inside the cron route's 60 s (it shares them with the Telegram job). */
const TIME_BUDGET_MS = 40_000;

export async function cleanupSpeakingRecordings(now: Date = new Date()): Promise<JobResult> {
  // Without the store's token the files can't be deleted — keep the URLs so a later run can.
  if (!blobConfigured()) return { skipped: "Blob storage is not configured" };

  const started = Date.now();
  let deleted = 0;
  let failed = 0;
  let batches = 0;
  let more = false;

  while (batches < MAX_BATCHES) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      more = true;
      break;
    }
    const rows = (await db.speakingRecording.findMany({
      where: { expiresAt: { lt: now }, audioUrl: { not: null } },
      select: { id: true, audioUrl: true },
      orderBy: { expiresAt: "asc" },
      take: BATCH,
    })) as { id: string; audioUrl: string | null }[];
    if (!rows.length) break;
    batches++;

    const urls = rows.map((r) => r.audioUrl).filter((u): u is string => typeof u === "string" && u.length > 0);
    if (!(await deleteBlobs(urls))) {
      failed += rows.length;
      more = true;
      break;
    }
    // `expiresAt < now` again: a new take uploaded meanwhile has a fresh expiry and keeps its file.
    const r = await db.speakingRecording.updateMany({
      where: { id: { in: rows.map((x) => x.id) }, expiresAt: { lt: now } },
      data: { audioUrl: null, audioBytes: 0 },
    });
    deleted += typeof r?.count === "number" ? r.count : 0;
    if (rows.length < BATCH) break;
    if (batches === MAX_BATCHES) more = true;
  }

  return { deleted, failed, batches, more };
}
