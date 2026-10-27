/**
 * Daily Session planner — pure, no I/O. Shared by the server (Today tab,
 * GET /api/session/today) and the client hero, which rebuilds the plan when the
 * student switches the session length (5 / 10 / 20 min).
 *
 * A plan is 2–4 steps. Each step has a kind, an honest one-line reason, an
 * estimate, a link (tagged `from=session` so the target page can offer "Back to
 * today's session") and a `done` flag derived ONLY from today's verified
 * activity logs — the planner never stores anything.
 *
 * Priorities (in plan order):
 *   1. warmup   — always first. Due words (or words already reviewed today, so
 *                 the step stays stable) → "Review N due words" (/flashcards,
 *                 SRS_REVIEW); otherwise the 60-second warm-up (/studio/warm-up,
 *                 WARMUP_COMPLETED).
 *   2. homework — OVERDUE homework is always included and comes before the
 *                 focus. Otherwise homework submitted today (shown done), or
 *                 homework due within HOMEWORK_SOON_DAYS days. In 5 / 10 min it
 *                 takes the rest of the session (no focus step that day).
 *   3. focus    — the weakest skill (never-tried skills first, rotating by day;
 *                 then the biggest gap to the target band), with the largest
 *                 concrete exam task that fits the length. When that skill's
 *                 smallest task can't fit (Reading 20 min in a 10-min session),
 *                 the next skill in line takes the slot and the reason says so.
 *   4. bonus    — 20 min only, when there is room: a speaking partner, or the
 *                 daily 5-question challenge when the focus is already Speaking.
 *
 * The total of the estimates stays within ±40 % of the chosen length, no kind
 * appears twice, and the same input on the same Tashkent day gives the same plan.
 */
import type { SkillKey } from "@/lib/engine/progression/config";

export const SESSION_LENGTHS = [5, 10, 20] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];
export const DEFAULT_SESSION_LENGTH: SessionLength = 10;
/** localStorage key of the preferred length (a device preference, like the comfort settings). */
export const SESSION_LENGTH_KEY = "averna_session_minutes";
/** Upcoming homework joins the plan when it is due within this many days. */
export const HOMEWORK_SOON_DAYS = 3;
/** The exam date turns into a reason ("Exam in 9 days") within this many days. */
export const EXAM_SOON_DAYS = 21;
/** Query param every session link carries. */
export const SESSION_FROM_PARAM = "from";
export const SESSION_FROM_VALUE = "session";
/** sessionStorage key: the step the student just opened ({ step, total, day }), for the return bar. */
export const SESSION_STEP_KEY = "averna_session_step";

export type SessionStepKind = "warmup" | "focus" | "homework" | "bonus";

export interface SessionStep {
  id: string;
  kind: SessionStepKind;
  title: string;
  /** One honest line: why this step, today. */
  why: string;
  estMinutes: number;
  href: string;
  done: boolean;
  skill: SkillKey | null;
}

export interface DailyPlan {
  dayKey: string;
  minutes: SessionLength;
  steps: SessionStep[];
  totalMinutes: number;
  doneCount: number;
  allDone: boolean;
  /** First unfinished step — the Continue / Start target. */
  next: SessionStep | null;
}

/** One of today's activity logs, normalised (ActivityLog action + the details the planner reads). */
export interface TodayActivity {
  action: string;
  /** IELTS_TEST_COMPLETED: the skill. */
  module?: string | null;
  /** IELTS_TEST_COMPLETED: the band (0 = blank attempt, does not count). */
  score?: number | null;
  /** HOMEWORK_SUBMITTED: the homework. */
  homeworkId?: string | null;
  /** SRS_REVIEW: cards reviewed in that request. */
  count?: number | null;
  /** SPEAKING_SESSION_COMPLETED: "peer" for a speaking-partner session. */
  kind?: string | null;
}

/** The skill picture as it stood this morning (sessions before today). */
export interface SkillFact {
  skill: SkillKey;
  label: string;
  sessions: number;
  recentAvg: number;
  daysSince: number | null;
}

export interface FocusTask {
  title: string;
  href: string;
  minutes: number;
}

/** Concrete tasks per skill, smallest first (from the exam catalog picks). */
export type FocusTasks = Record<SkillKey, FocusTask[]>;

export interface PlanHomework {
  id: string;
  title: string;
  /** ISO deadline. */
  dueAt: string;
}

/** Everything the server knows; the client adds `minutes` and `examDate`. */
export interface DailyPlanFacts {
  dayKey: string;
  /** Server time when the facts were read (ms) — decides "overdue". */
  now: number;
  /** Deterministic per-student seed. */
  seed: number;
  targetBand: number;
  dueWords: number;
  /** First unsubmitted homework (overdue first), if any. */
  homework: PlanHomework | null;
  /** Homework submitted today (keeps the step on the plan, checked). */
  homeworkDoneToday: { id: string; title: string }[];
  skills: SkillFact[];
  tasks: FocusTasks;
  activities: TodayActivity[];
}

