import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Self check-in via QR. The QR encodes a URL with ?code=<groupId>-<YYYYMMDD>.
 * A student opening it is marked PRESENT for their group for today, but only
 * if the code matches their own group and the date is today (anti-abuse).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student || !student.groupId) {
      return NextResponse.json({ error: "You are not assigned to a group yet." }, { status: 400 });
    }

    const [groupId, dateStr] = code.split("|");
    const today = new Date().toISOString().slice(0, 10);
    if (dateStr !== today) {
      return NextResponse.json({ error: "This check-in code has expired." }, { status: 400 });
    }
    if (groupId !== student.groupId) {
      return NextResponse.json({ error: "This code is for a different group." }, { status: 400 });
    }

    const dayStart = new Date(`${today}T00:00:00`);
    const dayEnd = new Date(`${today}T23:59:59`);

    const existing = await db.attendance.findFirst({
      where: { studentId: student.id, groupId, date: { gte: dayStart, lte: dayEnd } },
    });
    if (existing) {
      await db.attendance.update({ where: { id: existing.id }, data: { status: "PRESENT" } });
    } else {
      await db.attendance.create({
        data: { studentId: student.id, groupId, date: dayStart, status: "PRESENT" },
      });
    }

    return NextResponse.json({ ok: true, message: "You're checked in. See you in class! ✅" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
