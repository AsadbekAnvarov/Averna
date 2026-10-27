/**
 * Shared checks for the live speaking partner routes (app/api/coach/live/*). SERVER ONLY.
 * Every route: same-origin mutation, a signed-in STUDENT with a student record.
 * Responses are private and never cached; nothing here logs a body.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trustedMutation } from "@/lib/security/same-origin";

export const reply = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } });

export interface LiveStudent {
  userId: string;
  student: { id: string; level: string | null; targetBand: string | null };
}

/** The signed-in student, or the error response to return. */
export async function liveStudent(request: Request): Promise<{ ok: true; who: LiveStudent } | { ok: false; res: Response }> {
  if (!trustedMutation(request)) return { ok: false, res: reply({ error: "Untrusted request origin." }, 403) };
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false, res: reply({ error: "Sign in to use the live partner." }, 401) };
  if (user.role !== "STUDENT") return { ok: false, res: reply({ error: "The live partner is for students." }, 403) };
  try {
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true, level: true, targetBand: true } });
    if (!student) return { ok: false, res: reply({ error: "The live partner is for students." }, 403) };
    return { ok: true, who: { userId: user.id, student } };
  } catch (e) {
    console.error("Live partner student lookup failed", e instanceof Error ? e.name : "unknown");
    return { ok: false, res: reply({ error: "The live partner isn't available right now. Try again in a moment." }, 503) };
  }
}
