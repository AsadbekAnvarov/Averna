import { NextRequest, NextResponse } from "next/server";
import { runOncePerDay } from "@/lib/cron/once";
import { telegramReady } from "@/lib/telegram/config";
import { runTelegramDaily } from "@/lib/telegram/daily";
import { cleanupSpeakingRecordings } from "@/lib/speaking/cleanup";
import { blobConfigured } from "@/lib/storage/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily scheduled job (vercel.json → "0 14 * * *": 19:00 Tashkent — the
 * Hobby plan fires it once a day, at some minute of that hour). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`; without CRON_SECRET the route refuses
 * to run, so nobody can trigger mass Telegram messages from outside.
 *
 * Each job claims the day only where it can run (runOncePerDay `ready`), so a
 * project without the Telegram or Blob configuration leaves it to the other
 * project. 500 when a job failed or the day couldn't be claimed.
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [telegram, recordings] = await Promise.all([
    runOncePerDay("telegram-daily", () => runTelegramDaily(new Date(), { startedAt }), { ready: telegramReady }),
    runOncePerDay("speaking-recordings-cleanup", () => cleanupSpeakingRecordings(), { ready: blobConfigured }),
  ]);
  const ok = !telegram.error && !recordings.error;
  return NextResponse.json({ ok, telegram, recordings }, { status: ok ? 200 : 500 });
}
