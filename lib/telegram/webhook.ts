/**
 * The Averna bot's update router. Pure logic over injected dependencies —
 * `store` (the database) and `api` (Telegram) — so it runs offline with fakes;
 * lib/telegram/store.ts provides the real ones.
 *
 *   /start <code>  link this chat: a user code → the Averna account (role from
 *                  User.role; English for students, Uzbek otherwise); a parent
 *                  invite → the child, then Oʻzbekcha / Русский buttons
 *   /start         already linked: who is linked here (and resume after /stop);
 *                  otherwise how to link
 *   /status        student: streak + next homework · teacher: homework due +
 *                  reviews waiting · admin: today so far · parent: the child's week
 *   /lang          parents: pick Uzbek or Russian again
 *   /stop          pause every notification to this chat (/start resumes)
 *   /help          commands
 *
 * Private chats only — reports never go to groups. Never throws.
 */

import { isLinkCode } from "./codes";
import { appLink } from "./config";
import {
  adminSummaryText,
  chooseLanguageText,
  connectedText,
  guessLang,
  helpText,
  joinLines,
  languageKeyboard,
  linkedText,
  notLinkedText,
  openAppKeyboard,
  parentLang,
  parentWelcomeText,
  studentStatusText,
  teacherStatusText,
  tr,
  weeklyReportText,
} from "./messages";
import type { AdminSummary, StudentStatus, TeacherStatus, WeeklyReport } from "./builders";
import type { CodeKind, Keyboard, Lang, LinkRole, UserLinkRole } from "./types";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface ChatInfo {
  id: string;
  username: string | null;
  firstName: string | null;
  /** Telegram's language_code of the sender. */
  languageCode: string | null;
}

export type ClaimResult =
  | { status: "ok" | "used" | "expired"; kind: CodeKind; userId: string | null; studentId: string | null }
  | { status: "invalid" };

export type UserLinkResult =
  | { ok: true; role: UserLinkRole; name: string; language: Lang }
  | { ok: false; reason: "account_missing" | "parent_account" };

export type ParentLinkResult = { ok: true; childName: string; language: Lang } | { ok: false; reason: "student_missing" };

export interface ChatLink {
  id: string;
  role: LinkRole;
  userId: string | null;
  studentId: string | null;
  language: Lang;
  active: boolean;
  /** The user's name, or the child's name for a parent link. */
  name: string;
}

export type StatusData =
  | { kind: "student"; data: StudentStatus }
  | { kind: "teacher"; data: TeacherStatus }
  | { kind: "admin"; data: AdminSummary }
  | { kind: "parent"; data: WeeklyReport };

export interface BotStore {
  /** Atomically mark an unused, unexpired code as used ("ok"), or say why not. */
  claimCode(code: string, now: Date): Promise<ClaimResult>;
  /** Undo a claim when linking failed afterwards. */
  releaseCode(code: string): Promise<void>;
  linkUser(input: { userId: string; chat: ChatInfo; now: Date }): Promise<UserLinkResult>;
  linkParent(input: { studentId: string; chat: ChatInfo; language: Lang; now: Date }): Promise<ParentLinkResult>;
  /** Every link of this chat, active or not. */
  chatLinks(chatId: string): Promise<ChatLink[]>;
  setChatActive(chatId: string, active: boolean): Promise<void>;
  setParentLanguage(chatId: string, language: Lang): Promise<void>;
  status(link: ChatLink, now: Date): Promise<StatusData | null>;
}

export interface BotApi {
  send(chatId: string, text: string, keyboard?: Keyboard): Promise<boolean>;
  edit(chatId: string, messageId: number, text: string, keyboard?: Keyboard): Promise<boolean>;
  answerCallback(callbackQueryId: string, text?: string): Promise<void>;
}

export interface BotDeps {
  store: BotStore;
  api: BotApi;
  now?: () => Date;
  /** Public app URL for "Open in Averna" buttons (null: no buttons). */
  appUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

type Rec = Record<string, unknown>;
const asRec = (x: unknown): Rec | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as Rec) : null);
const str = (x: unknown): string | null => (typeof x === "string" && x.trim() ? x.trim() : null);
/** Chat ids are numbers (up to 52 bits) — kept as text. */
const idOf = (x: unknown): string | null =>
  typeof x === "number" && Number.isSafeInteger(x) ? String(x) : typeof x === "string" && /^-?\d{1,20}$/.test(x) ? x : null;

export interface Command {
  name: string;
  /** "/cmd@SomeBot" — the addressed bot. */
  bot: string | null;
  args: string[];
}

/** "/start abc" → { name: "start", args: ["abc"] }; null for plain text. */
export function parseCommand(text: string): Command | null {
  const m = /^\/([A-Za-z0-9_]{1,32})(?:@([A-Za-z0-9_]{3,64}))?(?:\s+([\s\S]*))?$/.exec(text.trim());
  if (!m) return null;
  return { name: m[1].toLowerCase(), bot: m[2] ?? null, args: (m[3] ?? "").trim().split(/\s+/).filter(Boolean) };
}

