/**
 * Minimal Telegram Bot API client (fetch; no SDK). Transport only — no database.
 *
 *   - every call has a timeout and never throws: the result is { ok, result }
 *     or { ok: false, code, description, retryAfter, gone, network };
 *   - 429 "Too Many Requests": waits `retry_after` and retries (once by default,
 *     only when the wait fits `maxRetryWaitMs`; `onRetryAfter` lets a rate
 *     limiter hold every other send meanwhile);
 *   - 403 (blocked by the user, deactivated …) and "chat not found" come back
 *     as `gone: true` — the caller marks that chat's links inactive;
 *   - sendMessage uses HTML with link previews off; if Telegram ever rejects
 *     our markup it resends the same text as plain text, so nothing is lost.
 *
 * The bot token never appears in results or logs. SERVER ONLY.
 */

import { botToken } from "./config";
import { htmlToPlain } from "./messages";
import type { Keyboard } from "./types";

const API_BASE = "https://api.telegram.org";
export const ALLOWED_UPDATES = ["message", "callback_query"] as const;

export interface TgOk<T> {
  ok: true;
  result: T;
}
export interface TgErr {
  ok: false;
  /** HTTP status (0 = no response: timeout / network). */
  status: number;
  /** Telegram error_code (falls back to the HTTP status). */
  code: number | null;
  description: string;
  /** Seconds to wait (429). */
  retryAfter: number | null;
  /** The chat can't be messaged any more (blocked, deactivated, not found). */
  gone: boolean;
  network: boolean;
}
export type TgResult<T> = TgOk<T> | TgErr;

export interface CallOptions {
  /** Defaults to TELEGRAM_BOT_TOKEN. */
  token?: string | null;
  timeoutMs?: number;
  /** 429 retries (default 1). */
  retries?: number;
  /** Longest 429 wait worth retrying (default 3 s). */
  maxRetryWaitMs?: number;
  onRetryAfter?: (ms: number) => void;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}
export interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  date: number;
  text?: string;
}
export interface TgWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}
export interface TgCommand {
  command: string;
  description: string;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

function scrub(text: string, token: string): string {
  return token ? text.split(token).join("<token>") : text;
}

export function isGone(code: number | null, description: string): boolean {
  if (code === 403) return true;
  return code === 400 && /chat not found|user not found|peer_id_invalid|user is deactivated|bot was blocked/i.test(description);
}

async function once<T>(f: typeof fetch, token: string, method: string, params: Record<string, unknown>, timeoutMs: number): Promise<TgResult<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: ctrl.signal,
      cache: "no-store",
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    if (rec && rec.ok === true) return { ok: true, result: rec.result as T };
    const code = typeof rec?.error_code === "number" ? (rec.error_code as number) : res.status || null;
    const description = scrub(typeof rec?.description === "string" ? (rec.description as string) : `HTTP ${res.status}`, token);
    const params429 = rec?.parameters && typeof rec.parameters === "object" ? (rec.parameters as Record<string, unknown>) : null;
    const retryAfter =
      typeof params429?.retry_after === "number" ? (params429.retry_after as number) : code === 429 ? 1 : null;
    return { ok: false, status: res.status, code, description, retryAfter, gone: isGone(code, description), network: false };
  } catch (err) {
    const aborted = ctrl.signal.aborted;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      code: null,
      description: aborted ? `timeout after ${timeoutMs} ms` : scrub(msg, token),
      retryAfter: null,
      gone: false,
      network: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Call a Bot API method. Never throws. */
export async function callApi<T>(method: string, params: Record<string, unknown> = {}, opts: CallOptions = {}): Promise<TgResult<T>> {
  const token = opts.token === undefined ? botToken() : opts.token;
  if (!token) {
    return { ok: false, status: 0, code: null, description: "TELEGRAM_BOT_TOKEN is not set", retryAfter: null, gone: false, network: false };
  }
  const f = opts.fetchImpl ?? globalThis.fetch;
  const retries = Math.max(0, opts.retries ?? 1);
  const maxWait = opts.maxRetryWaitMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 5000;
  for (let attempt = 0; ; attempt++) {
    const res = await once<T>(f, token, method, params, timeoutMs);
    if (!res.ok && res.retryAfter != null && attempt < retries) {
      const wait = res.retryAfter * 1000;
      if (wait <= maxWait) {
        opts.onRetryAfter?.(wait);
        await (opts.sleep ?? sleep)(wait + 100);
        continue;
      }
    }
    return res;
  }
}

export interface SendOptions extends CallOptions {
  keyboard?: Keyboard;
}

const markup = (keyboard?: Keyboard) => (keyboard && keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {});
const badMarkup = (r: TgErr) => r.code === 400 && /can't parse entities|unsupported start tag|can't find end tag|unexpected end tag/i.test(r.description);

/** sendMessage — HTML, no link previews, optional inline keyboard. */
export async function sendMessage(chatId: string | number, text: string, opts: SendOptions = {}): Promise<TgResult<TgMessage>> {
  const base = { chat_id: chatId, link_preview_options: { is_disabled: true }, ...markup(opts.keyboard) };
  const res = await callApi<TgMessage>("sendMessage", { ...base, text, parse_mode: "HTML" }, opts);
  if (!res.ok && badMarkup(res)) {
    console.error("Telegram rejected the HTML of a message — resending as plain text:", res.description);
    return callApi<TgMessage>("sendMessage", { ...base, text: htmlToPlain(text) }, opts);
  }
  return res;
}

export async function editMessageText(chatId: string | number, messageId: number, text: string, opts: SendOptions = {}): Promise<TgResult<unknown>> {
  const base = { chat_id: chatId, message_id: messageId, link_preview_options: { is_disabled: true }, ...markup(opts.keyboard) };
  const res = await callApi<unknown>("editMessageText", { ...base, text, parse_mode: "HTML" }, opts);
  if (!res.ok && badMarkup(res)) return callApi<unknown>("editMessageText", { ...base, text: htmlToPlain(text) }, opts);
  return res;
}

export function answerCallbackQuery(callbackQueryId: string, text?: string, opts: CallOptions = {}): Promise<TgResult<boolean>> {
  return callApi<boolean>("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text: text.slice(0, 190) } : {}) }, opts);
}

/** Point the bot at our webhook; Telegram then sends the secret in X-Telegram-Bot-Api-Secret-Token. */
export function setWebhook(url: string, secret: string, opts: CallOptions = {}): Promise<TgResult<boolean>> {
  return callApi<boolean>(
    "setWebhook",
    { url, secret_token: secret, allowed_updates: [...ALLOWED_UPDATES], max_connections: 20 },
    { timeoutMs: 10_000, ...opts }
  );
}

export function deleteWebhook(opts: CallOptions = {}): Promise<TgResult<boolean>> {
  return callApi<boolean>("deleteWebhook", { drop_pending_updates: false }, opts);
}

export function getWebhookInfo(opts: CallOptions = {}): Promise<TgResult<TgWebhookInfo>> {
  return callApi<TgWebhookInfo>("getWebhookInfo", {}, opts);
}

export function getMe(opts: CallOptions = {}): Promise<TgResult<TgUser>> {
  return callApi<TgUser>("getMe", {}, opts);
}

/** The "/" command menu (per language_code; omitted = default). */
export function setMyCommands(commands: TgCommand[], languageCode?: string, opts: CallOptions = {}): Promise<TgResult<boolean>> {
  return callApi<boolean>("setMyCommands", { commands, ...(languageCode ? { language_code: languageCode } : {}) }, opts);
}
