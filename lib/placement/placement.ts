/**
 * The placement (entry) test — server logic.
 *
 * One sitting = Grammar & Vocabulary → Listening → Reading → Writing (optional),
 * about 40 minutes (55 with Writing). It ends with a CEFR level, an IELTS
 * estimate per skill and overall, and a recommended course, written to
 * PlacementAttempt (cefr / band / recommendation) and to Student.level.
 *
 * Exam conditions, as in the mock exam (lib/ielts/mock.ts):
 *   - one active sitting per student (partial unique index) — Start resumes it;
 *   - each section's clock starts when the student presses Start and lives in
 *     the database, so a refresh or a second tab can't reset it;
 *   - work is autosaved while the section runs; after the deadline (+ a short
 *     grace) new work is refused and the section is marked from the autosave;
 *   - submitting a section is idempotent (a retry of a marked section is ok).
 *
 * PlacementAttempt has no clock columns, so the running section's clock lives
 * in `draft` (PlacementDraft: { section, startedAt, deadline, answers | essay }),
 * which is cleared whenever a section is submitted. `plan` pins the content
 * form; `results` holds the section results, the summary and an admin's early
 * retake permission. No XP is awarded and no IELTSTest rows are written — a
 * placement is not practice history.
 *
 * SERVER ONLY.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { estimateListeningMinutes } from "@/lib/ielts/format";
import { gradeGroups, sanitizeAnswers } from "@/lib/ielts/grading";
import { toClientGroup, toClientReading } from "@/lib/ielts/sanitize";
import { listeningClientContent } from "@/lib/ielts/audio/client";
import type { ExamGroup } from "@/lib/ielts/types";
import { GRACE_MS, LISTENING_BUFFER_MINUTES, SECTION_MINUTES, SECTION_TITLE, retakeOpensAt } from "./config";
import { CURRENT_FORM_ID, getPlacementForm } from "./content";
import { grammarGroups, scoreGrammar, scoreObjective, scoreWriting, skippedWriting, summarize } from "./scoring";
import { assessPlacementWriting } from "./writing";
import {
  PLACEMENT_SECTIONS,
  type PlacementContent,
  type PlacementDraft,
  type PlacementForm,
  type PlacementOverview,
  type PlacementPlan,
  type PlacementResultView,
  type PlacementResults,
  type PlacementSection,
  type PlacementSectionResult,
  type PlacementSectionView,
  type PlacementView,
  type RetakeStatus,
} from "./types";

const MAX_DRAFT_CHARS = 40_000;
const MAX_ESSAY_CHARS = 6_000;

const json = (x: unknown) => x as Prisma.InputJsonValue;
const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

// ---------------------------------------------------------------------------
// JSON column readers
// ---------------------------------------------------------------------------

export function planOf(raw: unknown): PlacementPlan | null {
  const p = asRec(raw);
  if (!p || p.v !== 1 || typeof p.form !== "string" || !Array.isArray(p.sections) || !p.sections.length) return null;
  const known = new Set<string>(PLACEMENT_SECTIONS);
  if (!p.sections.every((s) => typeof s === "string" && known.has(s))) return null;
  return { v: 1, form: p.form, sections: p.sections as PlacementSection[] };
}

export function resultsOf(raw: unknown): PlacementResults {
  const r = asRec(raw) ?? {};
  const sections = (asRec(r.sections) ?? {}) as PlacementResults["sections"];
  const summary = asRec(r.summary) ? (r.summary as PlacementResults["summary"]) : undefined;
  const retake = asRec(r.retake) && typeof asRec(r.retake)?.allowedAt === "string" ? (r.retake as PlacementResults["retake"]) : undefined;
  return { sections, ...(summary ? { summary } : {}), ...(retake ? { retake } : {}) };
}

/** The running section's draft (clock + work), when it belongs to section `index`. */
function draftOf(raw: unknown, index: number): PlacementDraft | null {
  const d = asRec(raw);
  if (!d || d.section !== index) return null;
  const startedAt = Number(d.startedAt);
  const deadline = Number(d.deadline);
  if (!Number.isFinite(startedAt) || !Number.isFinite(deadline) || deadline <= startedAt) return null;
  const out: PlacementDraft = { section: index, startedAt, deadline };
  const answers = asRec(d.answers);
  if (answers) {
    const clean: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === "string") clean[k] = v;
      else if (Array.isArray(v)) clean[k] = v.filter((x): x is string => typeof x === "string");
    }
    out.answers = clean;
  }
  if (typeof d.essay === "string") out.essay = d.essay;
  return out;
}

