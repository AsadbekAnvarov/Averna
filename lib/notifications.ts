import { db } from "@/lib/db";
import { runAfterResponse } from "@/lib/after-response";
import { deliverToTelegram, MAX_BULK_BUDGET_MS } from "@/lib/telegram/notify";

interface NotificationInput {
  type?: string; // homework | grade | booking | message | system
  title: string;
  message: string;
  link?: string;
}

export interface NotifyOptions {
  /**
   * How long the Telegram fan-out may keep sending after the response, for
   * 2+ recipients (default 8 s; capped at TELEGRAM_BULK_BUDGET_MAX_MS = 45 s).
   * Only for callers whose function may run that long (maxDuration = 60).
   */
  telegramBudgetMs?: number;
}

/** The longest Telegram fan-out budget (45 s) — for bulk callers with maxDuration = 60. */
export const TELEGRAM_BULK_BUDGET_MAX_MS = MAX_BULK_BUDGET_MS;

/** The Telegram copy runs after the response (lib/after-response) — the caller never waits for Telegram. */
function copyToTelegram(userIds: string[], input: NotificationInput, budgetMs?: number): void {
  const ids = userIds.slice();
  const notice = { ...input };
  void runAfterResponse("Telegram copy", () => deliverToTelegram(ids, notice, { budgetMs }));
}

/**
 * Create a notification for a single user (by user id). Never throws.
 * Once the in-app row exists, a copy goes to the user's Telegram (when linked
 * and their preferences allow the type) in the background — not awaited.
 */
export async function notifyUser(userId: string, input: NotificationInput) {
  try {
    await db.notification.create({
      data: {
        userId,
        type: input.type ?? "system",
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      },
    });
  } catch (e) {
    console.error("notifyUser failed:", e);
    return;
  }
  copyToTelegram([userId], input);
}

/**
 * Create the same notification for many users. Never throws. Telegram copies
 * are throttled, in the background — within `options.telegramBudgetMs` when given.
 */
export async function notifyUsers(userIds: string[], input: NotificationInput, options: NotifyOptions = {}) {
  if (userIds.length === 0) return;
  try {
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: input.type ?? "system",
        title: input.title,
        message: input.message,
        link: input.link ?? null,
      })),
    });
  } catch (e) {
    console.error("notifyUsers failed:", e);
    return;
  }
  copyToTelegram(userIds, input, options?.telegramBudgetMs);
}

/** Notify every student in a group (by group id). `options` as for notifyUsers. */
export async function notifyGroupStudents(groupId: string, input: NotificationInput, options: NotifyOptions = {}) {
  try {
    const students = await db.student.findMany({
      where: { groupId },
      select: { userId: true },
    });
    await notifyUsers(students.map((s) => s.userId), input, options);
  } catch (e) {
    console.error("notifyGroupStudents failed:", e);
  }
}
