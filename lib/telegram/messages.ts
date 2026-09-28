/**
 * Every text the Averna bot sends — Uzbek (Latin), Russian and English — as
 * Telegram HTML (parse_mode "HTML"). Pure: no I/O, unit-tested.
 *
 * Audiences: students read English, teachers and admins Uzbek, parents pick
 * Uzbek or Russian (/lang). Every text exists in all three languages, so a
 * link's language can change without a missing string.
 *
 * Rules: every dynamic value goes through esc() (after clip(), so an entity is
 * never cut in half); a message is an array of self-contained lines that
 * joinLines() keeps under Telegram's 4096-character limit by dropping whole
 * lines from the end. Dates are Tashkent time.
 */

import type { CodeKind, Keyboard, Lang, LinkRole, UserLinkRole } from "./types";
import type {
  AdminSummary,
  DueItem,
  HomeworkProgress,
  Skill,
  StreakState,
  StudentReminder,
  StudentStatus,
  TeacherDigest,
  TeacherStatus,
  WeeklyReport,
} from "./builders";

export const MAX_MESSAGE_CHARS = 4096;
/** Margin under Telegram's limit. */
const SAFE_CHARS = 3900;

/** List caps — keep the busiest teacher's report well under the limit. */
export const CAPS = { homework: 8, names: 8, inactive: 10, due: 6, missingHomework: 3, upcoming: 8 } as const;

// ---------------------------------------------------------------------------
// Escaping and layout
// ---------------------------------------------------------------------------

/** Telegram HTML escaping (the four entities the Bot API understands). */
export function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trim to `max` characters (code points — never splits an emoji), adding "…". */
export function clip(v: unknown, max: number): string {
  const s = String(v ?? "").trim();
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, Math.max(1, max - 1)).join("").trimEnd() + "…" : s;
}

/** Bold, clipped, escaped. */
const b = (v: unknown, max = 80): string => `<b>${esc(clip(v, max))}</b>`;
const e = (v: unknown, max = 80): string => esc(clip(v, max));

/**
 * Join lines with "\n", skipping null/false/undefined. When the text would pass
 * `max`, whole lines are dropped from the end and "…" is appended — lines are
 * self-contained HTML, so the markup stays valid.
 */
export function joinLines(lines: (string | null | false | undefined)[], max = SAFE_CHARS): string {
  const kept = lines.filter((l): l is string => typeof l === "string");
  let text = kept.join("\n");
  if (text.length <= max) return text;
  const out: string[] = [];
  let len = 0;
  for (const l of kept) {
    if (len + l.length + 1 > max - 2) break;
    out.push(l);
    len += l.length + 1;
  }
  text = out.join("\n").replace(/\n+$/, "");
  return `${text}\n…`;
}

/** Tags stripped, entities decoded — the plain-text fallback if Telegram rejects our HTML. */
export function htmlToPlain(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

export function asLang(v: unknown, fallback: Lang = "uz"): Lang {
  return v === "uz" || v === "ru" || v === "en" ? v : fallback;
}

/** Students get English, teachers and admins Uzbek. */
export function langForRole(role: UserLinkRole): Lang {
  return role === "student" ? "en" : "uz";
}

/** Best guess for a chat we don't know yet, from Telegram's language_code. */
export function guessLang(code: string | null | undefined): Lang {
  const c = (code ?? "").toLowerCase();
  if (c.startsWith("ru")) return "ru";
  if (c.startsWith("en")) return "en";
  return "uz";
}

/** Parents read Uzbek or Russian. */
export function parentLang(code: string | null | undefined): Lang {
  return (code ?? "").toLowerCase().startsWith("ru") ? "ru" : "uz";
}

// ---------------------------------------------------------------------------
// Dates (Asia/Tashkent: UTC+5, no daylight saving)
// ---------------------------------------------------------------------------

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000;
const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
  ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
};
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function tz(d: Date) {
  const t = new Date(d.getTime() + TZ_OFFSET_MS);
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), wd: t.getUTCDay(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
}
const pad = (n: number) => String(n).padStart(2, "0");

/** "28 Sep" · "28-sentabr" · "28 сентября" */
export function fmtDate(d: Date, lang: Lang): string {
  const p = tz(d);
  if (lang === "uz") return `${p.d}-${MONTHS.uz[p.mo]}`;
  return `${p.d} ${MONTHS[lang][p.mo]}`;
}

/** "Mon 28 Sep, 23:59" · "28-sentabr, 23:59" · "28 сентября, 23:59" */
export function fmtDue(d: Date, lang: Lang): string {
  const p = tz(d);
  const day = lang === "en" ? `${WEEKDAYS_EN[p.wd]} ${fmtDate(d, lang)}` : fmtDate(d, lang);
  return `${day}, ${pad(p.h)}:${pad(p.mi)}`;
}

export function fmtTime(d: Date): string {
  const p = tz(d);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

/** "22–28 Sep" · "22–28-sentabr" · "22–28 сентября" (month spelled on both sides when it changes). */
export function fmtRange(start: Date, end: Date, lang: Lang): string {
  const a = tz(start);
  const z = tz(end);
  if (a.y === z.y && a.mo === z.mo && a.d === z.d) return fmtDate(start, lang);
  if (a.y === z.y && a.mo === z.mo) {
    return lang === "uz" ? `${a.d}–${z.d}-${MONTHS.uz[a.mo]}` : `${a.d}–${z.d} ${MONTHS[lang][a.mo]}`;
  }
  return `${fmtDate(start, lang)} – ${fmtDate(end, lang)}`;
}

export function fmtBand(band: number): string {
  return (Math.round(band * 2) / 2).toFixed(1);
}

/** Russian plural: 1 день · 2 дня · 5 дней. */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = Math.abs(n) % 10;
  const m100 = Math.abs(n) % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const enDays = (n: number) => (n === 1 ? "day" : "days");
const ruDays = (n: number) => ruPlural(n, "день", "дня", "дней");

const SKILL_NAME: Record<Skill, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };

// ---------------------------------------------------------------------------
// Dictionaries
// ---------------------------------------------------------------------------

type When = HomeworkProgress["when"];

