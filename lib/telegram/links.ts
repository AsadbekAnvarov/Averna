/**
 * Linking Averna accounts to Telegram (Settings) and parent invites (teacher's
 * parent report). SERVER ONLY.
 *
 *   user code   — the signed-in student / teacher / admin, 15 minutes, single use;
 *                 creating one drops the user's older unused codes;
 *   parent code — only a teacher of the student's group or an admin, 7 days,
 *                 single use (one per parent); at most 10 open per student;
 *   parent links — the same staff see who is linked (Telegram name, date,
 *                 paused or not) and can remove a link.
 */

import { db } from "@/lib/db";
import { canReviewStudent, type Viewer } from "@/lib/access";
import { runAfterResponse } from "@/lib/after-response";
import { sendMessage } from "./api";
import { deepLink, hashLinkCode, newLinkCode, PARENT_CODE_TTL_MS, USER_CODE_TTL_MS } from "./codes";
import { botUsername, telegramReady } from "./config";
import { asLang, parentRemovedText, tr } from "./messages";
import { patchPrefs, readPrefs, ROLE_PREF_KEYS } from "./prefs";
import {
  asRole,
  USER_LINK_ROLE,
  type ParentInviteStatus,
  type ParentLinkInfo,
  type Prefs,
  type TelegramCodeResponse,
  type TelegramLinkStatus,
} from "./types";

export type Fail = { ok: false; status: number; code: string; error: string };
const fail = (status: number, code: string, error: string): Fail => ({ ok: false, status, code, error });

const NOT_CONFIGURED = "Telegram notifications are not available yet.";
const MAX_OPEN_INVITES = 10;

export async function getLinkStatus(user: Viewer): Promise<TelegramLinkStatus> {
  const accountRole = USER_LINK_ROLE[String(user.role ?? "")] ?? null;
  const ready = telegramReady();
  const username = botUsername();
  const link: { role: string; active: boolean; username: string | null; firstName: string | null; prefs: unknown; linkedAt: Date } | null =
    ready
      ? await db.telegramLink.findUnique({
          where: { userId: user.id },
          select: { role: true, active: true, username: true, firstName: true, prefs: true, linkedAt: true },
        })
      : null;
  const role = (link ? asRole(link.role) : null) ?? accountRole;
  return {
    available: ready && !!accountRole,
    ...(!ready ? { reason: "not_configured" as const } : !accountRole ? { reason: "parent_account" as const } : {}),
    linked: !!link,
    active: !!link?.active,
    role,
    username: link?.username ?? null,
    firstName: link?.firstName ?? null,
    linkedAt: link ? new Date(link.linkedAt).toISOString() : null,
    prefs: readPrefs(link?.prefs),
    prefKeys: role ? ROLE_PREF_KEYS[role] : [],
    botUrl: ready && username ? `https://t.me/${encodeURIComponent(username)}` : null,
  };
}

/** A fresh deep link for the signed-in user. */
export async function createUserLinkCode(user: Viewer, now: Date = new Date()): Promise<({ ok: true } & TelegramCodeResponse) | Fail> {
  const username = botUsername();
  if (!telegramReady() || !username) return fail(503, "not_configured", NOT_CONFIGURED);
  if (!USER_LINK_ROLE[String(user.role ?? "")]) {
    return fail(403, "parent_account", "Parents connect with an invite link from their child's teacher.");
  }
  const code = newLinkCode();
  const expiresAt = new Date(now.getTime() + USER_CODE_TTL_MS);
  await db.telegramLinkCode.deleteMany({ where: { kind: "user", userId: user.id, usedAt: null } });
  await db.telegramLinkCode.create({
    data: { code: hashLinkCode(code), kind: "user", userId: user.id, createdById: user.id, expiresAt },
  });
  return { ok: true, url: deepLink(username, code), expiresAt: expiresAt.toISOString() };
}

/** Disconnect the user's chat (and say goodbye there, best effort). */
export async function unlinkUser(userId: string): Promise<void> {
  const link: { chatId: string; language: string; active: boolean } | null = await db.telegramLink.findUnique({
    where: { userId },
    select: { chatId: true, language: true, active: true },
  });
  await db.telegramLink.deleteMany({ where: { userId } });
  await db.telegramLinkCode.deleteMany({ where: { kind: "user", userId, usedAt: null } });
  if (link?.active && telegramReady()) {
    await sendMessage(link.chatId, tr(link.language).disconnected, { timeoutMs: 2500, retries: 0 });
  }
}

export async function updateUserPrefs(userId: string, body: unknown): Promise<{ ok: true; prefs: Prefs } | Fail> {
  const link: { id: string; prefs: unknown } | null = await db.telegramLink.findUnique({
    where: { userId },
    select: { id: true, prefs: true },
  });
  if (!link) return fail(404, "not_linked", "Telegram isn't connected to your account.");
  const next = patchPrefs(readPrefs(link.prefs), body);
  if (!next) return fail(400, "invalid", "Nothing to change.");
  await db.telegramLink.update({ where: { id: link.id }, data: { prefs: next } });
  return { ok: true, prefs: next };
}

