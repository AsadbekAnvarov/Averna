import { db } from "@/lib/db";

interface NotificationInput {
  type?: string; // homework | grade | booking | message | system
  title: string;
  message: string;
  link?: string;
}

/** Create a notification for a single user (by user id). Never throws. */
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
  }
}

/** Create the same notification for many users. Never throws. */
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
  }
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
