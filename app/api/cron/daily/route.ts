import { NextRequest, NextResponse } from "next/server";
import { runOncePerDay } from "@/lib/cron/once";
import { runTelegramDaily } from "@/lib/telegram/daily";
import { cleanupSpeakingRecordings } from "@/lib/speaking/cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily scheduled job (vercel.json → "0 14 * * *" = 19:00 Tashkent; the
 * Hobby plan allows one run per day). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`; without CRON_SECRET the route refuses
 * to run, so nobody can trigger mass Telegram messages from outside.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [telegram, recordings] = await Promise.all([
    runOncePerDay("telegram-daily", () => runTelegramDaily()),
    runOncePerDay("speaking-recordings-cleanup", () => cleanupSpeakingRecordings()),
  ]);
  return NextResponse.json({ ok: true, telegram, recordings });
}