type AttemptRow = {
  id: string;
  studentId: string;
  status: string;
  plan: unknown;
  current: number;
  draft: unknown;
  results: unknown;
  cefr: string | null;
  band: number | null;
  recommendation: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  updatedAt: Date;
};

async function loadRow(studentId: string, attemptId: string): Promise<AttemptRow | null> {
  if (typeof attemptId !== "string" || !attemptId || attemptId.length > 64) return null;
  const row = await db.placementAttempt.findFirst({ where: { id: attemptId, studentId } }).catch(() => null);
  return (row as AttemptRow | null) ?? null;
}

function formOfRow(row: AttemptRow): { plan: PlacementPlan; form: PlacementForm } | null {
  const plan = planOf(row.plan);
  const form = plan ? getPlacementForm(plan.form) : null;
  return plan && form ? { plan, form } : null;
}

function groupsOf(section: PlacementSection, form: PlacementForm): ExamGroup[] {
  if (section === "GRAMMAR") return grammarGroups(form.grammar);
  if (section === "LISTENING") return form.listening.parts.flatMap((p) => p.groups);
  if (section === "READING") return form.reading.parts.flatMap((p) => p.groups);
  return [];
}

/** Minutes on the section clock. */
function sectionMinutes(section: PlacementSection, form: PlacementForm): number {
  if (section === "LISTENING") return estimateListeningMinutes(form.listening) + LISTENING_BUFFER_MINUTES;
  if (section === "READING") return form.reading.timeLimit > 0 ? form.reading.timeLimit : SECTION_MINUTES.READING;
  return SECTION_MINUTES[section];
}

// ---------------------------------------------------------------------------
// Retakes
// ---------------------------------------------------------------------------

function retakeFrom(last: { finishedAt: Date | null; startedAt: Date; results: unknown } | null): RetakeStatus {
  if (!last) return { allowed: true, nextAt: null, override: false };
  const override = !!resultsOf(last.results).retake;
  const opens = retakeOpensAt(last.finishedAt ?? last.startedAt);
  const open = Date.now() >= opens.getTime();
  return { allowed: override || open, nextAt: override || open ? null : opens.toISOString(), override };
}

/** Can this student start a new sitting? (14 days after the last finished one, or earlier with an admin's permission.) */
export async function retakeStatus(studentId: string): Promise<RetakeStatus> {
  const last = await db.placementAttempt.findFirst({
    where: { studentId, status: "finished" },
    orderBy: { finishedAt: "desc" },
    select: { finishedAt: true, startedAt: true, results: true },
  });
  return retakeFrom(last);
}

// ---------------------------------------------------------------------------
// Attempt lifecycle
// ---------------------------------------------------------------------------

export type StartResult =
  | { ok: true; attemptId: string; resumed: boolean }
  | { ok: false; error: string; status: number; nextAt?: string | null };

export async function startPlacement(studentId: string): Promise<StartResult> {
  const active = await db.placementAttempt.findFirst({
    where: { studentId, status: "active" },
    orderBy: { startedAt: "desc" },
    select: { id: true, plan: true },
  });
  if (active) {
    const plan = planOf(active.plan);
    if (plan && getPlacementForm(plan.form)) return { ok: true, attemptId: active.id, resumed: true };
    // Its content form was retired: close it so a fresh sitting can start.
    await db.placementAttempt.updateMany({
      where: { id: active.id, status: "active" },
      data: { status: "abandoned", draft: Prisma.DbNull, updatedAt: new Date() },
    });
  }

  const retake = await retakeStatus(studentId);
  if (!retake.allowed) {
    const when = retake.nextAt
      ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", day: "numeric", month: "long", year: "numeric" }).format(new Date(retake.nextAt))
      : "soon";
    return {
      ok: false,
      status: 403,
      nextAt: retake.nextAt,
      error: `You've already taken the placement test. You can take it again from ${when} — or ask your teacher if you need to retake it sooner.`,
    };
  }

  const plan: PlacementPlan = { v: 1, form: CURRENT_FORM_ID, sections: [...PLACEMENT_SECTIONS] };
  try {
    const row = await db.placementAttempt.create({
      data: { studentId, status: "active", plan: json(plan), current: 0, results: json({ sections: {} }) },
      select: { id: true },
    });
    return { ok: true, attemptId: row.id, resumed: false };
  } catch (e) {
    // Two starts at once (two tabs, a retried request): the partial unique index
    // "one active placement per student" rejects the second — resume the winner.
    const winner = await db.placementAttempt.findFirst({ where: { studentId, status: "active" }, select: { id: true } });
    if (winner) return { ok: true, attemptId: winner.id, resumed: true };
    throw e;
  }
}