const HOME_PATH: Record<LinkRole, string | null> = {
  student: "/dashboard",
  teacher: "/teacher/dashboard",
  admin: "/admin/dashboard",
  parent: null,
};
const STATUS_PATH: Record<LinkRole, string | null> = {
  student: "/homework",
  teacher: "/teacher/reviews",
  admin: "/admin/dashboard",
  parent: null,
};

/** The chat's language: its account link's, else its first parent link's, else a guess. */
function chatLang(links: ChatLink[], chat: ChatInfo): Lang {
  return links.find((l) => l.role !== "parent")?.language ?? links[0]?.language ?? guessLang(chat.languageCode);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/** Handle one Telegram update. Never throws. */
export async function handleUpdate(update: unknown, deps: BotDeps): Promise<void> {
  try {
    const u = asRec(update);
    if (!u) return;
    const cq = asRec(u.callback_query);
    if (cq) return await onCallback(cq, deps);
    const msg = asRec(u.message);
    if (msg) return await onMessage(msg, deps);
  } catch (e) {
    console.error("Telegram update failed:", e);
  }
}

async function onMessage(msg: Rec, deps: BotDeps): Promise<void> {
  const chatRec = asRec(msg.chat);
  const chatId = idOf(chatRec?.id);
  if (!chatRec || !chatId) return;
  const from = asRec(msg.from);
  if (from?.is_bot === true) return;
  const chat: ChatInfo = {
    id: chatId,
    username: str(from?.username),
    firstName: str(from?.first_name),
    languageCode: str(from?.language_code),
  };
  const cmd = parseCommand(typeof msg.text === "string" ? msg.text : "");
  const payload = cmd?.args[0] ?? "";
  const send = (text: string, keyboard?: Keyboard) => deps.api.send(chatId, text, keyboard);

  if (chatRec.type !== "private") {
    // Links and reports are personal: never in groups or channels.
    if (cmd?.name === "start") await send(tr(guessLang(chat.languageCode)).privateOnly);
    return;
  }

  const now = deps.now?.() ?? new Date();
  try {
    switch (cmd?.name) {
      case "start":
        return payload ? await startWithCode(payload, chat, deps, now) : await startPlain(chat, deps);
      case "help":
        return await help(chat, deps);
      case "status":
        return await status(chat, deps, now);
      case "lang":
      case "language":
        return await language(chat, deps);
      case "stop":
        return await stop(chat, deps);
      default:
        return await unknownInput(chat, deps);
    }
  } catch (e) {
    console.error(`Telegram /${cmd?.name ?? "text"} failed:`, e);
    await send(tr(guessLang(chat.languageCode)).failed).catch(() => false);
  }
}

async function startWithCode(code: string, chat: ChatInfo, deps: BotDeps, now: Date): Promise<void> {
  const { store, api } = deps;
  const guess = guessLang(chat.languageCode);
  const send = (text: string, keyboard?: Keyboard) => api.send(chat.id, text, keyboard);
  if (!isLinkCode(code)) {
    await send(tr(guess).codeInvalid);
    return;
  }

  const claim = await store.claimCode(code, now);
  if (claim.status === "invalid") {
    await send(tr(guess).codeInvalid);
    return;
  }
  if (claim.status === "expired") {
    await send(tr(claim.kind === "parent" ? parentLang(chat.languageCode) : guess).codeExpired(claim.kind));
    return;
  }
  if (claim.status === "used") {
    // A second tap on Start (or a redelivered update) for a code this chat already redeemed.
    const links = await store.chatLinks(chat.id);
    const mine = links.find((l) => (claim.kind === "user" ? !!claim.userId && l.userId === claim.userId : !!claim.studentId && l.studentId === claim.studentId));
    if (!mine) {
      await send(tr(claim.kind === "parent" ? parentLang(chat.languageCode) : guess).codeUsed(claim.kind));
      return;
    }
    if (mine.role === "parent") {
      const parents = links.filter((l) => l.role === "parent").map((l) => l.name);
      await send(parentWelcomeText(mine.language, parents));
    } else {
      await send(linkedText(mine.language, mine.role, mine.name), openAppKeyboard(mine.language, appLink(HOME_PATH[mine.role], deps.appUrl ?? null)));
    }
    return;
  }

  try {
    if (claim.kind === "user") {
      const r = claim.userId ? await store.linkUser({ userId: claim.userId, chat, now }) : ({ ok: false, reason: "account_missing" } as const);
      if (!r.ok) {
        await send(r.reason === "parent_account" ? tr(guess).parentAccount : tr(guess).accountMissing);
        return;
      }
      await send(linkedText(r.language, r.role, r.name), openAppKeyboard(r.language, appLink(HOME_PATH[r.role], deps.appUrl ?? null)));
      return;
    }
    const lang = parentLang(chat.languageCode);
    const r = claim.studentId
      ? await store.linkParent({ studentId: claim.studentId, chat, language: lang, now })
      : ({ ok: false, reason: "student_missing" } as const);
    if (!r.ok) {
      await send(tr(lang).studentMissing);
      return;
    }
    await send(chooseLanguageText([r.childName]), languageKeyboard());
  } catch (e) {
    // Give the code back so the same link works on the next try.
    await store.releaseCode(code).catch(() => undefined);
    throw e;
  }
}

async function startPlain(chat: ChatInfo, deps: BotDeps): Promise<void> {
  const links = await deps.store.chatLinks(chat.id);
  if (!links.length) {
    await deps.api.send(chat.id, notLinkedText());
    return;
  }
  const paused = links.some((l) => !l.active);
  if (paused) await deps.store.setChatActive(chat.id, true);
  await deps.api.send(chat.id, connectedText(chatLang(links, chat), links.map((l) => ({ role: l.role, name: l.name })), paused));
}

async function help(chat: ChatInfo, deps: BotDeps): Promise<void> {
  const links = await deps.store.chatLinks(chat.id);
  await deps.api.send(chat.id, links.length ? helpText(chatLang(links, chat), links.map((l) => l.role)) : notLinkedText());
}

function statusText(lang: Lang, s: StatusData): string {
  switch (s.kind) {
    case "student":
      return studentStatusText(lang, s.data);
    case "teacher":
      return teacherStatusText(lang, s.data);
    case "admin":
      return adminSummaryText(lang, s.data, "status");
    case "parent":
      return weeklyReportText(lang, s.data, "status");
  }
}

async function status(chat: ChatInfo, deps: BotDeps, now: Date): Promise<void> {
  const links = await deps.store.chatLinks(chat.id);
  if (!links.length) {
    await deps.api.send(chat.id, notLinkedText());
    return;
  }
  const parts: string[] = [];
  let keyboard: Keyboard | undefined;
  for (const link of links.slice(0, 6)) {
    let s: StatusData | null = null;
    try {
      s = await deps.store.status(link, now);
    } catch (e) {
      console.error(`Telegram /status (${link.role}) failed:`, e);
    }
    if (!s) continue;
    parts.push(statusText(link.language, s));
    if (!keyboard) keyboard = openAppKeyboard(link.language, appLink(STATUS_PATH[link.role], deps.appUrl ?? null));
  }
  const lang = chatLang(links, chat);
  if (!parts.length) {
    await deps.api.send(chat.id, tr(lang).failed);
    return;
  }
  await deps.api.send(chat.id, joinLines(parts.flatMap((p, i) => (i ? ["", "— — —", "", p] : [p]))), keyboard);
}

async function language(chat: ChatInfo, deps: BotDeps): Promise<void> {
  const links = await deps.store.chatLinks(chat.id);
  if (!links.length) {
    await deps.api.send(chat.id, notLinkedText());
    return;
  }
  const parents = links.filter((l) => l.role === "parent");
  if (parents.length) {
    await deps.api.send(chat.id, chooseLanguageText(parents.map((p) => p.name)), languageKeyboard());
    return;
  }
  await deps.api.send(chat.id, tr(chatLang(links, chat)).langFixed);
}

async function stop(chat: ChatInfo, deps: BotDeps): Promise<void> {
  const links = await deps.store.chatLinks(chat.id);
  if (!links.length) {
    await deps.api.send(chat.id, notLinkedText());
    return;
  }
  await deps.store.setChatActive(chat.id, false);
  await deps.api.send(chat.id, tr(chatLang(links, chat)).stopped);
}

async function unknownInput(chat: ChatInfo, deps: BotDeps): Promise<void> {
  const links = await deps.store.chatLinks(chat.id);
  await deps.api.send(chat.id, links.length ? tr(chatLang(links, chat)).unknown : notLinkedText());
}

async function onCallback(cq: Rec, deps: BotDeps): Promise<void> {
  const id = str(cq.id);
  if (!id) return;
  const message = asRec(cq.message);
  const chatRec = asRec(message?.chat);
  const chatId = idOf(chatRec?.id);
  const messageId = typeof message?.message_id === "number" ? message.message_id : null;
  const m = /^lang:(uz|ru)$/.exec(str(cq.data) ?? "");
  if (!chatId || chatRec?.type !== "private" || !m) {
    await deps.api.answerCallback(id);
    return;
  }
  const from = asRec(cq.from);
  const chat: ChatInfo = { id: chatId, username: str(from?.username), firstName: str(from?.first_name), languageCode: str(from?.language_code) };
  const lang = m[1] as Lang;
  try {
    const parents = (await deps.store.chatLinks(chatId)).filter((l) => l.role === "parent");
    if (!parents.length) {
      await deps.api.answerCallback(id);
      await deps.api.send(chatId, notLinkedText());
      return;
    }
    await deps.store.setParentLanguage(chatId, lang);
    await deps.api.answerCallback(id, tr(lang).languageSet);
    const text = parentWelcomeText(lang, parents.map((p) => p.name));
    const edited = messageId != null && (await deps.api.edit(chatId, messageId, text));
    if (!edited) await deps.api.send(chatId, text);
  } catch (e) {
    console.error("Telegram language choice failed:", e);
    await deps.api.answerCallback(id).catch(() => undefined);
    await deps.api.send(chatId, tr(guessLang(chat.languageCode)).failed).catch(() => false);
  }
}