interface Dict {
  openApp: string;
  unknown: string;
  failed: string;
  codeInvalid: string;
  codeExpired(kind: CodeKind): string;
  codeUsed(kind: CodeKind): string;
  accountMissing: string;
  parentAccount: string;
  studentMissing: string;
  languageSet: string;
  langFixed: string;
  stopped: string;
  resumed: string;
  disconnected: string;
  // linking
  linkedTitle(nameHtml: string): string;
  linkedBody(role: UserLinkRole): string;
  linkedFooter(role: UserLinkRole): string;
  /** This chat belonged to other accounts, now unlinked (they were told in the app). */
  replacedAccounts(namesHtml: string): string;
  parentWelcomeTitle(namesHtml: string, count: number): string;
  parentWelcomeBody: string;
  // parents: /disconnect (asked first, removed on a button press), removed by the school
  /** The question: one child → remove it?; several → which one? */
  disconnectAsk(namesHtml: string, count: number): string;
  /** Buttons (plain text): one child — yes / cancel; several — one per child, all, cancel. */
  disconnectYes: string;
  disconnectChild(name: string): string;
  disconnectAll: string;
  disconnectCancel: string;
  disconnectCancelled: string;
  /** A button of an old question whose connection is already gone. */
  disconnectGone: string;
  parentDisconnected(namesHtml: string, count: number): string;
  /** One of several children removed; `othersHtml` stay connected. */
  parentDisconnectedOne(nameHtml: string, othersHtml: string): string;
  disconnectNotParent: string;
  parentRemoved(nameHtml: string): string;
  // who / help
  who(role: LinkRole, nameHtml: string): string;
  connectedTitle: string;
  helpTitle: string;
  helpStatus(role: LinkRole): string;
  helpLang: string;
  helpStop: string;
  helpDisconnect: string;
  helpHelp: string;
  helpSettings: string;
  testTitle: string;
  testBody(nameHtml: string, time: string): string;
  // student
  streak(days: number, state: StreakState): string;
  next(titleHtml: string, due: string, more: number): string;
  noHomework: string;
  eveningTitle: string;
  dueTomorrowTitle: string;
  streakAtRisk(days: number): string;
  streakFreeze(days: number): string;
  moreItems(n: number): string;
  // teacher
  teacherStatusTitle: string;
  upcomingTitle: string;
  noUpcoming: string;
  noGroups: string;
  reviewsLine(n: number): string;
  submitted(x: number, y: number): string;
  whenDue(when: When, date: string): string;
  digestTitle: string;
  digestHomeworkTitle: string;
  missingNames(listHtml: string): string;
  digestReviews(n: number): string;
  digestInactiveTitle(n: number): string;
  inactiveItem(nameHtml: string, days: number): string;
  andMore(n: number): string;
  // admin
  adminTitle(mode: "daily" | "status"): string;
  adminNewStudents(n: number): string;
  adminPlacements(n: number): string;
  adminPayments(n: number): string;
  adminReviews(n: number): string;
  adminHomework(n: number): string;
  // parent
  weeklyTitle(mode: "weekly" | "status"): string;
  studentLine(nameHtml: string): string;
  activeDays(a: number, d: number): string;
  testsLabel: string;
  testItem(skill: string, count: number, band: string | null): string;
  noTests: string;
  /** Over homework whose deadline has passed. */
  homeworkLine(submitted: number, due: number): string;
  noHomeworkWeek: string;
  /** There is homework this week, but no deadline has passed yet. */
  noHomeworkDueYet: string;
  /** Appended to the homework line: not due yet, already handed in. `afterDue`: after "X of Y submitted". */
  handedInEarly(n: number, afterDue: boolean): string;
  /** Deadline passed, still not submitted (a late submission leaves this list). */
  missedLine(listHtml: string): string;
  /** Not due yet, not submitted. */
  toDoLine(listHtml: string): string;
  dueItem(titleHtml: string, due: string): string;
  attendanceLine(a: WeeklyReport["attendance"]): string;
  noAttendance: string;
  streakLine(days: number): string;
  noStreak: string;
  reviewsWeek(n: number): string;
}

