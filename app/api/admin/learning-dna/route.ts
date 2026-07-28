import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getDnaAggregate } from "@/lib/engine/learning-dna";

export const dynamic = "force-dynamic";

/**
 * Anonymous, platform-wide Learning DNA analytics for the administrator.
 *
 * Admin-only, and returns only aggregates that already passed the engine's
 * k-anonymity suppression — no student identifiers ever leave the aggregation
 * layer, so this endpoint cannot be used to profile an individual even by
 * combining responses.
 */
export async function GET() {
  try {
    await requireAdmin();
    const aggregate = await getDnaAggregate();
    return NextResponse.json({ aggregate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load analytics";
    const status = message.includes("Forbidden") ? 403 : message.includes("Unauthorized") ? 401 : 500;
    if (status === 500) console.error("Learning DNA aggregate error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}
