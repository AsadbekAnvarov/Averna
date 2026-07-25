import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessWritingTask, analyzeWritingIssues } from "@/lib/ai";
import { saveIELTSTest } from "@/lib/db-helpers";
import { isGenuineWriting, isOnTopic } from "@/lib/utils";
import { assessSubmission, logShadowAssessment } from "@/lib/engine/integrity-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Get student profile
    const student = await db.student.findUnique({
      where: { userId: user.id },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { essay, taskType, prompt, timeSpent } = body;

    // Validate
    if (!essay || !taskType || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Anti-cheat: only award points for a genuine effort. Empty / spammy /
    // too-short essays are still assessed and saved, but earn 0 points.
    const minWords = taskType === "task1" ? 60 : 100;
    // Genuine effort AND actually about the prompt — an off-topic essay is still
    // assessed and saved, but earns no XP (relevance gate, Phase 3c).
    const onTopic = isOnTopic(essay, prompt);
    const genuine = isGenuineWriting(essay, minWords) && onTopic;

    // Get AI assessment
    const assessment = await assessWritingTask(
      essay,
      taskType,
      prompt
    );
    // Prefer the model's inline issues (richer — includes strong-phrase
    // highlights) and top up with mechanical heuristic checks it may miss.
    // Falls back cleanly to heuristics-only when no OpenAI key is configured.
    const heuristicIssues = analyzeWritingIssues(essay);
    const aiIssues = Array.isArray((assessment as { issues?: unknown }).issues)
      ? ((assessment as { issues: { text: string; type: string; suggestion: string }[] }).issues)
      : [];
    const seen = new Set<string>(aiIssues.map((i) => String(i.text || "").toLowerCase()));
    const issues = [
      ...aiIssues,
      ...heuristicIssues.filter((h) => !seen.has(String(h.text || "").toLowerCase())),
    ].slice(0, 15);

    // Save test result (0 points if it doesn't meet the effort threshold)
    const test = await saveIELTSTest(
      student.id,
      "WRITING",
      assessment.overallBand,
      { essay, prompt },
      { ...assessment, issues },
      timeSpent || 0,
      genuine
        ? { idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined }
        : { pointsOverride: 0 }
    );

    // Integrity Engine — SHADOW MODE: assess and record, reward unchanged (S3).
    const facts = {
      studentId: student.id,
      module: "WRITING",
      timeSpent: Number(timeSpent) || 0,
      essay: { genuine: isGenuineWriting(essay, minWords), onTopic },
    };
    const verdict = await assessSubmission(facts);
    await logShadowAssessment(facts, verdict, test.pointsAwarded ?? 0);

    return NextResponse.json({
      testId: test.id,
      assessment,
      issues,
      pointsAwarded: genuine,
      cheatNotice: genuine
        ? undefined
        : !onTopic
          ? "Your essay looks off-topic — address the prompt to earn points."
          : `Write at least ${minWords} meaningful words to earn points.`,
    });
  } catch (error: any) {
    console.error("Writing submission error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit essay" },
      { status: 500 }
    );
  }
}