export interface DailyPlanInput extends DailyPlanFacts {
  minutes: SessionLength;
  /** "YYYY-MM-DD" exam date (device preference), or null. */
  examDate?: string | null;
}

const DAY_MS = 86_400_000;

export function isSessionLength(v: unknown): v is SessionLength {
  return SESSION_LENGTHS.includes(Number(v) as SessionLength) && typeof v !== "boolean";
}

export function parseSessionLength(v: unknown): SessionLength {
  const n = typeof v === "string" ? Number(v) : v;
  return isSessionLength(n) ? (n as SessionLength) : DEFAULT_SESSION_LENGTH;
}

/** Adds `from=session` to a link (keeps its own query, e.g. `?part=1`). */
export function withSessionFrom(href: string): string {
  const [path, hash] = href.split("#");
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${SESSION_FROM_PARAM}=${SESSION_FROM_VALUE}${hash ? `#${hash}` : ""}`;
}

/** FNV-1a — same hash the Daily Mission uses for its per-student seed. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Whole days from `dayKey` to `examDate` (both Tashkent calendar days), or null. */
export function examDaysLeft(examDate: string | null | undefined, dayKey: string): number | null {
  if (!examDate || !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) return null;
  const a = Date.parse(`${examDate}T00:00:00Z`);
  const b = Date.parse(`${dayKey}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / DAY_MS);
}

// ---------------------------------------------------------------------------
// Done flags — only from matching activities
// ---------------------------------------------------------------------------

function reviewedToday(acts: TodayActivity[]): number {
  return acts.filter((a) => a.action === "SRS_REVIEW").reduce((n, a) => n + Math.max(0, Number(a.count) || 0), 0);
}

function skillDone(acts: TodayActivity[], skill: SkillKey): boolean {
  return acts.some(
    (a) =>
      (a.action === "IELTS_TEST_COMPLETED" && a.module === skill && (a.score == null || a.score > 0)) ||
      (skill === "SPEAKING" && a.action === "SPEAKING_SESSION_COMPLETED")
  );
}

// ---------------------------------------------------------------------------
// Focus choice
// ---------------------------------------------------------------------------

/** Always available, and fits every length: one answer to the AI examiner. */
export const SPEAKING_ITEM: FocusTask = { title: "One Speaking answer — AI examiner", href: "/learning/examiner", minutes: 5 };

/**
 * Skills in focus order: never-tried first (rotating by day), then the lowest
 * recent band (= the biggest gap to the target), the longest-neglected on ties.
 */
export function focusOrder(skills: SkillFact[], rot: number): SkillFact[] {
  const untried = skills.filter((s) => s.sessions === 0);
  const tried = skills
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.sessions > 0)
    .sort((a, b) => a.s.recentAvg - b.s.recentAvg || (b.s.daysSince ?? 0) - (a.s.daysSince ?? 0) || a.i - b.i)
    .map(({ s }) => s);
  const k = untried.length ? rot % untried.length : 0;
  return [...untried.slice(k), ...untried.slice(0, k), ...tried];
}

