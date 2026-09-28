import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assessWritingTask, analyzeWritingIssues } from "@/lib/ai";
import { saveIELTSTest } from "@/lib/db-helpers";
import { isGenuineWriting, isOnTopic } from "@/lib/utils";
import { assessSubmission, logAssessment } from "@/lib/engine/integrity-engine";
import { computeWritingXp } from "@/lib/engine/progression/xp";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { hashString } from "@/lib/engine/progression/missions";
import { findSubmittedTest, loadXpHistory } from "@/lib/engine/progression/service";
import { getWritingTask } from "@/lib/ielts/catalog";
import { examHomeworkFor, recordExamHomework, writingVerdict, type ExamHomeworkTarget } from "@/lib/homework/exam-homework";
import { writingTaskGate } from "@/lib/homework/exam-attempt";
import { isHomeworkRetryOf } from "@/lib/homework/library-shared";
import type { WritingPrompt } from "@/lib/writing-data";

export const dynamic = "force-dynamic";

const sameText = (a: unknown, b: unknown) =>
  String(a ?? "").replace(/\s+/g, " ").trim() === String(b ?? "").replace(/\s+/g, " ").trim();

/**
 * Exam homework (?hw) for exactly this library prompt, or null. The essay is
 * assessed against the prompt text the client sends, so that text must be the
 * homework prompt's own wording — a homework id can't be attached to another task.
 */
async function writingHomework(
  studentId: string,
  homeworkId: unknown,
  task: "task1" | "task2",
  promptId: unknown,
  promptText: unknown
): Promise<{ target: ExamHomeworkTarget; prompt: WritingPrompt } | null> {
  if (typeof promptId !== "string" || !promptId || promptId.length > 200) return null;
  const libraryPrompt: WritingPrompt | null = await getWritingTask(task, promptId).catch(() => null);
  if (!libraryPrompt || !sameText(libraryPrompt.prompt, promptText)) return null;
  const target = await examHomeworkFor(studentId, homeworkId, {
    kind: task === "task1" ? "WRITING_TASK1" : "WRITING_TASK2",
    contentId: libraryPrompt.id,
  });
  return target ? { target, prompt: libraryPrompt } : null;
}

function homeworkSummary(task: "task1" | "task2", words: number, band: number): string {
  return `Writing ${task === "task1" ? "Task 1" : "Task 2"} · ${words} words · band ${band.toFixed(1)} (AI estimate)`;
}

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
        { error: "Your essay is missing its task or text. Reload the task and try again." },
        { status: 400 }
      );
    }

    const task: "task1" | "task2" = taskType === "task1" ? "task1" : "task2";
    // Anti-cheat: only award XP for a genuine, on-topic, long-enough essay.
    // Weak essays are still assessed and saved (feedback is the point) — the
    // XP engine explains exactly what was missing.
    const minWords = XP_CONFIG.writing[task].minWords;
    // Exam homework: resolved before the slow assessment (cheap reads only).
    const homework = body.homeworkId ? await writingHomework(student.id, body.homeworkId, task, body.promptId, prompt) : null;

    // Retry / double-click safety — checked BEFORE the (slow, paid) AI call.
    const previous = await findSubmittedTest(student.id, body.submissionId);
    if (previous) {
      // A retried request still completes the homework (recordExamHomework is idempotent) — but
      // only with this homework's own saved essay, never another skill's or another prompt's attempt.
      if (homework && isHomeworkRetryOf(previous, homework.target.homeworkId, homework.prompt.id)) {
        const prevAnswers = previous.answers as { essay?: unknown; prompt?: unknown } | null;
        const prevEssay = String(prevAnswers?.essay ?? "");
        const prevWords = (previous.aiAnalysis as { wordCount?: unknown } | null)?.wordCount;
        const words = typeof prevWords === "number" ? prevWords : prevEssay.trim().split(/\s+/).filter(Boolean).length;
        const band = Number(previous.score) || 0;
        await recordExamHomework({
          studentId: student.id,
          target: homework.target,
          testId: previous.id,
          band,
          summary: homeworkSummary(task, words, band),
          // Real words that address the task, at least the XP minimum (80 / 120) — the saved essay, as recordExamHomework judges it too.
          genuine: writingTaskGate(writingVerdict(prevEssay, prevAnswers?.prompt ?? homework.prompt.prompt, task)).counts,
        });
      }
      return NextResponse.json({ testId: previous.id, duplicate: true });
    }

    const onTopic = isOnTopic(essay, prompt);
    const genuine = isGenuineWriting(essay, minWords) && onTopic;
    // Same prompt again → repeat decay (stored as `testId` on the answers).
    const contentKey = `${task}:${hashString(String(prompt))}`;

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

    const wordTotal = essayWords.length;
    const xp = computeWritingXp({
      task,
      words: wordTotal,
      band: Number(assessment.overallBand) || 0,
      genuine: isGenuineWriting(essay, minWords),
      onTopic,
      coherence: Number((assessment as { coherenceCohesion?: number }).coherenceCohesion) || null,
      history: await loadXpHistory(student.id, "WRITING", contentKey),
    });

    // Save test result (0 XP when it doesn't meet the effort threshold)
    const test = await saveIELTSTest(
      student.id,
      "WRITING",
      assessment.overallBand,
      {
        essay,
        prompt,
        taskType: task,
        testId: contentKey,
        ...(homework ? { promptId: homework.prompt.id, promptTitle: homework.prompt.title, homeworkId: homework.target.homeworkId } : {}),
      },
      { ...assessment, issues, wordCount: wordTotal },
      timeSpent || 0,
      {
        contentKey,
        idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined,
        xp,
        logDetails: { words: wordTotal, task },
        dna,
      }
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

    // Exam homework: the first essay for this prompt that counts completes it (the teacher reviews it later).
    if (homework) {
      const band = Number(assessment.overallBand) || 0;
      await recordExamHomework({
        studentId: student.id,
        target: homework.target,
        testId: test.id,
        band,
        summary: homeworkSummary(task, wordTotal, band),
        // The same minimum the essay's own XP needs (80 / 120 real words, not filler) and on the task —
        // a shorter or off-topic essay earns neither XP nor homework points, and leaves it in To do.
        genuine: writingTaskGate(writingVerdict(essay, prompt, task)).counts,
      });
    }

    return NextResponse.json({
      testId: test.id,
      assessment,
      issues,
      pointsAwarded: test.pointsAwarded > 0,
      xpAwarded: test.pointsAwarded,
      cheatNotice: genuine ? undefined : xp.notes[0],
    });
  } catch (error: any) {
    console.error("Writing submission error:", error);
    return NextResponse.json(
      { error: "Your essay wasn't submitted. Your text is still in the editor — please try again." },
      { status: 500 }
    );
  }
}
