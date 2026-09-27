import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveIELTSTest } from "@/lib/db-helpers";
import { scoreSpeaking } from "@/lib/utils";
import { computeSpeakingXp } from "@/lib/engine/progression/xp";
import { XP_CONFIG } from "@/lib/engine/progression/config";
import { hashString } from "@/lib/engine/progression/missions";
import { EXAMINER_QUESTIONS } from "@/lib/examiner-questions";
import { buildSessionOutcome, findSubmittedTest, loadXpHistory } from "@/lib/engine/progression/service";

export const dynamic = "force-dynamic";

/**
 * Speaking practice submission (AI examiner).
 *
 * Before this route existed, Speaking practice was scored only in the browser
 * and never saved — so Speaking earned no XP, never appeared in progress, and
 * the recommendation engine could never see it. Now the server re-scores the
 * transcript itself (the client's band is ignored), applies the Speaking XP
 * model (duration, words, quality, plausibility of the speaking rate, repeat
 * decay, daily budget) and saves it as a SPEAKING test so it flows into skill
 * stages, missions, challenges, badges and the Learning DNA.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const student = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 300) : "";
    const transcript = typeof body.transcript === "string" ? body.transcript.trim().slice(0, 6000) : "";
    const seconds = Math.max(0, Math.min(Math.round(Number(body.seconds) || 0), XP_CONFIG.speaking.maxSeconds));
    if (!question || !transcript) {
      return NextResponse.json(
        { error: "We didn't catch any speech. Check your microphone and answer again." },
        { status: 400 }
      );
    }

    if (!EXAMINER_QUESTIONS.includes(question)) {
      return NextResponse.json({ error: "This question isn't recognised. Reload the examiner and try again." }, { status: 400 });
    }

    const previous = await findSubmittedTest(student.id, body.submissionId);
    if (previous) {
      return NextResponse.json({
        testId: previous.id,
        duplicate: true,
        outcome: await buildSessionOutcome(student.id, previous.id),
      });
    }

    // Server-side scoring — never trust a client-reported band.
    const score = scoreSpeaking(transcript, Math.max(1, seconds));
    const contentKey = `speaking:${hashString(question)}`;
    const xp = computeSpeakingXp({
      seconds,
      words: score.wordCount,
      band: score.overall,
      history: await loadXpHistory(student.id, "SPEAKING", contentKey),
    });

    const test = await saveIELTSTest(
      student.id,
      "SPEAKING",
      score.overall,
      { testId: contentKey, question, transcript },
      { ...score, seconds },
      seconds,
      {
        contentKey,
        idempotencyKey: typeof body.submissionId === "string" ? body.submissionId : undefined,
        xp,
        logDetails: { seconds, words: score.wordCount },
        dna: { channel: "speaking", words: score.wordCount },
      }
    );

    // Keep the legacy SpeakingSession tally (drives the Speaking Champion badge).
    if (!test.duplicate && xp.xp > 0) {
      await db.speakingSession
        .create({
          data: { studentId: student.id, duration: Math.max(1, Math.round(seconds / 60)), points: test.pointsAwarded },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      testId: test.id,
      score,
      xpAwarded: test.pointsAwarded,
      xpNotes: xp.notes,
      outcome: await buildSessionOutcome(student.id, test.id),
    });
  } catch (error: unknown) {
    console.error("Speaking submission error:", error);
    return NextResponse.json(
      { error: "Your answer wasn't saved. Your score is still shown — try saving again." },
      { status: 500 }
    );
  }
}
