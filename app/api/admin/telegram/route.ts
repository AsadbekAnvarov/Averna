import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { installWebhook, requestOrigin, sendAdminTestMessage, telegramAdminStatus } from "@/lib/telegram/admin";

export const dynamic = "force-dynamic";

/**
 * Admin → Telegram.
 *   GET                              status (config, bot, webhook, linked chats, latest cron runs with counts)
 *   POST { action: "set_webhook" }   setWebhook → <app URL: NEXTAUTH_URL, else the production domain>/api/telegram/webhook
 *                                    (+ command menu); refused on a preview deployment
 *   POST { action: "test_message" }  a test message to the admin's own linked chat
 * POST answers { ok, message | error, status }.
 */

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

async function admin(): Promise<{ id: string; name: string } | { error: string; status: number }> {
  try {
    const u = await requireAdmin();
    return { id: String(u.id), name: u.name ? String(u.name) : "Admin" };
  } catch (e) {
    const signedOut = e instanceof Error && e.message === "Unauthorized";
    return { error: signedOut ? "Tizimga qayta kiring." : "Faqat administratorlar uchun.", status: signedOut ? 401 : 403 };
  }
}

export async function GET(req: NextRequest) {
  const user = await admin();
  if ("error" in user) return json({ error: user.error }, user.status);
  try {
    return json(await telegramAdminStatus(requestOrigin(req.headers), user.id));
  } catch (e) {
    console.error("Telegram admin status failed:", e);
    return json({ error: "Holatni yuklab boʻlmadi — birozdan keyin qayta urinib koʻring." }, 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await admin();
  if ("error" in user) return json({ error: user.error }, user.status);
  const body: unknown = await req.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as { action?: unknown }).action : null;
  const origin = requestOrigin(req.headers);
  try {
    const r =
      action === "set_webhook"
        ? await installWebhook(origin)
        : action === "test_message"
          ? await sendAdminTestMessage(user.id, user.name)
          : null;
    if (!r) return json({ error: "Nomaʼlum amal." }, 400);
    const status = await telegramAdminStatus(origin, user.id).catch(() => null);
    return json(r.ok ? { ok: true, message: r.message, status } : { ok: false, error: r.error, status }, r.ok ? 200 : 400);
  } catch (e) {
    console.error("Telegram admin action failed:", e);
    return json({ error: "Amalni bajarib boʻlmadi — birozdan keyin qayta urinib koʻring." }, 500);
  }
}
