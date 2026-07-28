import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLearningDna, refreshLearningDna } from "@/lib/engine/learning-dna";

export const dynamic = "force-dynamic";

/**
 * Learning DNA profile API.
 *
 * GET  /api/learning-dna              → the signed-in student's own profile
 * GET  /api/learning-dna?studentId=x  → that student's profile (teachers/admins)
 * POST /api/learning-dna              → force a recomputation of your own profile
 *
 * Authorisation is deliberately strict: a student may only ever read themselves,
 * and a teacher may only read a student in one of their own groups. A behavioural
 * profile is more revealing than a score, so "any teacher can read any student"
 * would not be an acceptable default.
 */

/** Resolve which student the caller is allowed to read, or an error response. */
async function resolveTarget(
  user: { id: string; role: string },
  requestedStudentId: string | null
): Promise<{ studentId: string } | { error: string; status: number }> {
  // Own profile.
  if (!requestedStudentId) {
    const student = await db.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return { error: "Student profile not found", status: 404 };
    return { studentId: student.id };
  }

  if (user.role === "ADMIN") return { studentId: requestedStudentId };

  if (user.role === "TEACHER") {
    // Must be a student in one of this teacher's own groups.
    const allowed = await db.student.findFirst({
      where: { id: requestedStudentId, group: { teacher: { userId: user.id } } },
      select: { id: true },
    });
    if (!allowed) return { error: "Forbidden", status: 403 };
    return { studentId: allowed.id };
  }

  // A student asking for someone else — allowed only if it's actually them.
  const self = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!self || self.id !== requestedStudentId) return { error: "Forbidden", status: 403 };
  return { studentId: self.id };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const requested = req.nextUrl.searchParams.get("studentId");
    const target = await resolveTarget(user, requested);
    if ("error" in target) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    const profile = await getLearningDna(target.studentId);
    return NextResponse.json({ profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load Learning DNA";
    console.error("Learning DNA read error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Force a recomputation. Only ever for the caller's own profile — recomputation
 * is the expensive path, so it must not be triggerable for arbitrary students.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const profile = await refreshLearningDna(student.id);
    return NextResponse.json({ profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to refresh Learning DNA";
    console.error("Learning DNA refresh error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