const validStudentId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
const FORBIDDEN = "You can only invite parents of students in your groups.";

/** The student's parent links (who pressed Start, when, paused or not) — listed even while the bot is off, so they can be removed. */
export async function parentInviteStatus(viewer: Viewer, studentId: unknown): Promise<({ ok: true } & ParentInviteStatus) | Fail> {
  if (!validStudentId(studentId)) return fail(400, "invalid", "Choose a student.");
  if (!(await canReviewStudent(viewer, studentId))) return fail(403, "forbidden", FORBIDDEN);
  const rows: { id: string; firstName: string | null; username: string | null; linkedAt: Date; active: boolean }[] =
    await db.telegramLink.findMany({
      where: { studentId, role: "parent" },
      select: { id: true, firstName: true, username: true, linkedAt: true, active: true },
      orderBy: { linkedAt: "asc" },
    });
  const parents: ParentLinkInfo[] = rows.map((r) => ({
    id: r.id,
    firstName: r.firstName ?? null,
    username: r.username ?? null,
    linkedAt: new Date(r.linkedAt).toISOString(),
    active: !!r.active,
  }));
  return { ok: true, available: telegramReady(), linkedParents: parents.filter((p) => p.active).length, parents };
}

const validLinkId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);

/**
 * Remove one parent link of this student (a mis-sent invite taken by the wrong
 * chat …). Same rule as invites: a teacher of the student's group or an admin.
 * The chat is told (best effort, after the response).
 */
export async function removeParentLink(viewer: Viewer, studentId: unknown, linkId: unknown): Promise<{ ok: true } | Fail> {
  if (!validStudentId(studentId) || !validLinkId(linkId)) return fail(400, "invalid", "Choose a parent connection to remove.");
  if (!(await canReviewStudent(viewer, studentId))) {
    return fail(403, "forbidden", "You can only manage parents of students in your groups.");
  }
  const link: { id: string; chatId: string; language: string; active: boolean; student: { user: { name: string | null } | null } | null } | null =
    await db.telegramLink.findFirst({
      where: { id: linkId, studentId, role: "parent" },
      select: { id: true, chatId: true, language: true, active: true, student: { select: { user: { select: { name: true } } } } },
    });
  if (!link) return fail(404, "not_found", "This parent connection no longer exists.");
  // The link must belong to this student — checked again by the delete itself.
  await db.telegramLink.deleteMany({ where: { id: link.id, studentId, role: "parent" } });
  if (link.active && telegramReady()) {
    const text = parentRemovedText(asLang(link.language), link.student?.user?.name?.trim() || "—");
    void runAfterResponse("Telegram parent goodbye", () => sendMessage(link.chatId, text, { timeoutMs: 2500, retries: 0 }));
  }
  return { ok: true };
}

/** A 7-day, single-use invite for one parent of this student. Teacher of the student's group or admin only. */
export async function createParentInvite(
  viewer: Viewer,
  studentId: unknown,
  now: Date = new Date()
): Promise<({ ok: true; studentName: string } & TelegramCodeResponse) | Fail> {
  if (!validStudentId(studentId)) return fail(400, "invalid", "Choose a student.");
  if (!(await canReviewStudent(viewer, studentId))) return fail(403, "forbidden", FORBIDDEN);
  const username = botUsername();
  if (!telegramReady() || !username) {
    return fail(503, "not_configured", "Telegram isn't set up yet — an admin can connect the bot in Admin → Telegram.");
  }
  const student: { user: { name: string | null } | null } | null = await db.student.findUnique({
    where: { id: studentId },
    select: { user: { select: { name: true } } },
  });
  if (!student) return fail(404, "not_found", "Student not found.");

  await db.telegramLinkCode.deleteMany({ where: { kind: "parent", studentId, usedAt: null, expiresAt: { lt: now } } });
  const open: { code: string }[] = await db.telegramLinkCode.findMany({
    where: { kind: "parent", studentId, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  if (open.length >= MAX_OPEN_INVITES) {
    await db.telegramLinkCode.deleteMany({ where: { code: { in: open.slice(MAX_OPEN_INVITES - 1).map((o) => o.code) } } });
  }
  const code = newLinkCode();
  const expiresAt = new Date(now.getTime() + PARENT_CODE_TTL_MS);
  await db.telegramLinkCode.create({
    data: { code: hashLinkCode(code), kind: "parent", studentId, createdById: viewer.id, expiresAt },
  });
  return {
    ok: true,
    url: deepLink(username, code),
    expiresAt: expiresAt.toISOString(),
    studentName: student.user?.name?.trim() || "Student",
  };
}

/** Housekeeping for the daily job: every code (used or not) a day after it expired. */
export async function purgeOldCodes(now: Date = new Date()): Promise<number> {
  try {
    const r: { count: number } = await db.telegramLinkCode.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
    });
    return r.count;
  } catch (e) {
    console.error("Telegram: purging old link codes failed:", e);
    return 0;
  }
}
