/**
 * Changing your own password (POST /api/account/password). SERVER ONLY.
 *
 * The current password is required, and wrong guesses are limited (5 per 15
 * minutes per account on each instance). The new password follows
 * ./password-rules. On success the hash and User.passwordChangedAt are
 * written together, which ends every session signed in before now
 * (./session-guard) — the form then signs the user out, and they sign in with
 * the new password.
 */

import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { passwordProblem, type PasswordProblem } from "./password-rules";
import { markPasswordChanged } from "./session-guard";

export type ChangePasswordError = PasswordProblem | "missing" | "wrong_current" | "too_many" | "not_found" | "server";

export type ChangePasswordResult = { ok: true } | { ok: false; status: number; code: ChangePasswordError };

const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60_000;
const fails = new Map<string, number[]>();

function recentFails(userId: string, now: number): number[] {
  const list = (fails.get(userId) ?? []).filter((t) => now - t < FAIL_WINDOW_MS);
  if (list.length) fails.set(userId, list);
  else fails.delete(userId);
  return list;
}

function recordFail(userId: string, now: number): void {
  fails.set(userId, [...recentFails(userId, now), now]);
  if (fails.size > 5000) {
    const oldest = fails.keys().next().value;
    if (oldest !== undefined) fails.delete(oldest);
  }
}

const refuse = (status: number, code: ChangePasswordError): ChangePasswordResult => ({ ok: false, status, code });

export async function changePassword(userId: string, currentRaw: unknown, nextRaw: unknown): Promise<ChangePasswordResult> {
  const current = typeof currentRaw === "string" ? currentRaw : "";
  const next = typeof nextRaw === "string" ? nextRaw : "";
  if (!userId || !current || !next) return refuse(400, "missing");

  const now = Date.now();
  if (recentFails(userId, now).length >= MAX_FAILS) return refuse(429, "too_many");

  try {
    const user: { password: string | null; email: string; username?: string | null } | null = await db.user.findUnique({
      where: { id: userId },
      select: { password: true, email: true },
    });
    if (!user || !user.password) return refuse(404, "not_found");

    // Rules that don't need the current password first (nothing is revealed by them).
    const early = passwordProblem(next, { email: user.email });
    if (early) return refuse(400, early);

    if (!(await compare(current, user.password))) {
      recordFail(userId, now);
      return refuse(400, "wrong_current");
    }
    if (next === current) return refuse(400, "same");

    const changedAt = new Date();
    await db.user.update({
      where: { id: userId },
      data: { password: await hash(next, 12), passwordChangedAt: changedAt },
    });
    markPasswordChanged(userId, changedAt);
    fails.delete(userId);
    return { ok: true };
  } catch (e) {
    console.error("Password change failed:", e);
    return refuse(500, "server");
  }
}
