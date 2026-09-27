/**
 * Daily Mission rules — pure.
 *
 * A mission is a short, personalised study session shaped as a rhythm rather
 * than a list of chores:
 *
 *   Warm-up (quick win, ~3 min) → Focus (weakest skill) → Switch (a different,
 *   shorter skill — usually the neglected one) → optional Homework
 *
 * It is chosen from the profile as it stood at the START of the day, so the
 * mission never reshuffles while the student is working through it, and each
 * step is marked done only from verified server-side activity.
 */

import { MISSION_CONFIG, type SkillKey } from "./config";
import { estimateXp } from "./xp";
import { activityForSkill, type ActivityPlan, type ContentHints } from "./recommendations";
import type { SessionFact, SkillSnapshot } from "./skills";

export type MissionStepRole = "warmup" | "focus" | "switch" | "homework";

export interface MissionStep extends ActivityPlan {
  id: string;
  role: MissionStepRole;
  roleLabel: string;
  why: string;
  done: boolean;
}

export interface DailyMission {
  dayKey: string;
  steps: MissionStep[];
  completed: number;
  total: number;
  percent: number;
  estMinutes: number;
  /** Minutes left for unfinished steps. */
  remainingMinutes: number;
  potentialXp: number;
  completionBonus: number;
  allDone: boolean;
  focusSkill: SkillKey | null;
  /** First unfinished step — the "Start / Continue mission" target. */
  nextStep: MissionStep | null;
}

export interface TodayFacts {
  /** Sessions completed today (verified). */
  sessions: SessionFact[];
  dailyQuizDone: boolean;
  srsReviewsToday: number;
  homeworkSubmittedToday: boolean;
}

export interface MissionInputs {
  dayKey: string;
  /** Profile computed from sessions BEFORE today (keeps the mission stable). */
  profile: SkillSnapshot[];
  today: TodayFacts;
  homeworkDue: { id: string; title: string; module: string } | null;
  hints?: ContentHints;
  /** Deterministic per-student seed (so two students don't get identical days). */
  seed: number;
}

const ROLE_LABEL: Record<MissionStepRole, string> = {
  warmup: "Warm-up",
  focus: "Focus",
  switch: "Switch skill",
  homework: "Homework",
};

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick the focus skill: never-tried first, then weakest, rotating on ties. */
function chooseFocus(profile: SkillSnapshot[], seed: number): SkillSnapshot {
  const untried = profile.filter((s) => s.sessions === 0);
  if (untried.length === profile.length) {
    // Brand-new student: start with Reading or Listening (receptive skills first).
    return profile[seed % 2 === 0 ? 0 : 1];
  }
  if (untried.length) return untried[seed % untried.length];
  const sorted = [...profile].sort((a, b) => a.recentAvg - b.recentAvg);
  return sorted[0];
}

/** Pick the switch skill: the most neglected one that isn't the focus. */
function chooseSwitch(profile: SkillSnapshot[], focus: SkillKey, seed: number): SkillSnapshot {
  const others = profile.filter((s) => s.skill !== focus);
  const neglected = others
    .filter((s) => s.sessions === 0 || (s.daysSince ?? 0) >= MISSION_CONFIG.neglectDays)
    .sort((a, b) => (b.daysSince ?? 999) - (a.daysSince ?? 999));
  if (neglected.length) {
    // Speaking is the skill learners avoid most; prefer it when it's neglected.
    return neglected.find((s) => s.skill === "SPEAKING") ?? neglected[0];
  }
  // Otherwise rotate through the short skills (Listening / Speaking / Writing T1).
  const short = others.filter((s) => s.skill !== "READING");
  return short[seed % short.length] ?? others[0];
}

function sessionDone(today: TodayFacts, skill: SkillKey): boolean {
  return today.sessions.some((s) => s.skill === skill && s.band > 0);
}

