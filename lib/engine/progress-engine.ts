import { db } from "@/lib/db";
import { getSkillStages, type SkillStage } from "@/lib/student-intel";

/**
 * Progress Engine — the single authority for the persisted mastery lifecycle.
 *
 * The stage itself stays DERIVED from real test evidence (getSkillStages), which
 * keeps it impossible to fake; this engine writes that derivation into SkillState
 * so the platform also keeps the *transition history*. That history is what makes
 * "you reached Verified" celebrations, mastery velocity and cohort analytics
 * possible — none of which are expressible from a value recomputed per request.
 *
 * Safe by construction: reconcile() is idempotent (same evidence ⇒ same rows) and
 * never throws, so a learning action can never fail because of bookkeeping.
 */

const STAGE_RANK: Record<SkillStage, number> = {
  locked: 0,
  learning: 1,
  practicing: 2,
  verified: 3,
  mastered: 4,
  retained: 5,
};

/** Stages worth telling the student about when newly reached. */
const CELEBRATED: SkillStage[] = ["verified", "mastered", "retained"];

const CELEBRATION: Record<string, { title: string; message: (skill: string) => string }> = {
  verified: {
    title: "Skill verified ✅",
    message: (s) => `You've proven your ${s} at your target level — not luck, real evidence.`,
  },
  mastered: {
    title: "Skill mastered 🏆",
    message: (s) => `${s} is now mastered: repeated strong results across several days.`,
  },
  retained: {
    title: "Knowledge retained 🧠",
    message: (s) => `You still had ${s} weeks later — that's long-term learning, the hardest kind.`,
  },
};

export interface StageAdvance {
  skill: string;
  from: SkillStage | null;
  to: SkillStage;
}

/**
 * Recompute every skill's stage from evidence and persist it, returning the
 * stages that moved UP (so callers can celebrate). Called after verified
 * learning events; never on page load.
 */
export async function reconcileSkillStates(studentId: string): Promise<StageAdvance[]> {
  const advances: StageAdvance[] = [];
  try {
    const [stages, existingRows] = await Promise.all([
      getSkillStages(studentId),
      db.skillState.findMany({ where: { studentId } }),
    ]);
    const existing = new Map(existingRows.map((r) => [r.skill, r]));
    const now = new Date();

    for (const s of stages) {
      const prev = existing.get(s.key);
      const prevStage = (prev?.stage as SkillStage | undefined) ?? null;
      const changed = prevStage !== s.stage;
      const movedUp = changed && STAGE_RANK[s.stage] > (prevStage ? STAGE_RANK[prevStage] : -1);

      // Nothing to record for a skill that has never been touched.
      if (!prev && s.stage === "locked") continue;

      const data = {
        stage: s.stage,
        evidenceCount: s.sessions,
        distinctDays: s.distinctDays,
        bestBand: s.bestBand,
        recentAvg: s.recentAvg,
        retention: s.retention,
        ...(changed ? { previousStage: prevStage, stageChangedAt: now } : {}),
        ...(STAGE_RANK[s.stage] >= STAGE_RANK.verified ? { lastVerifiedAt: now } : {}),
      };

      await db.skillState.upsert({
        where: { studentId_skill: { studentId, skill: s.key } },
        create: { studentId, skill: s.key, ...data },
        update: data,
      });

      if (movedUp) advances.push({ skill: s.label, from: prevStage, to: s.stage });
    }
  } catch {
    /* bookkeeping must never break a learning action (e.g. table not deployed yet) */
  }
  return advances;
}

/**
 * Persisted stages, newest-first by change. Falls back to the live derivation
 * when the table isn't populated yet, so the UI is correct from day one.
 */
export async function getPersistedSkillStates(studentId: string) {
  try {
    const rows = await db.skillState.findMany({
      where: { studentId },
      orderBy: { stageChangedAt: "desc" },
    });
    if (rows.length > 0) return rows;
  } catch {
    /* fall through to the derivation */
  }
  const stages = await getSkillStages(studentId);
  return stages
    .filter((s) => s.stage !== "locked")
    .map((s) => ({
      skill: s.key,
      stage: s.stage,
      previousStage: null,
      evidenceCount: s.sessions,
      distinctDays: s.distinctDays,
      bestBand: s.bestBand,
      recentAvg: s.recentAvg,
      retention: s.retention,
      stageChangedAt: new Date(),
      lastVerifiedAt: null,
    }));
}

/** Notification payload for a newly reached stage (null when not worth telling). */
export function celebrationFor(advance: StageAdvance): { title: string; message: string; link: string } | null {
  if (!CELEBRATED.includes(advance.to)) return null;
  const c = CELEBRATION[advance.to];
  if (!c) return null;
  return { title: c.title, message: c.message(advance.skill), link: "/progress" };
}
