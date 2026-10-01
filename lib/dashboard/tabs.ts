/**
 * Student dashboard tabs. The active tab lives in the URL (`/dashboard?tab=learn`)
 * so the server renders only that tab's widgets, tabs can be linked to, and
 * Back / Forward / reload keep the student's place. Pure.
 */
export const DASHBOARD_TAB_KEYS = ["home", "learn", "progress", "class", "fun"] as const;
export type DashboardTabKey = (typeof DASHBOARD_TAB_KEYS)[number];
export const DEFAULT_DASHBOARD_TAB: DashboardTabKey = "home";

export function isDashboardTab(v: unknown): v is DashboardTabKey {
  return typeof v === "string" && (DASHBOARD_TAB_KEYS as readonly string[]).includes(v);
}

/** The tab a `?tab=` search param selects; anything unknown (or missing) is Today. */
export function parseDashboardTab(v: string | string[] | null | undefined): DashboardTabKey {
  const raw = Array.isArray(v) ? v[0] : v;
  const key = raw?.trim().toLowerCase();
  return isDashboardTab(key) ? key : DEFAULT_DASHBOARD_TAB;
}

/** Canonical URL of a tab. Today is plain `/dashboard`. */
export function dashboardTabHref(key: DashboardTabKey): string {
  return key === DEFAULT_DASHBOARD_TAB ? "/dashboard" : `/dashboard?tab=${key}`;
}