export function buildDailyMission(i: MissionInputs): DailyMission {
  const { profile, today } = i;
  const steps: MissionStep[] = [];

  // 1. Warm-up — a quick, low-stakes win to get started.
  const quizFirst = i.seed % 3 !== 0 || today.dailyQuizDone;
  const srsDone = today.srsReviewsToday >= 10;
  steps.push(
    quizFirst
      ? {
          id: "warmup-quiz",
          role: "warmup",
          roleLabel: ROLE_LABEL.warmup,
          skill: "GENERAL",
          kind: "dailyQuiz",
          title: "Daily 5-question challenge",
          href: "/challenge",
          difficulty: "Intermediate",
          estMinutes: MISSION_CONFIG.minutes.warmup,
          xp: estimateXp("dailyQuiz"),
          why: "Vocabulary and grammar warm-up — gets your brain into English.",
          done: today.dailyQuizDone,
        }
      : {
          id: "warmup-cards",
          role: "warmup",
          roleLabel: ROLE_LABEL.warmup,
          skill: "GENERAL",
          kind: "flashcards",
          title: "Review 10 flashcards",
          href: "/flashcards",
          difficulty: "Intermediate",
          estMinutes: MISSION_CONFIG.minutes.flashcards,
          xp: estimateXp("flashcards"),
          why: "Open Spaced Review and rate 10 cards — it moves words into long-term memory.",
          done: srsDone,
        }
  );

  // 2. Focus — the skill with the most to gain.
  const focus = chooseFocus(profile, i.seed);
  const focusPlan = activityForSkill(focus.skill, focus, i.hints);
  steps.push({
    ...focusPlan,
    id: `focus-${focus.skill.toLowerCase()}`,
    role: "focus",
    roleLabel: ROLE_LABEL.focus,
    why:
      focus.sessions === 0
        ? `First ${focus.label} session — this sets your baseline.`
        : `${focus.label} is your weakest skill right now (avg ${focus.recentAvg.toFixed(1)}).`,
    done: sessionDone(today, focus.skill),
  });

  // 3. Switch — a different, shorter skill to keep the session fresh.
  const sw = chooseSwitch(profile, focus.skill, i.seed);
  const swPlan = activityForSkill(sw.skill, sw, i.hints, { short: true });
  steps.push({
    ...swPlan,
    id: `switch-${sw.skill.toLowerCase()}`,
    role: "switch",
    roleLabel: ROLE_LABEL.switch,
    why:
      sw.sessions === 0
        ? `You haven't tried ${sw.label} yet.`
        : sw.daysSince != null && sw.daysSince >= MISSION_CONFIG.neglectDays
          ? `Last ${sw.label} practice was ${sw.daysSince} days ago.`
          : `A change of skill keeps the session fresh.`,
    done: sessionDone(today, sw.skill),
  });

  // 4. Homework — only when something is actually due.
  if (i.homeworkDue) {
    steps.push({
      id: `homework-${i.homeworkDue.id}`,
      role: "homework",
      roleLabel: ROLE_LABEL.homework,
      skill: (["READING", "LISTENING", "WRITING", "SPEAKING"].includes(i.homeworkDue.module)
        ? i.homeworkDue.module
        : "GENERAL") as SkillKey | "GENERAL",
      kind: "homework",
      title: i.homeworkDue.title,
      href: `/homework/${i.homeworkDue.id}`,
      difficulty: "Intermediate",
      estMinutes: MISSION_CONFIG.minutes.homework,
      xp: 0,
      why: "Due soon — your teacher is waiting for it.",
      done: today.homeworkSubmittedToday,
    });
  }

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const estMinutes = steps.reduce((a, s) => a + s.estMinutes, 0);
  return {
    dayKey: i.dayKey,
    steps,
    completed,
    total,
    percent: Math.round((completed / Math.max(1, total)) * 100),
    estMinutes,
    remainingMinutes: steps.filter((s) => !s.done).reduce((a, s) => a + s.estMinutes, 0),
    potentialXp: steps.reduce((a, s) => a + s.xp, 0) + MISSION_CONFIG.completionBonus,
    completionBonus: MISSION_CONFIG.completionBonus,
    allDone: completed === total,
    focusSkill: focus.skill,
    nextStep: steps.find((s) => !s.done) ?? null,
  };
}

