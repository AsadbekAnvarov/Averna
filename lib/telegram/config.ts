/**
 * Telegram bot configuration from the environment. SERVER ONLY (reads secrets).
 *
 *   TELEGRAM_BOT_TOKEN       from @BotFather (/newbot)
 *   TELEGRAM_BOT_USERNAME    the bot's username without "@", e.g. AvernaSchoolBot
 *   TELEGRAM_WEBHOOK_SECRET  16–256 characters of A–Z a–z 0–9 _ - (Telegram's rule
 *                            for secret_token — e.g. `openssl rand -hex 32`)
 *
 * The feature is on only when all three are valid ("ready"): otherwise Settings
 * says "not available yet", notifications stay in-app and the daily job is
 * skipped. Both Vercel projects must use the SAME three values — one bot, one
 * webhook, one shared database.
 */

export const WEBHOOK_PATH = "/api/telegram/webhook";
export const SECRET_HEADER = "x-telegram-bot-api-secret-token";

/** Telegram's own rule for setWebhook's secret_token, plus a 16-character minimum. */
export const WEBHOOK_SECRET_RE = /^[A-Za-z0-9_-]{16,256}$/;
/** Telegram usernames: 5–32 letters, digits and underscores. */
const USERNAME_RE = /^[A-Za-z0-9_]{5,32}$/;

function env(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

export function botToken(): string | null {
  return env("TELEGRAM_BOT_TOKEN") || null;
}

/** TELEGRAM_BOT_USERNAME without a leading "@" (null when missing or malformed). */
export function botUsername(): string | null {
  const u = env("TELEGRAM_BOT_USERNAME").replace(/^@+/, "");
  return USERNAME_RE.test(u) ? u : null;
}

/** The webhook secret, only when Telegram would accept it. */
export function webhookSecret(): string | null {
  const s = env("TELEGRAM_WEBHOOK_SECRET");
  return WEBHOOK_SECRET_RE.test(s) ? s : null;
}

export function telegramConfig() {
  const rawSecret = env("TELEGRAM_WEBHOOK_SECRET");
  const token = !!botToken();
  const username = botUsername();
  const secretValid = WEBHOOK_SECRET_RE.test(rawSecret);
  return {
    token,
    username,
    secret: rawSecret.length > 0,
    secretValid,
    cronSecret: env("CRON_SECRET").length > 0,
    ready: token && !!username && secretValid,
    appUrl: appBaseUrl(),
  };
}

/** Linking, notifications and the daily job all require the full configuration. */
export function telegramReady(): boolean {
  return !!botToken() && !!botUsername() && !!webhookSecret();
}

/** A public https origin, or null (Telegram buttons can't open localhost or plain http). */
export function publicOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || /^[\d.]+$/.test(host) || host.includes(":")) {
      return null;
    }
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * The app's public base URL: NEXTAUTH_URL (https, not localhost), else
 * https://$VERCEL_PROJECT_PRODUCTION_URL. Also where the webhook points (admin.ts).
 */
export function appBaseUrl(): string | null {
  const prod = env("VERCEL_PROJECT_PRODUCTION_URL").replace(/^https?:\/\//i, "");
  return publicOrigin(env("NEXTAUTH_URL")) ?? (prod ? publicOrigin(`https://${prod}`) : null);
}

/** Absolute app URL for an in-app path ("/homework/abc"); null when no public base URL is known. */
export function appLink(path?: string | null, base: string | null = appBaseUrl()): string | null {
  if (!base) return null;
  const p = (path ?? "").trim();
  if (p.startsWith("/") && !p.startsWith("//")) return `${base}${p}`;
  if (p && publicOrigin(p) === base) return p;
  return base;
}
