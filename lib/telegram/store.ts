/**
 * The real dependencies of the webhook router (lib/telegram/webhook.ts): the
 * database-backed BotStore and the Telegram-backed BotApi. SERVER ONLY.
 */

import { db } from "@/lib/db";
import { answerCallbackQuery, editMessageText, sendMessage } from "./api";
import { hashLinkCode } from "./codes";
import { appBaseUrl } from "./config";
import { asLang, langForRole } from "./messages";
import { markChatsInactive } from "./notify";
import { defaultPrefs } from "./prefs";
import { loadAdminSummary, loadStudentStatus, loadTeacherStatus, loadWeeklyReports } from "./reports";
import type { BotApi, BotDeps, BotStore, ChatLink, StatusData } from "./webhook";
import { asRole, USER_LINK_ROLE, type CodeKind } from "./types";

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && (e as { code?: unknown }).code === "P2002";

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

export function createBotStore(): BotStore {
  return {
    async claimCode(code, now) {
      const hash = hashLinkCode(code);
      const row: { kind: string; userId: string | null; studentId: string | null; expiresAt: Date; usedAt: Date | null } | null =
        await db.telegramLinkCode.findUnique({
          where: { code: hash },
          select: { kind: true, userId: true, studentId: true, expiresAt: true, usedAt: true },
        });
      if (!row) return { status: "invalid" };
      const kind: CodeKind = row.kind === "parent" ? "parent" : "user";
      const base = { kind, userId: row.userId ?? null, studentId: row.studentId ?? null };
      if (row.usedAt) return { status: "used", ...base };
      if (new Date(row.expiresAt).getTime() <= now.getTime()) return { status: "expired", ...base };
      // Single use even under concurrent /start: only one UPDATE can flip usedAt.
      const won: { count: number } = await db.telegramLinkCode.updateMany({
        where: { code: hash, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      return { status: won.count === 1 ? "ok" : "used", ...base };
    },

    async releaseCode(code) {
      await db.telegramLinkCode.updateMany({ where: { code: hashLinkCode(code) }, data: { usedAt: null } });
    },

    async linkUser({ userId, chat, now }) {
      const user: { name: string | null; email: string; role: string } | null = await db.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, role: true },
      });
      if (!user) return { ok: false, reason: "account_missing" };
      const role = USER_LINK_ROLE[String(user.role)];
      if (!role) return { ok: false, reason: "parent_account" };
      const language = langForRole(role);
      // One Averna account per chat: another account linked here is unlinked.
      await db.telegramLink.deleteMany({ where: { chatId: chat.id, studentId: null, userId: { not: null }, NOT: { userId } } });
      await db.telegramLink.upsert({
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
      return { ok: true, role, name: user.name?.trim() || user.email, language };
    },

    async linkParent({ studentId, chat, language, now }) {
      const student: { user: { name: string | null } | null } | null = await db.student.findUnique({
        where: { id: studentId },
        select: { user: { select: { name: true } } },
      });
      if (!student) return { ok: false, reason: "student_missing" };
      const childName = student.user?.name?.trim() || "—";
      const refresh = { role: "parent", username: chat.username, firstName: chat.firstName, active: true, linkedAt: now };
      const existing: { id: string; language: string } | null = await db.telegramLink.findFirst({
        where: { chatId: chat.id, studentId },
        select: { id: true, language: true },
      });
      if (existing) {
        await db.telegramLink.update({ where: { id: existing.id }, data: refresh });
        return { ok: true, childName, language: asLang(existing.language) };
      }
      try {
        await db.telegramLink.create({
          data: { ...refresh, chatId: chat.id, studentId, language, prefs: defaultPrefs() },
        });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        // A concurrent /start created it first.
        await db.telegramLink.updateMany({ where: { chatId: chat.id, studentId }, data: refresh });
      }
      return { ok: true, childName, language };
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
