import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { reserveLimits } from "@/lib/security/rate-limit";
import { submitWorkshopSchema, reviewWorkshopSchema } from "@/lib/adventures/rules";
import { listWorkshops, submitWorkshop, reviewWorkshop, withdrawWorkshop, WorkshopError } from "@/lib/adventures/workshop-service";
export const dynamic = "force-dynamic";
const reply = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
async function handle(request: Request) {
  if (process.env.ADVENTURE_WORKSHOP !== "on") return reply({ error: "Class sharing is not enabled. Personal drafts and previews still work." }, 404);
  if (request.method !== "GET" && !trustedMutation(request)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const session = await auth(); if (!session?.user) return reply({ error: "Sign in first" }, 401);
    const current = await db.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    if (!current || !["STUDENT", "TEACHER"].includes(current.role) || current.role !== session.user.role) return reply({ error: "Student or teacher access required" }, 403);
    const role = current.role;
    const mode = new URL(request.url).searchParams.get("mode") || "mine";
    if (request.method === "GET" && (role === "TEACHER" ? mode !== "review" : !["mine", "class"].includes(mode))) return reply({ error: "Invalid list scope" }, 403);
    if (role === "STUDENT" && request.method !== "DELETE") {
      const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { blacklisted: true } });
      if (!student || student.blacklisted) return reply({ error: "Student access is unavailable" }, 403);
    }
    if ((request.method === "POST" || request.method === "DELETE") && role !== "STUDENT" || request.method === "PATCH" && role !== "TEACHER") return reply({ error: "Not allowed" }, 403);
    const limit = await reserveLimits([{ key: `adventure-workshop:${request.method}:${session.user.id}`, limit: request.method === "GET" ? 180 : 30, seconds: 3600 }]);
    if (!limit.ok) return reply({ error: "Temporarily limited. Your device draft has not changed." }, limit.unavailable ? 503 : 429);
    if (request.method === "GET") return reply(await listWorkshops(session.user.id, mode as "mine" | "class" | "review"));
    let raw: unknown; try { raw = await boundedJson(request, 24_000); } catch { return reply({ error: "Invalid or oversized request" }, 400); }
    if (request.method === "POST") {
      const parsed = submitWorkshopSchema.safeParse(raw); if (!parsed.success) return reply({ error: "Review your title, passage, questions, answer keys and sharing permission." }, 400);
      return reply({ item: await submitWorkshop(session.user.id, parsed.data.requestId, parsed.data.payload) });
    }
    if (request.method === "PATCH") {
      const parsed = reviewWorkshopSchema.safeParse(raw); if (!parsed.success) return reply({ error: "Choose a decision, a current version and feedback for returned work." }, 400);
      return reply({ item: await reviewWorkshop(session.user.id, parsed.data) });
    }
    const parsed = z.object({ id: z.string().min(1).max(100), version: z.number().int().min(1) }).strict().safeParse(raw);
    if (!parsed.success) return reply({ error: "Invalid withdrawal" }, 400);
    await withdrawWorkshop(session.user.id, parsed.data.id, parsed.data.version); return reply({ ok: true });
  } catch (error) {
    if (error instanceof WorkshopError) return reply({ error: error.message }, error.status);
    console.error("Adventure workshop unavailable", error instanceof Error ? error.name : "unknown");
    return reply({ error: "Class sharing is unavailable. Your personal device draft is unchanged." }, 503);
  }
}
export const GET = handle; export const POST = handle; export const PATCH = handle; export const DELETE = handle;
