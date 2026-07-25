import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateLessonReflection } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (user.role !== "TEACHER" && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Teachers only" }, { status: 403 });
    }
    const { topic, notes, weakArea, groupName } = await req.json();
    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Lesson topic required" }, { status: 400 });
    }
    const reflection = await generateLessonReflection({
      topic,
      notes: typeof notes === "string" ? notes : undefined,
      weakArea: typeof weakArea === "string" ? weakArea : null,
      groupName: typeof groupName === "string" ? groupName : undefined,
    });
    return NextResponse.json(reflection);
  } catch (error: any) {
    console.error("Reflection route error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }
}