export async function abandonPlacement(studentId: string, attemptId: string): Promise<boolean> {
  if (typeof attemptId !== "string" || !attemptId || attemptId.length > 64) return false;
  const r = await db.placementAttempt.updateMany({
    where: { id: attemptId, studentId, status: "active" },
    data: { status: "abandoned", draft: Prisma.DbNull, updatedAt: new Date() },
  });
  return r.count > 0;
}

/** Start the clock of the current section (idempotent). */
export async function beginPlacementSection(
  studentId: string,
  attemptId: string,
  section: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await loadRow(studentId, attemptId);
  if (!row || row.status !== "active") return { ok: false, error: "This placement test is no longer active." };
  if (!Number.isInteger(section) || row.current !== section) {
    return { ok: false, error: "This section has already finished — reloading the test." };
  }
  const f = formOfRow(row);
  const key = f?.plan.sections[section];
  if (!f || !key) return { ok: false, error: "This placement test can't be continued. Please start it again." };
  if (draftOf(row.draft, section)) return { ok: true };

  const now = Date.now();
  const clock: PlacementDraft = { section, startedAt: now, deadline: now + sectionMinutes(key, f.form) * 60_000 };
  // Compare-and-set on updatedAt: two Start presses (two tabs) can't both set a clock.
  const r = await db.placementAttempt.updateMany({
    where: { id: row.id, status: "active", current: section, updatedAt: row.updatedAt },
    data: { draft: json(clock), updatedAt: new Date(now) },
  });
  if (r.count > 0) return { ok: true };
  const again = await loadRow(studentId, attemptId);
  if (again && again.status === "active" && again.current === section && draftOf(again.draft, section)) return { ok: true };
  return { ok: false, error: "The section couldn't be started. Please try again." };
}

/** Autosave the running section. Body draft: { answers } (Grammar, Listening, Reading) or { essay } (Writing). */
export async function savePlacementDraft(studentId: string, attemptId: string, section: number, draft: unknown): Promise<boolean> {
  const row = await loadRow(studentId, attemptId);
  if (!row || row.status !== "active" || !Number.isInteger(section) || row.current !== section) return false;
  const clock = draftOf(row.draft, section);
  if (!clock || Date.now() > clock.deadline + GRACE_MS) return false;
  const f = formOfRow(row);
  const key = f?.plan.sections[section];
  if (!f || !key) return false;

  const d = asRec(draft);
  const next: PlacementDraft = { section, startedAt: clock.startedAt, deadline: clock.deadline };
  if (key === "WRITING") next.essay = typeof d?.essay === "string" ? d.essay.slice(0, MAX_ESSAY_CHARS) : "";
  else next.answers = sanitizeAnswers(groupsOf(key, f.form), d?.answers);
  if (JSON.stringify(next).length > MAX_DRAFT_CHARS) return false;

  const r = await db.placementAttempt.updateMany({
    // `current` guards against a late save landing after the section was submitted.
    where: { id: row.id, status: "active", current: section },
    data: { draft: json(next), updatedAt: new Date() },
  });
  return r.count > 0;
}

export type SectionSubmitResult =
  | { ok: true; done: boolean; section: PlacementSection }
  | { ok: false; error: string; status: number };

