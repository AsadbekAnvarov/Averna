/**
 * Sessions end when the password changes.
 *
 * Sessions are JWTs (lib/auth.config.ts), so nothing is stored per session.
 * Each token carries the passwordChangedAt of the account row whose password
 * it verified at sign-in (`pwdAt`, ms; 0 = never changed — lib/auth.ts). The
 * token stays valid only while the database value is still that one: after a
 * change every earlier session ends, on every device, including one that
 * signed in with the old password a moment before the change (it read the old
 * value). No clocks are compared. A deleted account's sessions end too. Tokens
 * from before this existed have no `pwdAt` and count as 0: they keep working
 * until the user first changes the password.
 *
 * Checked by the Node-side jwt callback (lib/auth.ts), i.e. on every auth() /
 * useSession() — cached per user for CHECK_TTL_MS on each instance. The Edge
 * middleware can't read the database; there the page or route behind it gets
 * no session and sends the user to sign in.
 *
 * Fails open: when the database can't be read (an outage) the session is
 * kept, never signed out by accident. SERVER ONLY.
 */

import { db } from "@/lib/db";

/** How long one instance trusts its last look at a user's passwordChangedAt. */
const CHECK_TTL_MS = 30_000;
const CACHE_MAX = 5_000;

type Entry = { changedAt: number; missing: boolean; at: number };
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

/** A passwordChangedAt as the token stores it (ms; 0 = never changed). */
export function passwordStamp(d: Date | string | number | null | undefined): number {
  if (d == null) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** The password was just changed: this instance stops accepting older sessions at once. */
export function markPasswordChanged(userId: string, at: Date): void {
  remember(userId, { changedAt: passwordStamp(at), missing: false, at: Date.now() });
}

async function lookup(userId: string, now: number): Promise<Entry | null> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < CHECK_TTL_MS) return hit;
  try {
    const row: { passwordChangedAt: Date | null } | null = await db.user.findUnique({
      where: { id: userId },
      select: { passwordChangedAt: true },
    });
    const entry: Entry = row ? { changedAt: passwordStamp(row.passwordChangedAt), missing: false, at: now } : { changedAt: 0, missing: true, at: now };
    remember(userId, entry);
    return entry;
  } catch (e) {
    console.error("Session check skipped (database unavailable):", e instanceof Error ? e.message : e);
    return null;
  }
}

/** False when the password changed since the token was issued, or the account is gone. Never throws. */
export async function sessionStillValid(token: { id?: unknown; sub?: unknown; pwdAt?: unknown } | null | undefined): Promise<boolean> {
  try {
    const raw = token?.id ?? token?.sub;
    const userId = typeof raw === "string" ? raw : "";
    if (!userId) return true;
    const entry = await lookup(userId, Date.now());
    if (!entry) return true;
    if (entry.missing) return false;
    const pwdAt = typeof token?.pwdAt === "number" && Number.isFinite(token.pwdAt) ? token.pwdAt : 0;
    return entry.changedAt <= pwdAt;
  } catch {
    return true;
  }
}

/** Tests only. */
export function resetSessionGuard(): void {
  cache.clear();
}
