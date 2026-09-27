/**
 * Skill profile — pure. Summarises a student's verified sessions per IELTS skill
 * into the numbers every other progression module reasons about: how strong,
 * how recent, which direction, and how far from the target band.
 */

import { SKILLS, SKILL_LABEL, type SkillKey } from "./config";

/** One verified learning session (from an IELTSTest row). */
export interface SessionFact {
  skill: SkillKey;
  band: number;
  /** 0-1 when the activity has objective answers (Reading/Listening). */
  accuracy: number | null;
  /** Essay words (Writing) or transcript words (Speaking). */
  words: number | null;
  /** Speaking duration in seconds. */
  seconds: number | null;
  task: "task1" | "task2" | null;
  /** Tashkent calendar day, "YYYY-MM-DD". */
  dayKey: string;
  at: number;
}

export interface SkillSnapshot {
  skill: SkillKey;
  label: string;
  sessions: number;
  /** Average band of the last 3 sessions (0 when none). */
  recentAvg: number;
  /** Average of the 3 before that (0 when not enough history). */
  previousAvg: number;
  bestBand: number;
  /** Best objective accuracy 0-100 (Reading/Listening), else null. */
  bestAccuracy: number | null;
  /** Recent objective accuracy 0-100, else null. */
  recentAccuracy: number | null;
  lastAt: number | null;
  daysSince: number | null;
  trend: "up" | "down" | "flat" | null;
  /** 0-100 progress of recentAvg toward the target band. */
  progress: number;
}

export const DEFAULT_TARGET_BAND = 7;

export function parseTargetBand(raw: string | null | undefined): number {
  const n = parseFloat(String(raw ?? ""));
  return Number.isFinite(n) && n >= 4 && n <= 9 ? n : DEFAULT_TARGET_BAND;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildSkillProfile(facts: SessionFact[], targetBand: number, now = Date.now()): SkillSnapshot[] {
  return SKILLS.map((skill) => {
    const rows = facts.filter((f) => f.skill === skill && f.band > 0).sort((a, b) => a.at - b.at);
    const recent = rows.slice(-3);
    const previous = rows.slice(-6, -3);
    const recentAvg = round1(avg(recent.map((r) => r.band)));
    const previousAvg = round1(avg(previous.map((r) => r.band)));
    const accs = rows.map((r) => r.accuracy).filter((a): a is number => a != null);
    const recentAccs = recent.map((r) => r.accuracy).filter((a): a is number => a != null);
    const last = rows[rows.length - 1];
    let trend: SkillSnapshot["trend"] = null;
    if (previous.length > 0) {
      const d = recentAvg - previousAvg;
      trend = d > 0.2 ? "up" : d < -0.2 ? "down" : "flat";
    }
    return {
      skill,
      label: SKILL_LABEL[skill],
      sessions: rows.length,
      recentAvg,
      previousAvg,
      bestBand: rows.length ? Math.max(...rows.map((r) => r.band)) : 0,
      bestAccuracy: accs.length ? Math.round(Math.max(...accs) * 100) : null,
      recentAccuracy: recentAccs.length ? Math.round(avg(recentAccs) * 100) : null,
      lastAt: last ? last.at : null,
      daysSince: last ? Math.floor((now - last.at) / 86400000) : null,
      trend,
      progress: rows.length ? Math.max(0, Math.min(100, Math.round((recentAvg / targetBand) * 100))) : 0,
    };
  });
}

/** Weakest practised skill (lowest recent average), or null when none practised. */
export function weakestSkill(profile: SkillSnapshot[]): SkillSnapshot | null {
  const practised = profile.filter((s) => s.sessions > 0);
  if (!practised.length) return null;
  return practised.reduce((a, b) => (b.recentAvg < a.recentAvg ? b : a));
}

export function strongestSkill(profile: SkillSnapshot[]): SkillSnapshot | null {
  const practised = profile.filter((s) => s.sessions > 0);
  if (!practised.length) return null;
  return practised.reduce((a, b) => (b.recentAvg > a.recentAvg ? b : a));
}

/** Fastest-improving skill (positive trend with the biggest gain). */
export function fastestGrowing(profile: SkillSnapshot[]): SkillSnapshot | null {
  const up = profile.filter((s) => s.trend === "up");
  if (!up.length) return null;
  return up.reduce((a, b) => (b.recentAvg - b.previousAvg > a.recentAvg - a.previousAvg ? b : a));
}

/** A one-line, honest summary of where the student stands. */
export function skillInsight(profile: SkillSnapshot[]): string {
  const practised = profile.filter((s) => s.sessions > 0);
  if (!practised.length) return "Complete your first activity and Averna will map your four skills.";
  const untried = profile.filter((s) => s.sessions === 0);
  const weak = weakestSkill(profile);
  const growing = fastestGrowing(profile);
  const parts: string[] = [];
  if (growing) parts.push(`Your ${growing.label} is improving quickly.`);
  if (weak && practised.length > 1) parts.push(`${weak.label} is currently your weakest skill.`);
  if (untried.length) parts.push(`You haven't tried ${untried.map((u) => u.label).join(" or ")} yet.`);
  if (!parts.length && weak) parts.push(`Keep going — ${weak.label} is where the next gains are.`);
  return parts.join(" ");
}