const EN: Dict = {
  openApp: "Open in Averna",
  unknown: "Sorry, I didn't get that. Send /help to see what I can do.",
  failed: "Something went wrong — please try again in a minute.",
  codeInvalid: "This link isn't valid. Get a new one in Averna → Settings → Telegram.",
  codeExpired: (k) =>
    k === "parent"
      ? "This invite has expired. Please ask the teacher for a new link."
      : "This link has expired. Get a new one in Averna → Settings → Telegram.",
  codeUsed: (k) =>
    k === "parent"
      ? "This invite has already been used. Please ask the teacher for a new link."
      : "This link has already been used. Get a new one in Averna → Settings → Telegram.",
  accountMissing: "This Averna account no longer exists.",
  parentAccount: "Parents connect with an invite link from the teacher.",
  studentMissing: "This student is no longer on Averna.",
  languageSet: "Language: English",
  langFixed: "The language is set automatically: English for students, Uzbek for teachers and admins.",
  stopped: "🔕 Notifications to this chat are off. Send /start to turn them back on.",
  resumed: "🔔 Notifications are back on.",
  disconnected: "Telegram was disconnected from your Averna account — you won't get notifications here any more.",
  linkedTitle: (n) => `✅ Telegram is connected to ${n}.`,
  linkedBody: (role) =>
    role === "student"
      ? "You'll get:\n• new homework from your teacher\n• teacher reviews and grades\n• a reminder every evening (around 19:00) when homework is due tomorrow or your streak is at risk\n\nChoose what you get in Averna → Settings → Telegram."
      : role === "teacher"
        ? "Every evening (around 19:00) you'll get a report: homework due today and yesterday (who hasn't submitted), Writing/Speaking work waiting for your review and students inactive for 7+ days. School announcements come here too."
        : "Every evening (around 19:00) you'll get a summary: new students, finished placement tests, pending payments, work waiting for review and homework created.",
  linkedFooter: (role) =>
    role === "student"
      ? "/status — your streak and next homework · /help — commands"
      : role === "teacher"
        ? "/status — right now · /help — commands"
        : "/status — today so far · /help — commands",
  replacedAccounts: (n) => `ℹ️ This chat was connected to ${n} before — that account no longer gets Telegram messages here (it was told in Averna).`,
  parentWelcomeTitle: (names, count) => `✅ You're connected. ${count > 1 ? "Students" : "Student"}: ${names}`,
  parentWelcomeBody:
    "Every Sunday evening (around 19:00) you'll get a weekly report: active days, tests with the latest band, homework, attendance, streak and teacher reviews.\n\n/status — this week so far\n/lang — change language\n/stop — turn notifications off\n/disconnect — remove this connection completely",
  disconnectAsk: (names, count) =>
    count > 1
      ? `This chat gets the weekly reports of these students: ${names}. Which connection should be removed? Connecting again needs a new invite link from the teacher.`
      : `Disconnect this chat from the weekly reports (student: ${names})? The reports will stop coming here, and connecting again needs a new invite link from the teacher.`,
  disconnectYes: "✅ Yes, disconnect",
  disconnectChild: (n) => `Disconnect: ${n}`,
  disconnectAll: "Disconnect all",
  disconnectCancel: "Cancel",
  disconnectCancelled: "Cancelled — nothing was changed.",
  disconnectGone: "This connection has already been removed.",
  parentDisconnected: (names, count) =>
    `✅ Connection removed. This chat won't get reports any more (${count > 1 ? "students" : "student"}: ${names}). To connect again, ask the teacher for a new invite link.`,
  parentDisconnectedOne: (n, others) =>
    `✅ Connection removed (student: ${n}) — this student's reports won't come here any more. Still connected: ${others}.`,
  disconnectNotParent: "/disconnect is for parents. To disconnect your Averna account, open Averna → Settings → Telegram → Disconnect.",
  parentRemoved: (n) =>
    `The school removed this chat's connection to the reports (student: ${n}). If this is a mistake, ask the teacher for a new invite link.`,
  who: (role, n) =>
    role === "parent" ? `${n} (as a parent)` : `${n} (${role === "student" ? "student" : role === "teacher" ? "teacher" : "admin"})`,
  connectedTitle: "This chat is connected to Averna:",
  helpTitle: "🤖 <b>Averna bot</b>",
  helpStatus: (role) =>
    role === "student"
      ? "your streak and next homework"
      : role === "teacher"
        ? "homework due and work to review"
        : role === "admin"
          ? "today's summary"
          : "your child's week so far",
  helpLang: "/lang — change language (parents)",
  helpStop: "/stop — turn notifications off (/start turns them back on)",
  helpDisconnect: "/disconnect — remove this chat's parent connection (no more reports)",
  helpHelp: "/help — this list",
  helpSettings: "Notification settings: Averna → Settings → Telegram.",
  testTitle: "✅ <b>Test message</b>",
  testBody: (n, t) => `The Averna bot works. Sent by ${n} at ${t}.`,
  streak: (d, s) =>
    d <= 0
      ? "🔥 No streak yet — practise today to start one."
      : s === "done_today"
        ? `🔥 Streak: ${d} ${enDays(d)} — done for today ✅`
        : s === "freeze_will_save"
          ? `🔥 Streak: ${d} ${enDays(d)} — you missed yesterday; practise today and a streak freeze saves it`
          : `🔥 Streak: ${d} ${enDays(d)} — practise today to keep it`,
  next: (t, due, more) => `📚 Next homework: ${t} — due ${due}${more > 0 ? ` (+${more} more)` : ""}`,
  noHomework: "📚 No homework waiting. 🎉",
  eveningTitle: "🌙 <b>Evening reminder</b>",
  dueTomorrowTitle: "📚 Due tomorrow:",
  streakAtRisk: (d) => `🔥 Your ${d}-day streak ends tonight — do one practice before midnight to keep it.`,
  streakFreeze: (d) => `🧊 You missed yesterday — practise today and a streak freeze keeps your ${d}-day streak.`,
  moreItems: (n) => `…and ${n} more`,
  teacherStatusTitle: "📊 <b>Your groups right now</b>",
  upcomingTitle: "📚 Homework due in the next 7 days:",
  noUpcoming: "📚 No homework due in the next 7 days.",
  noGroups: "You don't have any groups yet.",
  reviewsLine: (n) => `✍️ Waiting for your review: ${n} (last 14 days)`,
  submitted: (x, y) => `${x}/${y} submitted`,
  whenDue: (w, d) => (w === "today" ? "due today" : w === "yesterday" ? "was due yesterday" : w === "tomorrow" ? "due tomorrow" : `due ${d}`),
  digestTitle: "📋 <b>Daily report</b>",
  digestHomeworkTitle: "📚 <b>Homework</b>",
  missingNames: (l) => `Missing: ${l}`,
  digestReviews: (n) => `✍️ <b>Waiting for your review:</b> ${n} Writing/Speaking (last 14 days)`,
  digestInactiveTitle: (n) => `💤 <b>Inactive 7+ days</b> (${n}):`,
  inactiveItem: (n, d) => `${n} (${d} d)`,
  andMore: (n) => `and ${n} more`,
  adminTitle: (m) => (m === "daily" ? "Daily summary" : "Today so far"),
  adminNewStudents: (n) => `New students: ${n}`,
  adminPlacements: (n) => `Placement tests finished: ${n}`,
  adminPayments: (n) => `Pending payments: ${n}`,
  adminReviews: (n) => `Work waiting for review: ${n} (last 14 days)`,
  adminHomework: (n) => `Homework created: ${n}`,
  weeklyTitle: (m) => (m === "weekly" ? "Weekly report" : "This week so far"),
  studentLine: (n) => `Student: ${n}`,
  activeDays: (a, d) => `Active days: ${a} of ${d}`,
  testsLabel: "Tests:",
  testItem: (s, c, band) => `${s} — ${c}${band ? ` (latest ${band})` : ""}`,
  noTests: "Tests: none this week",
  homeworkLine: (s, a) => `Homework due so far: ${s} of ${a} submitted`,
  noHomeworkWeek: "Homework: nothing due this week",
  noHomeworkDueYet: "Homework: nothing due yet this week",
  handedInEarly: (n) => `${n} handed in early`,
  missedLine: (l) => `Missed: ${l}`,
  toDoLine: (l) => `Still to do: ${l}`,
  dueItem: (t, d) => `${t} (due ${d})`,
  attendanceLine: (a) => `Attendance: present ${a.present}, absent ${a.absent}, late ${a.late}${a.excused ? `, excused ${a.excused}` : ""}`,
  noAttendance: "Attendance: no lessons marked this week",
  streakLine: (d) => `Streak: ${d} ${enDays(d)} in a row`,
  noStreak: "Streak: none right now",
  reviewsWeek: (n) => `Teacher reviews: ${n}`,
};

