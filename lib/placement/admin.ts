/**
 * Placement sittings for the admin panel: the filtered list (finished, in
 * progress and left — with a status), the CSV export and the "allow a retake
 * now" switch. Labels are Uzbek (the admin panel's language). SERVER ONLY.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AVERNA_TZ } from "@/lib/utils";
import { RECOMMENDATIONS, RETAKE_DAYS, SECTION_TITLE_UZ } from "./config";
import { COUNTED_SITTINGS, finishParkedSittings, lastCountedSitting, planOf, resultsOf, retakeFrom } from "./placement";
import {
  CEFR_LEVELS,
  PLACEMENT_SECTIONS,
  type Cefr,
  type PlacementResults,
  type PlacementSection,
  type PlacementSectionResult,
  type RetakeStatus,
} from "./types";

const json = (x: unknown) => x as Prisma.InputJsonValue;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Rows shown / exported at most. */
export const ADMIN_LIMIT = 500;

export const ADMIN_STATUSES = ["finished", "active", "abandoned"] as const;
export type AdminPlacementStatus = (typeof ADMIN_STATUSES)[number];
export const STATUS_UZ: Record<AdminPlacementStatus, string> = {
  finished: "Yakunlangan",
  active: "Jarayonda",
  abandoned: "Tark etilgan",
};

