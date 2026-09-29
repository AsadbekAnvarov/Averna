/**
 * Admin → Telegram: configuration and bot status (with the latest daily-job
 * runs and what they did), installing the webhook on the app's public URL and
 * a test message to the admin's own chat. Error texts are Uzbek (admin UI).
 * SERVER ONLY.
 */

import { STALE_RUN_MS } from "@/lib/cron/once";
import { db } from "@/lib/db";
import { getMe, getWebhookInfo, sendMessage, setMyCommands, setWebhook } from "./api";
import { appBaseUrl, botToken, botUsername, publicOrigin, telegramConfig, webhookSecret, WEBHOOK_PATH } from "./config";
import { readCronRun } from "./cron-runs";
import { asLang, BOT_COMMANDS, testMessageText } from "./messages";
import { markChatsInactive } from "./notify";
import type { CronRunInfo, LinkRole, RoleCounts, TelegramAdminStatus } from "./types";

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

/** A Vercel preview deployment (VERCEL_ENV=preview): its env and Deployment Protection aren't production's. */
export function isPreviewDeployment(): boolean {
  return (process.env.VERCEL_ENV ?? "").trim().toLowerCase() === "preview";
}

/**
 * Where the one bot's webhook must point — never the preview or alias the
 * admin happens to be on:
 *   1. the app's configured public URL (appBaseUrl: NEXTAUTH_URL, when it is
 *      https and not localhost) — the domain the admin chose, which must answer
 *      directly: Telegram doesn't follow a redirect (an apex → www 308 …);
 *   2. else the production domain Vercel gives this project (VERCEL_PROJECT_PRODUCTION_URL,
 *      the shortest one — appBaseUrl's own fallback);
 *   3. else the request's origin (self-hosted).
 */
export function webhookTargetUrl(origin: string | null): string | null {
  return webhookUrlFor(appBaseUrl()) ?? webhookUrlFor(origin);
}

const CRON_RUNS_SHOWN = 6;

async function recentCronRuns(): Promise<CronRunInfo[]> {
  try {
    const rows: { job: string; day: string; status: string; details: unknown; updatedAt: Date }[] = await db.cronRun.findMany({
      orderBy: { updatedAt: "desc" },
      take: CRON_RUNS_SHOWN,
      select: { job: true, day: true, status: true, details: true, updatedAt: true },
    });
    // Counts from details, and a "running" row older than STALE_RUN_MS reads as interrupted.
    const now = Date.now();
    return rows.map((r) => readCronRun(r, now, STALE_RUN_MS));
  } catch (e) {
    console.error("Telegram admin: cron runs failed:", e);
    return [];
  }
}

async function roleCounts(): Promise<RoleCounts> {
  const out: RoleCounts = {
    student: { active: 0, inactive: 0 },
    teacher: { active: 0, inactive: 0 },
    admin: { active: 0, inactive: 0 },
    parent: { active: 0, inactive: 0 },
  };
  try {
    const rows = await db.telegramLink.groupBy({
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
  const [me, info, counts, mine, cronRuns] = await Promise.all([
    config.token ? getMe({ timeoutMs: 4000, retries: 0 }) : Promise.resolve(null),
    config.token ? getWebhookInfo({ timeoutMs: 4000, retries: 0 }) : Promise.resolve(null),
    roleCounts(),
    db.telegramLink
      .findUnique({ where: { userId }, select: { active: true, username: true } })
      .catch(() => null) as Promise<{ active: boolean; username: string | null } | null>,
    recentCronRuns(),
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
    expectedWebhookUrl: webhookTargetUrl(origin),
    preview: isPreviewDeployment(),
    counts,
    cronRuns,
    me: { linked: !!mine, active: !!mine?.active, username: mine?.username ?? null },
    checkedAt: new Date().toISOString(),
  };
}

/**
 * setWebhook(<webhookTargetUrl>, secret) + the "/" command menu (uz default,
 * ru, en). Refused on a preview deployment: the one bot must never point at a
 * preview (Deployment Protection answers 401, the bot goes quiet).
 */
export async function installWebhook(origin: string | null): Promise<Result> {
  if (isPreviewDeployment()) {
    return {
      ok: false,
      error:
        "Bu preview deployment — webhook bu yerdan oʻrnatilmaydi, aks holda bot hamma uchun ishlamay qoladi. Shu sahifani production saytida oching va qayta bosing.",
    };
  }
  if (!botToken()) return { ok: false, error: "TELEGRAM_BOT_TOKEN oʻrnatilmagan." };
  if (!botUsername()) return { ok: false, error: "TELEGRAM_BOT_USERNAME yoʻq yoki notoʻgʻri (@ belgisisiz, masalan AvernaSchoolBot)." };
  const secret = webhookSecret();
  if (!secret) {
    return { ok: false, error: "TELEGRAM_WEBHOOK_SECRET yoʻq yoki notoʻgʻri: 16–256 ta belgi, faqat A–Z, a–z, 0–9, _ va -." };
  }
  const url = webhookTargetUrl(origin);
  if (!url) {
    return {
      ok: false,
      error: "Webhook faqat ochiq HTTPS manzilda ishlaydi — NEXTAUTH_URL ga saytning https manzilini yozing yoki sahifani sayt domeni orqali oching.",
    };
  }
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
