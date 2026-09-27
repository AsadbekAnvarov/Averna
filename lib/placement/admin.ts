/**
 * Placement results for the admin panel: the filtered list, the CSV export and
 * the "allow a retake now" switch. Labels are Uzbek (the admin panel's
 * language). SERVER ONLY.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AVERNA_TZ } from "@/lib/utils";
import { RECOMMENDATIONS, SECTION_TITLE_UZ, retakeOpensAt } from "./config";
import { resultsOf } from "./placement";
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

export interface PlacementFilters {
  /** YYYY-MM-DD (Tashkent day), inclusive. */
  from: string;
  to: string;
  level: Cefr | "";
  /** Only students who aren't in a group yet. */
  noGroup: boolean;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parsePlacementFilters(sp: Params): PlacementFilters {
  const from = one(sp.from).trim();
  const to = one(sp.to).trim();
  const level = one(sp.level).trim().toUpperCase();
  return {
    from: DAY.test(from) ? from : "",
    to: DAY.test(to) ? to : "",
    level: (CEFR_LEVELS as readonly string[]).includes(level) ? (level as Cefr) : "",
    noGroup: one(sp.nogroup) === "1",
  };
}

/** The same filters as a query string (for the CSV link). */
export function filtersQuery(f: PlacementFilters): string {
  const q = new URLSearchParams();
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  if (f.level) q.set("level", f.level);
  if (f.noGroup) q.set("nogroup", "1");
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface AdminPlacementRow {
  attemptId: string;
  studentId: string;
  name: string;
  email: string;
  finishedAt: string;
  cefr: string | null;
  band: number | null;
  /** Recommendation (Uzbek label when known). */
  recommendation: string;
  group: string | null;
  sections: PlacementResults["sections"];
  /** This is the student's most recent finished sitting (the retake switch lives here). */
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
  const where: Record<string, unknown> = { status: "finished" };
  const range: Record<string, Date> = {};
  if (f.from) range.gte = new Date(`${f.from}T00:00:00.000+05:00`);
  if (f.to) range.lte = new Date(`${f.to}T23:59:59.999+05:00`);
  if (Object.keys(range).length) where.finishedAt = range;
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
  finishedAt: Date | null;
  startedAt: Date;
  cefr: string | null;
  band: number | null;
  recommendation: string | null;
  results: unknown;
  student: { user: { name: string | null; email: string } | null; group: { name: string } | null } | null;
};

export async function listPlacementResults(f: PlacementFilters): Promise<AdminPlacementList> {
  const [rows, active] = (await Promise.all([
    db.placementAttempt.findMany({
      where: whereOf(f),
      orderBy: { finishedAt: "desc" },
      take: ADMIN_LIMIT + 1,
      select: {
        id: true,
        studentId: true,
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
        where: { studentId: { in: ids }, status: "finished" },
        orderBy: [{ studentId: "asc" }, { finishedAt: "desc" }],
        distinct: ["studentId"],
        select: { id: true, studentId: true, finishedAt: true, startedAt: true, results: true },
      })) as { id: string; studentId: string; finishedAt: Date | null; startedAt: Date; results: unknown }[])
    : [];
  const latestBy = new Map(latest.map((l) => [l.studentId, l]));

  return {
    active,
    truncated: rows.length > ADMIN_LIMIT,
    rows: shown.map((r) => {
      const results = resultsOf(r.results);
      const last = latestBy.get(r.studentId);
      const isLatest = last?.id === r.id;
      const override = isLatest && !!results.retake;
      const opens = retakeOpensAt(r.finishedAt ?? r.startedAt);
      const open = Date.now() >= opens.getTime();
      return {
        attemptId: r.id,
        studentId: r.studentId,
        name: r.student?.user?.name?.trim() || "Nomsiz",
        email: r.student?.user?.email ?? "",
        finishedAt: (r.finishedAt ?? r.startedAt).toISOString(),
        cefr: r.cefr,
        band: r.band,
        recommendation: uzRecommendation(r.recommendation, results.summary?.recommendation?.key),
        group: r.student?.group?.name ?? null,
        sections: results.sections,
        latest: isLatest,
        retake: { allowed: override || open, override, nextAt: override || open ? null : opens.toISOString() },
      };
    }),
  };
}

/** Let a student sit the test again now (before the 14 days are up). */
export async function allowPlacementRetake(studentId: string, by: string): Promise<boolean> {
  if (typeof studentId !== "string" || !studentId || studentId.length > 64) return false;
  const last = (await db.placementAttempt.findFirst({
    where: { studentId, status: "finished" },
    orderBy: { finishedAt: "desc" },
    select: { id: true, results: true },
  })) as { id: string; results: unknown } | null;
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

/** One section's score for a table cell, e.g. "22/30 · B1", "7/10 · 5.5", "6.0", "oʻtkazib yuborildi". */
export function sectionCell(section: PlacementSection, r: PlacementSectionResult | undefined): string {
  if (!r) return "—";
  if (section === "WRITING") return r.skipped ? "oʻtkazib yuborildi" : `${r.band.toFixed(1)}${r.assessedBy === "heuristic" ? " (taxminiy)" : ""}`;
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

export function placementCsv(rows: AdminPlacementRow[]): string {
  const head = [
    "Ism",
    "Email",
    "Sana",
    "CEFR",
    "IELTS (taxminiy)",
    ...PLACEMENT_SECTIONS.map((s) => SECTION_TITLE_UZ[s]),
    "Tavsiya etilgan kurs",
    "Guruh",
  ];
  const body = rows.map((r) => [
    r.name,
    r.email,
    uzDateTime(r.finishedAt),
    r.cefr ?? "",
    r.band != null ? r.band.toFixed(1) : "",
    ...PLACEMENT_SECTIONS.map((s) => sectionCell(s, r.sections[s])),
    r.recommendation,
    r.group ?? "Guruh yoʻq",
  ]);
  // BOM so Excel opens the Uzbek letters as UTF-8.
  return "\uFEFF" + [head, ...body].map((row) => row.map(cell).join(",")).join("\r\n");
}
