import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXAM_CATALOG_TAG } from "@/lib/ielts/catalog";
import { LEVEL_PREFIX } from "@/lib/ielts/generate";
import type { DeleteResponse } from "@/lib/ielts/generation-types";

export const dynamic = "force-dynamic";

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return NextResponse.json({ error: signedOut ? "Please sign in." : "Admin access required." }, { status: signedOut ? 401 : 403 });
}

/** POST { ids } — delete bulk-generator rows (level "exam-gen:*") only; other GeneratedTest rows are never touched. */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    return authError(e);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const raw = body && Array.isArray(body.ids) ? body.ids : [];
  const ids = Array.from(new Set(raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0)));
  if (!ids.length || ids.length > 500) return NextResponse.json({ error: "ids must be a list of 1–500 draft ids." }, { status: 400 });

  try {
    const res = await db.generatedTest.deleteMany({ where: { id: { in: ids }, level: { startsWith: LEVEL_PREFIX } } });
    // Deleted tests may have been published: drop them from the cached catalog too.
    if (res.count > 0) revalidateTag(EXAM_CATALOG_TAG);
    const response: DeleteResponse = { ok: true, deleted: res.count };
    return NextResponse.json(response);
  } catch (error) {
    console.error("exam-gen/delete error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete the drafts." }, { status: 500 });
  }
}