export interface PlacementFilters {
  /** YYYY-MM-DD (Tashkent day), inclusive. */
  from: string;
  to: string;
  level: Cefr | "";
  /** Only students who aren't in a group yet. */
  noGroup: boolean;
  /** Only sittings with this status ("" = all). */
  status: AdminPlacementStatus | "";
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parsePlacementFilters(sp: Params): PlacementFilters {
  const from = one(sp.from).trim();
  const to = one(sp.to).trim();
  const level = one(sp.level).trim().toUpperCase();
  const status = one(sp.status).trim().toLowerCase();
  return {
    from: DAY.test(from) ? from : "",
    to: DAY.test(to) ? to : "",
    level: (CEFR_LEVELS as readonly string[]).includes(level) ? (level as Cefr) : "",
    noGroup: one(sp.nogroup) === "1",
    status: (ADMIN_STATUSES as readonly string[]).includes(status) ? (status as AdminPlacementStatus) : "",
  };
}

/** The same filters as a query string (for the CSV link). */
export function filtersQuery(f: PlacementFilters): string {
  const q = new URLSearchParams();
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  if (f.level) q.set("level", f.level);
  if (f.noGroup) q.set("nogroup", "1");
  if (f.status) q.set("status", f.status);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface AdminPlacementRow {
  attemptId: string;
  studentId: string;
  name: string;
  email: string;
  status: AdminPlacementStatus;
  /** When the sitting ended (finished, or left after a section had started); otherwise when it started. */
  date: string;
  /** Counts toward the retake wait: finished, or left after a section's clock had started. */
  counts: boolean;
  /** The section it is at (in progress) or was at when left (index into the plan), and how many there are. */
  current: number;
  sectionCount: number;
  currentSection: PlacementSection | null;
  cefr: string | null;
  band: number | null;
  /** Recommendation (Uzbek label when known). */
  recommendation: string;
  group: string | null;
  sections: PlacementResults["sections"];
  /** Listening had no answer at all, so the level comes from the other sections (within config BLANK_LISTENING_CEILING's bounds). */
  listeningNotAssessed: boolean;
  /** This is the student's most recent sitting that counts (the retake switch lives here). */
  latest: boolean;
  retake: RetakeStatus;
}

export interface AdminPlacementList {
  rows: AdminPlacementRow[];
  /** Sittings in progress right now (all students). */
  active: number;
  truncated: boolean;
}

function whereOf(f: PlacementFilters): Record<string, unknown> {
  const where: Record<string, unknown> = { status: f.status || { in: [...ADMIN_STATUSES] } };
  const range: Record<string, Date> = {};
  if (f.from) range.gte = new Date(`${f.from}T00:00:00.000+05:00`);
  if (f.to) range.lte = new Date(`${f.to}T23:59:59.999+05:00`);
  // The day of a sitting: when it ended — or, while it has no end, when it started.
  if (Object.keys(range).length) where.OR = [{ finishedAt: range }, { finishedAt: null, startedAt: range }];
  if (f.level) where.cefr = f.level;
  if (f.noGroup) where.student = { is: { groupId: null } };
  return where;
}

function uzRecommendation(label: string | null, key: string | undefined): string {
  const rule = RECOMMENDATIONS.find((r) => r.key === key);
  return rule?.uz ?? label ?? "—";
}

type ListRow = {
  id: string;
  studentId: string;
  status: string;
  current: number;
  plan: unknown;
  finishedAt: Date | null;
  startedAt: Date;
  cefr: string | null;
  band: number | null;
  recommendation: string | null;
  results: unknown;
  student: { user: { name: string | null; email: string } | null; group: { name: string } | null } | null;
};

const NO_RETAKE: RetakeStatus = { allowed: false, nextAt: null, override: false };

export async function listPlacementResults(f: PlacementFilters): Promise<AdminPlacementList> {
  // Sittings left at the optional Writing intro for too long get their result first.
  await finishParkedSittings();
  const [rows, active] = (await Promise.all([
    db.placementAttempt.findMany({
      where: whereOf(f),
      orderBy: { startedAt: "desc" },
      take: ADMIN_LIMIT + 1,
      select: {
        id: true,
        studentId: true,
        status: true,
        current: true,
        plan: true,
        finishedAt: true,
        startedAt: true,
        cefr: true,
        band: true,
        recommendation: true,
        results: true,
        student: { select: { user: { select: { name: true, email: true } }, group: { select: { name: true } } } },
      },
    }),
    db.placementAttempt.count({ where: { status: "active" } }),
  ])) as [ListRow[], number];

  const shown = rows.slice(0, ADMIN_LIMIT);
  const ids = Array.from(new Set(shown.map((r) => r.studentId)));
  const latest = ids.length
    ? ((await db.placementAttempt.findMany({
        where: { studentId: { in: ids }, ...COUNTED_SITTINGS },
        orderBy: [{ studentId: "asc" }, { finishedAt: "desc" }],
        distinct: ["studentId"],
        select: { id: true, studentId: true },
      })) as { id: string; studentId: string }[])
    : [];
  const latestBy = new Map(latest.map((l) => [l.studentId, l.id]));

  return {
    active,
    truncated: rows.length > ADMIN_LIMIT,
    rows: shown.map((r): AdminPlacementRow => {
      const results = resultsOf(r.results);
      const status: AdminPlacementStatus = r.status === "finished" || r.status === "abandoned" ? r.status : "active";
      const counts = status !== "active" && !!r.finishedAt;
      const isLatest = counts && latestBy.get(r.studentId) === r.id;
      const plan = planOf(r.plan);
      const listening = results.sections.LISTENING;
      return {
        attemptId: r.id,
        studentId: r.studentId,
        name: r.student?.user?.name?.trim() || "Nomsiz",
        email: r.student?.user?.email ?? "",
        status,
        date: (r.finishedAt ?? r.startedAt).toISOString(),
        counts,
        current: r.current,
        sectionCount: plan?.sections.length ?? PLACEMENT_SECTIONS.length,
        currentSection: plan?.sections[r.current] ?? null,
        cefr: r.cefr,
        band: r.band,
        recommendation: status === "finished" ? uzRecommendation(r.recommendation, results.summary?.recommendation?.key) : "—",
        group: r.student?.group?.name ?? null,
        sections: results.sections,
        listeningNotAssessed: status === "finished" && (!!results.summary?.listeningNotAssessed || (!!listening && !listening.scored)),
        latest: isLatest,
        retake: isLatest ? retakeFrom({ status: r.status, finishedAt: r.finishedAt, startedAt: r.startedAt, results: r.results }) : NO_RETAKE,
      };
    }),
  };
}

/**
 * Let a student sit the test again now (before the 14 days are up). The
 * permission goes on the sitting the wait follows — the latest one that
 * counts, finished or left after it had started.
 */
export async function allowPlacementRetake(studentId: string, by: string): Promise<boolean> {
  if (typeof studentId !== "string" || !studentId || studentId.length > 64) return false;
  const last = await lastCountedSitting(studentId);
  if (!last) return false;
  const results = resultsOf(last.results);
  const merged: PlacementResults = { ...results, retake: { allowedAt: new Date().toISOString(), by: by.slice(0, 120) } };
  await db.placementAttempt.update({ where: { id: last.id }, data: { results: json(merged) } });
  return true;
}

// ---------------------------------------------------------------------------
// Formatting (shared by the page and the CSV)
// ---------------------------------------------------------------------------

/** dd.mm.yyyy (Tashkent). */
export function uzDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: AVERNA_TZ, day: "2-digit", month: "2-digit", year: "numeric" })
    .format(d)
    .replace(/\//g, ".");
}

