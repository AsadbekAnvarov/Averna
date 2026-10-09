/**
 * Who may see a student's work.
 *
 *   - the student themself;
 *   - a teacher of a group the student belongs to;
 *   - any admin.
 *
 * Every teacher-facing page that opens a student's attempt, recording or
 * homework goes through these helpers, so the rule lives in one place.
 * SERVER ONLY.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type AccessClient = Pick<Prisma.TransactionClient, "student" | "teacher">;

export interface Viewer {
  id: string;
  role?: string | null;
}

/** The Teacher row of a user, or null. */
export async function teacherOf(userId: string, client: AccessClient = db): Promise<{ id: string } | null> {
  try {
    return await client.teacher.findUnique({ where: { userId }, select: { id: true } });
  } catch {
    return null;
  }
}

/** Ids of the groups a teacher teaches. */
export async function teacherGroupIds(teacherId: string): Promise<string[]> {
  try {
    const groups = await db.group.findMany({ where: { teacherId }, select: { id: true } });
    return groups.map((g: { id: string }) => g.id);
  } catch {
    return [];
  }
}

/** Ids of every student in a teacher's groups. */
export async function teacherStudentIds(teacherId: string): Promise<string[]> {
  try {
    const students = await db.student.findMany({
      where: { group: { teacherId } },
      select: { id: true },
    });
    return students.map((s: { id: string }) => s.id);
  } catch {
    return [];
  }
}

/**
 * The students this viewer may see: "all" for admins, the list for teachers,
 * their own id for a student.
 */
export async function visibleStudentIds(viewer: Viewer): Promise<"all" | string[]> {
  if (viewer.role === "ADMIN") return "all";
  if (viewer.role === "TEACHER") {
    const t = await teacherOf(viewer.id);
    return t ? teacherStudentIds(t.id) : [];
  }
  try {
    const s = await db.student.findUnique({ where: { userId: viewer.id }, select: { id: true } });
    return s ? [s.id] : [];
  } catch {
    return [];
  }
}

/** True when the viewer may see this student's attempts, recordings and homework. */
export async function canViewStudent(viewer: Viewer, studentId: string, client: AccessClient = db): Promise<boolean> {
  if (!studentId) return false;
  if (viewer.role === "ADMIN") return true;
  try {
    const student = await client.student.findUnique({
      where: { id: studentId },
      select: { userId: true, group: { select: { teacherId: true } } },
    });
    if (!student) return false;
    if (student.userId === viewer.id) return true;
    if (viewer.role !== "TEACHER" || !student.group) return false;
    const t = await teacherOf(viewer.id, client);
    return !!t && student.group.teacherId === t.id;
  } catch {
    return false;
  }
}

/**
 * True when the viewer is staff (teacher of the student's group or admin) — and
 * never the student themself, even a teacher or admin who owns that Student row
 * (nobody re-bands their own attempts).
 */
export async function canReviewStudent(viewer: Viewer, studentId: string, client: AccessClient = db): Promise<boolean> {
  if (viewer.role !== "ADMIN" && viewer.role !== "TEACHER") return false;
  if (!studentId) return false;
  try {
    const student = await client.student.findUnique({
      where: { id: studentId },
      select: { userId: true, group: { select: { teacherId: true } } },
    });
    if (!student || student.userId === viewer.id) return false;
    if (viewer.role === "ADMIN") return true;
    if (!student.group) return false;
    const t = await teacherOf(viewer.id, client);
    return !!t && student.group.teacherId === t.id;
  } catch {
    return false;
  }
}