/**
 * Mark one section and move the sitting on; the last one finishes it (summary,
 * cefr / band / recommendation, Student.level). Idempotent: a retry of a marked
 * section returns ok. Writing may call the AI examiner (up to ~40 s).
 * `payload`: { answers } | { essay } | { skip: true } (Writing only — also before its clock starts).
 */
export async function submitPlacementSection(o: {
  studentId: string;
  userId: string;
  attemptId: string;
  section: number;
  payload: unknown;
  /** Mark from the autosave (the deadline passed while the student was away). */
  fromDraft?: boolean;
}): Promise<SectionSubmitResult> {
  const row = await loadRow(o.studentId, o.attemptId);
  if (!row) return { ok: false, error: "This placement test couldn't be found.", status: 404 };
  const f = formOfRow(row);
  if (!f) return { ok: false, error: "This placement test can't be continued. Please start it again.", status: 410 };
  const { plan, form } = f;
  if (!Number.isInteger(o.section) || o.section < 0 || o.section >= plan.sections.length) {
    return { ok: false, error: "Unknown section.", status: 400 };
  }
  const key = plan.sections[o.section];
  const results = resultsOf(row.results);
  if (results.sections[key] || row.current > o.section || row.status === "finished") {
    return { ok: true, done: row.status === "finished", section: key };
  }
  if (row.status !== "active") return { ok: false, error: "This placement test is no longer active.", status: 409 };
  if (row.current !== o.section) return { ok: false, error: "Finish the earlier sections first.", status: 409 };

  const payload = asRec(o.payload);
  const skip = key === "WRITING" && payload?.skip === true;
  const clock = draftOf(row.draft, o.section);
  if (!clock && !skip) return { ok: false, error: "Start the section first.", status: 409 };

  const now = Date.now();
  const late = !!clock && now > clock.deadline + GRACE_MS;
  const auto = !!o.fromDraft || late;
  // After the deadline only the autosaved work counts — papers are collected.
  const source: Record<string, unknown> | null = auto ? (clock as unknown as Record<string, unknown> | null) : payload;
  const meta = { auto, submittedAt: new Date(now).toISOString() };

  let result: PlacementSectionResult;
  if (key === "GRAMMAR") {
    result = scoreGrammar(form.grammar, sanitizeAnswers(groupsOf(key, form), source?.answers), meta);
  } else if (key === "LISTENING" || key === "READING") {
    const groups = groupsOf(key, form);
    result = scoreObjective(key, gradeGroups(groups, sanitizeAnswers(groups, source?.answers)), meta);
  } else {
    const essay = typeof source?.essay === "string" ? source.essay.slice(0, MAX_ESSAY_CHARS).trim() : "";
    if (skip || !essay) {
      result = skippedWriting({ ...meta, blank: !skip });
    } else {
      const a = await assessPlacementWriting({ userId: o.userId, attemptId: row.id, essay, prompt: form.writing });
      result = scoreWriting({ ...a, essay }, meta);
    }
  }

  const next = o.section + 1;
  const done = next >= plan.sections.length;
  const sections = { ...results.sections, [key]: result };
  const summary = done ? summarize(form.grammar, sections) : null;
  const merged: PlacementResults = { ...results, sections, ...(summary ? { summary } : {}) };
  const r = await db.placementAttempt.updateMany({
    where: { id: row.id, status: "active", current: o.section },
    data: {
      current: next,
      results: json(merged),
      // A nullable Json column takes Prisma.DbNull, never a plain JS null.
      draft: Prisma.DbNull,
      updatedAt: new Date(now),
      ...(summary
        ? {
            status: "finished",
            finishedAt: new Date(now),
            cefr: summary.cefr,
            band: summary.band,
            recommendation: summary.recommendation.label,
          }
        : {}),
    },
  });
  if (r.count === 0) {
    // Marked meanwhile by a second tab or by the page's time-up collection.
    const again = await loadRow(o.studentId, o.attemptId);
    if (again && (again.current > o.section || resultsOf(again.results).sections[key])) {
      return { ok: true, done: again.status === "finished", section: key };
    }
    return { ok: false, error: "This test changed in another tab — reloading it.", status: 409 };
  }
  if (summary) {
    await db.student
      .update({ where: { id: o.studentId }, data: { level: summary.level } })
      .catch((e: unknown) => console.error("Placement: Student.level update failed", e));
  }
  return { ok: true, done, section: key };
}

