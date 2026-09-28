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
 *   - submitting a section is idempotent (a retry of a marked section is ok);
 *   - leaving is no restart: a sitting left after a section's clock started
 *     (or a section was marked) gets `finishedAt` and counts toward the
 *     retake wait like a finished one (see COUNTED_SITTINGS);
 *   - Writing is optional: leaving at its intro (its clock not started)
 *     finishes the sitting without it, with a level, like "Skip Writing";
 *   - a sitting left waiting at the optional Writing intro for more than
 *     WRITING_INTRO_TIMEOUT_HOURS is finished without Writing when it is next
 *     read (the student's pages, the admin list), so it still gets a level —
 *     written to Student.level only if no one (an admin) changed it meanwhile.
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
import {
  GRACE_MS,
  LISTENING_BUFFER_MINUTES,
  SECTION_MINUTES,
  SECTION_TITLE,
  WRITING_INTRO_TIMEOUT_HOURS,
  retakeOpensAt,
} from "./config";
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

/** A section's clock has started, or a section was marked: leaving now counts toward the retake wait. */
function sittingStarted(row: Pick<AttemptRow, "current" | "draft" | "results">): boolean {
  return row.current > 0 || Object.keys(resultsOf(row.results).sections).length > 0 || !!draftOf(row.draft, row.current);
}

/** An active sitting waiting at the optional Writing intro: every other section marked, the Writing clock not started. */
function atWritingIntro(row: Pick<AttemptRow, "status" | "plan" | "current" | "draft">): boolean {
  if (row.status !== "active") return false;
  const plan = planOf(row.plan);
  return !!plan && plan.sections[row.current] === "WRITING" && !draftOf(row.draft, row.current);
}

// ---------------------------------------------------------------------------
// Retakes
// ---------------------------------------------------------------------------

/**
 * The sittings the retake wait follows are exactly those with `finishedAt`:
 * it is set when a sitting finishes, and when the student leaves one after a
 * section's clock had started or a section was marked (abandonPlacement). A
 * sitting left before any section started — or closed because its content
 * form was retired — has no finishedAt and doesn't count.
 */
export const COUNTED_SITTINGS = { status: { in: ["finished", "abandoned"] }, finishedAt: { not: null } };

type CountedSitting = { id: string; status: string; finishedAt: Date | null; startedAt: Date; results: unknown };

/** The retake state that follows a student's latest counted sitting (null: none yet). */
export function retakeFrom(last: Omit<CountedSitting, "id"> | null): RetakeStatus {
  if (!last) return { allowed: true, nextAt: null, override: false };
  const override = !!resultsOf(last.results).retake;
  const opens = retakeOpensAt(last.finishedAt ?? last.startedAt);
  const open = Date.now() >= opens.getTime();
  return {
    allowed: override || open,
    nextAt: override || open ? null : opens.toISOString(),
    override,
    ...(last.status === "abandoned" ? { unfinished: true } : {}),
  };
}

/** The student's latest sitting that counts toward the retake wait (see COUNTED_SITTINGS), or null. */
export async function lastCountedSitting(studentId: string): Promise<CountedSitting | null> {
  const row = await db.placementAttempt.findFirst({
    where: { studentId, ...COUNTED_SITTINGS },
    orderBy: { finishedAt: "desc" },
    select: { id: true, status: true, finishedAt: true, startedAt: true, results: true },
  });
  return (row as CountedSitting | null) ?? null;
}

/**
 * Can this student start a new sitting? 14 days after the last sitting that
 * counts — finished, or left after a section had started — or earlier with an
 * admin's permission.
 */
export async function retakeStatus(studentId: string): Promise<RetakeStatus> {
  return retakeFrom(await lastCountedSitting(studentId));
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
    // Its content form was retired: close it (not the student's doing — it doesn't count) so a fresh sitting can start.
    await abandonPlacement(studentId, active.id, "system");
  }

  const retake = await retakeStatus(studentId);
  if (!retake.allowed) {
    const when = retake.nextAt
      ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", day: "numeric", month: "long", year: "numeric" }).format(new Date(retake.nextAt))
      : "soon";
    const why = retake.unfinished
      ? "You left your last placement test after it had started, so it counts as a sitting."
      : "You've already taken the placement test.";
    return {
      ok: false,
      status: 403,
      nextAt: retake.nextAt,
      error: `${why} You can take it again from ${when} — or ask your teacher if you need to retake it sooner.`,
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

/** What leaving did: "finished" (at the Writing intro — finished without Writing, with a level), "left" (abandoned), or false (nothing to leave). */
export type LeaveOutcome = false | "left" | "finished";

/**
 * Leave a sitting for good. When a section's clock had started (or a section
 * was marked) the sitting gets `finishedAt`, so it counts toward the retake
 * wait like a finished one — leaving can't restart the clocks on the same
 * items. At the intro of the optional Writing (its clock not started) the
 * student's Leave finishes the sitting with Writing skipped instead, so the
 * three marked sections still give a level. `by: "system"` (its content form
 * was retired, so nobody can continue it) never counts, and neither does a
 * sitting whose form is gone.
 */
export async function abandonPlacement(studentId: string, attemptId: string, by: "student" | "system" = "student"): Promise<LeaveOutcome> {
  if (typeof attemptId !== "string" || !attemptId || attemptId.length > 64) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await loadRow(studentId, attemptId);
    if (!row || row.status !== "active") return false;
    const f = formOfRow(row);
    if (by === "student" && f && atWritingIntro(row)) {
      // Leaving here is skipping Writing. Only while the sitting is exactly as checked: a Start pressed in
      // another tab at the same moment wins, and the next pass leaves by the rule for a running section.
      const r = await markSection(
        { studentId, userId: "", attemptId: row.id, section: row.current, payload: { skip: true } },
        { ifUpdatedAt: row.updatedAt }
      );
      if (r.ok && r.done) return "finished";
      continue;
    }
    const counts = by === "student" && !!f && sittingStarted(row);
    // The student leaves before anything started: compare-and-set on updatedAt, so a Start pressed
    // at the same moment (another tab) can't slip in between this check and the write.
    const guard = by === "student" && !counts;
    const now = new Date();
    const r = await db.placementAttempt.updateMany({
      where: { id: row.id, studentId, status: "active", ...(guard ? { updatedAt: row.updatedAt } : {}) },
      data: { status: "abandoned", draft: Prisma.DbNull, updatedAt: now, ...(counts ? { finishedAt: now } : {}) },
    });
    if (r.count > 0) return "left";
  }
  return false;
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

interface SectionSubmit {
  studentId: string;
  userId: string;
  attemptId: string;
  section: number;
  payload: unknown;
  /**
   * Marked by the server, not the student: from the autosave (the deadline
   * passed while the student was away), or — with { skip: true } — Writing
   * skipped for a sitting left at the Writing intro (finishIfParked). That
   * automatic skip is refused once a Writing clock has started, and it writes
   * only while the sitting is unchanged since it was checked.
   */
  fromDraft?: boolean;
}

/** How the server itself marks a section (never from a request). */
interface MarkOptions {
  /** Compare-and-set: mark only while the sitting still has this updatedAt (the row the caller checked). */
  ifUpdatedAt?: Date;
  /**
   * A late automatic finish: Student.level is written only when it is empty or still holds the level
   * the student's previous finished placement wrote — never over a level an admin set meanwhile.
   */
  keepChangedLevel?: boolean;
}

const SITTING_CHANGED: SectionSubmitResult = { ok: false, error: "This test changed in another tab — reloading it.", status: 409 };

/**
 * Mark one section and move the sitting on; the last one finishes it (summary,
 * cefr / band / recommendation, Student.level). Idempotent: a retry of a marked
 * section returns ok. Writing may call the AI examiner (at most
 * WRITING_AI_TIMEOUT_MS, then the offline estimate).
 * `payload`: { answers } | { essay } | { skip: true } (Writing only — also before its clock starts).
 */
export async function submitPlacementSection(o: SectionSubmit): Promise<SectionSubmitResult> {
  return markSection(o, {});
}

async function markSection(o: SectionSubmit, opts: MarkOptions): Promise<SectionSubmitResult> {
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
  if (opts.ifUpdatedAt && new Date(row.updatedAt).getTime() !== new Date(opts.ifUpdatedAt).getTime()) return SITTING_CHANGED;

  const payload = asRec(o.payload);
  const skip = key === "WRITING" && payload?.skip === true;
  const clock = draftOf(row.draft, o.section);
  if (!clock && !skip) return { ok: false, error: "Start the section first.", status: 409 };
  // The server's own skip (a sitting left at the Writing intro) never throws away a Writing started meanwhile.
  const autoSkip = skip && !!o.fromDraft;
  if (autoSkip && clock) return { ok: false, error: "Writing has started, so it isn't skipped.", status: 409 };
  const guard = opts.ifUpdatedAt ?? (autoSkip ? row.updatedAt : undefined);

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
    // `guard`: only while the sitting is exactly the row that was checked (a Writing Start in between changes it).
    where: { id: row.id, status: "active", current: o.section, ...(guard ? { updatedAt: guard } : {}) },
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
    return SITTING_CHANGED;
  }
  if (summary) await writeStudentLevel(o.studentId, row.id, summary.level, !!opts.keepChangedLevel);
  return { ok: true, done, section: key };
}

/**
 * Student.level after a finished sitting: the admin roster's level name ("Oʻrta (B1)"), so the
 * enrollment form shows it and keeps it on save. A late automatic finish (`keepChanged`) writes it
 * only when it is empty or still the level the student's previous finished placement wrote — as a
 * compare-and-set, so a level an admin set (even at this very moment) stays. Never throws.
 */
async function writeStudentLevel(studentId: string, attemptId: string, level: string, keepChanged: boolean): Promise<void> {
  try {
    if (!keepChanged) {
      await db.student.update({ where: { id: studentId }, data: { level } });
      return;
    }
    const previous: { results: unknown } | null = await db.placementAttempt.findFirst({
      where: { studentId, status: "finished", id: { not: attemptId } },
      orderBy: { finishedAt: "desc" },
      select: { results: true },
    });
    const written = resultsOf(previous?.results).summary?.level;
    const unchanged: { level: string | null }[] = [{ level: null }, { level: "" }];
    if (typeof written === "string" && written) unchanged.push({ level: written });
    await db.student.updateMany({ where: { id: studentId, OR: unchanged }, data: { level } });
  } catch (e) {
    console.error("Placement: Student.level update failed", e);
  }
}

// ---------------------------------------------------------------------------
// Sittings left at the (optional) Writing intro
// ---------------------------------------------------------------------------

const WRITING_INTRO_TIMEOUT_MS = WRITING_INTRO_TIMEOUT_HOURS * 3_600_000;

/** Waiting at the Writing intro (no clock started) for longer than WRITING_INTRO_TIMEOUT_HOURS. */
function parkedAtWriting(row: AttemptRow, now: number = Date.now()): boolean {
  const plan = planOf(row.plan);
  if (!plan || !atWritingIntro(row)) return false;
  const prevKey = row.current > 0 ? plan.sections[row.current - 1] : undefined;
  const prev = prevKey ? resultsOf(row.results).sections[prevKey] : undefined;
  const marked = Date.parse(prev?.submittedAt ?? "");
  const since = Number.isFinite(marked) ? marked : new Date(row.updatedAt).getTime();
  return now - since > WRITING_INTRO_TIMEOUT_MS;
}

/**
 * A sitting that has waited at the Writing intro too long is finished with
 * Writing skipped (marked `auto`), so the student gets a result and a level.
 * Only while the sitting is still the row checked here (a Writing started
 * since is never skipped), and Student.level only when no one changed it
 * since the last placement (an admin may have enrolled the student meanwhile).
 * True when it is finished now. Never throws.
 */
async function finishIfParked(row: AttemptRow): Promise<boolean> {
  if (!parkedAtWriting(row)) return false;
  try {
    const r = await markSection(
      {
        studentId: row.studentId,
        userId: "", // skipping never calls the AI examiner
        attemptId: row.id,
        section: row.current,
        payload: { skip: true },
        fromDraft: true,
      },
      { ifUpdatedAt: row.updatedAt, keepChangedLevel: true }
    );
    return r.ok && r.done;
  } catch (e) {
    console.error("Placement: finishing a sitting left at the Writing intro failed", e);
    return false;
  }
}

/** Finish every active sitting (of one student, or everyone's) that has waited at the Writing intro too long. Never throws. */
export async function finishParkedSittings(studentId?: string): Promise<number> {
  try {
    const rows = (await db.placementAttempt.findMany({
      where: { status: "active", ...(studentId ? { studentId } : {}) },
      orderBy: { startedAt: "asc" },
      take: 200,
    })) as AttemptRow[];
    let finished = 0;
    for (const row of rows) if (await finishIfParked(row)) finished++;
    return finished;
  } catch (e) {
    console.error("Placement: checking sittings left at the Writing intro failed", e);
    return 0;
  }
}

/** The student's sitting in progress (full row), or null. */
async function activeRow(studentId: string): Promise<AttemptRow | null> {
  const row = await db.placementAttempt.findFirst({ where: { studentId, status: "active" }, orderBy: { startedAt: "desc" } });
  return (row as AttemptRow | null) ?? null;
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
      // With a ready pre-rendered recording for this test id (rendered on the admin audio page),
      // listeningClientContent sends the recording and withholds the script. Without one the script
      // is sent for the browser voices — as for any browser-voice test — and it contains the answers.
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
      if (!r.ok && r.status === 410) await abandonPlacement(studentId, row.id, "system");
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
  // Left waiting at the optional Writing intro for too long: finished without Writing.
  if (row.status === "active" && (await finishIfParked(row))) row = await loadRow(studentId, attemptId);
  if (!row) return null;

  const f = formOfRow(row);
  if (!f) {
    if (row.status === "active") await abandonPlacement(studentId, row.id, "system").catch(() => false);
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

/**
 * The hub page: a sitting in progress, the last result, and whether a new
 * sitting can start. A sitting left at the Writing intro for too long is
 * finished first. Never throws.
 */
export async function getPlacementOverview(studentId: string): Promise<PlacementOverview> {
  try {
    let active = await activeRow(studentId);
    if (active && (await finishIfParked(active))) active = null;
    const [last, counted] = await Promise.all([
      db.placementAttempt.findFirst({
        where: { studentId, status: "finished" },
        orderBy: { finishedAt: "desc" },
        select: { id: true, finishedAt: true, startedAt: true, cefr: true, band: true, recommendation: true },
      }),
      lastCountedSitting(studentId),
    ]);
    const plan = active ? planOf(active.plan) : null;
    return {
      active: active
        ? {
            attemptId: active.id,
            current: active.current,
            sections: plan?.sections.length ?? PLACEMENT_SECTIONS.length,
            startedAt: active.startedAt.toISOString(),
            started: sittingStarted(active),
            atWritingIntro: atWritingIntro(active),
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
      retake: retakeFrom(counted),
    };
  } catch (e) {
    console.error("Placement overview failed:", e);
    return EMPTY_OVERVIEW;
  }
}

/**
 * Dashboard card: show it to students who never finished a placement test —
 * not while a left sitting's retake wait is running (there's nothing they
 * could start). Never throws (hidden on errors).
 */
export async function placementPromptState(studentId: string): Promise<{ show: boolean; activeAttemptId: string | null }> {
  try {
    const [finished, active] = await Promise.all([
      db.placementAttempt.findFirst({ where: { studentId, status: "finished" }, select: { id: true } }),
      activeRow(studentId),
    ]);
    // Left at the Writing intro for too long: finished now, so there's a level and nothing to finish.
    if (active && (await finishIfParked(active))) return { show: false, activeAttemptId: null };
    if (finished) return { show: false, activeAttemptId: active?.id ?? null };
    if (!active && !retakeFrom(await lastCountedSitting(studentId)).allowed) return { show: false, activeAttemptId: null };
    return { show: true, activeAttemptId: active?.id ?? null };
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