function focusWhy(s: SkillFact, targetBand: number): string {
  if (s.sessions === 0) return `No ${s.label} result yet — this sets your baseline.`;
  const gap = Math.round((targetBand - s.recentAvg) * 10) / 10;
  if (gap > 0) return `Your ${s.label} is ${gap.toFixed(1)} below your ${targetBand.toFixed(1)} target.`;
  return `Your ${s.label} is at your ${targetBand.toFixed(1)} target — keep it sharp.`;
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export function buildDailyPlan(input: DailyPlanInput): DailyPlan {
  const L = parseSessionLength(input.minutes);
  const maxTotal = Math.floor(L * 1.4);
  const acts = input.activities ?? [];
  const rot = hash(`${input.seed}:${input.dayKey}`);
  const steps: SessionStep[] = [];

  // 1. Warm-up
  const reviewed = reviewedToday(acts);
  const due = Math.max(0, Math.floor(input.dueWords) || 0);
  if (due > 0 || reviewed > 0) {
    const cap = L === 5 ? 5 : 10;
    const target = Math.min(cap, due + reviewed);
    const n = Math.min(cap, Math.max(due, target));
    steps.push({
      id: "warmup-review",
      kind: "warmup",
      title: `Review ${n} due word${n === 1 ? "" : "s"}`,
      why:
        due > 0
          ? `${due} word${due === 1 ? " is" : "s are"} due today — recall them before they fade.`
          : "You reviewed your due words today.",
      estMinutes: L === 5 ? 2 : 3,
      href: withSessionFrom("/flashcards"),
      done: reviewed > 0 && reviewed >= target,
      skill: null,
    });
  } else {
    steps.push({
      id: "warmup-60s",
      kind: "warmup",
      title: "60-second warm-up",
      why: "No words are due — a minute of quick questions gets your English going.",
      estMinutes: 1,
      href: withSessionFrom("/studio/warm-up"),
      done: acts.some((a) => a.action === "WARMUP_COMPLETED"),
      skill: null,
    });
  }
  const warmMin = steps[0].estMinutes;

  // 2. Homework
  const hw = input.homework;
  const hwDue = hw ? Date.parse(hw.dueAt) : NaN;
  const overdue = !!hw && Number.isFinite(hwDue) && hwDue < input.now;
  const soon = !!hw && Number.isFinite(hwDue) && !overdue && hwDue - input.now <= HOMEWORK_SOON_DAYS * DAY_MS;
  const doneHw = input.homeworkDoneToday?.[0] ?? null;
  const pick = overdue ? hw : doneHw ?? (soon ? hw : null);
  let homework: SessionStep | null = null;
  if (pick) {
    const isDone = acts.some((a) => a.action === "HOMEWORK_SUBMITTED" && a.homeworkId === pick.id);
    const dueAt = pick === hw ? hwDue : NaN;
    const days = Number.isFinite(dueAt) ? Math.ceil((dueAt - input.now) / DAY_MS) : null;
    homework = {
      id: `homework-${pick.id}`,
      kind: "homework",
      title: pick.title,
      why: isDone
        ? "Submitted today — your teacher has it."
        : overdue
          ? "Overdue — your teacher is waiting for it."
          : days != null && days <= 1
            ? "Due within a day."
            : `Due in ${days} days.`,
      estMinutes: L === 20 ? 10 : L - warmMin,
      href: withSessionFrom(`/homework/${encodeURIComponent(pick.id)}`),
      done: isDone,
      skill: null,
    };
  }
  if (homework && overdue) steps.push(homework);

  // 3. Focus — only when it fits beside the homework.
  const used = () =>
    steps.reduce((a, s) => a + s.estMinutes, 0) + (homework && !steps.includes(homework) ? homework.estMinutes : 0);
  let focusSkill: SkillKey | null = null;
  if (!homework || L === 20) {
    const budget = maxTotal - used();
    const order = focusOrder(input.skills, rot);
    const top = order[0];
    const days = examDaysLeft(input.examDate, input.dayKey);
    const exam = days != null && days >= 0 && days <= EXAM_SOON_DAYS ? `Exam in ${days} day${days === 1 ? "" : "s"} · ` : "";
    let chosen: { s: SkillFact; task: FocusTask } | null = null;
    for (const s of order) {
      const options = (input.tasks[s.skill] ?? []).filter((t) => t.minutes <= budget).sort((a, b) => a.minutes - b.minutes);
      if (options.length) {
        chosen = { s, task: options[options.length - 1] };
        break;
      }
    }
    if (!chosen) {
      const speaking = input.skills.find((s) => s.skill === "SPEAKING") ?? { skill: "SPEAKING" as const, label: "Speaking", sessions: 0, recentAvg: 0, daysSince: null };
      chosen = { s: speaking, task: SPEAKING_ITEM };
    }
    if (chosen) {
      const { s, task } = chosen;
      let why = `${exam}${focusWhy(s, input.targetBand)}`;
      if (top && s.skill !== top.skill) {
        const need = Math.min(...(input.tasks[top.skill] ?? []).map((t) => t.minutes), 99);
        why = homework
          ? `Homework first — ${top.label} needs ${need} min. ${focusWhy(s, input.targetBand)}`
          : `${top.label} needs ${need} min — choose ${need <= 10 ? 10 : 20} min for it. ${focusWhy(s, input.targetBand)}`;
      }
      steps.push({
        id: `focus-${s.skill.toLowerCase()}`,
        kind: "focus",
        title: task.title,
        why,
        estMinutes: task.minutes,
        href: withSessionFrom(task.href),
        done: skillDone(acts, s.skill),
        skill: s.skill,
      });
      focusSkill = s.skill;
    }
  }
  if (homework && !overdue) steps.push(homework);

  // 4. Bonus — 20 min only, when there is room.
  if (L === 20) {
    const partner = focusSkill !== "SPEAKING";
    const bonus: SessionStep = partner
      ? {
          id: "bonus-partner",
          kind: "bonus",
          title: "Bonus: talk with a speaking partner",
          why: "Real conversation turns practice into fluency.",
          estMinutes: 10,
          href: withSessionFrom("/learning/speaking"),
          done: acts.some((a) => a.action === "SPEAKING_SESSION_COMPLETED" && a.kind === "peer"),
          skill: "SPEAKING",
        }
      : {
          id: "bonus-challenge",
          kind: "bonus",
          title: "Bonus: daily 5-question challenge",
          why: "A quick vocabulary and grammar game to finish on a win.",
          estMinutes: 3,
          href: withSessionFrom("/challenge"),
          done: acts.some((a) => a.action === "DAILY_CHALLENGE"),
          skill: null,
        };
    if (used() + bonus.estMinutes <= L + 4) steps.push(bonus);
  }

  const doneCount = steps.filter((s) => s.done).length;
  return {
    dayKey: input.dayKey,
    minutes: L,
    steps,
    totalMinutes: steps.reduce((a, s) => a + s.estMinutes, 0),
    doneCount,
    allDone: doneCount === steps.length,
    next: steps.find((s) => !s.done) ?? null,
  };
}
