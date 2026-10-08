import { trustedMutation } from "@/lib/security/same-origin";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  correctionMatches,
  MAX_MISTAKES,
  parseMistake,
} from "@/lib/mistakes/rules";
import { reserveLimits } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function owner() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "STUDENT") return null;
  return db.student.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
}
export async function GET() {
  try {
    const student = await owner();
    if (!student)
      return json({ error: "Sign in with your student account." }, 401);
    const items = await db.mistakeEntry.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: MAX_MISTAKES,
    });
    return json({ items });
  } catch {
    return json(
      {
        error:
          "Your bank is temporarily unavailable. Nothing has been deleted.",
      },
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  if (!trustedMutation(req))
    return json({ error: "Untrusted request origin." }, 403);
  try {
    const student = await owner();
    if (!student)
      return json({ error: "Sign in with your student account." }, 401);
    const limit = await reserveLimits([
      { key: `mistakes:${student.id}`, limit: 120, seconds: 3600 },
    ]);
    if (!limit.ok)
      return json(
        { error: "Please wait before making more changes." },
        limit.unavailable ? 503 : 429,
      );
    const body = await req.json().catch(() => null);
    if (body?.action === "practice") {
      if (typeof body.id !== "string")
        return json({ error: "Choose a correction first." }, 400);
      const item = await db.mistakeEntry.findFirst({
        where: { id: body.id, studentId: student.id },
      });
      if (!item) return json({ error: "Correction not found." }, 404);
      const matched = correctionMatches(body.answer, item.right);
      if (matched)
        await db.mistakeEntry.update({
          where: { id: item.id },
          data: {
            practiceCount: { increment: 1 },
            lastPracticedAt: new Date(),
          },
        });
      // Matching a saved correction is practice evidence, not a new IELTS band or automatic XP.
      return json({ matched, correction: item.right });
    }
    const card = parseMistake(body);
    if (!card)
      return json(
        {
          error:
            "Add an original phrase and a different corrected version (up to 2,000 characters each).",
        },
        400,
      );
    if (card.sourceTestId) {
      const test = await db.iELTSTest.findFirst({
        where: { id: card.sourceTestId, studentId: student.id },
        select: { id: true },
      });
      if (!test)
        return json(
          { error: "That attempt does not belong to your account." },
          403,
        );
    }
    // Serialise quota checks for this student's bank. Ownership is never taken from the request.
    const item = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "students" WHERE "id" = ${student.id} FOR UPDATE`;
      const existing = await tx.mistakeEntry.findUnique({
        where: { id: card.id },
      });
      if (existing && existing.studentId !== student.id) return null;
      if (existing) return existing; // idempotent creation/retry; never overwrite another card
      if (
        (await tx.mistakeEntry.count({ where: { studentId: student.id } })) >=
        MAX_MISTAKES
      )
        return null;
      return tx.mistakeEntry.create({
        data: { ...card, studentId: student.id },
      });
    });
    return item
      ? json({ item }, 201)
      : json(
          {
            error:
              "This card could not be added. Your bank may be full; refresh and try again.",
          },
          409,
        );
  } catch {
    return json({ error: "The change was not saved. Please try again." }, 503);
  }
}
export async function DELETE(req: NextRequest) {
  if (!trustedMutation(req))
    return json({ error: "Untrusted request origin." }, 403);
  try {
    const student = await owner();
    if (!student)
      return json({ error: "Sign in with your student account." }, 401);
    const id = req.nextUrl.searchParams.get("id");
    if (!id || id.length > 100)
      return json({ error: "Choose a correction." }, 400);
    await db.$transaction(async (tx) => {
      const removed = await tx.mistakeEntry.deleteMany({
        where: { id, studentId: student.id },
      });
      if (removed.count)
        await tx.reviewItem.deleteMany({
          where: { studentId: student.id, itemKey: id, source: "mistake" },
        });
    });
    return json({ ok: true });
  } catch {
    return json({ error: "The card was not deleted. Try again." }, 503);
  }
}