/** dd.mm.yyyy HH:MM (Tashkent). */
export function uzDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: AVERNA_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${uzDate(iso)} ${time}`;
}

/**
 * One section's score for a table cell, e.g. "22/30 · B1", "7/10 · 5.5",
 * "6.0", "oʻtkazib yuborildi" ("… (avtomatik)": not started within a day).
 */
export function sectionCell(section: PlacementSection, r: PlacementSectionResult | undefined): string {
  if (!r) return "—";
  if (section === "WRITING") {
    if (r.skipped) return r.auto ? "oʻtkazib yuborildi (avtomatik)" : "oʻtkazib yuborildi";
    return `${r.band.toFixed(1)}${r.assessedBy === "heuristic" ? " (taxminiy)" : ""}`;
  }
  const raw = `${r.correct ?? 0}/${r.total ?? 0}`;
  if (section === "GRAMMAR") return `${raw} · ${r.cefr}`;
  if (!r.scored) return `${raw} · javob yoʻq`;
  return `${raw} · ${r.band.toFixed(1)}`;
}

/** A spreadsheet cell that can't be read as a formula (CSV injection). */
function cell(v: string | number): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A sitting's status for the table: "Yakunlangan"; "Jarayonda" with the
 * section it is at; "Tark etilgan" with whether it counts toward the wait.
 */
export function statusCell(r: AdminPlacementRow): { label: string; note: string } {
  const label = STATUS_UZ[r.status];
  if (r.status === "active") {
    const title = r.currentSection ? SECTION_TITLE_UZ[r.currentSection] : "";
    return { label, note: `${Math.min(r.current + 1, r.sectionCount)}/${r.sectionCount}-boʻlim${title ? `: ${title}` : ""}` };
  }
  if (r.status === "abandoned") {
    return { label, note: r.counts ? `boʻlim boshlangan — ${RETAKE_DAYS} kunlik kutishga hisoblanadi` : "boʻlim boshlanmagan — hisobga olinmaydi" };
  }
  return { label, note: "" };
}

/** The status as one line (CSV). */
function statusText(r: AdminPlacementRow): string {
  const { label, note } = statusCell(r);
  return note ? `${label} (${note})` : label;
}

export function placementCsv(rows: AdminPlacementRow[]): string {
  const head = [
    "Ism",
    "Email",
    "Sana",
    "Holat",
    "CEFR",
    "IELTS (taxminiy)",
    ...PLACEMENT_SECTIONS.map((s) => SECTION_TITLE_UZ[s]),
    "Tavsiya etilgan kurs",
    "Guruh",
  ];
  const body = rows.map((r) => [
    r.name,
    r.email,
    uzDateTime(r.date),
    statusText(r),
    r.cefr ?? "",
    r.band != null ? r.band.toFixed(1) : "",
    ...PLACEMENT_SECTIONS.map((s) => sectionCell(s, r.sections[s])),
    r.recommendation,
    r.group ?? "Guruh yoʻq",
  ]);
  // BOM so Excel opens the Uzbek letters as UTF-8.
  return "\uFEFF" + [head, ...body].map((row) => row.map(cell).join(",")).join("\r\n");
}
