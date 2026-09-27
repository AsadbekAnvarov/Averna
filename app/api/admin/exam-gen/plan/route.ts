import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireTeacherOrAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { GEN_ROW_SELECT, MODULE_FOR, isGenDifficulty, isGenSkill, levelFor, newDraft, planDifficulties, summarizeDraft } from "@/lib/ielts/generate";
import type { GenDifficulty, PlanResponse } from "@/lib/ielts/generation-types";
import { pickTopics } from "@/lib/ielts/topic-bank";

export const dynamic = "force-dynamic";

function authError(e: unknown) {
  const signedOut = e instanceof Error && e.message === "Unauthorized";
  return NextResponse.json({ error: signedOut ? "Please sign in." : "Teacher or admin access required." }, { status: signedOut ? 401 : 403 });
}

/** POST { skill, count 1–100, difficulty | "mixed" } → creates `count` queued drafts with fresh topics. */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireTeacherOrAdmin();
  } catch (e) {
    return authError(e);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const skill = body?.skill;
  const count = typeof body?.count === "number" ? Math.floor(body.count) : NaN;
  const difficulty = body?.difficulty;
  if (!isGenSkill(skill)) return NextResponse.json({ error: "skill must be READING, LISTENING, WRITING_TASK1, WRITING_TASK2 or SPEAKING." }, { status: 400 });
  if (!Number.isFinite(count) || count < 1 || count > 100) return NextResponse.json({ error: "count must be a number from 1 to 100." }, { status: 400 });
  if (difficulty !== "mixed" && !isGenDifficulty(difficulty)) return NextResponse.json({ error: 'difficulty must be "Easy", "Medium", "Hard" or "mixed".' }, { status: 400 });

  try {
    const module = MODULE_FOR[skill];
    const existing = await db.generatedTest.findMany({ where: { module }, select: { topic: true } });
    const topics = pickTopics(skill, count, existing.map((r: { topic: string | null }) => r.topic));
    const levels = planDifficulties(count, difficulty as GenDifficulty | "mixed");
    const rows = await db.$transaction(
      topics.map((topic, i) => {
        const draft = newDraft(skill, topic, levels[i]);
        return db.generatedTest.create({
          data: {
            module,
            title: draft.title,
            description: "",
            topic,
            level: levelFor(levels[i]),
            published: false,
            data: draft as unknown as Prisma.InputJsonValue,
            createdById: user.id,
          },
          select: GEN_ROW_SELECT,
        });
      })
    );
    const response: PlanResponse = { ok: true, drafts: rows.map((r: Parameters<typeof summarizeDraft>[0]) => summarizeDraft(r)) };
    return NextResponse.json(response);
  } catch (error) {
    console.error("exam-gen/plan error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create the drafts." }, { status: 500 });
  }
}
