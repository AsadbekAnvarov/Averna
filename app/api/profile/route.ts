import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    
    const student = await db.student.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: student.user.name || "",
      email: student.user.email,
      personalGoal: student.personalGoal || "",
      totalPoints: student.totalPoints,
      currentStreak: student.currentStreak,
      longestStreak: student.longestStreak,
      globalRank: student.globalRank,
      groupRank: student.groupRank,
    });
  } catch (error: any) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireAuth();
    
    const student = await db.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, personalGoal } = body;

    // Update user name
    if (name) {
      await db.user.update({
        where: { id: user.id },
        data: { name },
      });
    }

    // Update personal goal
    if (personalGoal) {
      await db.student.update({
        where: { id: student.id },
        data: { personalGoal },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