const UZ: Dict = {
  openApp: "Avernaʼda ochish",
  unknown: "Tushunmadim. /help — buyruqlar roʻyxati.",
  failed: "Nimadir xato ketdi — birozdan keyin qayta urinib koʻring.",
  codeInvalid: "Bu havola yaroqsiz. Averna → Settings → Telegram boʻlimidan yangisini oling.",
  codeExpired: (k) =>
    k === "parent"
      ? "Taklif havolasining muddati tugagan. Oʻqituvchidan yangi havola soʻrang."
      : "Havolaning muddati tugagan. Averna → Settings → Telegram boʻlimidan yangisini oling.",
  codeUsed: (k) =>
    k === "parent"
      ? "Bu taklif havolasi allaqachon ishlatilgan. Oʻqituvchidan yangi havola soʻrang."
      : "Bu havola allaqachon ishlatilgan. Averna → Settings → Telegram boʻlimidan yangisini oling.",
  accountMissing: "Bu Averna hisobi endi mavjud emas.",
  parentAccount: "Ota-onalar oʻqituvchi yuborgan taklif havolasi orqali ulanadi.",
  studentMissing: "Bu oʻquvchi endi Avernaʼda yoʻq.",
  languageSet: "Til: oʻzbekcha",
  langFixed: "Til avtomatik tanlanadi: oʻquvchilar uchun — inglizcha, oʻqituvchi va administratorlar uchun — oʻzbekcha.",
  stopped: "🔕 Bu chatga xabarlar yuborish toʻxtatildi. Qayta yoqish uchun /start yuboring.",
  resumed: "🔔 Xabarlar yana yoqildi.",
  disconnected: "Telegram Averna hisobingizdan uzildi — bu yerga endi xabar kelmaydi.",
  linkedTitle: (n) => `✅ Telegram ${n} hisobiga ulandi.`,
  linkedBody: (role) =>
    role === "student"
      ? "Bu yerga keladi:\n• oʻqituvchidan yangi uy vazifalari\n• oʻqituvchi tekshiruvlari va baholari\n• har kuni kechqurun (taxminan 19:00 da) eslatma — ertaga topshiriladigan uy vazifasi boʻlsa yoki streak xavf ostida qolsa\n\nNimalar kelishini tanlash: Averna → Settings → Telegram."
      : role === "teacher"
        ? "Har kuni kechqurun (taxminan 19:00 da) hisobot keladi: muddati bugun va kecha boʻlgan uy vazifalari (kim topshirmagan), tekshiruvingizni kutayotgan Writing/Speaking ishlari va 7+ kun faol boʻlmagan oʻquvchilar. Maktab eʼlonlari ham shu yerga keladi."
        : "Har kuni kechqurun (taxminan 19:00 da) kunlik xulosa keladi: yangi oʻquvchilar, tugallangan placement testlar, kutilayotgan toʻlovlar, tekshiruv kutayotgan ishlar va yaratilgan uy vazifalari.",
  linkedFooter: (role) =>
    role === "student"
      ? "/status — streak va navbatdagi uy vazifasi · /help — buyruqlar"
      : role === "teacher"
        ? "/status — hozirgi holat · /help — buyruqlar"
        : "/status — bugun hozirgacha · /help — buyruqlar",
  replacedAccounts: (n) =>
    `ℹ️ Bu chat avval ${n} hisobiga ulangan edi — u hisob boʻyicha xabarlar endi bu yerga kelmaydi (bu haqda unga Avernaʼda xabar berildi).`,
  parentWelcomeTitle: (names, count) => `✅ Ulandingiz. ${count > 1 ? "Oʻquvchilar" : "Oʻquvchi"}: ${names}`,
  parentWelcomeBody:
    "Har yakshanba kechqurun (taxminan 19:00 da) haftalik hisobot keladi: faol kunlar, testlar va oxirgi band, uy vazifalari, davomat, streak (ketma-ket faol kunlar) va oʻqituvchi tekshirgan ishlar.\n\n/status — shu hafta hozirgacha\n/lang — tilni oʻzgartirish\n/stop — xabarlarni toʻxtatish\n/disconnect — ulanishni butunlay oʻchirish",
  disconnectAsk: (names, count) =>
    count > 1
      ? `Bu chatga ${count} nafar oʻquvchining haftalik hisobotlari keladi: ${names}. Qaysi ulanishni oʻchiramiz? Qayta ulanish uchun oʻqituvchidan yangi taklif havolasi kerak boʻladi.`
      : `Bu chatning hisobotlarga ulanishi oʻchirilsinmi (oʻquvchi: ${names})? Hisobotlar bu yerga endi kelmaydi, qayta ulanish uchun esa oʻqituvchidan yangi taklif havolasi kerak boʻladi.`,
  disconnectYes: "✅ Ha, uzish",
  disconnectChild: (n) => `Uzish: ${n}`,
  disconnectAll: "Hammasini uzish",
  disconnectCancel: "Bekor qilish",
  disconnectCancelled: "Bekor qilindi — hech narsa oʻzgarmadi.",
  disconnectGone: "Bu ulanish allaqachon oʻchirilgan.",
  parentDisconnected: (names, count) =>
    `✅ Ulanish oʻchirildi. Bu chatga endi hisobot kelmaydi (${count > 1 ? "oʻquvchilar" : "oʻquvchi"}: ${names}). Qayta ulanish uchun oʻqituvchidan yangi taklif havolasini soʻrang.`,
  parentDisconnectedOne: (n, others) =>
    `✅ Ulanish oʻchirildi (oʻquvchi: ${n}) — bu oʻquvchining hisobotlari endi bu chatga kelmaydi. Qolgan ulanishlar saqlandi: ${others}.`,
  disconnectNotParent: "/disconnect — ota-onalar uchun. Averna hisobingizni uzish: Averna → Settings → Telegram → Disconnect.",
  parentRemoved: (n) =>
    `Maktab bu chatning hisobotlarga ulanishini oʻchirdi (oʻquvchi: ${n}). Xato boʻlsa, oʻqituvchidan yangi taklif havolasini soʻrang.`,
  who: (role, n) =>
    role === "parent"
      ? `${n} (ota-ona sifatida)`
      : `${n} (${role === "student" ? "oʻquvchi" : role === "teacher" ? "oʻqituvchi" : "administrator"})`,
  connectedTitle: "Bu chat Avernaʼga ulangan:",
  helpTitle: "🤖 <b>Averna boti</b>",
  helpStatus: (role) =>
    role === "student"
      ? "streak va navbatdagi uy vazifasi"
      : role === "teacher"
        ? "muddati yaqin uy vazifalari va tekshiruvlar"
        : role === "admin"
          ? "bugungi xulosa"
          : "farzandingizning shu haftasi",
  helpLang: "/lang — tilni oʻzgartirish (ota-onalar uchun)",
  helpStop: "/stop — xabarlarni toʻxtatish (/start — qayta yoqish)",
  helpDisconnect: "/disconnect — ota-ona ulanishini butunlay oʻchirish (hisobotlar kelmaydi)",
  helpHelp: "/help — shu roʻyxat",
  helpSettings: "Xabar sozlamalari: Averna → Settings → Telegram.",
  testTitle: "✅ <b>Test xabar</b>",
  testBody: (n, t) => `Averna boti ishlayapti. Yuboruvchi: ${n}, ${t}.`,
  streak: (d, s) =>
    d <= 0
      ? "🔥 Streak hali yoʻq — bugun mashq qilib boshlang."
      : s === "done_today"
        ? `🔥 Streak: ${d} kun — bugungi mashq bajarildi ✅`
        : s === "freeze_will_save"
          ? `🔥 Streak: ${d} kun — kecha oʻtkazib yubordingiz; bugun mashq qilsangiz, muzlatish uni saqlab qoladi`
          : `🔥 Streak: ${d} kun — saqlab qolish uchun bugun mashq qiling`,
  next: (t, due, more) => `📚 Navbatdagi uy vazifasi: ${t} — muddati ${due}${more > 0 ? ` (yana ${more} ta)` : ""}`,
  noHomework: "📚 Topshirilishi kerak boʻlgan uy vazifasi yoʻq. 🎉",
  eveningTitle: "🌙 <b>Kechki eslatma</b>",
  dueTomorrowTitle: "📚 Ertaga topshiriladi:",
  streakAtRisk: (d) => `🔥 ${d} kunlik streakingiz bugun tugaydi — saqlab qolish uchun yarim tungacha bitta mashq bajaring.`,
  streakFreeze: (d) => `🧊 Kecha mashq qilmadingiz — bugun mashq qilsangiz, muzlatish ${d} kunlik streakingizni saqlab qoladi.`,
  moreItems: (n) => `… yana ${n} ta`,
  teacherStatusTitle: "📊 <b>Guruhlaringiz hozir</b>",
  upcomingTitle: "📚 Keyingi 7 kunda muddati tugaydigan uy vazifalari:",
  noUpcoming: "📚 Keyingi 7 kunda muddati tugaydigan uy vazifasi yoʻq.",
  noGroups: "Sizda hali guruh yoʻq.",
  reviewsLine: (n) => `✍️ Tekshiruvingizni kutmoqda: ${n} ta ish (soʻnggi 14 kun)`,
  submitted: (x, y) => `${x}/${y} topshirdi`,
  whenDue: (w, d) =>
    w === "today" ? "muddati bugun" : w === "yesterday" ? "muddati kecha edi" : w === "tomorrow" ? "muddati ertaga" : `muddati ${d}`,
  digestTitle: "📋 <b>Kunlik hisobot</b>",
  digestHomeworkTitle: "📚 <b>Uy vazifalari</b>",
  missingNames: (l) => `Topshirmaganlar: ${l}`,
  digestReviews: (n) => `✍️ <b>Tekshiruvingizni kutmoqda:</b> ${n} ta Writing/Speaking ishi (soʻnggi 14 kun)`,
  digestInactiveTitle: (n) => `💤 <b>7+ kun faol emas</b> (${n}):`,
  inactiveItem: (n, d) => `${n} (${d} kun)`,
  andMore: (n) => `va yana ${n} ta`,
  adminTitle: (m) => (m === "daily" ? "Kunlik xulosa" : "Bugun hozirgacha"),
  adminNewStudents: (n) => `Yangi oʻquvchilar: ${n}`,
  adminPlacements: (n) => `Tugallangan placement testlar: ${n}`,
  adminPayments: (n) => `Kutilayotgan toʻlovlar: ${n}`,
  adminReviews: (n) => `Tekshiruv kutayotgan ishlar: ${n} (soʻnggi 14 kun)`,
  adminHomework: (n) => `Yaratilgan uy vazifalari: ${n}`,
  weeklyTitle: (m) => (m === "weekly" ? "Haftalik hisobot" : "Shu hafta hozirgacha"),
  studentLine: (n) => `Oʻquvchi: ${n}`,
  activeDays: (a, d) => `Faol kunlar: ${a} / ${d}`,
  testsLabel: "Testlar:",
  testItem: (s, c, band) => `${s} — ${c} ta${band ? ` (oxirgi band ${band})` : ""}`,
  noTests: "Testlar: bu hafta yoʻq",
  homeworkLine: (s, a) => `Muddati tugagan uy vazifalari: ${a} tadan ${s} tasi topshirildi`,
  noHomeworkWeek: "Uy vazifalari: bu hafta muddati tugaydiganlari yoʻq",
  noHomeworkDueYet: "Uy vazifalari: bu hafta hali muddati tugaganlari yoʻq",
  handedInEarly: (n, afterDue) => `${afterDue ? "yana " : ""}${n} tasi muddatidan oldin topshirildi`,
  missedLine: (l) => `Topshirilmagan (muddati oʻtgan): ${l}`,
  toDoLine: (l) => `Hali topshirilishi kerak: ${l}`,
  dueItem: (t, d) => `${t} (muddati ${d})`,
  attendanceLine: (a) => `Davomat: keldi ${a.present}, kelmadi ${a.absent}, kechikdi ${a.late}${a.excused ? `, sababli ${a.excused}` : ""}`,
  noAttendance: "Davomat: bu hafta belgilanmagan",
  streakLine: (d) => `Streak: ketma-ket ${d} kun`,
  noStreak: "Streak: hozircha yoʻq",
  reviewsWeek: (n) => `Oʻqituvchi tekshirgan ishlar: ${n}`,
};

