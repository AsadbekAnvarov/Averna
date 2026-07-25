import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { calculateBandScore, heuristicWritingAssessmentSafe, isGenuineWriting } from "@/lib/utils";
import { MOCK_EXAMS } from "@/lib/mock-exams-data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const essay: string = body.essay || "";
    const timeSpent = Number(body.timeSpent) || 0;

    // Score listening & reading SERVER-SIDE from the real exam answer keys, so a
    // client can't forge section scores. The runner sends its raw chosen options
    // (keyed by question index) plus the exam id.
    const exam = MOCK_EXAMS.find((e) => e.id === body.examId);
    if (!exam) {
      return NextResponse.json({ error: "Invalid exam ID" }, { status: 400 });
    }

    const lQ = exam.listening.questions;
    const rQ = exam.reading.questions;
    const lTotal = lQ.length || 1;
    const rTotal = rQ.length || 1;
    const lAns = (body.listeningAnswers ?? {}) as Record<string, number>;
    const rAns = (body.readingAnswers ?? {}) as Record<string, number>;

    let lCorrect = 0;
    lQ.forEach((q, i) => {
      if ((lAns[i] ?? lAns[String(i)]) === q.a) lCorrect++;
    });
    let rCorrect = 0;
    rQ.forEach((q, i) => {
      if ((rAns[i] ?? rAns[String(i)]) === q.a) rCorrect++;
    });

    const listeningBand = calculateBandScore((lCorrect / lTotal) * 100);
    const readingBand = calculateBandScore((rCorrect / rTotal) * 100);
    const writingBand = heuristicWritingAssessmentSafe(essay);

    const overall = Math.round(((listeningBand + readingBand + writingBand) / 3) * 2) / 2;

    // Anti-cheat: each section only earns points if the student actually
    // engaged with it (answered questions / wrote a genuine essay).
    const lPts = lCorrect > 0 ? Math.round(listeningBand * 10) : 0;
    const rPts = rCorrect > 0 ? Math.round(readingBand * 10) : 0;
    const wPts = isGenuineWriting(essay, 100) ? Math.round(writingBand * 10) : 0;

    // Save each section as an IELTS test (awards points + updates streak/achievements)
    await saveIELTSTest(student.id, "LISTENING", listeningBand, { mock: true, lCorrect, lTotal }, { type: "mock" }, Math.round(timeSpent / 3), { pointsOverride: lPts });
    await saveIELTSTest(student.id, "READING", readingBand, { mock: true, rCorrect, rTotal }, { type: "mock" }, Math.round(timeSpent / 3), { pointsOverride: rPts });
    await saveIELTSTest(student.id, "WRITING", writingBand, { mock: true, essay: essay.slice(0, 2000) }, { type: "mock" }, Math.round(timeSpent / 3), { pointsOverride: wPts });

    const pointsEarned = lPts + rPts + wPts;

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
