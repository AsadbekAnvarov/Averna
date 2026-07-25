import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGroupsBrief } from "@/lib/teacher-intel";
import { simulateClass } from "@/lib/ai";
import { guardAi } from "@/lib/engine/ai-guard";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const guard = guardAi(user.id, "teacher-tool");
    if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: 429 });
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }
    const { topic, groupId } = await req.json();
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic required" }, { status: 400 });
    }

    const teacher = await db.teacher.findUnique({ where: { userId: user.id }, select: { id: true } });
    let brief = null;
    if (teacher && typeof groupId === "string") {
      const groups = await getGroupsBrief(teacher.id);
      brief = groups.find((g) => g.id === groupId) ?? null;
    }

    const sim = await simulateClass({
      topic,
      level: brief?.level ?? null,
      size: brief?.size,
      avgBand: brief?.avgBand ?? null,
      weakArea: brief?.weakModule ?? null,
    });
    return NextResponse.json(sim);
  } catch (error: any) {
    console.error("Simulate route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
