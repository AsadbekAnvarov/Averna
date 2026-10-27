/**
 * Creating homework — the one write path behind "Set homework"
 * (POST /api/teacher/homework/create) and the one-button mini task
 * (POST /api/teacher/mini-task): one Homework row per group, then the
 * students it is for are notified ("New homework assigned", in-app and the
 * Telegram copy). A row with `assigneeId` is for that ONE student of its group
 * (lib/homework/audience): only they are notified and only they see it.
 *
 * SERVER ONLY.
 */

import { db } from "@/lib/db";
import { notifyGroupStudents, notifyUser, TELEGRAM_BULK_BUDGET_MAX_MS } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";

export const HOMEWORK_MODULES = ["WRITING", "READING", "LISTENING", "SPEAKING"] as const;
export type HomeworkModule = (typeof HOMEWORK_MODULES)[number];

export interface HomeworkData {
  title: string;
  description: string;
  module: HomeworkModule;
  difficulty: number;
  points: number;
  dueDate: Date;
  teacherId: string;
  contentKind?: string;
  contentId?: string;
  contentPart?: number | null;
  contentTitle?: string;
}

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** A due date from the client: an ISO timestamp, or a bare "YYYY-MM-DDTHH:mm" read as Tashkent time. */
export function parseDue(x: unknown): Date | null {
  if (typeof x !== "string" || !x.trim()) return null;
  const s = x.trim();
  const d = new Date(LOCAL_DATETIME.test(s) ? `${s.length === 16 ? `${s}:00` : s}+05:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** For one student only: their Student id (stored) and User id (notified). */
export interface HomeworkAssignee {
  studentId: string;
  userId: string;
}

/** The notification every new homework sends (same text for a group and for one student). */
export function homeworkNotification(data: Pick<HomeworkData, "title" | "dueDate">, homeworkId: string) {
  return {
    type: "homework",
    title: "New homework assigned",
    message: `${data.title} — due ${formatDateTime(data.dueDate)}`,
    link: `/homework/${homeworkId}`,
  };
}

/**
 * Create the rows (one transaction) and notify. With `assignee`, exactly one
 * group id is expected and the row is that student's personal task.
 */
export async function createHomework(
  data: HomeworkData,
  groupIds: string[],
  assignee: HomeworkAssignee | null = null
): Promise<{ id: string; groupId: string }[]> {
  const targets = assignee ? groupIds.slice(0, 1) : groupIds;
  const created: { id: string; groupId: string }[] = await db.$transaction(
    targets.map((groupId) =>
      db.homework.create({
        data: { ...data, groupId, ...(assignee ? { assigneeId: assignee.studentId } : {}) },
        select: { id: true, groupId: true },
      })
    )
  );

  await Promise.all(
    created.map((h) =>
      assignee
        ? notifyUser(assignee.userId, homeworkNotification(data, h.id))
        : notifyGroupStudents(h.groupId, homeworkNotification(data, h.id), { telegramBudgetMs: TELEGRAM_BULK_BUDGET_MAX_MS })
    )
  );
  return created;
}
