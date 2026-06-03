import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore, heuristicWritingAssessmentSafe } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const lCorrect = Number(body.listeningCorrect) || 0;
    const lTotal = Number(body.listeningTotal) || 1;
    const rCorrect = Number(body.readingCorrect) || 0;
    const rTotal = Number(body.readingTotal) || 1;
    const essay: string = body.essay || "";
    const timeSpent = Number(body.timeSpent) || 0;

    const listeningBand = calculateBandScore((lCorrect / lTotal) * 100);
    const readingBand = calculateBandScore((rCorrect / rTotal) * 100);
    const writingBand = heuristicWritingAssessmentSafe(essay);

    const overall = Math.round(((listeningBand + readingBand + writingBand) / 3) * 2) / 2;

    // Save each section as an IELTS test (awards points + updates streak/achievements)
    await saveIELTSTest(student.id, "LISTENING", listeningBand, { mock: true, lCorrect, lTotal }, { type: "mock" }, Math.round(timeSpent / 3));
    await saveIELTSTest(student.id, "READING", readingBand, { mock: true, rCorrect, rTotal }, { type: "mock" }, Math.round(timeSpent / 3));
    await saveIELTSTest(student.id, "WRITING", writingBand, { mock: true, essay: essay.slice(0, 2000) }, { type: "mock" }, Math.round(timeSpent / 3));

    const pointsEarned =
      Math.round(listeningBand * 10) + Math.round(readingBand * 10) + Math.round(writingBand * 10);

    return NextResponse.json({
      listeningBand,
      readingBand,
      writingBand,
      overall,
      pointsEarned,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit mock exam";
    console.error("Mock submit error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
