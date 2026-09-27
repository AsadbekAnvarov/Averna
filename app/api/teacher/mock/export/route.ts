import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { getMockCsv, mockScope } from "@/lib/teacher/mock-analytics";
import { exportFileName } from "@/lib/teacher/mock-analytics-core";

/**
 * GET /api/teacher/mock/export?group=<id> — the mock results of a group (or,
 * without ?group, of every group the viewer may see) as CSV: one row per
 * student with their latest finished mock —
 * Student, Group, Date, Overall, Listening, Reading, Writing, Speaking, Mocks.
 *
 * Teachers export their own groups only; admins any group.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let user: { id: string; role: string };
  try {
    user = await requireTeacherOrAdmin();
  } catch (e) {
    const forbidden = e instanceof Error && e.message.startsWith("Forbidden");
    return NextResponse.json(
      { error: forbidden ? "Only teachers and admins can export mock results." : "Please sign in again." },
      { status: forbidden ? 403 : 401 }
    );
  }

  try {
    const scope = await mockScope({ id: user.id, role: user.role }, new URL(req.url).searchParams.get("group"));
    if (!scope.ok) {
      return NextResponse.json(
        { error: scope.reason === "no-teacher" ? "This account has no teacher profile." : "Not allowed." },
        { status: 403 }
      );
    }
    if (scope.unknownGroup) return NextResponse.json({ error: "Group not found." }, { status: 404 });

    const now = Date.now();
    const out = await getMockCsv(scope, now);
    if (!out.ok) {
      return NextResponse.json({ error: "Too many students to export at once — choose a group." }, { status: 409 });
    }
    // The BOM makes Excel read the names as UTF-8.
    return new Response(`\uFEFF${out.csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName(scope.group?.name ?? null, now)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("Mock results export failed:", e);
    return NextResponse.json({ error: "The export couldn't be built. Please try again." }, { status: 500 });
  }
}