// ---------------------------------------------------------------------------
// Views for the pages
// ---------------------------------------------------------------------------

function sectionDetail(section: PlacementSection, form: PlacementForm): string {
  const count = (groups: ExamGroup[]) => groups.reduce((n, g) => n + g.questions.length, 0);
  switch (section) {
    case "GRAMMAR":
      return `${form.grammar.length} multiple-choice questions, from easy to hard`;
    case "LISTENING":
      return `One conversation · ${count(groupsOf("LISTENING", form))} questions · the recording plays once`;
    case "READING":
      return `One short article · ${count(groupsOf("READING", form))} questions`;
    case "WRITING":
      return `Optional · ${form.writing.minWords}–${form.writing.maxWords} words giving your opinion`;
  }
}

function sectionViews(plan: PlacementPlan, form: PlacementForm, current: number, results: PlacementResults): PlacementSectionView[] {
  return plan.sections.map((section, index) => ({
    section,
    index,
    title: SECTION_TITLE[section],
    detail: sectionDetail(section, form),
    minutes: section === "LISTENING" ? estimateListeningMinutes(form.listening) : sectionMinutes(section, form),
    status: index < current ? "done" : index === current ? "current" : "upcoming",
    ...(results.sections[section]?.skipped ? { skipped: true } : {}),
  }));
}

async function sectionContent(section: PlacementSection, form: PlacementForm): Promise<PlacementContent> {
  switch (section) {
    case "GRAMMAR":
      return { section, groups: grammarGroups(form.grammar).map(toClientGroup), minutes: sectionMinutes(section, form) };
    case "LISTENING":
      // Browser voices, or a pre-rendered recording if one exists for this test id (the script is then withheld).
      return { section, test: await listeningClientContent(form.listening) };
    case "READING":
      return { section, test: toClientReading(form.reading), minutes: sectionMinutes(section, form) };
    case "WRITING":
      return { section, prompt: form.writing, minutes: sectionMinutes(section, form) };
  }
}

/**
 * Everything the run page needs. A section whose clock ran out while the
 * student was away is marked from its autosave first, so the view always
 * agrees with the server clock.
 */
export async function getPlacementView(studentId: string, userId: string, attemptId: string): Promise<PlacementView | null> {
  let row = await loadRow(studentId, attemptId);
  if (!row) return null;

  for (let guard = 0; guard < PLACEMENT_SECTIONS.length && row && row.status === "active"; guard++) {
    const clock = draftOf(row.draft, row.current);
    if (!clock || Date.now() <= clock.deadline + GRACE_MS) break;
    // Never let marking break the page: on a failure the section is shown as
    // usual, and its runner submits at once (the clock is over).
    try {
      const r = await submitPlacementSection({ studentId, userId, attemptId: row.id, section: row.current, payload: null, fromDraft: true });
      if (!r.ok && r.status === 410) await abandonPlacement(studentId, row.id);
      if (!r.ok) {
        row = await loadRow(studentId, attemptId);
        break;
      }
    } catch (e) {
      console.error("Placement auto-mark failed:", e);
      break;
    }
    row = await loadRow(studentId, attemptId);
  }
  if (!row) return null;

  const f = formOfRow(row);
  if (!f) {
    if (row.status === "active") await abandonPlacement(studentId, row.id).catch(() => false);
    return { attemptId: row.id, sections: [], stage: { kind: row.status === "finished" ? "finished" : "abandoned" }, startedAt: row.startedAt.toISOString() };
  }
  const { plan, form } = f;
  const results = resultsOf(row.results);
  const base = { attemptId: row.id, sections: sectionViews(plan, form, row.current, results), startedAt: row.startedAt.toISOString() };

  if (row.status === "finished" || row.current >= plan.sections.length) return { ...base, stage: { kind: "finished" } };
  if (row.status !== "active") return { ...base, stage: { kind: "abandoned" } };

  const section = plan.sections[row.current];
  const draft = draftOf(row.draft, row.current);
  if (!draft) return { ...base, stage: { kind: "intro", section, index: row.current } };
  return {
    ...base,
    stage: {
      kind: "running",
      section,
      index: row.current,
      deadline: draft.deadline,
      content: await sectionContent(section, form),
      draft,
    },
  };
}

