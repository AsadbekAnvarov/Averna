import { db } from "@/lib/db";
import { deliverToTelegram } from "@/lib/telegram/notify";

interface NotificationInput {
  type?: string; // homework | grade | booking | message | system
  title: string;
  message: string;
  link?: string;
}

/**
 * Create a notification for a single user (by user id). Never throws.
 * After the in-app row exists, a copy goes to the user's Telegram (when linked
 * and their preferences allow the type) — bounded to ~3 s, never throwing.
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
  await deliverToTelegram([userId], input);
}

/** Create the same notification for many users. Never throws. Telegram copies are throttled. */
export async function notifyUsers(userIds: string[], input: NotificationInput) {
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
  await deliverToTelegram(userIds, input);
}

/** Notify every student in a group (by group id). */
export async function notifyGroupStudents(groupId: string, input: NotificationInput) {
  try {
    const students = await db.student.findMany({
      where: { groupId },
      select: { userId: true },
    });
    await notifyUsers(students.map((s) => s.userId), input);
  } catch (e) {
    console.error("notifyGroupStudents failed:", e);
  }
}
