/**
 * Sessions end when the password changes.
 *
 * Sessions are JWTs (lib/auth.config.ts), so nothing is stored per session.
 * Each token remembers when its user signed in (`loginAt`, set in lib/auth.ts);
 * a token issued before the user's last password change
 * (User.passwordChangedAt) is no longer accepted — on every device, including
 * one that signed in with the old password. A deleted account's sessions end
 * too. Tokens from before this existed have no `loginAt` and count as
 * "signed in at 0": they keep working until the user changes the password.
 *
 * Checked by the Node-side jwt callback (lib/auth.ts), i.e. on every auth() /
 * useSession() — cached per user for CHECK_TTL_MS on each instance. The Edge
 * middleware can't read the database; there the page or route behind it gets
 * no session and sends the user to sign in.
 *
 * Fails open: when the database can't be read (outage, column not created
 * yet) the session is kept, never signed out by accident. SERVER ONLY.
 */

import { db } from "@/lib/db";

/** How long one instance trusts its last look at a user's passwordChangedAt. */
const CHECK_TTL_MS = 30_000;
const CACHE_MAX = 5_000;
/** Clock differences between server instances (a fresh sign-in right after a change must count). */
const CLOCK_SLACK_MS = 1_000;

type Entry = { changedAt: number | null; missing: boolean; at: number };
const cache = new Map<string, Entry>();

function remember(userId: string, entry: Entry): void {
  cache.delete(userId);
  cache.set(userId, entry);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** The password was just changed: this instance stops accepting older sessions at once. */
export function markPasswordChanged(userId: string, at: Date): void {
  remember(userId, { changedAt: at.getTime(), missing: false, at: Date.now() });
}

async function lookup(userId: string, now: number): Promise<Entry | null> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < CHECK_TTL_MS) return hit;
  try {
    const row: { passwordChangedAt: Date | null } | null = await db.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true },
    });
    const entry: Entry = row
      ? { changedAt: row.passwordChangedAt ? new Date(row.passwordChangedAt).getTime() : null, missing: false, at: now }
      : { changedAt: null, missing: true, at: now };
    remember(userId, entry);
    return entry;
  } catch (e) {
    console.error("Session check skipped (database unavailable):", e instanceof Error ? e.message : e);
    return null;
  }
}

/** False when the token was issued before the user's last password change, or the account is gone. Never throws. */
export async function sessionStillValid(token: { id?: unknown; sub?: unknown; loginAt?: unknown } | null | undefined): Promise<boolean> {
  try {
    const raw = token?.id ?? token?.sub;
    const userId = typeof raw === "string" ? raw : "";
    if (!userId) return true;
    const now = Date.now();
    const entry = await lookup(userId, now);
    if (!entry) return true;
    if (entry.missing) return false;
    if (entry.changedAt == null) return true;
    const loginAt = typeof token?.loginAt === "number" && Number.isFinite(token.loginAt) ? token.loginAt : 0;
    return entry.changedAt - loginAt <= CLOCK_SLACK_MS;
  } catch {
    return true;
  }
}

/** Tests only. */
export function resetSessionGuard(): void {
  cache.clear();
}
