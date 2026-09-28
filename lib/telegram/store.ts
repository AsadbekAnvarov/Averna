/**
 * The real dependencies of the webhook router (lib/telegram/webhook.ts): the
 * database-backed BotStore and the Telegram-backed BotApi. SERVER ONLY.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { answerCallbackQuery, editMessageText, sendMessage } from "./api";
import { hashLinkCode } from "./codes";
import { appBaseUrl } from "./config";
import { asLang, displacedNotice, langForRole } from "./messages";
import { markChatsInactive } from "./notify";
import { defaultPrefs } from "./prefs";
import { loadAdminSummary, loadStudentStatus, loadTeacherStatus, loadWeeklyReports } from "./reports";
import type { BotApi, BotDeps, BotStore, ChatInfo, ChatLink, ParentLinkResult, RedeemResult, StatusData, UserLinkResult } from "./webhook";
import { asRole, USER_LINK_ROLE, type CodeKind, type Lang, type UserLinkRole } from "./types";

type LinkRow = {
  id: string;
  role: string;
  userId: string | null;
  studentId: string | null;
  language: string;
  active: boolean;
  user: { name: string | null; email: string } | null;
  student: { user: { name: string | null } | null } | null;
};

/** An account whose link to this chat was just replaced. */
type Displaced = { userId: string; role: UserLinkRole; name: string };

/** One Averna account per chat: another account linked here is unlinked (and reported back as displaced). */
async function linkUserIn(
  tx: Prisma.TransactionClient,
  userId: string,
  chat: ChatInfo,
  now: Date
): Promise<{ link: UserLinkResult; displaced: Displaced[] }> {
  const user: { name: string | null; email: string; role: string } | null = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, role: true },
  });
  if (!user) return { link: { ok: false, reason: "account_missing" }, displaced: [] };
  const role = USER_LINK_ROLE[String(user.role)];
  if (!role) return { link: { ok: false, reason: "parent_account" }, displaced: [] };
  const language = langForRole(role);

  const others = { chatId: chat.id, studentId: null, userId: { not: null }, NOT: { userId } };
  const rows: { userId: string | null; role: string; user: { name: string | null; email: string } | null }[] = await tx.telegramLink.findMany({
    where: others,
    select: { userId: true, role: true, user: { select: { name: true, email: true } } },
  });
  const displaced: Displaced[] = [];
  for (const r of rows) {
    const otherRole = asRole(r.role);
    if (!r.userId || !otherRole || otherRole === "parent") continue;
    displaced.push({ userId: r.userId, role: otherRole, name: r.user?.name?.trim() || r.user?.email || "—" });
  }
  if (rows.length) await tx.telegramLink.deleteMany({ where: others });

  await tx.telegramLink.upsert({
    where: { userId },
    create: {
      chatId: chat.id,
      role,
      userId,
      language,
      username: chat.username,
      firstName: chat.firstName,
      active: true,
      prefs: defaultPrefs(),
      linkedAt: now,
    },
    // Preferences survive re-linking.
    update: { chatId: chat.id, role, language, username: chat.username, firstName: chat.firstName, active: true, linkedAt: now },
  });
  const name = user.name?.trim() || user.email;
  return { link: { ok: true, role, name, language, replaced: displaced.map((d) => d.name) }, displaced };
}

async function linkParentIn(
  tx: Prisma.TransactionClient,
  studentId: string,
  chat: ChatInfo,
  language: Lang,
  now: Date
): Promise<ParentLinkResult> {
  const student: { user: { name: string | null } | null } | null = await tx.student.findUnique({
    where: { id: studentId },
    select: { user: { select: { name: true } } },
  });
  if (!student) return { ok: false, reason: "student_missing" };
  const childName = student.user?.name?.trim() || "—";
  const refresh = { role: "parent", username: chat.username, firstName: chat.firstName, active: true, linkedAt: now };
  const existing: { id: string; language: string } | null = await tx.telegramLink.findFirst({
    where: { chatId: chat.id, studentId },
    select: { id: true, language: true },
  });
  if (existing) {
    await tx.telegramLink.update({ where: { id: existing.id }, data: refresh });
    return { ok: true, childName, language: asLang(existing.language) };
  }
  // A unique violation here (another invite for this child redeemed in this chat at the same moment)
  // rolls the transaction back: the code stays unused, and the next Start finds the link above.
  await tx.telegramLink.create({
    data: { ...refresh, chatId: chat.id, studentId, language, prefs: defaultPrefs() },
  });
  return { ok: true, childName, language };
}

