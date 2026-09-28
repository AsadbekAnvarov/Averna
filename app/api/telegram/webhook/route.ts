import { NextRequest, NextResponse } from "next/server";
import { runAfterResponse } from "@/lib/after-response";
import { safeEqual } from "@/lib/telegram/codes";
import { SECRET_HEADER, telegramReady, webhookSecret } from "@/lib/telegram/config";
import { botDeps } from "@/lib/telegram/store";
import { handleUpdate } from "@/lib/telegram/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Telegram updates are a few KB; anything bigger isn't one. */
const MAX_BODY_CHARS = 256 * 1024;
/** Answer well inside Telegram's patience even if the database is slow. */
const HANDLE_BUDGET_MS = 9000;

/**
 * Telegram → Averna bot updates (set up from Admin → Telegram).
 *
 * Only requests carrying X-Telegram-Bot-Api-Secret-Token equal to
 * TELEGRAM_WEBHOOK_SECRET are processed (constant-time compare); everything
 * else is rejected. A verified update is always answered 200 — errors are
 * logged, never retried by Telegram, never thrown. An update still being
 * handled after HANDLE_BUDGET_MS is answered and finished after the response
 * (runAfterResponse); a /start code is claimed and linked in one transaction,
 * so a cut-off can't spend it without linking.
 */
export async function POST(req: NextRequest) {
  const secret = webhookSecret();
  if (!secret || !telegramReady()) {
    return NextResponse.json({ ok: false, error: "Telegram bot is not configured." }, { status: 503 });
  }
  const given = req.headers.get(SECRET_HEADER) ?? "";
  if (!given || !safeEqual(given, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: unknown = null;
  try {
    const text = await req.text();
    if (text.length <= MAX_BODY_CHARS) update = JSON.parse(text);
  } catch {
    update = null;
  }

  if (update) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const work = handleUpdate(update, botDeps()); // never throws
      const finished = await Promise.race([
        work.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), HANDLE_BUDGET_MS);
        }),
      ]);
      // Still running (slow database …): answer now and keep the function alive until it's done.
      if (!finished) void runAfterResponse("Telegram update", () => work);
    } catch (e) {
      console.error("Telegram webhook failed:", e);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return NextResponse.json({ ok: true });
}