const RU: Dict = {
  openApp: "Открыть в Averna",
  unknown: "Не понял. Отправьте /help — там список команд.",
  failed: "Что-то пошло не так — попробуйте ещё раз через минуту.",
  codeInvalid: "Эта ссылка недействительна. Получите новую в Averna → Settings → Telegram.",
  codeExpired: (k) =>
    k === "parent"
      ? "Срок действия приглашения истёк. Попросите у учителя новую ссылку."
      : "Срок действия ссылки истёк. Получите новую в Averna → Settings → Telegram.",
  codeUsed: (k) =>
    k === "parent"
      ? "Это приглашение уже использовано. Попросите у учителя новую ссылку."
      : "Эта ссылка уже использована. Получите новую в Averna → Settings → Telegram.",
  accountMissing: "Этого аккаунта Averna больше нет.",
  parentAccount: "Родители подключаются по ссылке-приглашению от учителя.",
  studentMissing: "Этого ученика больше нет в Averna.",
  languageSet: "Язык: русский",
  langFixed: "Язык выбирается автоматически: английский — для учеников, узбекский — для учителей и администраторов.",
  stopped: "🔕 Уведомления в этот чат отключены. Чтобы включить снова, отправьте /start.",
  resumed: "🔔 Уведомления снова включены.",
  disconnected: "Telegram отключён от вашего аккаунта Averna — уведомления сюда больше не придут.",
  linkedTitle: (n) => `✅ Telegram подключён к аккаунту ${n}.`,
  linkedBody: (role) =>
    role === "student"
      ? "Сюда будут приходить:\n• новые домашние задания от учителя\n• проверки и оценки учителя\n• напоминание каждый вечер (около 19:00), если завтра срок сдачи задания или серия под угрозой\n\nВыбрать, что присылать: Averna → Settings → Telegram."
      : role === "teacher"
        ? "Каждый вечер (около 19:00) — отчёт: домашние задания со сроком сегодня и вчера (кто не сдал), работы Writing/Speaking, ожидающие вашей проверки, и ученики, неактивные 7+ дней. Объявления школы тоже приходят сюда."
        : "Каждый вечер (около 19:00) — сводка: новые ученики, завершённые placement-тесты, ожидающие платежи, работы на проверке и созданные домашние задания.",
  linkedFooter: (role) =>
    role === "student"
      ? "/status — серия и ближайшее задание · /help — команды"
      : role === "teacher"
        ? "/status — текущее состояние · /help — команды"
        : "/status — сегодня на данный момент · /help — команды",
  replacedAccounts: (n) =>
    `ℹ️ Раньше этот чат был подключён к аккаунту ${n} — уведомления этого аккаунта сюда больше не приходят (ему сообщили в Averna).`,
  parentWelcomeTitle: (names, count) => `✅ Готово. ${count > 1 ? "Ученики" : "Ученик"}: ${names}`,
  parentWelcomeBody:
    "Каждое воскресенье вечером (около 19:00) будет приходить недельный отчёт: активные дни, тесты и последний балл, домашние задания, посещаемость, серия занятий и работы, проверенные учителем.\n\n/status — эта неделя на данный момент\n/lang — сменить язык\n/stop — отключить уведомления\n/disconnect — полностью удалить подключение",
  disconnectAsk: (names, count) =>
    count > 1
      ? `Этот чат получает недельные отчёты по ученикам: ${names}. Какое подключение удалить? Чтобы подключиться снова, понадобится новая ссылка-приглашение от учителя.`
      : `Отключить этот чат от отчётов (ученик: ${names})? Отчёты больше не будут приходить сюда, а чтобы подключиться снова, понадобится новая ссылка-приглашение от учителя.`,
  disconnectYes: "✅ Да, отключить",
  disconnectChild: (n) => `Отключить: ${n}`,
  disconnectAll: "Отключить всех",
  disconnectCancel: "Отмена",
  disconnectCancelled: "Отменено — ничего не изменилось.",
  disconnectGone: "Это подключение уже удалено.",
  parentDisconnected: (names, count) =>
    `✅ Подключение удалено. Отчёты больше не будут приходить в этот чат (${count > 1 ? "ученики" : "ученик"}: ${names}). Чтобы подключиться снова, попросите у учителя новую ссылку-приглашение.`,
  parentDisconnectedOne: (n, others) =>
    `✅ Подключение удалено (ученик: ${n}) — отчёты по этому ученику больше не будут приходить в этот чат. Остальные подключения сохранены: ${others}.`,
  disconnectNotParent: "/disconnect — для родителей. Чтобы отключить аккаунт Averna, откройте Averna → Settings → Telegram → Disconnect.",
  parentRemoved: (n) =>
    `Школа удалила подключение этого чата к отчётам (ученик: ${n}). Если это ошибка, попросите у учителя новую ссылку-приглашение.`,
  who: (role, n) =>
    role === "parent" ? `${n} (как родитель)` : `${n} (${role === "student" ? "ученик" : role === "teacher" ? "учитель" : "администратор"})`,
  connectedTitle: "Этот чат подключён к Averna:",
  helpTitle: "🤖 <b>Бот Averna</b>",
  helpStatus: (role) =>
    role === "student"
      ? "серия и ближайшее задание"
      : role === "teacher"
        ? "задания со сроком и работы на проверке"
        : role === "admin"
          ? "сводка за сегодня"
          : "неделя ребёнка на данный момент",
  helpLang: "/lang — сменить язык (для родителей)",
  helpStop: "/stop — отключить уведомления (/start — включить снова)",
  helpDisconnect: "/disconnect — полностью удалить родительское подключение (отчёты больше не придут)",
  helpHelp: "/help — этот список",
  helpSettings: "Настройки уведомлений: Averna → Settings → Telegram.",
  testTitle: "✅ <b>Тестовое сообщение</b>",
  testBody: (n, t) => `Бот Averna работает. Отправитель: ${n}, ${t}.`,
  streak: (d, s) =>
    d <= 0
      ? "🔥 Серии пока нет — позанимайтесь сегодня, чтобы начать."
      : s === "done_today"
        ? `🔥 Серия: ${d} ${ruDays(d)} — сегодня уже есть ✅`
        : s === "freeze_will_save"
          ? `🔥 Серия: ${d} ${ruDays(d)} — вчера был пропуск; позанимайтесь сегодня, и заморозка её сохранит`
          : `🔥 Серия: ${d} ${ruDays(d)} — позанимайтесь сегодня, чтобы её сохранить`,
  next: (t, due, more) => `📚 Ближайшее задание: ${t} — срок ${due}${more > 0 ? ` (ещё ${more})` : ""}`,
  noHomework: "📚 Несданных заданий нет. 🎉",
  eveningTitle: "🌙 <b>Вечернее напоминание</b>",
  dueTomorrowTitle: "📚 Срок завтра:",
  streakAtRisk: (d) => `🔥 Ваша серия (${d} ${ruDays(d)}) прервётся сегодня — выполните одно упражнение до полуночи, чтобы её сохранить.`,
  streakFreeze: (d) => `🧊 Вчера вы пропустили занятия — позанимайтесь сегодня, и заморозка сохранит вашу серию (${d} ${ruDays(d)}).`,
  moreItems: (n) => `… и ещё ${n}`,
  teacherStatusTitle: "📊 <b>Ваши группы сейчас</b>",
  upcomingTitle: "📚 Задания со сроком в ближайшие 7 дней:",
  noUpcoming: "📚 Заданий со сроком в ближайшие 7 дней нет.",
  noGroups: "У вас пока нет групп.",
  reviewsLine: (n) => `✍️ Ждут вашей проверки: ${n} (последние 14 дней)`,
  submitted: (x, y) => `сдали ${x}/${y}`,
  whenDue: (w, d) => (w === "today" ? "срок сегодня" : w === "yesterday" ? "срок был вчера" : w === "tomorrow" ? "срок завтра" : `срок ${d}`),
  digestTitle: "📋 <b>Отчёт за день</b>",
  digestHomeworkTitle: "📚 <b>Домашние задания</b>",
  missingNames: (l) => `Не сдали: ${l}`,
  digestReviews: (n) => `✍️ <b>Ждут вашей проверки:</b> ${n} Writing/Speaking (последние 14 дней)`,
  digestInactiveTitle: (n) => `💤 <b>Неактивны 7+ дней</b> (${n}):`,
  inactiveItem: (n, d) => `${n} (${d} дн.)`,
  andMore: (n) => `и ещё ${n}`,
  adminTitle: (m) => (m === "daily" ? "Сводка за день" : "Сегодня на данный момент"),
  adminNewStudents: (n) => `Новые ученики: ${n}`,
  adminPlacements: (n) => `Завершённые placement-тесты: ${n}`,
  adminPayments: (n) => `Ожидающие платежи: ${n}`,
  adminReviews: (n) => `Работы на проверке: ${n} (последние 14 дней)`,
  adminHomework: (n) => `Создано домашних заданий: ${n}`,
  weeklyTitle: (m) => (m === "weekly" ? "Недельный отчёт" : "Эта неделя на данный момент"),
  studentLine: (n) => `Ученик: ${n}`,
  activeDays: (a, d) => `Активные дни: ${a} из ${d}`,
  testsLabel: "Тесты:",
  testItem: (s, c, band) => `${s} — ${c}${band ? ` (последний балл ${band})` : ""}`,
  noTests: "Тесты: на этой неделе не было",
  homeworkLine: (s, a) => `Задания с истёкшим сроком: сдано ${s} из ${a}`,
  noHomeworkWeek: "Домашние задания: на этой неделе сроков не было",
  noHomeworkDueYet: "Домашние задания: сроки на этой неделе ещё не наступили",
  handedInEarly: (n, afterDue) => (afterDue ? `ещё ${n} сдано досрочно` : `${n} уже сдано досрочно`),
  missedLine: (l) => `Не сдано (срок прошёл): ${l}`,
  toDoLine: (l) => `Ещё предстоит сдать: ${l}`,
  dueItem: (t, d) => `${t} (срок ${d})`,
  attendanceLine: (a) =>
    `Посещаемость: присутствие — ${a.present}, пропуски — ${a.absent}, опоздания — ${a.late}${a.excused ? `, по уважительной причине — ${a.excused}` : ""}`,
  noAttendance: "Посещаемость: на этой неделе отметок нет",
  streakLine: (d) => `Серия: ${d} ${ruDays(d)} подряд`,
  noStreak: "Серия: пока нет",
  reviewsWeek: (n) => `Проверено учителем: ${n} ${ruPlural(n, "работа", "работы", "работ")}`,
};

