/**
 * Changing your own password (POST /api/account/password). SERVER ONLY.
 *
 * The current password is required, and wrong guesses are limited (5 per 15
 * minutes per account on each instance — an attempt is counted before its
 * checks run, so parallel guesses can't slip past). The new password follows
 * ./password-rules. On success the hash and User.passwordChangedAt are written
 * together, which ends every session issued for the old password
 * (./session-guard) — the form then signs the user out, and they sign in with
 * the new password.
 */

import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { passwordProblem, type PasswordProblem } from "./password-rules";
import { markPasswordChanged, passwordStamp } from "./session-guard";

export type ChangePasswordError = PasswordProblem | "missing" | "wrong_current" | "too_many" | "not_found" | "server";

export type ChangePasswordResult = { ok: true } | { ok: false; status: number; code: ChangePasswordError };

const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60_000;
/** Per account: times of wrong guesses, and of attempts still being checked. */
const attempts = new Map<string, number[]>();

function recent(userId: string, now: number): number[] {
  const list = (attempts.get(userId) ?? []).filter((t) => now - t < FAIL_WINDOW_MS);
  if (list.length) attempts.set(userId, list);
  else attempts.delete(userId);
  return list;
}

/** Count this attempt now (synchronously, before any await). Returns the slot to release if it wasn't a wrong guess. */
function reserve(userId: string, now: number): number {
  attempts.set(userId, [...recent(userId, now), now]);
  if (attempts.size > 5000) {
    const oldest = attempts.keys().next().value;
    if (oldest !== undefined && oldest !== userId) attempts.delete(oldest);
  }
  return now;
}

function release(userId: string, slot: number): void {
  const list = attempts.get(userId);
  if (!list) return;
  const i = list.indexOf(slot);
  if (i >= 0) list.splice(i, 1);
  if (!list.length) attempts.delete(userId);
}

const refuse = (status: number, code: ChangePasswordError): ChangePasswordResult => ({ ok: false, status, code });

export async function changePassword(userId: string, currentRaw: unknown, nextRaw: unknown): Promise<ChangePasswordResult> {
  const current = typeof currentRaw === "string" ? currentRaw : "";
  const next = typeof nextRaw === "string" ? nextRaw : "";
  if (!userId || !current || !next) return refuse(400, "missing");

  const now = Date.now();
  if (recent(userId, now).length >= MAX_FAILS) return refuse(429, "too_many");
  const slot = reserve(userId, now);
  let wrongGuess = false;

  try {
    const user: { password: string | null; email: string; username: string | null; passwordChangedAt: Date | null } | null =
      await db.user.findUnique({
        where: { id: userId },
        select: { password: true, email: true, username: true, passwordChangedAt: true },
      });
    if (!user || !user.password) return refuse(404, "not_found");

    // Rules that don't need the current password first (nothing is revealed by them).
    const early = passwordProblem(next, { email: user.email, username: user.username });
    if (early) return refuse(400, early);

    if (!(await compare(current, user.password))) {
      wrongGuess = true;
      return refuse(400, "wrong_current");
    }
    if (next === current) return refuse(400, "same");

    const newHash = await hash(next, 12);
    // Stamped after hashing, right before the write (the session guard compares stamps, not
    // clocks) — always later than the previous stamp, so a new change never looks like the old one.
    const changedAt = new Date(Math.max(Date.now(), passwordStamp(user.passwordChangedAt) + 1));
    await db.user.update({ where: { id: userId }, data: { password: newHash, passwordChangedAt: changedAt } });
    markPasswordChanged(userId, changedAt);
    attempts.delete(userId);
    return { ok: true };
  } catch (e) {
    console.error("Password change failed:", e);
    return refuse(500, "server");
  } finally {
    if (!wrongGuess) release(userId, slot);
  }
}
