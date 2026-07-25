/**
 * Permissions (M13) — the single authority for who may open which admin module.
 *
 * Before this, every admin page hard-coded `role !== "ADMIN"` (44 places), so the
 * panel was all-or-nothing: a receptionist who needed to enrol students would also
 * see salaries and profit. Roles now map to modules through ONE matrix, and every
 * page asks `can()` instead of comparing strings.
 *
 * Deliberately coarse: one permission per module (view + act). Action-level rules
 * (e.g. an accountant who may read payroll but not approve it) are a follow-up —
 * pretending to enforce them here without testing would be worse than not having
 * them. Where a role can reach a page, it can act on it.
 */

/** Every gated admin surface. Keys are stable — they're used in page guards. */
export type Module =
  | "dashboard"
  | "finance"
  | "expenses"
  | "payroll"
  | "payments"
  | "calendar"
  | "risks"
  | "analytics"
  | "teachers"
  | "groups"
  | "students"
  | "content"
  | "tests"
  | "rewards"
  | "announcements"
  | "system"
  | "logs"
  | "roles";

/** Roles that belong to the admin area at all. */
export const ADMIN_AREA_ROLES = ["ADMIN", "OWNER", "FINANCE_MANAGER", "ACCOUNTANT", "RECEPTION"] as const;
export type AdminRole = (typeof ADMIN_AREA_ROLES)[number];

const ALL: Module[] = [
  "dashboard", "finance", "expenses", "payroll", "payments", "calendar", "risks",
  "analytics", "teachers", "groups", "students", "content", "tests", "rewards",
  "announcements", "system", "logs", "roles",
];

/** Money modules — the group that must stay invisible to non-finance staff. */
const MONEY: Module[] = ["finance", "expenses", "payroll", "payments", "calendar"];

/**
 * Role → allowed modules.
 * ADMIN and OWNER keep everything (ADMIN is unchanged, so nothing regresses).
 */
const MATRIX: Record<AdminRole, Module[]> = {
  ADMIN: ALL,
  OWNER: ALL,
  // Full money control, plus the risk register (mostly financial) — but no
  // people management, content or system settings.
  FINANCE_MANAGER: [...MONEY, "dashboard", "risks", "analytics"],
  // Books and reports. Same money visibility, without the risk/ops surface.
  ACCOUNTANT: [...MONEY, "dashboard", "logs"],
  // Front desk: gets people and comms, and NOTHING financial.
  RECEPTION: ["dashboard", "students", "groups", "teachers", "announcements", "rewards"],
};

const LABEL: Record<AdminRole, string> = {
  ADMIN: "Administrator",
  OWNER: "Egasi",
  FINANCE_MANAGER: "Moliya menejeri",
  ACCOUNTANT: "Hisobchi",
  RECEPTION: "Qabul (reception)",
};

const DESCRIPTION: Record<AdminRole, string> = {
  ADMIN: "Barcha boʻlimlarga toʻliq kirish.",
  OWNER: "Barcha boʻlimlar, jumladan moliya va foyda.",
  FINANCE_MANAGER: "Toʻlovlar, xarajatlar, maoshlar, kalendar va xavflar.",
  ACCOUNTANT: "Moliyaviy hisobotlar va audit jurnali.",
  RECEPTION: "Oʻquvchilarni qabul qilish, guruhlar va eʼlonlar — moliya yopiq.",
};

export const ADMIN_ROLE_OPTIONS = ADMIN_AREA_ROLES.map((r) => ({
  key: r,
  label: LABEL[r],
  description: DESCRIPTION[r],
}));

export const roleLabel = (role?: string | null): string =>
  (role && LABEL[role as AdminRole]) || role || "—";

/** True when the role may use the admin area at all. */
export function isAdminArea(role?: string | null): boolean {
  return !!role && (ADMIN_AREA_ROLES as readonly string[]).includes(role);
}

/**
 * The one check every admin page and server action uses.
 * Unknown or student/teacher roles are denied.
 */
export function can(role: string | null | undefined, mod: Module): boolean {
  if (!role) return false;
  const allowed = MATRIX[role as AdminRole];
  return !!allowed && allowed.includes(mod);
}

/** Modules a role can reach — used to filter navigation. */
export function allowedModules(role?: string | null): Module[] {
  if (!role) return [];
  return MATRIX[role as AdminRole] ?? [];
}

/** Maps an admin nav/tool href onto the module that gates it. */
export function moduleForHref(href: string): Module | null {
  if (href.startsWith("/admin/finance")) return "finance";
  if (href.startsWith("/admin/expenses")) return "expenses";
  if (href.startsWith("/admin/payroll")) return "payroll";
  if (href.startsWith("/admin/payments")) return "payments";
  if (href.startsWith("/admin/calendar")) return "calendar";
  if (href.startsWith("/admin/risks")) return "risks";
  if (href.startsWith("/admin/analytics")) return "analytics";
  if (href.startsWith("/admin/teachers")) return "teachers";
  if (href.startsWith("/admin/groups")) return "groups";
  if (href.startsWith("/admin/content")) return "content";
  if (href.startsWith("/admin/generate-tests")) return "tests";
  if (href.startsWith("/admin/rewards")) return "rewards";
  if (href.startsWith("/admin/announcements")) return "announcements";
  if (href.startsWith("/admin/system")) return "system";
  if (href.startsWith("/admin/logs")) return "logs";
  if (href.startsWith("/admin/roles")) return "roles";
  if (href.startsWith("/admin/dashboard") || href.startsWith("/admin/profile")) return "dashboard";
  // Non-admin destinations (messages, notifications) are not gated here.
  return null;
}