// ---------------------------------------------------------------------------
// Results, the hub, the dashboard prompt, teacher badges
// ---------------------------------------------------------------------------

export async function getPlacementResult(studentId: string, attemptId: string): Promise<PlacementResultView | null> {
  const row = await loadRow(studentId, attemptId);
  if (!row) return null;
  const results = resultsOf(row.results);
  const retake = await retakeStatus(studentId).catch((): RetakeStatus => ({ allowed: false, nextAt: null, override: false }));
  return {
    attemptId: row.id,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    sections: results.sections,
    summary: results.summary ?? null,
    retake,
  };
}

const EMPTY_OVERVIEW: PlacementOverview = { active: null, last: null, retake: { allowed: true, nextAt: null, override: false } };

/** The hub page: a sitting in progress, the last result, and whether a new sitting can start. Never throws. */
export async function getPlacementOverview(studentId: string): Promise<PlacementOverview> {
  try {
    const [active, last] = await Promise.all([
      db.placementAttempt.findFirst({
        where: { studentId, status: "active" },
        orderBy: { startedAt: "desc" },
        select: { id: true, current: true, startedAt: true, plan: true },
      }),
      db.placementAttempt.findFirst({
        where: { studentId, status: "finished" },
        orderBy: { finishedAt: "desc" },
        select: { id: true, finishedAt: true, startedAt: true, cefr: true, band: true, recommendation: true, results: true },
      }),
    ]);
    const plan = active ? planOf(active.plan) : null;
    return {
      active: active
        ? {
            attemptId: active.id,
            current: active.current,
            sections: plan?.sections.length ?? PLACEMENT_SECTIONS.length,
            startedAt: active.startedAt.toISOString(),
          }
        : null,
      last: last
        ? {
            attemptId: last.id,
            finishedAt: (last.finishedAt ?? last.startedAt).toISOString(),
            cefr: last.cefr,
            band: last.band,
            recommendation: last.recommendation,
          }
        : null,
      retake: retakeFrom(last),
    };
  } catch (e) {
    console.error("Placement overview failed:", e);
    return EMPTY_OVERVIEW;
  }
}

/** Dashboard card: show it to students who never finished a placement test. Never throws (hidden on errors). */
export async function placementPromptState(studentId: string): Promise<{ show: boolean; activeAttemptId: string | null }> {
  try {
    const [finished, active] = await Promise.all([
      db.placementAttempt.findFirst({ where: { studentId, status: "finished" }, select: { id: true } }),
      db.placementAttempt.findFirst({ where: { studentId, status: "active" }, orderBy: { startedAt: "desc" }, select: { id: true } }),
    ]);
    return { show: !finished, activeAttemptId: active?.id ?? null };
  } catch {
    return { show: false, activeAttemptId: null };
  }
}

/** The latest finished placement of each student (teacher badges). Never throws. */
export async function latestPlacementByStudent(
  studentIds: string[]
): Promise<Map<string, { cefr: string; band: number | null; finishedAt: string }>> {
  const out = new Map<string, { cefr: string; band: number | null; finishedAt: string }>();
  const ids = Array.from(new Set(studentIds.filter((id) => typeof id === "string" && id))).slice(0, 2000);
  if (!ids.length) return out;
  try {
    const rows = (await db.placementAttempt.findMany({
      where: { studentId: { in: ids }, status: "finished", cefr: { not: null } },
      orderBy: [{ studentId: "asc" }, { finishedAt: "desc" }],
      distinct: ["studentId"],
      select: { studentId: true, cefr: true, band: true, finishedAt: true, startedAt: true },
    })) as { studentId: string; cefr: string | null; band: number | null; finishedAt: Date | null; startedAt: Date }[];
    for (const r of rows) {
      if (!r.cefr) continue;
      out.set(r.studentId, { cefr: r.cefr, band: r.band, finishedAt: (r.finishedAt ?? r.startedAt).toISOString() });
    }
  } catch (e) {
    console.error("Placement badges failed:", e);
  }
  return out;
}
