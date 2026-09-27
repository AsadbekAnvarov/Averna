/**
 * Recommendation rules — pure. Decides the single best NEXT activity from the
 * skill profile, and turns a skill into a concrete, startable activity with an
 * honest time and XP estimate (from the real XP engine).
 *
 * Activity sizes:
 *   - daily missions (and "right after a session") → one Reading passage, one
 *     Listening part, one Writing task, a full Speaking test;
 *   - bigger goals (a skill close to the target band) → the full timed paper,
 *     or both Writing tasks in one sitting; all four skills close → the mock.
 * Links go to the exam routes; the service supplies concrete papers as
 * ContentHints, and without them every link falls back to the library page.
 */

import { MISSION_CONFIG, SKILL_LABEL, type SkillKey } from "./config";
import { estimateXp } from "./xp";
import type { ExamPick, SpeakingPick } from "./picks";
import type { SkillSnapshot } from "./skills";

export type ActivityKind =
  | "reading" // older short Reading test (kept for compatibility)
  | "readingPassage"
  | "readingFull"
  | "listening" // older short Listening test (kept for compatibility)
  | "listeningPart"
  | "listeningFull"
  | "writingTask1"
  | "writingTask2"
  | "writingExam"
  | "speaking" // one answer to the AI examiner
  | "speakingTest"
  | "mock"
  | "dailyQuiz"
  | "flashcards"
  | "homework";

