/**
 * Review queue filters ↔ URL query. Pure — shared by the queue page, the review
 * page (its "back" link and "next pending" keep the teacher's filters) and the
 * review form.
 */

import type { ReviewSkill } from "./scoring";

export type ReviewTab = "pending" | "reviewed";
export type ReviewSource = "homework" | "mock" | "practice";

export const REVIEW_SOURCES: readonly ReviewSource[] = ["homework", "mock", "practice"];
export const SOURCE_LABEL: Record<ReviewSource, string> = {
  homework: "Homework",
  mock: "Mock exam",
  practice: "Practice",
};

/** Completed within the last N days; 0 = any time. */
export const DAY_OPTIONS: readonly number[] = [7, 30, 90, 0];
export const DEFAULT_DAYS = 30;
export const REVIEW_PAGE_SIZE = 50;
export const QUEUE_PATH = "/teacher/reviews";

export interface QueueFilters {
  tab: ReviewTab;
  /** Group id (must be one of the viewer's groups; ignored otherwise). */
  group: string | null;
  skill: ReviewSkill | null;
  source: ReviewSource | null;
  days: number;
  /** 1-based. */
  page: number;
}

export const DEFAULT_FILTERS: QueueFilters = {
  tab: "pending",
  group: null,
  skill: null,
  source: null,
  days: DEFAULT_DAYS,
  page: 1,
};

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function pick(sp: unknown, key: string): string | undefined {
  if (!sp || typeof sp !== "object") return undefined;
  const v = (sp as Record<string, unknown>)[key];
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s === "number" && Number.isFinite(s)) return String(s);
  return typeof s === "string" ? s.trim() : undefined;
}

/** Filters from searchParams (or a POST body); anything unknown falls back to the default. */
export function parseQueueFilters(sp: unknown): QueueFilters {
  const tab = pick(sp, "tab") === "reviewed" ? "reviewed" : "pending";
  const g = pick(sp, "group");
  const skillRaw = (pick(sp, "skill") ?? "").toUpperCase();
  const src = pick(sp, "source") as ReviewSource | undefined;
  const daysRaw = pick(sp, "days");
  const days = daysRaw !== undefined && daysRaw !== "" && DAY_OPTIONS.includes(Number(daysRaw)) ? Number(daysRaw) : DEFAULT_DAYS;
  const pageRaw = Number(pick(sp, "page"));
  return {
    tab,
    group: g && ID_RE.test(g) ? g : null,
    skill: skillRaw === "WRITING" || skillRaw === "SPEAKING" ? skillRaw : null,
    source: src && REVIEW_SOURCES.includes(src) ? src : null,
    days,
    page: Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 10_000) : 1,
  };
}

/** The query string for these filters, defaults left out ("" when everything is default). */
export function queueQuery(f: Partial<QueueFilters>): string {
  const q = new URLSearchParams();
  if (f.tab === "reviewed") q.set("tab", "reviewed");
  if (f.group) q.set("group", f.group);
  if (f.skill) q.set("skill", f.skill);
  if (f.source) q.set("source", f.source);
  if (typeof f.days === "number" && f.days !== DEFAULT_DAYS) q.set("days", String(f.days));
  if (typeof f.page === "number" && f.page > 1) q.set("page", String(f.page));
  return q.toString();
}

export function queueHref(f: Partial<QueueFilters> = {}): string {
  const q = queueQuery(f);
  return q ? `${QUEUE_PATH}?${q}` : QUEUE_PATH;
}

/** The review page of one attempt, carrying the queue filters (back link + "next pending"). */
export function reviewHref(testId: string, f: Partial<QueueFilters> = {}): string {
  const q = queueQuery(f);
  return `${QUEUE_PATH}/${encodeURIComponent(testId)}${q ? `?${q}` : ""}`;
}

export function daysLabel(days: number): string {
  return days > 0 ? `Last ${days} days` : "Any time";
}
