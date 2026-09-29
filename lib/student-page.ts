import { cache } from "react";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Shared guard for student-only pages (the Progress & Rankings hubs, the
 * Practice Studio…): signed-out → sign-in, teachers/admins → their own
 * dashboard. Returns the session and the student row, or `student: null` when
 * the account has no student profile (callers render <AccountNotice/>).
 *
 * Cached per request, so a layout and its page can both call it for free.
 */
export const getPageStudent = cache(async () => {
  const session = (await auth()) as Session | null;
  if (!session?.user) redirect("/auth/signin");
  const role = (session.user as { role?: string }).role;
  if (role === "TEACHER") redirect("/teacher/dashboard");
  if (role === "ADMIN") redirect("/admin/dashboard");

  const student = await db.student.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      groupId: true,
      targetBand: true,
      totalPoints: true,
      currentStreak: true,
      longestStreak: true,
      cosmetics: true,
      user: { select: { name: true } },
    },
  });
  return { session, student };
});

export type PageStudent = NonNullable<Awaited<ReturnType<typeof getPageStudent>>["student"]>;
