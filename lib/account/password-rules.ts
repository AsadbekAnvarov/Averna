/**
 * Password rules for a password change — shared by the form (browser) and the
 * API (server). Pure, no imports: safe in "use client" components.
 */

export const PASSWORD_MIN_CHARS = 8;
/** bcrypt only uses the first 72 bytes of a password — anything longer would be silently cut. */
export const PASSWORD_MAX_BYTES = 72;

/** Why a new password is refused (the form shows each one in the user's language). */
export type PasswordProblem = "too_short" | "too_long" | "letters_digits" | "common" | "same";

/** Passwords that are guessed first — including the demo accounts' published passwords. */
const COMMON = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "12341234",
  "87654321",
  "11111111",
  "00000000",
  "qwerty12",
  "qwerty123",
  "qwertyui",
  "1q2w3e4r",
  "1qaz2wsx",
  "abc12345",
  "abcd1234",
  "iloveyou1",
  "admin123",
  "admin1234",
  "admin12345",
  "teacher123",
  "student123",
  "averna123",
  "averna2024",
  "averna2025",
  "averna2026",
  "parol123",
  "parol1234",
]);

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * The first problem with `next` as a new password, or null when it is fine:
 * at least 8 characters (at most 72 bytes), a letter and a digit, not a
 * common / published password, not the email (or its name part) or the
 * username, and not the current password.
 */
export function passwordProblem(
  next: string,
  ctx: { current?: string | null; email?: string | null; username?: string | null } = {}
): PasswordProblem | null {
  if (next.length < PASSWORD_MIN_CHARS || !next.trim()) return "too_short";
  if (byteLength(next) > PASSWORD_MAX_BYTES) return "too_long";
  if (!/\p{L}/u.test(next) || !/\p{N}/u.test(next)) return "letters_digits";
  const lower = next.toLowerCase();
  const email = (ctx.email ?? "").trim().toLowerCase();
  const personal = [email, email.split("@")[0], (ctx.username ?? "").trim().toLowerCase()].filter((x) => x.length >= 3);
  if (COMMON.has(lower) || personal.includes(lower)) return "common";
  if (ctx.current && next === ctx.current) return "same";
  return null;
}
