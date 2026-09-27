/**
 * Recommendation rules — pure. Decides the single best NEXT activity from the
 * skill profile, and turns a skill into a concrete, startable activity with an
 * honest time and XP estimate (from the real XP engine).
 */

import { MISSION_CONFIG, SKILL_LABEL, type SkillKey } from "./config";
import { estimateXp } from "./xp";
import type { SkillSnapshot } from "./skills";

export interface ActivityPlan {
  skill: SkillKey | "GENERAL";
  kind: "reading" | "listening" | "writingTask1" | "writingTask2" | "speaking" | "dailyQuiz" | "flashcards" | "homework";
  title: string;
  href: string;
  difficulty: "Foundation" | "Intermediate" | "Advanced";
  estMinutes: number;
  xp: number;
}

export interface Recommendation extends ActivityPlan {
  /** "Because…" — why this, why now. */
  reason: string;
  /** Short context line shown above the reason. */
  context?: string;
}

/** Content hints the service can supply so links go to concrete material. */
export interface ContentHints {
  /** A Reading test id the student hasn't taken yet (or the least-taken one). */
  nextReadingTestId?: string | null;
  readingQuestions?: number;
  readingMinutes?: number;
}

export function difficultyForBand(band: number): ActivityPlan["difficulty"] {
  if (band > 0 && band < 5.5) return "Foundation";
  if (band >= 7) return "Advanced";
  return "Intermediate";
}

const LISTENING_LEVEL: Record<ActivityPlan["difficulty"], string> = {
  Foundation: "Easy",
  Intermediate: "Medium",
  Advanced: "Hard",
};

/** Map a skill to the concrete activity Averna would start. */
export function activityForSkill(
  skill: SkillKey,
  snap: SkillSnapshot | undefined,
  hints: ContentHints = {},
  opts: { short?: boolean } = {}
): ActivityPlan {
  const difficulty = difficultyForBand(snap?.recentAvg ?? 0);
  const m = MISSION_CONFIG.minutes;
  switch (skill) {
    case "READING":
      return {
        skill,
        kind: "reading",
        title: "Academic Reading test",
        href: hints.nextReadingTestId ? `/learning/reading/${hints.nextReadingTestId}` : "/learning/reading",
        difficulty,
        estMinutes: hints.readingMinutes ?? m.reading,
        xp: estimateXp("reading", { questions: hints.readingQuestions }),
      };
    case "LISTENING": {
      const level = LISTENING_LEVEL[difficulty];
      return {
        skill,
        kind: "listening",
        title: `${level} Listening test`,
        href: `/learning/listening?level=${level}`,
        difficulty,
        estMinutes: m.listening,
        xp: estimateXp("listening", { difficulty: level }),
      };
    }
    case "WRITING": {
      // Short slot or no writing history yet → Task 1; otherwise the full essay.
      const task1 = opts.short || (snap?.sessions ?? 0) === 0;
      return task1
        ? { skill, kind: "writingTask1", title: "Writing Task 1 — report", href: "/learning/writing/task1", difficulty, estMinutes: m.writingTask1, xp: estimateXp("writingTask1") }
        : { skill, kind: "writingTask2", title: "Writing Task 2 — opinion essay", href: "/learning/writing/task2", difficulty, estMinutes: m.writingTask2, xp: estimateXp("writingTask2") };
    }
    case "SPEAKING":
      return {
        skill,
        kind: "speaking",
        title: "Speaking practice with the AI examiner",
        href: "/learning/examiner",
        difficulty,
        estMinutes: m.speaking,
        xp: estimateXp("speaking"),
      };
  }
}

/**
 * Score every skill and pick the best next one.
 *  - never tried            → strong pull (a full profile needs all four skills)
 *  - gap to target band     → the bigger the gap, the higher the priority
 *  - days since practised   → neglected skills come back into rotation
 *  - declining trend        → catch slips early
 *  - just practised         → pushed down, so a session alternates skills
 */
export function recommendNext(
  profile: SkillSnapshot[],
  targetBand: number,
  opts: { justCompleted?: SkillKey | null; hints?: ContentHints } = {}
): Recommendation {
  const scored = profile.map((s) => {
    let score = 0;
    let reason = "";
    if (s.sessions === 0) {
      score = 80;
      reason = `You haven't tried ${s.label} yet — one session gives Averna a baseline for all four skills.`;
    } else {
      const gap = Math.max(0, targetBand - s.recentAvg);
      score += gap * 25;
      const neglect = Math.min(30, (s.daysSince ?? 0) * 5);
      score += neglect;
      if (s.trend === "down") score += 10;
      if (s.daysSince != null && s.daysSince >= MISSION_CONFIG.neglectDays) {
        reason = `You haven't practised ${s.label} for ${s.daysSince} days — skills fade without review.`;
      } else if (s.trend === "down") {
        reason = `Your ${s.label} dipped recently (${s.previousAvg.toFixed(1)} → ${s.recentAvg.toFixed(1)}). One focused session usually recovers it.`;
      } else if (gap > 0) {
        reason = `${s.label} is ${gap.toFixed(1)} bands below your target of ${targetBand.toFixed(1)} — the biggest gains are here.`;
      } else {
        reason = `${s.label} is at your target — keep it retained with regular practice.`;
      }
    }
    if (opts.justCompleted && s.skill === opts.justCompleted) score -= 60;
    return { s, score, reason };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const plan = activityForSkill(best.s.skill, best.s, opts.hints, { short: !!opts.justCompleted });

  const strong = profile.filter((p) => p.sessions > 0).sort((a, b) => b.recentAvg - a.recentAvg)[0];
  const context =
    strong && strong.skill !== best.s.skill && strong.recentAvg >= targetBand - 0.5
      ? `Your ${strong.label} is strong (${strong.recentAvg.toFixed(1)}).`
      : undefined;
  return { ...plan, reason: best.reason, context };
}

export { SKILL_LABEL };
