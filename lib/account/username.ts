/**
 * Usernames on the server: availability, setting your own, and telling a
 * taken username from a taken email in Prisma's unique-violation error.
 * Rules: ./username-rules. SERVER ONLY.
 */

import { db } from "@/lib/db";
import { normalizeUsername, usernameProblem, type UsernameProblem } from "./username-rules";

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; username: string; code: UsernameProblem | "taken" | "missing" | "server" };

/** P2002 (unique constraint) on the given column — Prisma reports the fields, or the index name. */
export function isUniqueViolationOn(e: unknown, field: string): boolean {
  const err = e as { code?: unknown; meta?: { target?: unknown } } | null;
  if (err?.code !== "P2002") return false;
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.some((t) => String(t).includes(field));
  return typeof target === "string" ? target.includes(field) : false;
}

/**
 * Can `raw` be this user's username? Checks the rules, then whether another
 * account has it (the user's own current username counts as free).
 */
export async function checkUsername(raw: unknown, opts: { userId?: string | null; allowReserved?: boolean } = {}): Promise<UsernameCheck> {
  const username = normalizeUsername(typeof raw === "string" ? raw : "");
  if (!username) return { ok: false, username, code: "missing" };
  const problem = usernameProblem(username, { allowReserved: opts.allowReserved });
  if (problem) return { ok: false, username, code: problem };
  try {
    const row: { id: string } | null = await db.user.findUnique({ where: { username }, select: { id: true } });
    if (row && row.id !== opts.userId) return { ok: false, username, code: "taken" };
    return { ok: true, username };
  } catch (e) {
    console.error("Username check failed:", e);
    return { ok: false, username, code: "server" };
  }
}

export type SetUsernameResult =
  | { ok: true; username: string }
  | { ok: false; status: number; code: UsernameProblem | "taken" | "missing" | "server" };

/** Set (or change) the signed-in user's own username. Admins may take reserved names. */
export async function setOwnUsername(userId: string, raw: unknown, role: string | null | undefined): Promise<SetUsernameResult> {
  const check = await checkUsername(raw, { userId, allowReserved: role === "ADMIN" });
  if (!check.ok) return { ok: false, status: check.code === "server" ? 500 : check.code === "taken" ? 409 : 400, code: check.code };
  try {
    await db.user.update({ where: { id: userId }, data: { username: check.username } });
    return { ok: true, username: check.username };
  } catch (e) {
    // Another account took it between the check and the write.
    if (isUniqueViolationOn(e, "username")) return { ok: false, status: 409, code: "taken" };
    console.error("Setting the username failed:", e);
    return { ok: false, status: 500, code: "server" };
  }
}

/** The user's current username (null when none, or on a database error). */
export async function usernameOf(userId: string): Promise<string | null> {
  try {
    const row: { username: string | null } | null = await db.user.findUnique({ where: { id: userId }, select: { username: true } });
    return row?.username ?? null;
  } catch {
    return null;
  }
}
