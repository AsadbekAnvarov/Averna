/**
 * One-button mini task (docs/elegance-roadmap.md, idea 10): ONE part of a
 * Reading / Listening paper aimed at the student's weakest question type,
 * assigned as homework to that student alone. Pure and deterministic — the
 * student's recent mistakes by type (./kind-stats), the catalog summaries and
 * the student's done keys come in as data.
 *
 * The pick reuses idea 5's `pickPracticePart` (an unseen part first, catalog
 * order between equals) on a catalog with splittable papers first, so a part
 * the student already did is only chosen when every part with that type has
 * been done, and a whole single-recording paper only when nothing shorter has
 * the type. Without mistakes by type it falls back to a fresh part of the
 * weaker skill; with an empty catalog there is no task (null).
 *
 * Homework targets a whole passage / part (the smallest unit a Homework row
 * can hold), so the minutes are the honest length of that part: a Listening
 * part is ~7–8 min, a Reading passage 20.
 */

import { PRACTICE_KIND_LABEL } from "@/lib/ielts/format";
import { canPractiseParts, listeningPartMinutes } from "@/lib/ielts/parts";
import type { ExamSkill, PracticeKind } from "@/lib/ielts/types";
import { READING_PASSAGE_MINUTES } from "@/lib/homework/library-shared";
import { addDays } from "@/lib/forecast/band-forecast";
import { isDone, pickPracticePart, type CatalogEntry } from "@/lib/review/practice-by-type";
import type { KindStat } from "./kind-stats";

/** A catalog summary with the sizes the estimate needs. */
export type MiniCatalogEntry = CatalogEntry & { questions: number; timeLimit: number; parts: number };

export interface MiniTaskInput {
  /** Most-wrong first (kindStats order). */
  stats: readonly KindStat[];
  /** The skill to fall back to when no type has mistakes (e.g. the weaker of Reading / Listening). */
  fallbackSkill?: ExamSkill | null;
  catalog: { READING: readonly MiniCatalogEntry[]; LISTENING: readonly MiniCatalogEntry[] };
  done: { READING: ReadonlySet<string>; LISTENING: ReadonlySet<string> };
  /** Tashkent day "YYYY-MM-DD" (the task is due tomorrow evening). */
  todayKey: string;
}

export interface MiniTask {
  skill: ExamSkill;
  /** Homework.contentKind */
  contentKind: ExamSkill;
  contentId: string;
  /** 0-based passage / part; null = the whole paper (single-recording Listening). */
  contentPart: number | null;
  kind: PracticeKind | null;
  kindLabel: string | null;
  testTitle: string;
  partTitle: string | null;
  questions: number;
  minutes: number;
  /** Not done by the student yet. */
  fresh: boolean;
  /** Editable homework title. */
  title: string;
  /** Why this task (teacher-facing): "Matching headings: 4 of the last 5 wrong". */
  reason: string;
  /** "Matching headings · 1 part · ~8 min · due tomorrow" */
  summary: string;
  /** Tashkent local "YYYY-MM-DDTHH:mm" (tomorrow 20:00). */
  dueDate: string;
}

/** Due time of a mini task, Tashkent local. */
export const MINI_TASK_DUE_TIME = "20:00";
const SKILL_LABEL: Record<ExamSkill, string> = { READING: "Reading", LISTENING: "Listening" };

const isWhole = (t: MiniCatalogEntry) => !canPractiseParts(t);

/** Minutes of one part (the homework library's estimate) or of the whole paper. */
export function miniTaskMinutes(t: MiniCatalogEntry, part: number | null): number {
  if (part == null) return Math.max(1, Math.round(t.timeLimit));
  if (t.skill === "READING") return READING_PASSAGE_MINUTES;
  // A verified part of a whole recording: its own length + 1 minute to check.
  if (t.recordingMode === "whole" && t.splittable) return listeningPartMinutes(t, part);
  const parts = Math.max(1, t.parts || t.partInfo.length);
  return Math.max(1, Math.round((t.timeLimit - 2) / parts + 1));
}

function questionsOf(t: MiniCatalogEntry, part: number | null): number {
  if (part == null) return t.questions;
  const p = t.partInfo[part];
  return p && p.to >= p.from && p.from > 0 ? p.to - p.from + 1 : 0;
}

