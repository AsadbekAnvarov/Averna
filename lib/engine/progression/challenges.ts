/**
 * Daily / weekly challenge rules — pure.
 *
 * Challenges rotate deterministically (by Tashkent day / ISO week) so everyone
 * sees a stable challenge all day, but the daily one leans toward the student's
 * focus skill on alternate days — rotating AND personal, never hardcoded forever.
 * Progress is evaluated only from verified sessions.
 */

import { DAILY_CHALLENGES, WEEKLY_CHALLENGES, type ChallengeDef, type SkillKey } from "./config";
import { hashString } from "./missions";
import type { SessionFact } from "./skills";

export interface ChallengeState {
  def: ChallengeDef;
  scope: "daily" | "weekly";
  /** Window key ("2026-09-27" or "2026-W39"). */
  windowKey: string;
  current: number;
  target: number;
  percent: number;
  done: boolean;
  /** Idempotency key used when the reward is paid. */
  rewardKey: string;
}

export function pickDailyChallenge(dayKey: string, studentSeed: number, focus: SkillKey | null): ChallengeDef {
  const h = hashString(`${dayKey}:${studentSeed}`);
  if (focus && h % 2 === 0) {
    const matching = DAILY_CHALLENGES.filter((c) => c.skill === focus);
    if (matching.length) return matching[h % matching.length];
  }
  return DAILY_CHALLENGES[hashString(dayKey) % DAILY_CHALLENGES.length];
}

export function pickWeeklyChallenge(weekKey: string): ChallengeDef {
  return WEEKLY_CHALLENGES[hashString(weekKey) % WEEKLY_CHALLENGES.length];
}

/** Evaluate progress of a challenge over the sessions inside its window. */
export function evaluateChallenge(def: ChallengeDef, sessions: SessionFact[]): { current: number; target: number } {
  const ok = sessions.filter((s) => s.band > 0);
  const inSkill = def.skill ? ok.filter((s) => s.skill === def.skill) : ok;
  switch (def.metric) {
    case "skill_sessions": {
      if (def.parts?.length) {
        // Composite: count each part up to its own target.
        const current = def.parts.reduce(
          (a, p) => a + Math.min(p.target, ok.filter((s) => s.skill === p.skill).length),
          0
        );
        return { current, target: def.parts.reduce((a, p) => a + p.target, 0) };
      }
      return { current: Math.min(def.target, inSkill.length), target: def.target };
    }
    case "skill_accuracy":
      return { current: inSkill.some((s) => (s.accuracy ?? 0) >= (def.threshold ?? 1)) ? 1 : 0, target: 1 };
    case "skill_band":
      return { current: inSkill.some((s) => s.band >= (def.threshold ?? 9)) ? 1 : 0, target: 1 };
    case "essay_words":
      return { current: inSkill.some((s) => s.task !== "task1" && (s.words ?? 0) >= (def.threshold ?? 250)) ? 1 : 0, target: 1 };
    case "speaking_seconds":
      return { current: inSkill.some((s) => (s.seconds ?? 0) >= (def.threshold ?? 120)) ? 1 : 0, target: 1 };
    case "distinct_skills":
      return { current: Math.min(def.target, new Set(ok.map((s) => s.skill)).size), target: def.target };
    case "study_days":
      return { current: Math.min(def.target, new Set(ok.map((s) => s.dayKey)).size), target: def.target };
  }
}

export function challengeState(
  def: ChallengeDef,
  scope: "daily" | "weekly",
  windowKey: string,
  sessions: SessionFact[]
): ChallengeState {
  const { current, target } = evaluateChallenge(def, sessions);
  return {
    def,
    scope,
    windowKey,
    current,
    target,
    percent: Math.round((current / Math.max(1, target)) * 100),
    done: current >= target,
    rewardKey: `challenge:${scope}:${windowKey}:${def.id}`,
  };
}
