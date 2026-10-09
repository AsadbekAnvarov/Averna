import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWritingTask } from "@/lib/ielts/catalog";
import { trustedMutation } from "@/lib/security/same-origin";
import { boundedJson } from "@/lib/security/json-body";
import { reserveLimits } from "@/lib/security/rate-limit";
import { draftScopeSchema, draftWriteSchema } from "@/lib/writing-drafts/rules";
import { DraftError, promptHash, readDraft, writeDraft } from "@/lib/writing-drafts/service";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
async function handle(req: Request, mutation: boolean, clear = false) {
  if (process.env.CLOUD_WRITING_DRAFTS !== "on") return reply({ error: "Not available" }, 404);
  if (mutation && !trustedMutation(req)) return reply({ error: "Untrusted origin" }, 403);
  try {
    const session = await auth();
    if (!session?.user) return reply({ error: "Sign in to access your draft" }, 401);
    if (session.user.role !== "STUDENT") return reply({ error: "Student account required" }, 403);
    const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true, blacklisted: true } });
    if (!student || student.blacklisted) return reply({ error: "Student access unavailable" }, 403);
    let raw: unknown;
    try { raw = mutation ? await boundedJson(req) : Object.fromEntries(new URL(req.url).searchParams); }
    catch { return reply({ error: "Invalid or oversized draft" }, 400); }
    const parsed = mutation ? draftWriteSchema.safeParse(raw) : draftScopeSchema.safeParse(raw);
    if (!parsed.success) return reply({ error: "Invalid draft fields" }, 400);
    const input = parsed.data;
    const prompt = await getWritingTask(input.taskType, input.promptId);
    if (!prompt) return reply({ error: "Task is no longer available. Keep your local text." }, 404);
    const limit = await reserveLimits([{ key: `writing-draft:${mutation ? "write" : "read"}:${session.user.id}`, limit: mutation ? 90 : 180, seconds: 3600 }]);
    if (!limit.ok) return reply({ error: "Draft service temporarily limited. Your local text is unchanged." }, 429);
    const hash = promptHash(prompt.prompt);
    const draft = mutation
      ? await writeDraft(session.user.id, draftWriteSchema.parse(input), hash, clear)
      : await readDraft(student.id, input.taskType, input.promptId, hash);
    return reply({ draft });
  } catch (error) {
    if (error instanceof DraftError) return reply({ error: error.message }, error.status);
    console.error("Writing draft service unavailable", error instanceof Error ? error.name : "unknown");
    return reply({ error: "Account saving is unavailable. Your local text is unchanged; try again." }, 503);
  }
}
export const GET = (req: Request) => handle(req, false);
export const PUT = (req: Request) => handle(req, true);
export const DELETE = (req: Request) => handle(req, true, true);