const DICTS: Record<Lang, Dict> = { en: EN, uz: UZ, ru: RU };

/** The dictionary of a language (unknown values read as Uzbek). */
export function tr(lang: Lang | string | null | undefined): Dict {
  return DICTS[asLang(lang)];
}

/** The bot's "/" command menu (setMyCommands), per language. */
export const BOT_COMMANDS: Record<Lang, { command: string; description: string }[]> = {
  uz: [
    { command: "status", description: "Hozirgi holat" },
    { command: "help", description: "Buyruqlar roʻyxati" },
    { command: "lang", description: "Tilni oʻzgartirish (ota-onalar uchun)" },
    { command: "stop", description: "Xabarlarni toʻxtatish" },
    { command: "disconnect", description: "Ota-ona ulanishini oʻchirish" },
  ],
  ru: [
    { command: "status", description: "Текущее состояние" },
    { command: "help", description: "Список команд" },
    { command: "lang", description: "Сменить язык (для родителей)" },
    { command: "stop", description: "Отключить уведомления" },
    { command: "disconnect", description: "Удалить родительское подключение" },
  ],
  en: [
    { command: "status", description: "Your status right now" },
    { command: "help", description: "List of commands" },
    { command: "lang", description: "Change language (parents)" },
    { command: "stop", description: "Turn notifications off" },
    { command: "disconnect", description: "Remove a parent connection (parents)" },
  ],
};