/** Splittable papers first (stable), so a short part beats a whole single-recording paper. */
function ordered(catalog: readonly MiniCatalogEntry[]): MiniCatalogEntry[] {
  return catalog
    .map((t, i) => ({ t, i }))
    .sort((a, b) => Number(isWhole(a.t)) - Number(isWhole(b.t)) || a.i - b.i)
    .map(({ t }) => t);
}

/** Matching that couldn't be refined may still be practised on either named matching task. */
const variants = (kind: PracticeKind): PracticeKind[] =>
  kind === "matching" ? ["matching", "matching-headings", "matching-information"] : [kind];

function build(
  input: MiniTaskInput,
  skill: ExamSkill,
  pick: { testId: string; part: number | null; testTitle: string; partTitle: string | null },
  kind: PracticeKind | null,
  reason: string
): MiniTask | null {
  const t = input.catalog[skill].find((x) => x.id === pick.testId);
  if (!t) return null;
  const minutes = miniTaskMinutes(t, pick.part);
  const kindLabel = kind ? PRACTICE_KIND_LABEL[kind] : null;
  const what = kindLabel ?? SKILL_LABEL[skill];
  return {
    skill,
    contentKind: skill,
    contentId: t.id,
    contentPart: pick.part,
    kind,
    kindLabel,
    testTitle: pick.testTitle,
    partTitle: pick.partTitle,
    questions: questionsOf(t, pick.part),
    minutes,
    fresh: !isDone(input.done[skill], t.id, pick.part ?? 0),
    title: `Mini task: ${what}`,
    reason,
    summary: `${what} · 1 ${pick.part == null ? "test" : "part"} · ~${minutes} min · due tomorrow`,
    dueDate: `${addDays(input.todayKey, 1)}T${MINI_TASK_DUE_TIME}`,
  };
}

/** The first fresh part of a skill (any type), or any part when all were done. */
function anyPart(input: MiniTaskInput, skill: ExamSkill) {
  let fallback: { testId: string; part: number | null; testTitle: string; partTitle: string | null } | null = null;
  for (const t of ordered(input.catalog[skill])) {
    if (t.skill !== skill || !t.partInfo.length) continue;
    const whole = isWhole(t);
    const parts = whole ? [0] : t.partInfo.map((_, i) => i);
    for (const i of parts) {
      const pick = { testId: t.id, part: whole ? null : i, testTitle: t.title, partTitle: whole ? null : t.partInfo[i]?.title || null };
      if (!isDone(input.done[skill], t.id, i)) return pick;
      fallback ??= pick;
    }
  }
  return fallback;
}

/** The mini task for this student, or null when the catalog has nothing to offer. */
export function buildMiniTask(input: MiniTaskInput): MiniTask | null {
  // A fresh part for the weakest type that has one; a part already done only when no weak type has a fresh one.
  let repeat: MiniTask | null = null;
  for (const s of input.stats) {
    if (s.wrong <= 0) continue;
    const catalog = ordered(input.catalog[s.skill]);
    for (const kind of variants(s.kind)) {
      const pick = pickPracticePart({ kind, skill: s.skill, currentTestId: "", catalog, done: input.done[s.skill] });
      if (!pick) continue;
      const task = build(input, s.skill, pick, kind, `${s.label}: ${s.wrong} of the last ${s.of} wrong`);
      if (task?.fresh) return task;
      repeat ??= task;
    }
  }
  if (repeat) return repeat;
  const skills: ExamSkill[] = input.fallbackSkill
    ? [input.fallbackSkill, input.fallbackSkill === "READING" ? "LISTENING" : "READING"]
    : ["LISTENING", "READING"];
  for (const skill of skills) {
    const pick = anyPart(input, skill);
    if (!pick) continue;
    const reason =
      skill === input.fallbackSkill
        ? `${SKILL_LABEL[skill]} is the weaker skill right now`
        : `No recent mistakes by type — a fresh ${SKILL_LABEL[skill]} part to keep practising`;
    const task = build(input, skill, pick, null, reason);
    if (task) return task;
  }
  return null;
}
