import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toCSV } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET ?group=<id>&type=grades|attendance  -> CSV download
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const groupId = req.nextUrl.searchParams.get("group");
    const type = req.nextUrl.searchParams.get("type") ?? "grades";
    if (!groupId) return NextResponse.json({ error: "group required" }, { status: 400 });

    const teacher = await db.teacher.findUnique({ where: { userId: user.id } });
    const group = await db.group.findUnique({
      where: { id: groupId },
      include: { students: { include: { user: { select: { name: true, email: true } } } } },
    });
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (user.role === "TEACHER" && (!teacher || group.teacherId !== teacher.id)) {
      return NextResponse.json({ error: "Not your group" }, { status: 403 });
    }

    let rows: (string | number)[][] = [];
    let filename = "export.csv";

    if (type === "attendance") {
      const records = await db.attendance.findMany({
        where: { groupId },
        orderBy: { date: "desc" },
        include: { student: { include: { user: { select: { name: true } } } } },
      });
      rows = [["Date", "Student", "Status"]];
      records.forEach((r) =>
        rows.push([
          new Date(r.date).toISOString().slice(0, 10),
          r.student.user.name ?? "Unnamed",
          r.status,
        ])
      );
      filename = `attendance_${group.name.replace(/\s+/g, "_")}.csv`;
    } else {
      const grades = await db.grade.findMany({
        where: { groupId },
        orderBy: { date: "desc" },
        include: { student: { include: { user: { select: { name: true } } } } },
      });
      rows = [["Date", "Student", "Title", "Score", "Max", "Percent", "Comment"]];
      grades.forEach((g) =>
        rows.push([
          new Date(g.date).toISOString().slice(0, 10),
          g.student.user.name ?? "Unnamed",
          g.title,
          g.score,
          g.maxScore,
          `${Math.round((g.score / g.maxScore) * 100)}%`,
          g.comment ?? "",
        ])
      );
      filename = `grades_${group.name.replace(/\s+/g, "_")}.csv`;
    }

    const csv = toCSV(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
