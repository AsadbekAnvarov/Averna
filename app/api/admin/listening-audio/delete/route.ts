import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { StoreError, deleteAudio } from "@/lib/ielts/audio/store";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return json({ ok: false, error: signedOut ? "Tizimga kiring." : "Faqat administratorlar uchun.", code: "invalid" }, signedOut ? 401 : 403);
}

/**
 * POST { testId, partIndex? } — delete one part's recording, or all of a
 * test's recordings (also works for tests no longer in the catalog). Students
 * hear browser voices for those parts again.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    return authError(e);
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const testId = typeof body?.testId === "string" ? body.testId.trim() : "";
  const raw = body?.partIndex;
  const partIndex = raw == null ? null : typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 9 ? raw : NaN;
  if (!testId || testId.length > 200 || Number.isNaN(partIndex)) {
    return json({ ok: false, error: "Notoʻgʻri soʻrov: testId (va ixtiyoriy partIndex) kerak.", code: "invalid" }, 400);
  }
  try {
    const r = await deleteAudio(testId, partIndex);
    return json({ ok: true, deleted: r.deleted, filesKept: r.filesKept });
  } catch (e) {
    if (e instanceof StoreError && e.code === "storage") {
      return json({ ok: false, error: "Fayllarni Vercel Blob xotirasidan oʻchirib boʻlmadi — birozdan keyin qayta urinib koʻring.", code: "storage" }, 502);
    }
    console.error("listening-audio delete failed", e);
    return json({ ok: false, error: "Oʻchirib boʻlmadi — server xatosi.", code: "server" }, 500);
  }
}
