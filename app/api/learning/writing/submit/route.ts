import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessWritingTask, analyzeWritingIssues } from "@/lib/ai";
import { saveIELTSTest } from "@/lib/db-helpers";
import { isGenuineWriting, isOnTopic } from "@/lib/utils";
import { assessSubmission, logAssessment } from "@/lib/engine/integrity-engine";

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

    // Learning DNA signals only this route can measure: how much language the
    // student actually produced, how varied it was, and which issue categories
    // the assessment found. Without these, "writing complexity" and the
    // grammar/lexical mistake categories can never be measured for a learner.
    const essayWords = String(essay).trim().split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(
      essayWords.map((w) => w.toLowerCase().replace(/[^a-z']/g, "")).filter(Boolean)
    ).size;
    const ISSUE_TAG: Record<string, string> = {
      grammar: "grammar_range",
      tense: "tenses",
      article: "articles",
      preposition: "prepositions",
      spelling: "spelling",
      vocabulary: "lexical_range",
      word: "word_form",
      cohesion: "coherence",
      linking: "coherence",
      task: "task_response",
    };
    // Only categories the assessment flagged more than once count as a pattern.
    const tagCounts = new Map<string, number>();
    for (const issue of issues) {
      const type = String(issue?.type ?? "").toLowerCase();
      const key = Object.keys(ISSUE_TAG).find((k) => type.includes(k));
      if (!key) continue;
      const tag = ISSUE_TAG[key];
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    const dnaErrorTags = Array.from(tagCounts.entries())
      .filter(([, n]) => n >= 2)
      .map(([tag]) => tag);

    const dna = {
      channel: "writing" as const,
      words: essayWords.length,
      diversity: essayWords.length > 0 ? uniqueWords / essayWords.length : undefined,
      errorTags: dnaErrorTags,
    };

    // Save test result (0 points if it doesn't meet the effort threshold)
    const test = await saveIELTSTest(
      student.id,
      "WRITING",
      assessment.overallBand,
      { essay, prompt },
      { ...assessment, issues },
      timeSpent || 0,
      genuine
        ? { idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined, dna }
        : { pointsOverride: 0, dna }
    );

    // Integrity Engine (S4). The hard writing signals already gate XP to zero
    // above (via `genuine`), so this records the verdict for the audit trail.
    const facts = {
      studentId: student.id,
      module: "WRITING",
      timeSpent: Number(timeSpent) || 0,
      essay: { genuine: isGenuineWriting(essay, minWords), onTopic },
    };
    const verdict = await assessSubmission(facts);
    await logAssessment(facts, verdict, test.pointsAwarded ?? 0);

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