// ---------------------------------------------------------------------------
// Composite messages
// ---------------------------------------------------------------------------

/** Button row opening a page of the app (none without a public https URL). */
export function openAppKeyboard(lang: Lang, url: string | null): Keyboard | undefined {
  return url ? [[{ text: tr(lang).openApp, url }]] : undefined;
}

/** The parent's language choice (callback data "lang:uz" / "lang:ru"). */
export function languageKeyboard(): Keyboard {
  return [
    [
      { text: "🇺🇿 Oʻzbekcha", callback_data: "lang:uz" },
      { text: "🇷🇺 Русский", callback_data: "lang:ru" },
    ],
  ];
}

function nameList(names: string[], max: number, andMore: (n: number) => string, bold = false): string {
  const shown = names.slice(0, max).map((n) => (bold ? b(n, 40) : e(n, 40)));
  const rest = names.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} ${andMore(rest)}` : shown.join(", ");
}

/** Shown in a chat that isn't linked yet — all three languages. */
export function notLinkedText(): string {
  return joinLines([
    "👋 <b>Averna</b>",
    "",
    "🇺🇿 Ulash uchun Averna saytida <b>Settings → Telegram → Connect Telegram</b> tugmasini bosing. Ota-onalar taklif havolasini oʻqituvchidan oladi.",
    "",
    "🇷🇺 Чтобы подключиться, откройте в Averna <b>Settings → Telegram → Connect Telegram</b>. Родители получают ссылку-приглашение у учителя.",
    "",
    "🇬🇧 To connect, open <b>Settings → Telegram → Connect Telegram</b> in Averna. Parents get an invite link from the teacher.",
  ]);
}

/** Bilingual prompt after a parent opens an invite (and for /lang). */
export function chooseLanguageText(children: string[]): string {
  return joinLines([
    children.length ? `✅ ${children.map((c) => b(c, 60)).join(", ")}` : null,
    children.length ? "" : null,
    "🇺🇿 Tilni tanlang",
    "🇷🇺 Выберите язык",
  ]);
}

/** `replaced`: other accounts this chat was linked to until now (unlinked, told in the app). */
export function linkedText(lang: Lang, role: UserLinkRole, name: string, replaced: string[] = []): string {
  const L = tr(lang);
  return joinLines([
    L.linkedTitle(b(name, 60)),
    ...(replaced.length ? ["", L.replacedAccounts(replaced.map((r) => b(r, 60)).join(", "))] : []),
    "",
    L.linkedBody(role),
    "",
    L.linkedFooter(role),
  ]);
}

const boldNames = (names: string[]): string => (names.length ? names.map((c) => b(c, 60)).join(", ") : "—");

/** Parent's /disconnect: the question, naming the chat's children (nothing is removed yet). */
export function disconnectAskText(lang: Lang, children: string[]): string {
  return tr(lang).disconnectAsk(boldNames(children), children.length);
}

/**
 * Callback data of the /disconnect buttons (≤ 64 bytes): "dc:s:<studentId>" one
 * child, "dc:all" every parent link of the chat, "dc:no" cancel.
 */
export const DISCONNECT_DATA = { cancel: "dc:no", all: "dc:all", childPrefix: "dc:s:" } as const;
/** Student ids that fit the callback data (cuid: 25 characters). */
export const DISCONNECT_STUDENT_ID_RE = /^[A-Za-z0-9_-]{1,59}$/;

/**
 * The /disconnect buttons. One child: Yes / Cancel. Several: one button per
 * child, "all" and Cancel. Button texts are plain (Telegram doesn't parse them).
 */
export function disconnectKeyboard(lang: Lang, children: { studentId: string | null; name: string }[]): Keyboard {
  const L = tr(lang);
  const cancel = { text: L.disconnectCancel, callback_data: DISCONNECT_DATA.cancel };
  const one = (c: { studentId: string | null }) =>
    c.studentId && DISCONNECT_STUDENT_ID_RE.test(c.studentId) ? `${DISCONNECT_DATA.childPrefix}${c.studentId}` : null;
  if (children.length <= 1) {
    return [[{ text: L.disconnectYes, callback_data: (children[0] && one(children[0])) || DISCONNECT_DATA.all }, cancel]];
  }
  const rows: Keyboard = [];
  for (const c of children) {
    const data = one(c);
    if (data) rows.push([{ text: L.disconnectChild(clip(c.name, 40) || "—"), callback_data: data }]);
  }
  rows.push([{ text: L.disconnectAll, callback_data: DISCONNECT_DATA.all }], [cancel]);
  return rows;
}

/** Parent's /disconnect confirmed: the chat's parent links (these children) are gone. */
export function parentDisconnectedText(lang: Lang, children: string[]): string {
  return tr(lang).parentDisconnected(boldNames(children), children.length);
}

/** One child's parent link removed from a chat that keeps the others. */
export function parentDisconnectedOneText(lang: Lang, child: string, others: string[]): string {
  return tr(lang).parentDisconnectedOne(b(child || "—", 60), boldNames(others));
}

/** Staff removed this chat's parent link (parent report → Remove). */
export function parentRemovedText(lang: Lang, childName: string): string {
  return tr(lang).parentRemoved(b(childName || "—", 60));
}

/**
 * The in-app notice (plain text) for an account whose chat was taken by
 * another account's link: English for students, Uzbek for staff.
 */
export function displacedNotice(role: UserLinkRole, newAccountName: string): { title: string; message: string } {
  const who = clip(newAccountName, 60) || "—";
  return role === "student"
    ? {
        title: "Telegram disconnected",
        message: `Your Telegram chat is now connected to another Averna account (${who}), so Telegram notifications for your account have stopped. To connect again: Settings → Telegram → Connect Telegram.`,
      }
    : {
        title: "Telegram uzildi",
        message: `Telegramʼingiz boshqa Averna hisobiga ulandi (${who}) — hisobingiz boʻyicha Telegram xabarlari endi kelmaydi. Qayta ulash: Settings → Telegram → Connect Telegram.`,
      };
}

export function parentWelcomeText(lang: Lang, children: string[]): string {
  const L = tr(lang);
  const names = children.length ? children.map((c) => b(c, 60)).join(", ") : "—";
  return joinLines([L.parentWelcomeTitle(names, children.length), "", L.parentWelcomeBody]);
}

export interface ChatWho {
  role: LinkRole;
  name: string;
}

/** /start in a chat that is already linked. */
export function connectedText(lang: Lang, who: ChatWho[], resumed: boolean): string {
  const L = tr(lang);
  return joinLines([
    resumed ? L.resumed : null,
    resumed ? "" : null,
    L.connectedTitle,
    ...who.map((w) => `• ${L.who(w.role, b(w.name, 60))}`),
    "",
    "/status · /help",
  ]);
}

export function helpText(lang: Lang, roles: LinkRole[]): string {
  const L = tr(lang);
  const unique = Array.from(new Set(roles));
  const status = unique.map((r) => L.helpStatus(r)).join("; ");
  const hasUser = unique.some((r) => r !== "parent");
  return joinLines([
    L.helpTitle,
    "",
    `/status — ${status}`,
    unique.includes("parent") ? L.helpLang : null,
    L.helpStop,
    unique.includes("parent") ? L.helpDisconnect : null,
    L.helpHelp,
    hasUser ? "" : null,
    hasUser ? L.helpSettings : null,
  ]);
}

/** An in-app notification forwarded to Telegram (title/message are app text). */
export function notificationText(title: string, message: string): string {
  const t = e(title, 200);
  const m = esc(clip(message, 1500));
  return joinLines([`<b>${t}</b>`, m || null]);
}

export function testMessageText(lang: Lang, name: string, at: Date): string {
  const L = tr(lang);
  return joinLines([L.testTitle, L.testBody(b(name, 60), `${fmtDate(at, lang)}, ${fmtTime(at)}`)]);
}

function progressLine(L: Dict, lang: Lang, p: HomeworkProgress, withMissing: boolean): string[] {
  const done = p.total > 0 && p.submitted >= p.total;
  const head = `• ${b(p.title)} (${e(p.group, 40)}) — ${L.whenDue(p.when, fmtDue(p.dueDate, lang))}: ${L.submitted(p.submitted, p.total)}${done ? " ✅" : ""}`;
  if (!withMissing || !p.missing.length) return [head];
  return [head, `   ${L.missingNames(nameList(p.missing, CAPS.names, L.andMore))}`];
}

export function studentStatusText(lang: Lang, s: StudentStatus): string {
  const L = tr(lang);
  return joinLines([
    `📊 ${b(s.name, 60)}`,
    L.streak(s.streak.days, s.streak.state),
    s.next ? L.next(b(s.next.title), fmtDue(s.next.dueDate, lang), Math.max(0, s.pending - 1)) : L.noHomework,
  ]);
}

export function teacherStatusText(lang: Lang, s: TeacherStatus): string {
  const L = tr(lang);
  if (!s.hasGroups) return joinLines([L.teacherStatusTitle, L.noGroups, L.reviewsLine(s.reviewsWaiting)]);
  const shown = s.upcoming.slice(0, CAPS.upcoming);
  return joinLines([
    L.teacherStatusTitle,
    s.upcoming.length ? L.upcomingTitle : L.noUpcoming,
    ...shown.flatMap((p) => progressLine(L, lang, p, false)),
    s.upcoming.length > shown.length ? `   ${L.moreItems(s.upcoming.length - shown.length)}` : null,
    "",
    L.reviewsLine(s.reviewsWaiting),
  ]);
}

export function adminSummaryText(lang: Lang, s: AdminSummary, mode: "daily" | "status"): string {
  const L = tr(lang);
  return joinLines([
    `📊 <b>${L.adminTitle(mode)}</b> · ${fmtDate(s.day, lang)}`,
    `• ${L.adminNewStudents(s.newStudents)}`,
    `• ${L.adminPlacements(s.placementsFinished)}`,
    `• ${L.adminPayments(s.pendingPayments)}`,
    `• ${L.adminReviews(s.reviewsWaiting)}`,
    `• ${L.adminHomework(s.homeworkCreated)}`,
  ]);
}

export function weeklyReportText(lang: Lang, r: WeeklyReport, mode: "weekly" | "status"): string {
  const L = tr(lang);
  const tests = r.tests.map((t) => L.testItem(SKILL_NAME[t.skill], t.count, t.latestBand == null ? null : fmtBand(t.latestBand)));
  const hw = r.homework;
  const list = (items: DueItem[], line: (listHtml: string) => string): string | null => {
    if (!items.length) return null;
    const shown = items.slice(0, CAPS.missingHomework).map((m) => L.dueItem(b(m.title, 60), fmtDue(m.dueDate, lang)));
    return `   ${line(shown.join(", "))}${items.length > shown.length ? ` ${L.andMore(items.length - shown.length)}` : ""}`;
  };
  const a = r.attendance;
  const marked = a.present + a.absent + a.late + a.excused;
  // Handed in before a deadline that hasn't come yet — credited even when nothing is due so far.
  const early = hw.early > 0 ? ` · ${L.handedInEarly(hw.early, hw.due > 0)}` : "";
  return joinLines([
    `📘 <b>${L.weeklyTitle(mode)}</b> · ${fmtRange(r.weekStart, r.lastDay, lang)}`,
    L.studentLine(b(r.name, 60)),
    "",
    `📅 ${L.activeDays(r.activeDays, r.days)}`,
    `📝 ${tests.length ? `${L.testsLabel} ${tests.join(", ")}` : L.noTests}`,
    // "X of Y submitted" only over homework already due; the rest is "still to do" (or early), not missed.
    `📚 ${hw.due ? L.homeworkLine(hw.submitted, hw.due) : hw.total ? L.noHomeworkDueYet : L.noHomeworkWeek}${early}`,
    list(hw.missed, L.missedLine),
    list(hw.toDo, L.toDoLine),
    `🏫 ${marked ? L.attendanceLine(a) : L.noAttendance}`,
    `🔥 ${r.streak > 0 ? L.streakLine(r.streak) : L.noStreak}`,
    `✍️ ${L.reviewsWeek(r.reviews)}`,
  ]);
}

export function studentEveningText(lang: Lang, r: StudentReminder): string {
  const L = tr(lang);
  const due = r.dueTomorrow.slice(0, CAPS.due);
  return joinLines([
    L.eveningTitle,
    ...(due.length
      ? ["", L.dueTomorrowTitle, ...due.map((d) => `• ${b(d.title)} — ${fmtDue(d.dueDate, lang)}`)]
      : []),
    r.dueTomorrow.length > due.length ? `   ${L.moreItems(r.dueTomorrow.length - due.length)}` : null,
    ...(r.streak ? ["", r.streak.state === "freeze_will_save" ? L.streakFreeze(r.streak.days) : L.streakAtRisk(r.streak.days)] : []),
  ]);
}

export function teacherDigestText(lang: Lang, d: TeacherDigest, day: Date): string {
  const L = tr(lang);
  const inactive = d.inactive.slice(0, CAPS.inactive).map((s) => L.inactiveItem(e(s.name, 40), s.days));
  const moreInactive = d.inactive.length - inactive.length;
  const head = [`${L.digestTitle} · ${fmtDate(day, lang)}`];
  const tail = [
    ...(d.reviewsWaiting > 0 ? ["", L.digestReviews(d.reviewsWaiting)] : []),
    ...(d.inactive.length
      ? ["", L.digestInactiveTitle(d.inactive.length), `${inactive.join(", ")}${moreInactive > 0 ? ` ${L.andMore(moreInactive)}` : ""}`]
      : []),
  ];
  // Homework items fill the space the other sections leave, so those always fit.
  let used = joinLines([...head, ...tail]).length + L.digestHomeworkTitle.length + 80;
  const hwLines: string[] = [];
  let shown = 0;
  for (const p of d.homework.slice(0, CAPS.homework)) {
    const lines = progressLine(L, lang, p, true);
    const len = lines.join("\n").length + 1;
    if (used + len > SAFE_CHARS) break;
    hwLines.push(...lines);
    used += len;
    shown++;
  }
  const more = d.homework.length - shown;
  return joinLines([
    ...head,
    ...(d.homework.length ? ["", L.digestHomeworkTitle, ...hwLines, more > 0 ? `   ${L.moreItems(more)}` : null] : []),
    ...tail,
  ]);
}
