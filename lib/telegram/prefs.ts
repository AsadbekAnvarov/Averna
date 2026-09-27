/**
 * Telegram notification preferences (TelegramLink.prefs). Pure — safe to import
 * from client components.
 */

import type { LinkRole, PrefKey, Prefs } from "./types";

export const PREF_KEYS: readonly PrefKey[] = ["homework", "reviews", "reminders", "reports"];

/** The toggles that mean something for each role (Settings shows only these). */
export const ROLE_PREF_KEYS: Record<LinkRole, PrefKey[]> = {
  student: ["homework", "reviews", "reminders"],
  teacher: ["reports", "reminders"],
  admin: ["reports", "reminders"],
  parent: ["reports"],
};

/** Everything on — a new link receives every message meant for its role. */
export function defaultPrefs(): Prefs {
  return { homework: true, reviews: true, reminders: true, reports: true };
}

/** Stored JSON → full preferences (missing or malformed keys fall back to on). */
export function readPrefs(raw: unknown): Prefs {
  const out = defaultPrefs();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    for (const k of PREF_KEYS) if (typeof rec[k] === "boolean") out[k] = rec[k] as boolean;
  }
  return out;
}

/**
 * Apply a PATCH body — `{ prefs: { homework: false } }` or `{ homework: false }`.
 * Only known keys with boolean values count; null when the body changes nothing valid.
 */
export function patchPrefs(current: Prefs, body: unknown): Prefs | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const rec = body as Record<string, unknown>;
  const src = rec.prefs && typeof rec.prefs === "object" && !Array.isArray(rec.prefs) ? (rec.prefs as Record<string, unknown>) : rec;
  const next: Prefs = { ...current };
  let touched = false;
  for (const k of PREF_KEYS) {
    if (typeof src[k] === "boolean") {
      next[k] = src[k] as boolean;
      touched = true;
    }
  }
  return touched ? next : null;
}

/**
 * The preference that sends an in-app notification type to Telegram too.
 * null = that type stays in-app only (direct messages, 1-on-1 bookings).
 */
export function prefForNotificationType(type: string | null | undefined): PrefKey | null {
  switch ((type ?? "system").trim().toLowerCase()) {
    case "homework":
      return "homework";
    case "grade":
    case "review":
      return "reviews";
    case "system":
      return "reminders";
    default:
      return null;
  }
}
