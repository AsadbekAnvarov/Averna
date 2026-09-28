/**
 * Telegram copies of in-app notifications. lib/notifications.ts starts
 * deliverToTelegram after the Notification rows exist, via runAfterResponse —
 * the request that notified never waits for Telegram.
 *
 *   homework → prefs.homework · grade / review → prefs.reviews ·
 *   system → prefs.reminders · message, booking … stay in-app only
 *
 * Only active links whose preferences allow the type get a copy, with an
 * "Open in Averna" button when the app has a public https URL. Bounded so it
 * finishes inside the function's life after the response:
 *
 *   one recipient  ~3 s, no 429 retry (a copy that hits the rate limit stays in-app only);
 *   many           throttled (~25 msg/s), shuffled, inside a shared deadline —
 *                  bulk sends running at the same time in this process (one
 *                  homework for several groups …) share one, sized to their
 *                  total (3 s + 50 ms a recipient, at most 8 s); whatever
 *                  doesn't fit stays in-app only and is logged with counts.
 *                  A caller whose function may run longer (maxDuration = 60:
 *                  announcements, new homework) passes `budgetMs` — at most
 *                  45 s (≈ 1,100 chats); the shared deadline grows up to the
 *                  longest budget in the window, but no delivery sends past
 *                  its own budget (every other caller keeps its 8 s) or stops
 *                  before what it would get alone (a late joiner isn't starved).
 *
 * Never throws. SERVER ONLY.
 */

import { db } from "@/lib/db";
import { appLink, telegramReady } from "./config";
import { asLang, notificationText, openAppKeyboard } from "./messages";
import { sendBatch, shuffled, type Outgoing } from "./outbox";
import { prefForNotificationType, readPrefs } from "./prefs";

export interface TelegramNotice {
  type?: string;
  title: string;
  message: string;
  link?: string | null;
}

export const SINGLE_BUDGET_MS = 3000;
/** Default bulk cap: leaves the request itself room under the 10 s default maxDuration. */
export const BULK_BUDGET_MS = 8000;
/** The longest bulk budget a caller may ask for — only for functions with maxDuration = 60. */
export const MAX_BULK_BUDGET_MS = 45_000;
const PER_RECIPIENT_MS = 50;

/** A caller's bulk budget: the default 8 s unless a positive number is given, and never above 45 s. */
export function bulkBudget(ms?: number | null): number {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.min(MAX_BULK_BUDGET_MS, Math.round(ms)) : BULK_BUDGET_MS;
}

export interface DeliveryOptions {
  /** Bulk copies only (2+ recipients): the time budget, default 8 s, capped at 45 s. */
  budgetMs?: number;
}

/** Blocked / gone chats stop receiving (the user can /start the bot again). Never throws. */
export async function markChatsInactive(chatIds: string[]): Promise<void> {
  if (!chatIds.length) return;
  try {
    await db.telegramLink.updateMany({ where: { chatId: { in: chatIds } }, data: { active: false } });
  } catch (e) {
    console.error("Telegram: marking chats inactive failed:", e);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`Telegram: link lookup took over ${Math.max(0, Math.round(ms))} ms — these copies stay in-app only.`);
      resolve(null);
    }, Math.max(0, ms));
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        console.error("Telegram: link lookup failed:", e);
        resolve(null);
      }
    );
  });
}

export interface BulkWindow {
  openedAt: number;
  recipients: number;
  /** The longest budget a delivery of this window asked for (8 s unless a caller passed more). */
  budgetMs: number;
  deadline: number;
  /** Bulk deliveries of this window still running. */
  active: number;
}

let openWindow: BulkWindow | null = null;

/**
 * Join the bulk window of the deliveries running right now (or open one) and
 * grow its shared deadline by these recipients — up to the longest budget in
 * the window. Call leaveBulkWindow when done.
 */
export function joinBulkWindow(recipients: number, now: number = Date.now(), budgetMs: number = BULK_BUDGET_MS): BulkWindow {
  let w = openWindow;
  if (!w || w.active <= 0 || now >= w.deadline) {
    w = { openedAt: now, recipients: 0, budgetMs: 0, deadline: now, active: 0 };
    openWindow = w;
  }
  w.active++;
  w.recipients += Math.max(0, recipients);
  w.budgetMs = Math.max(w.budgetMs, bulkBudget(budgetMs));
  w.deadline = w.openedAt + Math.min(w.budgetMs, SINGLE_BUDGET_MS + w.recipients * PER_RECIPIENT_MS);
  return w;
}

export function leaveBulkWindow(w: BulkWindow): void {
  w.active = Math.max(0, w.active - 1);
}

type LinkRow = { chatId: string; language: string; prefs: unknown };

export async function deliverToTelegram(userIds: string[], notice: TelegramNotice, opts: DeliveryOptions = {}): Promise<void> {
  let bulk: BulkWindow | null = null;
  try {
    if (!telegramReady()) return;
    const pref = prefForNotificationType(notice.type);
    if (!pref) return;
    const ids = Array.from(new Set(userIds.filter((id): id is string => typeof id === "string" && id.length > 0)));
    if (!ids.length) return;

    const single = ids.length === 1;
    const started = Date.now();
    const budget = bulkBudget(opts.budgetMs);
    const w = single ? null : joinBulkWindow(ids.length, started, budget);
    bulk = w;
    // The window's shared deadline — never past this delivery's own budget (a longer caller in
    // the window doesn't stretch an 8 s one past its function's life), and never short of what
    // it would get alone (joining a long window just before it closes doesn't starve it).
    const alone = started + Math.min(budget, SINGLE_BUDGET_MS + ids.length * PER_RECIPIENT_MS);
    const deadline = w ? () => Math.min(started + budget, Math.max(w.deadline, alone)) : () => started + SINGLE_BUDGET_MS;

    const links = await withTimeout<LinkRow[]>(
      db.telegramLink.findMany({
        where: { userId: { in: ids }, active: true },
        select: { chatId: true, language: true, prefs: true },
      }),
      deadline() - Date.now()
    );
    if (!links?.length) return;

    const url = appLink(notice.link);
    const text = notificationText(notice.title, notice.message);
    const out: Outgoing[] = links
      .filter((l) => readPrefs(l.prefs)[pref])
      .map((l) => ({ chatId: l.chatId, text, keyboard: openAppKeyboard(asLang(l.language), url) }));
    if (!out.length) return;

    // Shuffled: when the deadline cuts a bulk send, it isn't the same chats every time.
    const r = await sendBatch(single ? out : shuffled(out), {
      timeoutMs: 3000,
      retries: single ? 0 : 1,
      deadline,
      onGone: markChatsInactive,
    });
    if (r.skipped) {
      console.warn(
        `Telegram: ${r.skipped} of ${out.length} "${notice.type ?? "system"}" copies not sent — the time budget ran out; ` +
          `they stay in-app only (sent ${r.sent}, failed ${r.failed}, blocked ${r.gone}).`
      );
    }
  } catch (e) {
    console.error("Telegram delivery failed:", e);
  } finally {
    if (bulk) leaveBulkWindow(bulk);
  }
}
