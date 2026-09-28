import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { audioOverview } from "@/lib/ielts/audio/store";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return json({ error: signedOut ? "Tizimga kiring." : "Faqat administratorlar uchun." }, signedOut ? 401 : 403);
}

/**
 * GET — the placement test's Listening and every catalog Listening test
 * (legacy short tests skipped) with each part's recording status (none /
 * ready / stale / failed), length and size, recordings of tests no longer in
 * the catalog, storage totals, and whether recordings are switched off
 * (LISTENING_AUDIO=off).
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    return authError(e);
  }
  try {
    return json(await audioOverview());
  } catch (e) {
    console.error("listening-audio overview failed", e);
    return json({ error: "Roʻyxatni yuklab boʻlmadi — birozdan keyin qayta urinib koʻring.", code: "server" }, 500);
  }
}
