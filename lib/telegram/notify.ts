/**
 * Telegram copies of in-app notifications (called by lib/notifications.ts
 * after the Notification rows exist).
 *
 *   homework → prefs.homework · grade / review → prefs.reviews ·
 *   system → prefs.reminders · message, booking … stay in-app only
 *
 * Only active links whose preferences allow the type get a copy, with an
 * "Open in Averna" button when the app has a public https URL. Awaited but
 * bounded: ~3 s for one user; bulk sends are throttled (~25 msg/s) inside a
 * 9 s budget so a school-wide announcement can't hang its request — anything
 * beyond that stays in-app only (logged). Never throws. SERVER ONLY.
 */

import { db } from "@/lib/db";
import { appLink, telegramReady } from "./config";
import { asLang, notificationText, openAppKeyboard } from "./messages";
import { sendBatch, type Outgoing } from "./outbox";
import { prefForNotificationType, readPrefs } from "./prefs";

export interface TelegramNotice {
  type?: string;
  title: string;
  message: string;
  link?: string | null;
}

export const SINGLE_BUDGET_MS = 3000;
export const BULK_BUDGET_MS = 9000;

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
    const timer = setTimeout(() => resolve(null), ms);
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

type LinkRow = { chatId: string; language: string; prefs: unknown };

export async function deliverToTelegram(userIds: string[], notice: TelegramNotice): Promise<void> {
  try {
    if (!telegramReady()) return;
    const pref = prefForNotificationType(notice.type);
    if (!pref) return;
    const ids = Array.from(new Set(userIds.filter((id): id is string => typeof id === "string" && id.length > 0)));
    if (!ids.length) return;

    const started = Date.now();
    const budget = ids.length === 1 ? SINGLE_BUDGET_MS : Math.min(BULK_BUDGET_MS, SINGLE_BUDGET_MS + ids.length * 50);
    const links = await withTimeout<LinkRow[]>(
      db.telegramLink.findMany({
        where: { userId: { in: ids }, active: true },
        select: { chatId: true, language: true, prefs: true },
      }),
      budget
    );
    if (!links?.length) return;

    const url = appLink(notice.link);
    const text = notificationText(notice.title, notice.message);
    const out: Outgoing[] = links
      .filter((l) => readPrefs(l.prefs)[pref])
      .map((l) => ({ chatId: l.chatId, text, keyboard: openAppKeyboard(asLang(l.language), url) }));
    if (!out.length) return;

    const left = budget - (Date.now() - started);
    const r = await sendBatch(out, {
      timeoutMs: Math.max(1000, Math.min(3000, left)),
      budgetMs: Math.max(250, left),
      onGone: markChatsInactive,
    });
    if (r.skipped) console.warn(`Telegram: ${r.skipped} of ${out.length} notification copies skipped (time budget).`);
  } catch (e) {
    console.error("Telegram delivery failed:", e);
  }
}
