/**
 * Student dashboard reads shared by app/dashboard/layout.tsx and the tab panels.
 * Wrapped in React `cache`, so the layout and the page run each query once per
 * request. Server only.
 */
import { cache } from "react";
import { db } from "@/lib/db";
import {
  DASHBOARD_HOMEWORK_SHOWN,
  homeworkCounts,
  orderDashboardHomework,
  overdueWindowStart,
} from "@/lib/dashboard/homework";

/**
 * The signed-in user's student profile, or null. Only the user fields the
 * dashboard renders are selected, so the password hash never leaves the DB.
 */
export const getDashboardStudent = cache((userId: string) =>
  db.student.findUnique({
    where: { userId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })
);

export type DashboardStudent = NonNullable<Awaited<ReturnType<typeof getDashboardStudent>>>;

/**
 * Unsubmitted homework of the student's group: overdue (within the window) and
 * upcoming. `shown` is what the Today tab lists; `counts` covers every row read.
 */
export const getDashboardHomework = cache(async (studentId: string, groupId: string | null) => {
  if (!groupId) return { shown: [], counts: { overdue: 0, upcoming: 0 } };
  const now = new Date();
  const rows = await db.homework.findMany({
    where: {
      groupId,
      dueDate: { gte: overdueWindowStart(now) },
      submissions: { none: { studentId } },
    },
    orderBy: { dueDate: "asc" },
    take: 50,
    include: { teacher: { include: { user: { select: { name: true } } } } },
  });
  return {
    shown: orderDashboardHomework(rows, now).slice(0, DASHBOARD_HOMEWORK_SHOWN),
    counts: homeworkCounts(rows, now),
  };
});