export interface ActivityPlan {
  skill: SkillKey | "GENERAL";
  kind: ActivityKind;
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

/**
 * Concrete material the service supplies (lib/engine/progression/picks.ts),
 * so links open a paper the student hasn't done yet.
 */
export interface ContentHints {
  /** One Reading passage — the mission size (≈13 questions, 20 min). */
  readingPassage?: ExamPick | null;
  /** A full Academic Reading paper (40 questions, 60 min). */
  readingFull?: ExamPick | null;
  /** One Listening part (10 questions). */
  listeningPart?: ExamPick | null;
  /** A full Listening paper (40 questions). */
  listeningFull?: ExamPick | null;
  /** A full Speaking test set. */
  speakingSet?: SpeakingPick | null;
  /** The mock exam can start (full Reading + Listening papers and a Speaking set exist). */
  mockAvailable?: boolean;
  /** Days since the last mock-exam section (null = never took one). */
  daysSinceMock?: number | null;
}

export const LIBRARY_HREF = {
  reading: "/learning/reading",
  listening: "/learning/listening",
  speakingTest: "/learning/speaking-test",
  writingExam: "/learning/writing/exam",
  mock: "/learning/mock-exam",
} as const;

export function difficultyForBand(band: number): ActivityPlan["difficulty"] {
  if (band > 0 && band < 5.5) return "Foundation";
  if (band >= 7) return "Advanced";
  return "Intermediate";
}

const EXAM_LEVEL: Record<ActivityPlan["difficulty"], string> = {
  Foundation: "Easy",
  Intermediate: "Medium",
  Advanced: "Hard",
};

/** The exam difficulty ("Easy" | "Medium" | "Hard") that suits a band. */
export function examLevelForBand(band: number): string {
  return EXAM_LEVEL[difficultyForBand(band)];
}

/** The activity level shown on the card, from the picked paper's difficulty. */
function levelOfExam(difficulty: string | undefined, fallback: ActivityPlan["difficulty"]): ActivityPlan["difficulty"] {
  if (difficulty === "Easy") return "Foundation";
  if (difficulty === "Medium") return "Intermediate";
  if (difficulty === "Hard") return "Advanced";
  return fallback;
}

/** Practice route of a picked paper: `/learning/reading/{id}` (+ `?part=N`, 0-based). */
export function examHref(library: string, pick: ExamPick | null | undefined): string {
  if (!pick) return library;
  const base = `${library}/${encodeURIComponent(pick.examId)}`;
  return pick.part != null ? `${base}?part=${pick.part}` : base;
}

function objectivePlan(
  skill: "READING" | "LISTENING",
  kind: "readingPassage" | "readingFull" | "listeningPart" | "listeningFull",
  pick: ExamPick | null | undefined,
  title: string,
  fallbackMinutes: number,
  level: ActivityPlan["difficulty"]
): ActivityPlan {
  return {
    skill,
    kind,
    title,
    href: examHref(skill === "READING" ? LIBRARY_HREF.reading : LIBRARY_HREF.listening, pick),
    difficulty: levelOfExam(pick?.difficulty, level),
    estMinutes: pick?.minutes ?? fallbackMinutes,
    xp: estimateXp(kind, { questions: pick?.questions, difficulty: pick?.difficulty, attempts: pick?.attempts }),
  };
}

/**
 * Map a skill to the concrete activity Averna would start.
 *  - `short`: a quick slot (mission "switch" step, right after a session);
 *  - `full`: a bigger goal — the full timed paper (Writing: both tasks).
 * A full paper is only offered when one exists; otherwise one part is.
 */
export function activityForSkill(
  skill: SkillKey,
  snap: SkillSnapshot | undefined,
  hints: ContentHints = {},
  opts: { short?: boolean; full?: boolean } = {}
): ActivityPlan {
  const level = difficultyForBand(snap?.recentAvg ?? 0);
  const m = MISSION_CONFIG.minutes;
  const full = !!opts.full && !opts.short;
  switch (skill) {
    case "READING": {
      if (full && (hints.readingFull || !hints.readingPassage)) {
        const p = hints.readingFull;
        return objectivePlan(skill, "readingFull", p, p ? `Full Reading test — ${p.title}` : "Full Academic Reading test", m.readingFull, level);
      }
      const p = hints.readingPassage;
      const title = !p
        ? "Academic Reading — one passage"
        : p.part != null
          ? `Reading Passage ${p.part + 1} — ${p.partTitle ?? p.title}`
          : `Reading passage — ${p.title}`;
      return objectivePlan(skill, "readingPassage", p, title, m.reading, level);
    }
    case "LISTENING": {
      if (full && (hints.listeningFull || !hints.listeningPart)) {
        const p = hints.listeningFull;
        return objectivePlan(skill, "listeningFull", p, p ? `Full Listening test — ${p.title}` : "Full IELTS Listening test", m.listeningFull, level);
      }
      const p = hints.listeningPart;
      const title = !p ? "IELTS Listening — one part" : p.part != null ? `Listening Part ${p.part + 1} — ${p.title}` : `Listening — ${p.title}`;
      return objectivePlan(skill, "listeningPart", p, title, m.listening, level);
    }
    case "WRITING": {
      if (full) {
        return {
          skill,
          kind: "writingExam",
          title: "Full Writing test — Task 1 + Task 2",
          href: LIBRARY_HREF.writingExam,
          difficulty: level,
          estMinutes: m.writingExam,
          xp: estimateXp("writingExam"),
        };
      }
      // Short slot or no writing history yet → Task 1; otherwise the full essay.
      const task1 = opts.short || (snap?.sessions ?? 0) === 0;
      return task1
        ? { skill, kind: "writingTask1", title: "Writing Task 1 — report", href: "/learning/writing/task1", difficulty: level, estMinutes: m.writingTask1, xp: estimateXp("writingTask1") }
        : { skill, kind: "writingTask2", title: "Writing Task 2 — opinion essay", href: "/learning/writing/task2", difficulty: level, estMinutes: m.writingTask2, xp: estimateXp("writingTask2") };
    }
    case "SPEAKING": {
      const s = hints.speakingSet;
      return {
        skill,
        kind: "speakingTest",
        title: s ? `Full Speaking test — ${s.title}` : "Full Speaking test — Parts 1–3",
        href: s ? `${LIBRARY_HREF.speakingTest}/${encodeURIComponent(s.id)}` : LIBRARY_HREF.speakingTest,
        difficulty: level,
        estMinutes: m.speakingTest,
        xp: estimateXp("speakingTest", { attempts: s?.attempts }),
      };
    }
  }
}

/** The full mock exam: Listening → Reading → Writing → Speaking in one sitting. */
export function mockExamPlan(level: ActivityPlan["difficulty"] = "Intermediate"): ActivityPlan {
  const m = MISSION_CONFIG.minutes;
  return {
    skill: "GENERAL",
    kind: "mock",
    title: "Full IELTS mock exam — all four skills",
    href: LIBRARY_HREF.mock,
    difficulty: level,
    estMinutes: m.listeningFull + m.readingFull + m.writingExam + m.speakingTest,
    xp: estimateXp("mock"),
  };
}

/** Enough results, and within `bandMargin` of the target: time for exam conditions. */
export function isExamReady(s: SkillSnapshot, targetBand: number): boolean {
  const r = MISSION_CONFIG.examReady;
  return s.sessions >= r.minSessions && s.recentAvg >= targetBand - r.bandMargin;
}

const FULL_NOTE: Partial<Record<ActivityKind, string>> = {
  readingFull: "A full 60-minute paper shows whether that holds under exam conditions.",
  listeningFull: "A full four-part paper shows whether that holds under exam conditions.",
  writingExam: "Both tasks in 60 minutes is the real exam challenge — time management counts.",
};

/**
 * Score every skill and pick the best next one.
 *  - never tried            → strong pull (a full profile needs all four skills)
 *  - gap to target band     → the bigger the gap, the higher the priority
 *  - days since practised   → neglected skills come back into rotation
 *  - declining trend        → catch slips early
 *  - just practised         → pushed down, so a session alternates skills
 * A skill that is exam-ready gets the full paper; when all four are (and no
 * recent mock), the full mock exam comes first.
 */
export function recommendNext(
  profile: SkillSnapshot[],
  targetBand: number,
  opts: { justCompleted?: SkillKey | null; hints?: ContentHints } = {}
): Recommendation {
  const hints = opts.hints ?? {};
  const ready = MISSION_CONFIG.examReady;

  if (
    !opts.justCompleted &&
    hints.mockAvailable &&
    profile.length === 4 &&
    profile.every((s) => isExamReady(s, targetBand)) &&
    (hints.daysSinceMock == null || hints.daysSinceMock >= ready.mockCooldownDays)
  ) {
    const avg = profile.reduce((a, s) => a + s.recentAvg, 0) / profile.length;
    return {
      ...mockExamPlan(difficultyForBand(avg)),
      reason: `All four skills are within ${ready.bandMargin} of your ${targetBand.toFixed(1)} target — a full timed mock shows your real overall band.`,
      context:
        hints.daysSinceMock == null ? "You haven't taken a full mock exam yet." : `Your last mock exam was ${hints.daysSinceMock} days ago.`,
    };
  }

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
  const full = !opts.justCompleted && isExamReady(best.s, targetBand);
  const plan = activityForSkill(best.s.skill, best.s, hints, { short: !!opts.justCompleted, full });
  const note = full ? FULL_NOTE[plan.kind] : undefined;

  const strong = profile.filter((p) => p.sessions > 0).sort((a, b) => b.recentAvg - a.recentAvg)[0];
  const context =
    strong && strong.skill !== best.s.skill && strong.recentAvg >= targetBand - 0.5
      ? `Your ${strong.label} is strong (${strong.recentAvg.toFixed(1)}).`
      : undefined;
  return { ...plan, reason: note ? `${best.reason} ${note}` : best.reason, context };
}

export { SKILL_LABEL };
