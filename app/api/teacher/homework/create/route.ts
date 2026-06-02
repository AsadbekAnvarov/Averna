import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await requireTeacher();

    const teacher = await db.teacher.findUnique({
      where: { userId: user.id },
      include: { groups: true },
    });

    if (!teacher || teacher.groups.length === 0) {
      return NextResponse.json({ error: "No groups assigned" }, { status: 400 });
    }

    const body = await req.json();
    const { title, description, module, difficulty, points, dueDate } = body;

    if (!title || !description || !module || !dueDate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create homework for first group (can be extended to select group)
    const homework = await db.homework.create({
      data: {
        title,
        description,
        module,
        difficulty: difficulty || 2,
        points: points || 50,
        dueDate: new Date(dueDate),
        teacherId: teacher.id,
        groupId: teacher.groups[0].id,
      },
    });

    return NextResponse.json({ success: true, homeworkId: homework.id });
  } catch (error: any) {
    console.error("Homework creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
