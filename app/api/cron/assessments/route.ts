import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processAssessmentBatch } from "@/lib/assessment/batch";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  if (process.env.ASSESSMENT_SCHEDULER !== "on") return NextResponse.json({ error: "Not available" }, { status: 404 });
  const secret = process.env.ASSESSMENT_SCHEDULER_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || secret.length < 32 || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await processAssessmentBatch(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Assessment storage unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
