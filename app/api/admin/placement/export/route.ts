import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listPlacementResults, parsePlacementFilters, placementCsv } from "@/lib/placement/admin";

export const dynamic = "force-dynamic";

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&level=B1&nogroup=1 → CSV of placement results (admins only). */
export async function GET(req: Request) {
  let role: string;
  try {
    role = (await requireAuth()).role;
  } catch {
    return NextResponse.json({ error: "Tizimga kiring." }, { status: 401 });
  }
  if (role !== "ADMIN") return NextResponse.json({ error: "Faqat adminlar uchun." }, { status: 403 });
  try {
    const sp: Record<string, string> = {};
    new URL(req.url).searchParams.forEach((value: string, key: string) => {
      sp[key] = value;
    });
    const filters = parsePlacementFilters(sp);
    const { rows } = await listPlacementResults(filters);
    const day = new Date().toISOString().slice(0, 10);
    return new NextResponse(placementCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="placement_${day}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Placement export error:", error);
    return NextResponse.json({ error: "Eksport qilib boʻlmadi. Qayta urinib koʻring." }, { status: 500 });
  }
}
