import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { EXAM_CATALOG_TAG } from "@/lib/ielts/catalog";
import { GEN_ROW_SELECT, LEVEL_PREFIX, canPublish, readDraft, skillForModule, type GenRow } from "@/lib/ielts/generate";
import type { PublishResponse } from "@/lib/ielts/generation-types";

export const dynamic = "force-dynamic";

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return NextResponse.json({ error: signedOut ? "Please sign in." : "Admin access required." }, { status: signedOut ? 401 : 403 });
}

/**
 * POST { ids, publish } — publish / unpublish finished bulk-generator tests.
 * Drafts are never published; a finished test is published only if it still
 * passes validation (so the catalog will actually show it).
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    return authError(e);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = Array.isArray(body?.ids) ? Array.from(new Set(body.ids.filter((x): x is string => typeof x === "string" && x.trim().length > 0))) : [];
  if (!ids.length || ids.length > 500) return NextResponse.json({ error: "ids must be a list of 1–500 draft ids." }, { status: 400 });
  if (typeof body?.publish !== "boolean") return NextResponse.json({ error: "publish must be true or false." }, { status: 400 });
  const publish = body.publish;

  try {
    const rows: GenRow[] = await db.generatedTest.findMany({
      where: { id: { in: ids }, level: { startsWith: LEVEL_PREFIX } },
      select: GEN_ROW_SELECT,
    });
    const eligible = rows.filter((r) =>
      r.published === publish ? false : publish ? canPublish(r) : !readDraft(r.data, skillForModule(r.module))
    );
    let updated = 0;
    if (eligible.length) {
      const res = await db.generatedTest.updateMany({
        where: { id: { in: eligible.map((r) => r.id) }, level: { startsWith: LEVEL_PREFIX } },
        data: { published: publish },
      });
      updated = res.count;
    }
    if (updated > 0) revalidateTag(EXAM_CATALOG_TAG);
    const response: PublishResponse = { ok: true, updated };
    return NextResponse.json(response);
  } catch (error) {
    console.error("exam-gen/publish error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update the tests." }, { status: 500 });
  }
}
