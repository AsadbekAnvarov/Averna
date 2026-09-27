/**
 * Shared Telegram types. Pure — client components may `import type` from here.
 */

/** Bot language: students English, teachers / admins Uzbek, parents Uzbek or Russian. */
export type Lang = "uz" | "ru" | "en";
export const LANGS: readonly Lang[] = ["uz", "ru", "en"];

/** TelegramLink.role — "parent" links carry the child's studentId instead of a userId. */
export type LinkRole = "student" | "teacher" | "admin" | "parent";
export type UserLinkRole = Exclude<LinkRole, "parent">;

const LINK_ROLES: readonly LinkRole[] = ["student", "teacher", "admin", "parent"];
export const asRole = (v: unknown): LinkRole | null => (LINK_ROLES.includes(v as LinkRole) ? (v as LinkRole) : null);

/** User.role → link role. PARENT accounts don't link from Settings (parents use teacher invites). */
export const USER_LINK_ROLE: Record<string, UserLinkRole | undefined> = {
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin",
};

/** TelegramLinkCode.kind. */
export type CodeKind = "user" | "parent";

/**
 * Notification preferences stored in TelegramLink.prefs.
 *   homework  — new homework (instant)
 *   reviews   — teacher reviews and grades (instant)
 *   reminders — 19:00 reminders, announcements and other "system" updates
 *   reports   — teachers / admins: the 19:00 daily report; parents: the Sunday report
 */
export type PrefKey = "homework" | "reminders" | "reviews" | "reports";
export type Prefs = Record<PrefKey, boolean>;

export interface InlineButton {
  text: string;
  url?: string;
  callback_data?: string;
}
export type Keyboard = InlineButton[][];

/** GET /api/telegram/link */
export interface TelegramLinkStatus {
  /** Linking works: the bot is configured and this account type links from Settings. */
  available: boolean;
  reason?: "not_configured" | "parent_account";
  linked: boolean;
  /** false after /stop in Telegram or when the user blocked the bot. */
  active: boolean;
  role: LinkRole | null;
  username: string | null;
  firstName: string | null;
  linkedAt: string | null;
  prefs: Prefs;
  /** The toggles that mean something for this account's role. */
  prefKeys: PrefKey[];
  /** https://t.me/<bot> (null when the bot isn't configured). */
  botUrl: string | null;
}

/** POST /api/telegram/link and POST /api/telegram/parent-invite */
export interface TelegramCodeResponse {
  url: string;
  expiresAt: string;
}

/** GET /api/telegram/parent-invite?studentId= */
export interface ParentInviteStatus {
  available: boolean;
  /** Active parent chats linked to this student. */
  linkedParents: number;
}

export type RoleCounts = Record<LinkRole, { active: number; inactive: number }>;

/** GET /api/admin/telegram */
export interface TelegramAdminStatus {
  config: {
    token: boolean;
    /** TELEGRAM_BOT_USERNAME without "@" (null when missing or malformed). */
    username: string | null;
    /** TELEGRAM_WEBHOOK_SECRET is set … */
    secret: boolean;
    /** … and uses only the characters Telegram accepts (16–256 of A–Z a–z 0–9 _ -). */
    secretValid: boolean;
    cronSecret: boolean;
    /** Everything needed for linking and sending is in place. */
    ready: boolean;
    /** Base URL used for "Open in Averna" buttons (null: no https URL known). */
    appUrl: string | null;
  };
  /** getMe (null without a token). */
  bot: { ok: true; id: number; username: string; firstName: string } | { ok: false; error: string } | null;
  /** TELEGRAM_BOT_USERNAME equals the bot's real username (null when unknown). */
  usernameMatches: boolean | null;
  /** getWebhookInfo (null without a token). */
  webhook:
    | {
        ok: true;
        url: string;
        pendingUpdateCount: number;
        lastErrorDate: string | null;
        lastErrorMessage: string | null;
        allowedUpdates: string[] | null;
      }
    | { ok: false; error: string }
    | null;
  /** <this site>/api/telegram/webhook (null when the site isn't served over https). */
  expectedWebhookUrl: string | null;
  counts: RoleCounts;
  /** The signed-in admin's own link (for "Test xabar yuborish"). */
  me: { linked: boolean; active: boolean; username: string | null };
  checkedAt: string;
}
