/**
 * Usernames — one per account, unique, usable instead of the email to sign in.
 * Shared by the forms (browser) and the server. Pure, no imports.
 *
 * Stored normalised (lower case, no leading "@"), so "Ali_07", "@ali_07" and
 * "ali_07" are the same name and uniqueness is case-insensitive. 3–30
 * characters: latin letters, digits, "_" and "."; starts with a letter; no
 * ".." and no "." at the end. A username never contains "@", which is how the
 * sign-in form tells it from an email.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export type UsernameProblem = "too_short" | "too_long" | "bad_chars" | "start_letter" | "dots" | "reserved";

/** Names that could pass for the school or its staff — only an admin may take them. */
const RESERVED = new Set([
  "admin", "administrator", "admins", "root", "system", "support", "help", "helpdesk", "info", "contact",
  "averna", "teacher", "teachers", "student", "students", "parent", "parents", "moderator", "mod", "staff",
  "official", "security", "owner", "api", "auth", "login", "signin", "signup", "register", "logout",
  "settings", "profile", "dashboard", "null", "undefined", "me", "bot", "telegram",
]);

/** "  @Ali_07 " → "ali_07". */
export function normalizeUsername(raw: string): string {
  return String(raw ?? "").trim().replace(/^@+/, "").toLowerCase();
}

/** The sign-in field holds an email (something before an "@"), otherwise a username. */
export function looksLikeEmail(login: string): boolean {
  return String(login ?? "").trim().indexOf("@") > 0;
}

/** Why `raw` can't be a username (after normalising), or null. `allowReserved`: admins may take reserved names. */
export function usernameProblem(raw: string, opts: { allowReserved?: boolean } = {}): UsernameProblem | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) return "too_short";
  if (u.length > USERNAME_MAX) return "too_long";
  if (!/^[a-z0-9._]+$/.test(u)) return "bad_chars";
  if (!/^[a-z]/.test(u)) return "start_letter";
  if (u.includes("..") || u.endsWith(".")) return "dots";
  if (!opts.allowReserved && (RESERVED.has(u) || u.startsWith("averna") || u.startsWith("admin"))) return "reserved";
  return null;
}

// ---------------------------------------------------------------------------
// Texts (the student / teacher UI is English, the admin UI Uzbek)
// ---------------------------------------------------------------------------

export type UsernameLang = "en" | "uz";
export type UsernameMessageCode = UsernameProblem | "taken" | "missing" | "server" | "auth" | "too_many";

export const USERNAME_TEXT: Record<UsernameLang, Record<UsernameMessageCode | "available" | "checking" | "rules", string>> = {
  en: {
    available: "Available",
    checking: "Checking…",
    taken: "This username is already taken — choose another.",
    too_short: `At least ${USERNAME_MIN} characters.`,
    too_long: `At most ${USERNAME_MAX} characters.`,
    bad_chars: "Only latin letters (a–z), digits, _ and . are allowed.",
    start_letter: "Start with a letter.",
    dots: "No two dots in a row, and no dot at the end.",
    reserved: "This name is reserved — choose another.",
    missing: "Choose a username.",
    server: "Couldn't check the username. Please try again.",
    auth: "Your session has ended — sign in again.",
    too_many: "Too many attempts — wait a minute and try again.",
    rules: `${USERNAME_MIN}–${USERNAME_MAX} characters: latin letters, digits, _ and . — starting with a letter.`,
  },
  uz: {
    available: "Boʻsh",
    checking: "Tekshirilmoqda…",
    taken: "Bu nom allaqachon band — boshqasini tanlang.",
    too_short: `Kamida ${USERNAME_MIN} ta belgi.`,
    too_long: `Koʻpi bilan ${USERNAME_MAX} ta belgi.`,
    bad_chars: "Faqat lotin harflari (a–z), raqamlar, _ va . ishlatiladi.",
    start_letter: "Harf bilan boshlanishi kerak.",
    dots: "Ikkita nuqta ketma-ket kelmasin va nuqta oxirida turmasin.",
    reserved: "Bu nom tizim uchun ajratilgan — boshqasini tanlang.",
    missing: "Foydalanuvchi nomini kiriting.",
    server: "Nomni tekshirib boʻlmadi. Qayta urinib koʻring.",
    auth: "Seans tugagan — qayta kiring.",
    too_many: "Juda koʻp urinish — bir daqiqadan soʻng qayta urinib koʻring.",
    rules: `${USERNAME_MIN}–${USERNAME_MAX} ta belgi: lotin harflari, raqamlar, _ va . — harf bilan boshlanadi.`,
  },
};
