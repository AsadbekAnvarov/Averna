/**
 * Who may set and inspect homework: a teacher, for the groups they teach
 * (admins may browse the library, but only a Teacher row owns groups).
 * requireTeacherOrAdmin() throws — API routes get a JSON 401 / 403 instead.
 *
 * SERVER ONLY.
 */

import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { teacherOf } from "@/lib/access";

export type StaffResult =
  | { ok: true; userId: string; role: string; teacherId: string | null }
  | { ok: false; response: NextResponse };

export async function homeworkStaff(): Promise<StaffResult> {
  let user: { id: string; role: string };
  try {
    user = await requireTeacherOrAdmin();
  } catch (e) {
    const forbidden = e instanceof Error && e.message.startsWith("Forbidden");
    return {
      ok: false,
      response: NextResponse.json(
        { error: forbidden ? "Only teachers can manage homework." : "Please sign in again." },
        { status: forbidden ? 403 : 401 }
      ),
    };
  }
  const teacher = await teacherOf(user.id);
  return { ok: true, userId: user.id, role: user.role, teacherId: teacher?.id ?? null };
}
