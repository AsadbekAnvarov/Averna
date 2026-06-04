import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET: list this teacher's saved homework templates
export async function GET() {
  try {
    const user = await requireAuth();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const teacher = await db.teacher.findUnique({ where: { userId: user.id } });
    if (!teacher) return NextResponse.json({ templates: [] });

    const templates = await db.homeworkTemplate.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}

// POST { title, description, module, points }: save a reusable template
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const teacher = await db.teacher.findUnique({ where: { userId: user.id } });
    if (!teacher) return NextResponse.json({ error: "No teacher" }, { status: 404 });

    const { title, description, module, points } = await req.json();
    if (!title || !description) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    const template = await db.homeworkTemplate.create({
      data: {
        teacherId: teacher.id,
        title: String(title).slice(0, 200),
        description: String(description).slice(0, 5000),
        module: module || "WRITING",
        points: Number(points) || 50,
      },
    });
    return NextResponse.json({ ok: true, template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
