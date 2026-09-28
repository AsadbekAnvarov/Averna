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
 *   /disconnect    parents: names the children and asks first — Yes / Cancel, or
 *                  with several children one button each, all, Cancel; only the
 *                  button press (a callback) deletes parent links
 *   /help          commands
 *
 * Private chats only — updates from groups and channels are ignored without a
 * reply (reports never go to groups). Never throws.
 */

import { isLinkCode } from "./codes";
import { appLink } from "./config";
import {
  adminSummaryText,
  chooseLanguageText,
  connectedText,
  DISCONNECT_DATA,
  DISCONNECT_STUDENT_ID_RE,
  disconnectAskText,
  disconnectKeyboard,
  guessLang,
  helpText,
  joinLines,
  languageKeyboard,
  linkedText,
  notLinkedText,
  openAppKeyboard,
  parentDisconnectedOneText,
  parentDisconnectedText,
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

export type UserLinkResult =
  | {
      ok: true;
      role: UserLinkRole;
      name: string;
      language: Lang;
      /** Names of other accounts this chat was linked to — unlinked now (and told in the app). */
      replaced?: string[];
    }
  | { ok: false; reason: "account_missing" | "parent_account" };

export type ParentLinkResult = { ok: true; childName: string; language: Lang } | { ok: false; reason: "student_missing" };

/** Whose code it was. */
export type CodeOwner = { kind: CodeKind; userId: string | null; studentId: string | null };

/** What /start <code> did: nothing (invalid / used / expired, and why) or the link it made. */
export type RedeemResult =
  | { status: "invalid" }
  | ({ status: "used" } & CodeOwner)
  | ({ status: "expired" } & CodeOwner)
  | { status: "ok"; kind: "user"; link: UserLinkResult }
  | { status: "ok"; kind: "parent"; link: ParentLinkResult };

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
  /**
   * Claim an unused, unexpired code (single use) and link this chat — a user
   * code to the account (one account per chat), a parent invite to the child
   * (in `parentLanguage`) — as ONE transaction: if linking fails, the code
   * stays unused. used / expired / invalid: nothing changed.
   */
  redeemCode(input: { code: string; chat: ChatInfo; now: Date; parentLanguage: Lang }): Promise<RedeemResult>;
  /** Every link of this chat, active or not. */
  chatLinks(chatId: string): Promise<ChatLink[]>;
  setChatActive(chatId: string, active: boolean): Promise<void>;
  setParentLanguage(chatId: string, language: Lang): Promise<void>;
  /** /disconnect confirmed: delete this chat's parent links — only `studentId`'s when given (account links stay). */
  removeParentLinks(chatId: string, studentId?: string): Promise<void>;
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
  // Links and reports are personal: groups and channels get no answer at all
  // (every reply would spend the bot's send budget).
  if (chatRec.type !== "private") return;
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
      case "disconnect":
        return await disconnect(chat, deps);
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

  // Claim + link in one transaction: if it throws, the code is still unused and the same link works again.
  const claim = await store.redeemCode({ code, chat, now, parentLanguage: parentLang(chat.languageCode) });
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

  if (claim.kind === "user") {
    const r = claim.link;
    if (!r.ok) {
      await send(r.reason === "parent_account" ? tr(guess).parentAccount : tr(guess).accountMissing);
      return;
    }
    await send(
      linkedText(r.language, r.role, r.name, r.replaced ?? []),
      openAppKeyboard(r.language, appLink(HOME_PATH[r.role], deps.appUrl ?? null))
    );
    return;
  }
  const r = claim.link;
  if (!r.ok) {
    await send(tr(parentLang(chat.languageCode)).studentMissing);
    return;
  }
  await send(chooseLanguageText([r.childName]), languageKeyboard());
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

/**
 * Parents: name the children and ask before anything is removed — the answer
 * comes back as a button press (disconnectChoice). An account link in the same
 * chat is never touched.
 */
async function disconnect(chat: ChatInfo, deps: BotDeps): Promise<void> {
  const links = await deps.store.chatLinks(chat.id);
  const parents = links.filter((l) => l.role === "parent");
  if (!parents.length) {
    await deps.api.send(chat.id, links.length ? tr(chatLang(links, chat)).disconnectNotParent : notLinkedText());
    return;
  }
  const lang = parents[0].language;
  await deps.api.send(
    chat.id,
    disconnectAskText(lang, parents.map((p) => p.name)),
    disconnectKeyboard(lang, parents.map((p) => ({ studentId: p.studentId, name: p.name })))
  );
}

type DisconnectChoice = { kind: "cancel" } | { kind: "all" } | { kind: "one"; studentId: string };

/** Callback data of the /disconnect buttons (messages.ts → disconnectKeyboard). */
function parseDisconnect(data: string): DisconnectChoice | null {
  if (data === DISCONNECT_DATA.cancel) return { kind: "cancel" };
  if (data === DISCONNECT_DATA.all) return { kind: "all" };
  if (!data.startsWith(DISCONNECT_DATA.childPrefix)) return null;
  const studentId = data.slice(DISCONNECT_DATA.childPrefix.length);
  return DISCONNECT_STUDENT_ID_RE.test(studentId) ? { kind: "one", studentId } : null;
}

/**
 * A /disconnect button: cancel, one child, or every parent link of THIS chat
 * (the chat comes from Telegram, so a crafted button can't reach another
 * chat's links). The question is replaced by the outcome.
 */
async function disconnectChoice(choice: DisconnectChoice, callbackId: string, chat: ChatInfo, messageId: number | null, deps: BotDeps): Promise<void> {
  const parents = (await deps.store.chatLinks(chat.id)).filter((l) => l.role === "parent");
  const lang = parents[0]?.language ?? parentLang(chat.languageCode);
  const L = tr(lang);
  const show = (text: string) => replaceQuestion(deps, chat.id, messageId, text);
  if (choice.kind === "cancel") {
    await deps.api.answerCallback(callbackId);
    await show(L.disconnectCancelled);
    return;
  }
  const removed = choice.kind === "all" ? parents : parents.filter((p) => p.studentId === choice.studentId);
  if (!removed.length) {
    // An old question: already removed (by an earlier tap, /disconnect elsewhere or the school).
    await deps.api.answerCallback(callbackId, L.disconnectGone);
    await show(L.disconnectGone);
    return;
  }
  await deps.store.removeParentLinks(chat.id, choice.kind === "one" ? choice.studentId : undefined);
  await deps.api.answerCallback(callbackId);
  const kept = parents.filter((p) => !removed.includes(p));
  await show(
    kept.length
      ? parentDisconnectedOneText(lang, removed[0].name, kept.map((p) => p.name))
      : parentDisconnectedText(lang, removed.map((p) => p.name))
  );
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
  // Not from a private chat of ours: ignored, no call to Telegram at all.
  if (!chatId || chatRec?.type !== "private") return;
  const data = str(cq.data) ?? "";
  const lang = /^lang:(uz|ru)$/.exec(data)?.[1] as Lang | undefined;
  const dc = lang ? null : parseDisconnect(data);
  if (!lang && !dc) {
    await deps.api.answerCallback(id);
    return;
  }
  const from = asRec(cq.from);
  const chat: ChatInfo = { id: chatId, username: str(from?.username), firstName: str(from?.first_name), languageCode: str(from?.language_code) };
  try {
    if (dc) await disconnectChoice(dc, id, chat, messageId, deps);
    else if (lang) await chooseLanguage(lang, id, chat, messageId, deps);
  } catch (e) {
    console.error(`Telegram ${dc ? "/disconnect" : "language"} button failed:`, e);
    await deps.api.answerCallback(id).catch(() => undefined);
    await deps.api.send(chatId, tr(guessLang(chat.languageCode)).failed).catch(() => false);
  }
}

/** The parent's Oʻzbekcha / Русский button: every parent link of the chat switches; the prompt becomes the welcome. */
async function chooseLanguage(lang: Lang, callbackId: string, chat: ChatInfo, messageId: number | null, deps: BotDeps): Promise<void> {
  const parents = (await deps.store.chatLinks(chat.id)).filter((l) => l.role === "parent");
  if (!parents.length) {
    await deps.api.answerCallback(callbackId);
    await deps.api.send(chat.id, notLinkedText());
    return;
  }
  await deps.store.setParentLanguage(chat.id, lang);
  await deps.api.answerCallback(callbackId, tr(lang).languageSet);
  await replaceQuestion(deps, chat.id, messageId, parentWelcomeText(lang, parents.map((p) => p.name)));
}

/** Replace the message whose button was pressed (its buttons go too); a new message when that fails. */
async function replaceQuestion(deps: BotDeps, chatId: string, messageId: number | null, text: string): Promise<void> {
  const edited = messageId != null && (await deps.api.edit(chatId, messageId, text));
  if (!edited) await deps.api.send(chatId, text);
}
