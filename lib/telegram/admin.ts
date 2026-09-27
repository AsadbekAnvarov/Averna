/**
 * Admin → Telegram: configuration and bot status, installing the webhook and a
 * test message to the admin's own chat. Error texts are Uzbek (admin UI).
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { getMe, getWebhookInfo, sendMessage, setMyCommands, setWebhook } from "./api";
import { botToken, botUsername, publicOrigin, telegramConfig, webhookSecret, WEBHOOK_PATH } from "./config";
import { asLang, BOT_COMMANDS, testMessageText } from "./messages";
import { markChatsInactive } from "./notify";
import type { LinkRole, RoleCounts, TelegramAdminStatus } from "./types";

type Result = { ok: true; message: string } | { ok: false; error: string };

/** The origin this request came to (Vercel sets x-forwarded-host / -proto). */
export function requestOrigin(headers: { get(name: string): string | null }): string | null {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(",")[0].trim();
  const proto = (headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim().toLowerCase();
  if (!host || !/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host) || (proto !== "https" && proto !== "http")) return null;
  return `${proto}://${host}`;
}

/** <origin>/api/telegram/webhook — only for a public https origin. */
export function webhookUrlFor(origin: string | null): string | null {
  const o = publicOrigin(origin);
  return o ? `${o}${WEBHOOK_PATH}` : null;
}

async function roleCounts(): Promise<RoleCounts> {
  const out: RoleCounts = {
    student: { active: 0, inactive: 0 },
    teacher: { active: 0, inactive: 0 },
    admin: { active: 0, inactive: 0 },
    parent: { active: 0, inactive: 0 },
  };
  try {
    const rows: { role: string; active: boolean; _count: { _all: number } }[] = await db.telegramLink.groupBy({
      by: ["role", "active"],
      _count: { _all: true },
    });
    for (const r of rows) {
      const bucket = out[r.role as LinkRole];
      if (bucket) bucket[r.active ? "active" : "inactive"] += r._count._all;
    }
  } catch (e) {
    console.error("Telegram admin: link counts failed:", e);
  }
  return out;
}

export async function telegramAdminStatus(origin: string | null, userId: string): Promise<TelegramAdminStatus> {
  const config = telegramConfig();
  const [me, info, counts, mine] = await Promise.all([
    config.token ? getMe({ timeoutMs: 4000, retries: 0 }) : Promise.resolve(null),
    config.token ? getWebhookInfo({ timeoutMs: 4000, retries: 0 }) : Promise.resolve(null),
    roleCounts(),
    db.telegramLink
      .findUnique({ where: { userId }, select: { active: true, username: true } })
      .catch(() => null) as Promise<{ active: boolean; username: string | null } | null>,
  ]);

  const bot: TelegramAdminStatus["bot"] =
    me == null
      ? null
      : me.ok
        ? { ok: true, id: me.result.id, username: me.result.username ?? "", firstName: me.result.first_name }
        : { ok: false, error: me.description };
  const webhook: TelegramAdminStatus["webhook"] =
    info == null
      ? null
      : info.ok
        ? {
            ok: true,
            url: info.result.url ?? "",
            pendingUpdateCount: info.result.pending_update_count ?? 0,
            lastErrorDate: info.result.last_error_date ? new Date(info.result.last_error_date * 1000).toISOString() : null,
            lastErrorMessage: info.result.last_error_message ?? null,
            allowedUpdates: info.result.allowed_updates ?? null,
          }
        : { ok: false, error: info.description };

  return {
    config,
    bot,
    usernameMatches: bot && bot.ok && config.username ? bot.username.toLowerCase() === config.username.toLowerCase() : null,
    webhook,
    expectedWebhookUrl: webhookUrlFor(origin),
    counts,
    me: { linked: !!mine, active: !!mine?.active, username: mine?.username ?? null },
    checkedAt: new Date().toISOString(),
  };
}

/** setWebhook(<origin>/api/telegram/webhook, secret) + the "/" command menu (uz default, ru, en). */
export async function installWebhook(origin: string | null): Promise<Result> {
  if (!botToken()) return { ok: false, error: "TELEGRAM_BOT_TOKEN oʻrnatilmagan." };
  if (!botUsername()) return { ok: false, error: "TELEGRAM_BOT_USERNAME yoʻq yoki notoʻgʻri (@ belgisisiz, masalan AvernaSchoolBot)." };
  const secret = webhookSecret();
  if (!secret) {
    return { ok: false, error: "TELEGRAM_WEBHOOK_SECRET yoʻq yoki notoʻgʻri: 16–256 ta belgi, faqat A–Z, a–z, 0–9, _ va -." };
  }
  const url = webhookUrlFor(origin);
  if (!url) return { ok: false, error: "Webhook faqat ochiq HTTPS manzilda ishlaydi — sahifani sayt domeni orqali oching." };
  const r = await setWebhook(url, secret);
  if (!r.ok) return { ok: false, error: `Telegram rad etdi: ${r.description}` };
  const menus = await Promise.all([
    setMyCommands(BOT_COMMANDS.uz, undefined, { timeoutMs: 4000, retries: 0 }),
    setMyCommands(BOT_COMMANDS.uz, "uz", { timeoutMs: 4000, retries: 0 }),
    setMyCommands(BOT_COMMANDS.ru, "ru", { timeoutMs: 4000, retries: 0 }),
    setMyCommands(BOT_COMMANDS.en, "en", { timeoutMs: 4000, retries: 0 }),
  ]);
  const menuOk = menus.every((m) => m.ok);
  return { ok: true, message: `Webhook oʻrnatildi: ${url}${menuOk ? "" : " (buyruqlar menyusi yangilanmadi)"}` };
}

/** A test message to the signed-in admin's own linked chat. */
export async function sendAdminTestMessage(userId: string, name: string): Promise<Result> {
  if (!botToken()) return { ok: false, error: "TELEGRAM_BOT_TOKEN oʻrnatilmagan." };
  const link: { chatId: string; language: string } | null = await db.telegramLink.findUnique({
    where: { userId },
    select: { chatId: true, language: true },
  });
  if (!link) return { ok: false, error: "Telegramʼingiz hali ulanmagan: Settings → Telegram → Connect Telegram." };
  const r = await sendMessage(link.chatId, testMessageText(asLang(link.language), name, new Date()), { timeoutMs: 5000 });
  if (r.ok) return { ok: true, message: "Test xabar yuborildi — Telegramʼni tekshiring." };
  if (r.gone) {
    await markChatsInactive([link.chatId]);
    return { ok: false, error: "Bot bloklangan yoki chat topilmadi — Telegramʼda botni oching va /start yuboring." };
  }
  return { ok: false, error: `Yuborilmadi: ${r.description}` };
}