export function createBotStore(): BotStore {
  return {
    async redeemCode({ code, chat, now, parentLanguage }) {
      const hash = hashLinkCode(code);
      let displaced: Displaced[] = [];
      // Claim and link in one transaction: if linking throws, the claim is rolled back too.
      const out: RedeemResult = await db.$transaction(async (tx: Prisma.TransactionClient): Promise<RedeemResult> => {
        const row: { kind: string; userId: string | null; studentId: string | null; expiresAt: Date; usedAt: Date | null } | null =
          await tx.telegramLinkCode.findUnique({
            where: { code: hash },
            select: { kind: true, userId: true, studentId: true, expiresAt: true, usedAt: true },
          });
        if (!row) return { status: "invalid" };
        const kind: CodeKind = row.kind === "parent" ? "parent" : "user";
        const base = { kind, userId: row.userId ?? null, studentId: row.studentId ?? null };
        if (row.usedAt) return { status: "used", ...base };
        if (new Date(row.expiresAt).getTime() <= now.getTime()) return { status: "expired", ...base };
        // Single use even under concurrent /start: only one UPDATE can flip usedAt (a second one
        // waits for this transaction, then finds the code used).
        const won: { count: number } = await tx.telegramLinkCode.updateMany({
          where: { code: hash, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (won.count !== 1) return { status: "used", ...base };
        if (kind === "user") {
          if (!row.userId) return { status: "ok", kind, link: { ok: false, reason: "account_missing" } };
          const r = await linkUserIn(tx, row.userId, chat, now);
          displaced = r.displaced;
          return { status: "ok", kind, link: r.link };
        }
        if (!row.studentId) return { status: "ok", kind, link: { ok: false, reason: "student_missing" } };
        return { status: "ok", kind, link: await linkParentIn(tx, row.studentId, chat, parentLanguage, now) };
      });
      // Committed: an account this chat was taken from hears it in the app (its Telegram link is gone).
      if (out.status === "ok" && out.kind === "user" && out.link.ok) {
        for (const d of displaced) {
          await notifyUser(d.userId, { type: "system", link: "/settings", ...displacedNotice(d.role, out.link.name) });
        }
      }
      return out;
    },

    async chatLinks(chatId) {
      const rows: LinkRow[] = await db.telegramLink.findMany({
        where: { chatId },
        select: {
          id: true,
          role: true,
          userId: true,
          studentId: true,
          language: true,
          active: true,
          user: { select: { name: true, email: true } },
          student: { select: { user: { select: { name: true } } } },
        },
        orderBy: { linkedAt: "asc" },
      });
      const out: ChatLink[] = [];
      for (const r of rows) {
        const role = asRole(r.role);
        if (!role) continue;
        out.push({
          id: r.id,
          role,
          userId: r.userId,
          studentId: r.studentId,
          language: asLang(r.language),
          active: r.active,
          name: (role === "parent" ? r.student?.user?.name : r.user?.name)?.trim() || r.user?.email || "—",
        });
      }
      return out;
    },

    async setChatActive(chatId, active) {
      await db.telegramLink.updateMany({ where: { chatId }, data: { active } });
    },

    async setParentLanguage(chatId, language) {
      await db.telegramLink.updateMany({ where: { chatId, role: "parent" }, data: { language } });
    },

    async removeParentLinks(chatId, studentId) {
      // Always scoped to this chat: a button press can't reach another chat's links.
      await db.telegramLink.deleteMany({ where: { chatId, role: "parent", ...(studentId ? { studentId } : {}) } });
    },

    async status(link, now): Promise<StatusData | null> {
      switch (link.role) {
        case "student": {
          const data = link.userId ? await loadStudentStatus(link.userId, now) : null;
          return data ? { kind: "student", data } : null;
        }
        case "teacher": {
          const data = link.userId ? await loadTeacherStatus(link.userId, now) : null;
          return data ? { kind: "teacher", data } : null;
        }
        case "admin":
          return link.userId ? { kind: "admin", data: await loadAdminSummary(now, link.userId) } : null;
        case "parent": {
          if (!link.studentId) return null;
          const data = (await loadWeeklyReports([link.studentId], now)).get(link.studentId);
          return data ? { kind: "parent", data } : null;
        }
      }
    },
  };
}

export function createBotApi(): BotApi {
  return {
    async send(chatId, text, keyboard) {
      const r = await sendMessage(chatId, text, { keyboard, timeoutMs: 4000 });
      if (!r.ok && r.gone) await markChatsInactive([chatId]);
      return r.ok;
    },
    async edit(chatId, messageId, text, keyboard) {
      const r = await editMessageText(chatId, messageId, text, { keyboard, timeoutMs: 4000 });
      return r.ok;
    },
    async answerCallback(callbackQueryId, text) {
      await answerCallbackQuery(callbackQueryId, text, { timeoutMs: 3000, retries: 0 });
    },
  };
}

export function botDeps(): BotDeps {
  return { store: createBotStore(), api: createBotApi(), now: () => new Date(), appUrl: appBaseUrl() };
}
