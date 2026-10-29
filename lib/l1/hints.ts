/**
 * Native-language hints: a curated, template-based translator for the
 * standard, repetitive instruction text of the IELTS papers — question
 * instructions and answer rules (Reading / Listening), question-type names
 * with a one-line tip, Writing task rubrics and the Speaking examiner's lines.
 * No AI, no network. Pure; runs on the server and in the browser.
 *
 * Honesty rules:
 *   - Unknown text → null. A multi-sentence instruction gets a hint only when
 *     EVERY sentence is known, so a hint is never partial or guessed.
 *   - Numbers, question ranges (1–6) and letter ranges (A–G, i–x) are copied
 *     exactly; the IELTS answers TRUE / FALSE / NOT GIVEN and YES / NO stay in
 *     English, and so do names ("Reading Passage 1", "Averna") and content
 *     phrases the paper itself names (kept in «…», e.g. a speaking topic).
 *   - Uzbek is Latin script: oʻ / gʻ with U+02BB, tutuq belgisi U+02BC (maʼlumot).
 */

import type { PracticeKind } from "@/lib/ielts/types";

export type L1Lang = "uz" | "ru";

export const L1_LANGS: readonly L1Lang[] = ["uz", "ru"];

/** Picker labels (in the language itself). */
export const L1_NAME: Record<L1Lang, string> = { uz: "Oʻzbekcha", ru: "Русский" };

/** Accessible name of the hint tag. */
export const L1_HINT_LABEL: Record<L1Lang, string> = { uz: "Hint in Uzbek", ru: "Hint in Russian" };

// ---------------------------------------------------------------------------
// Numbers and grammar helpers
// ---------------------------------------------------------------------------

const EN_NUMBER: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/** Own-key lookup (never "constructor", "toString" … from the prototype). */
function own<T>(table: Record<string, T>, key: string | undefined): T | undefined {
  return key != null && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

function enNumber(word: string): number | null {
  if (/^\d+$/.test(word)) return Number(word);
  return own(EN_NUMBER, word.toLowerCase()) ?? null;
}

const UZ_NUMBER = ["nol", "bir", "ikki", "uch", "toʻrt", "besh", "olti", "yetti", "sakkiz", "toʻqqiz", "oʻn"];

/** "ikki" (cardinal). */
function uzNum(n: number): string {
  if (n <= 10) return UZ_NUMBER[n];
  if (n < 20) return `oʻn ${UZ_NUMBER[n - 10]}`;
  return String(n);
}

/** "ikkita" / "bitta" (counting form). */
function uzTa(n: number): string {
  if (n === 1) return "bitta";
  if (n > 10 && n < 20) return `oʻn ${uzTa(n - 10)}`;
  if (n > 10) return `${n} ta`;
  return `${UZ_NUMBER[n]}ta`;
}

const RU_MASC = ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать"];
const RU_FEM_ACC = ["ноль", "одну", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать"];
const RU_GEN = ["ноля", "одного", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти", "десяти", "одиннадцати", "двенадцати"];

const ruWord = (list: string[], n: number) => list[n] ?? String(n);

/** Russian noun form for a count: 1 книга, 2 книги, 5 книг. */
function ruPlural(n: number, one: string, few: string, many: string): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return one;
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few;
  return many;
}

/** After "около" / "не менее" (genitive): 1 → singular, otherwise plural. */
function ruGenCount(n: number, sg: string, pl: string): string {
  return n % 10 === 1 && n % 100 !== 11 ? sg : pl;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "A, B or C" → "A, B yoki C" / "A, B или C"; ranges stay as they are. */
function letters(raw: string, lang: L1Lang): string {
  return raw
    .replace(/\s+or\s+/gi, lang === "uz" ? " yoki " : " или ")
    .replace(/\s+and\s+/gi, lang === "uz" ? " va " : " и ");
}

const plural = (nums: string) => /\D/.test(nums.trim());
const nums = (raw: string, lang: L1Lang) => raw.replace(/\s+(?:and|&)\s+/gi, lang === "uz" ? " va " : " и ");

/** "14–19-savollar" / "7-savol". */
function uzQuestions(raw: string): string {
  return `${nums(raw, "uz")}-${plural(raw) ? "savollar" : "savol"}`;
}

/** Russian "вопросы 14–19" in the case the sentence needs. */
function ruQuestions(raw: string, form: "nom" | "inst"): string {
  const pl = plural(raw);
  const word = form === "inst" ? (pl ? "вопросами" : "вопросом") : pl ? "вопросы" : "вопрос";
  return `${word} ${nums(raw, "ru")}`;
}

// ---------------------------------------------------------------------------
// Pattern pieces
// ---------------------------------------------------------------------------

const D = "[–—-]";
const NUMS = `(?:\\d+\\s*${D}\\s*\\d+|\\d+(?:\\s+(?:and|&)\\s+\\d+)?)`;
const LETTER_RANGE = `[A-Z]\\s*${D}\\s*[A-Z]`;
const LETTER_LIST = `(?:${LETTER_RANGE}|[A-Z](?:,\\s*[A-Z])*,?\\s+(?:or|and)\\s+[A-Z])`;
const ROMAN_RANGE = `[ivxl]+\\s*${D}\\s*[ivxl]+`;
const NUMWORD = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const LIMIT = `(?:NO MORE THAN ${NUMWORD} WORDS?(?:\\/NUMBERS)?|ONE WORD(?: ONLY)?)(?: (?:AND\\/OR|OR) A NUMBER)?`;
const SOURCE = "the (?:reading )?passage|the text|Reading Passage \\d+";

const rx = (body: string) => new RegExp(`^${body}$`, "i");

interface Limit {
  n: number;
  only: boolean;
  number: boolean;
}

function parseLimit(raw: string): Limit | null {
  // "WORDS/NUMBERS" and "OR A NUMBER" (Listening papers) mean the same as "AND/OR A NUMBER".
  const m = raw.match(new RegExp(`^(?:NO MORE THAN (${NUMWORD}) WORDS?(\\/NUMBERS)?|ONE WORD( ONLY)?)( (?:AND\\/OR|OR) A NUMBER)?$`, "i"));
  if (!m) return null;
  const n = m[1] ? enNumber(m[1]) : 1;
  if (n == null || n < 1 || n > 12) return null;
  return { n, only: !!m[3], number: !!m[2] || !!m[4] };
}

function limitClause(l: Limit, lang: L1Lang): string {
  if (lang === "uz") {
    const num = l.number ? " va/yoki raqam" : "";
    if (l.n > 1) return `koʻpi bilan ${uzNum(l.n).toUpperCase()} soʻz${num}`;
    return `${l.only ? "faqat " : ""}BITTA soʻz${num}`;
  }
  const num = l.number ? " И/ИЛИ ЧИСЛО" : "";
  if (l.n > 1) return `НЕ БОЛЕЕ ${ruWord(RU_GEN, l.n).toUpperCase()} СЛОВ${num}`;
  return `${l.only ? "ТОЛЬКО " : ""}ОДНО СЛОВО${num}`;
}

/** "from the passage" → uz prefix "matndan " / ru suffix " из текста". */
function sourcePart(raw: string | undefined, lang: L1Lang): string {
  if (!raw) return "";
  const n = raw.match(/Reading Passage (\d+)/i)?.[1];
  if (lang === "uz") return n ? `Reading Passage ${n} matnidan ` : "matndan ";
  return n ? ` из Reading Passage ${n}` : " из текста";
}

const VERB: Record<string, Record<L1Lang, string>> = {
  write: { uz: "yozing", ru: "напишите" },
  choose: { uz: "tanlang", ru: "выберите" },
  use: { uz: "ishlating", ru: "используйте" },
};

function limitSentence(verb: string, limit: Limit, source: string | undefined, each: boolean, lang: L1Lang): string {
  const v = VERB[verb.toLowerCase()][lang];
  const clause = limitClause(limit, lang);
  const src = sourcePart(source, lang);
  if (lang === "uz") return each ? `Har bir javob uchun ${src}${clause} ${v}.` : `${cap(`${src}${clause}`)} ${v}.`;
  return each ? `Для каждого ответа ${v} ${clause}${src}.` : `${cap(v)} ${clause}${src}.`;
}

// Nouns used inside the matching instructions -------------------------------

/** Things being matched ("Look at the following statements …", "Match each statement …"). */
const ITEMS: Record<string, { uzPl: string; uzSg: string; ruPl: string; ruEach: string }> = {
  statement: { uzPl: "fikrlarni", uzSg: "fikrni", ruPl: "утверждения", ruEach: "каждое утверждение" },
  description: { uzPl: "tavsiflarni", uzSg: "tavsifni", ruPl: "описания", ruEach: "каждое описание" },
  finding: { uzPl: "natijalarni", uzSg: "natijani", ruPl: "результаты", ruEach: "каждый результат" },
  claim: { uzPl: "daʼvolarni", uzSg: "daʼvoni", ruPl: "заявления", ruEach: "каждое заявление" },
  idea: { uzPl: "gʻoyalarni", uzSg: "gʻoyani", ruPl: "идеи", ruEach: "каждую идею" },
  event: { uzPl: "voqealarni", uzSg: "voqeani", ruPl: "события", ruEach: "каждое событие" },
  opinion: { uzPl: "fikrlarni", uzSg: "fikrni", ruPl: "мнения", ruEach: "каждое мнение" },
  feature: { uzPl: "xususiyatlarni", uzSg: "xususiyatni", ruPl: "характеристики", ruEach: "каждую характеристику" },
};

/** The list the letters belong to ("the list of researchers below"): uz plural, ru genitive plural. */
const LIST_NOUNS: Record<string, { uz: string; ru: string }> = {
  researcher: { uz: "tadqiqotchilar", ru: "исследователей" },
  scientist: { uz: "olimlar", ru: "учёных" },
  person: { uz: "odamlar", ru: "людей" },
  expert: { uz: "mutaxassislar", ru: "экспертов" },
  writer: { uz: "yozuvchilar", ru: "писателей" },
  author: { uz: "mualliflar", ru: "авторов" },
  company: { uz: "kompaniyalar", ru: "компаний" },
  country: { uz: "mamlakatlar", ru: "стран" },
  city: { uz: "shaharlar", ru: "городов" },
  place: { uz: "joylar", ru: "мест" },
  period: { uz: "davrlar", ru: "периодов" },
  theory: { uz: "nazariyalar", ru: "теорий" },
  study: { uz: "tadqiqotlar", ru: "исследований" },
  organisation: { uz: "tashkilotlar", ru: "организаций" },
  inventor: { uz: "ixtirochilar", ru: "изобретателей" },
  historian: { uz: "tarixchilar", ru: "историков" },
  psychologist: { uz: "psixologlar", ru: "психологов" },
  economist: { uz: "iqtisodchilar", ru: "экономистов" },
  speaker: { uz: "soʻzlovchilar", ru: "говорящих" },
  product: { uz: "mahsulotlar", ru: "продуктов" },
  animal: { uz: "hayvonlar", ru: "животных" },
  type: { uz: "turlar", ru: "типов" },
  feature: { uz: "xususiyatlar", ru: "характеристик" },
};

const IRREGULAR_SINGULAR: Record<string, string> = {
  people: "person", companies: "company", countries: "country", cities: "city", theories: "theory",
  studies: "study", organizations: "organisation", organization: "organisation", organisations: "organisation",
};

/** "researchers" / "researcher" / "people" → the dictionary key. */
function singular(word: string): string {
  const w = word.toLowerCase();
  return own(IRREGULAR_SINGULAR, w) ?? (w.endsWith("s") ? w.slice(0, -1) : w);
}

/** What gets completed: uz locative ("…dagi") and accusative, ru prepositional (после "в"). */
const COMPLETE_OBJECTS: Record<string, { uzLoc: string; uzAcc: string; ruLoc: string }> = {
  notes: { uzLoc: "qaydlardagi", uzAcc: "qaydlarni", ruLoc: "заметках" },
  table: { uzLoc: "jadvaldagi", uzAcc: "jadvalni", ruLoc: "таблице" },
  summary: { uzLoc: "qisqacha bayondagi", uzAcc: "qisqacha bayonni", ruLoc: "кратком содержании" },
  sentences: { uzLoc: "gaplardagi", uzAcc: "gaplarni", ruLoc: "предложениях" },
  sentence: { uzLoc: "gapdagi", uzAcc: "gapni", ruLoc: "предложении" },
  "flow-chart": { uzLoc: "blok-sxemadagi", uzAcc: "blok-sxemani", ruLoc: "блок-схеме" },
  flowchart: { uzLoc: "blok-sxemadagi", uzAcc: "blok-sxemani", ruLoc: "блок-схеме" },
  "flow chart": { uzLoc: "blok-sxemadagi", uzAcc: "blok-sxemani", ruLoc: "блок-схеме" },
  diagram: { uzLoc: "chizmadagi", uzAcc: "chizmani", ruLoc: "схеме" },
  form: { uzLoc: "anketadagi", uzAcc: "anketani", ruLoc: "форме" },
  chart: { uzLoc: "grafikdagi", uzAcc: "grafikni", ruLoc: "графике" },
  timetable: { uzLoc: "jadvaldagi", uzAcc: "jadvalni", ruLoc: "расписании" },
  text: { uzLoc: "matndagi", uzAcc: "matnni", ruLoc: "тексте" },
  paragraph: { uzLoc: "xatboshidagi", uzAcc: "xatboshini", ruLoc: "абзаце" },
  map: { uzLoc: "xaritadagi", uzAcc: "xaritani", ruLoc: "карте" },
  plan: { uzLoc: "rejadagi", uzAcc: "rejani", ruLoc: "плане" },
  list: { uzLoc: "roʻyxatdagi", uzAcc: "roʻyxatni", ruLoc: "списке" },
  timeline: { uzLoc: "vaqt chizigʻidagi", uzAcc: "vaqt chizigʻini", ruLoc: "хронологии" },
};
const COMPLETE_KEYS = Object.keys(COMPLETE_OBJECTS).map((k) => k.replace("-", "\\-")).join("|");

const LABEL_OBJECTS: Record<string, Record<L1Lang, string>> = {
  map: { uz: "xaritaga", ru: "карту" },
  plan: { uz: "rejaga", ru: "план" },
  diagram: { uz: "chizmaga", ru: "схему" },
  chart: { uz: "grafikka", ru: "график" },
  picture: { uz: "rasmga", ru: "рисунок" },
};

const WORD_LISTS: Record<string, Record<L1Lang, string>> = {
  words: { uz: "soʻzlar", ru: "слов" },
  "words and phrases": { uz: "soʻz va iboralar", ru: "слов и выражений" },
  phrases: { uz: "iboralar", ru: "выражений" },
  names: { uz: "nomlar", ru: "названий" },
  ideas: { uz: "gʻoyalar", ru: "идей" },
};

// Listening matching prompts ("What do the students say about each of the following …?")

const SUBJECTS: Record<string, { uz: string; ru: string; plural: boolean }> = {
  "the students": { uz: "talabalar", ru: "студенты", plural: true },
  students: { uz: "talabalar", ru: "студенты", plural: true },
  "the two students": { uz: "ikki talaba", ru: "двое студентов", plural: true },
  "the speakers": { uz: "soʻzlovchilar", ru: "говорящие", plural: true },
  "the speaker": { uz: "soʻzlovchi", ru: "говорящий", plural: false },
  "the man": { uz: "erkak", ru: "мужчина", plural: false },
  "the woman": { uz: "ayol", ru: "женщина", plural: false },
  visitors: { uz: "tashrif buyuruvchilar", ru: "посетители", plural: true },
  volunteers: { uz: "koʻngillilar", ru: "волонтёры", plural: true },
  "the tutor": { uz: "oʻqituvchi", ru: "преподаватель", plural: false },
  "the lecturer": { uz: "maʼruzachi", ru: "лектор", plural: false },
  "the guide": { uz: "gid", ru: "гид", plural: false },
  "the manager": { uz: "menejer", ru: "менеджер", plural: false },
};

function subjectOf(raw: string): { uz: string; ru: string; plural: boolean } | null {
  const known = own(SUBJECTS, raw.toLowerCase());
  if (known) return known;
  // A person's name ("Graham", "Mrs Lee") stays as it is.
  if (/^(?:(?:Mr|Mrs|Ms|Dr)\.? )?[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(raw)) return { uz: raw, ru: raw, plural: false };
  return null;
}

const quoted = (x: string | undefined) => (x ? ` («${x.trim()}»)` : "");

// ---------------------------------------------------------------------------
// Rules — one sentence each
// ---------------------------------------------------------------------------

type Out = (m: RegExpMatchArray, lang: L1Lang) => string | null;
interface Rule {
  re: RegExp;
  out: Out;
  /** Standard wording inside a Writing prompt (see writingInstructionText). */
  prompt?: true;
}

const fixed = (uz: string, ru: string): Out => (_m, lang) => (lang === "uz" ? uz : ru);

const RULES: Rule[] = [
  // "Questions 1–6" / "Question 7" headers.
  {
    re: rx(`Questions? (${NUMS})`),
    out: (m, lang) => (lang === "uz" ? uzQuestions(m[1]) : cap(ruQuestions(m[1], "nom"))),
  },
  // "Write NO MORE THAN TWO WORDS AND/OR A NUMBER from the passage for each answer."
  {
    re: rx(`(Write|Choose|Use) (${LIMIT})(?: from (${SOURCE}))?( for each answer)?\\.?`),
    out: (m, lang) => {
      const limit = parseLimit(m[2]);
      return limit ? limitSentence(m[1], limit, m[3], !!m[4], lang) : null;
    },
  },
  // A bare limit: "ONE WORD ONLY", "NO MORE THAN THREE WORDS AND/OR A NUMBER".
  {
    re: rx(`(${LIMIT})\\.?`),
    out: (m, lang) => {
      const limit = parseLimit(m[1]);
      return limit ? `${cap(limitClause(limit, lang))}.` : null;
    },
  },
  // "Answer the questions below (using NO MORE THAN … for each answer)."
  {
    re: rx(`Answer the (questions?) below(?:,? using (${LIMIT})(?: from (${SOURCE}))?(?: for each answer)?)?\\.?`),
    out: (m, lang) => {
      const pl = /s$/i.test(m[1]);
      const base = lang === "uz" ? `Quyidagi ${pl ? "savollarga" : "savolga"} javob bering.` : `Ответьте на ${pl ? "вопросы" : "вопрос"} ниже.`;
      if (!m[2]) return base;
      const limit = parseLimit(m[2]);
      return limit ? `${base} ${limitSentence("write", limit, m[3], true, lang)}` : null;
    },
  },
  // "Choose the correct letter, A, B, C or D." / "…, A–I, for each answer." / "Choose the correct answer."
  {
    re: rx(`Choose the (?:correct|best) (letter|answer|option)(?:,? (${LETTER_LIST}))?(,? for each answer)?\\.?`),
    out: (m, lang) => {
      const kind = m[1].toLowerCase();
      const list = m[2] ? letters(m[2], lang) : "";
      const each = !!m[3];
      if (lang === "uz") {
        const noun = kind === "letter" ? "harfni" : kind === "answer" ? "javobni" : "variantni";
        return `${each ? "Har bir javob uchun toʻgʻri" : "Toʻgʻri"} ${noun} tanlang${list ? `: ${list}` : ""}.`;
      }
      const noun = kind === "letter" ? "правильную букву" : kind === "answer" ? "правильный ответ" : "правильный вариант";
      return `${each ? "Для каждого ответа выберите" : "Выберите"} ${noun}${list ? `: ${list}` : ""}.`;
    },
  },
  // "Choose the correct letter, A–I, for questions 6–8." / "…, next to questions 15–20."
  {
    re: rx(`Choose the correct letter,? (${LETTER_LIST}),? (?:for|next to) questions? (${NUMS})\\.?`),
    out: (m, lang) =>
      lang === "uz"
        ? `${uzQuestions(m[2])} uchun toʻgʻri harfni tanlang: ${letters(m[1], "uz")}.`
        : `Выберите правильную букву (${letters(m[1], "ru")}) для ${plural(m[2]) ? "вопросов" : "вопроса"} ${nums(m[2], "ru")}.`,
  },
  // "Choose TRUE, FALSE or NOT GIVEN." / "Choose YES, NO or NOT GIVEN."
  {
    re: rx("Choose (TRUE), (FALSE) or (NOT GIVEN)\\.?|Choose (YES), (NO) or (NOT GIVEN)\\.?"),
    out: (m, lang) => {
      const [a, b, c] = m[1] ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]];
      return lang === "uz" ? `${a}, ${b} yoki ${c} ni tanlang.` : `Выберите ${a}, ${b} или ${c}.`;
    },
  },
  // "Choose A, B or C."
  {
    re: rx(`Choose (${LETTER_LIST})\\.?`),
    out: (m, lang) => (lang === "uz" ? `Bittasini tanlang: ${letters(m[1], "uz")}.` : `Выберите один вариант: ${letters(m[1], "ru")}.`),
  },
  // "Choose FIVE correct answers, A–G, next to questions 16–20." / "Choose TWO correct answers, A–E."
  {
    re: rx(`Choose (${NUMWORD}) correct answers(?:,? (${LETTER_LIST}))?(?:,? next to questions? (${NUMS}))?\\.?`),
    out: (m, lang) => {
      const n = enNumber(m[1]);
      if (n == null || n < 1 || n > 12) return null;
      const list = m[2] ? `: ${letters(m[2], lang)}` : "";
      if (lang === "uz") return `${uzTa(n).toUpperCase()} toʻgʻri javobni tanlang${list}${m[3] ? ` (${uzQuestions(m[3])})` : ""}.`;
      return `Выберите ${ruWord(RU_MASC, n).toUpperCase()} ${ruPlural(n, "правильный ответ", "правильных ответа", "правильных ответов")}${list}${m[3] ? ` (${ruQuestions(m[3], "nom")})` : ""}.`;
    },
  },
  // "Choose TWO letters, A–E."
  {
    re: rx(`Choose (${NUMWORD}) (letters|answers|options)(?:,? (${LETTER_LIST}))?\\.?`),
    out: (m, lang) => {
      const n = enNumber(m[1]);
      if (n == null || n < 1 || n > 12) return null;
      const kind = m[2].toLowerCase();
      const list = m[3] ? `: ${letters(m[3], lang)}` : "";
      if (lang === "uz") {
        const noun = kind === "letters" ? "harfni" : kind === "answers" ? "javobni" : "variantni";
        return `${uzTa(n).toUpperCase()} ${noun} tanlang${list}.`;
      }
      const phrase =
        kind === "letters"
          ? `${ruWord(RU_FEM_ACC, n).toUpperCase()} ${ruPlural(n, "букву", "буквы", "букв")}`
          : kind === "answers"
            ? `${ruWord(RU_MASC, n).toUpperCase()} ${ruPlural(n, "ответ", "ответа", "ответов")}`
            : `${ruWord(RU_MASC, n).toUpperCase()} ${ruPlural(n, "вариант", "варианта", "вариантов")}`;
      return `Выберите ${phrase}${list}.`;
    },
  },
  // "Choose FIVE answers from the box and write the correct letter, A–G, next to Questions 16–20."
  {
    re: rx(`Choose (${NUMWORD}) answers from the (?:box|list)(?: below)? and write the correct letter,? (${LETTER_LIST}),? next to questions? (${NUMS})\\.?`),
    out: (m, lang) => {
      const n = enNumber(m[1]);
      if (n == null || n < 1 || n > 12) return null;
      const list = letters(m[2], lang);
      if (lang === "uz") return `Roʻyxatdan ${uzTa(n).toUpperCase()} javobni tanlang va ${uzQuestions(m[3])} yoniga toʻgʻri harfni (${list}) yozing.`;
      return `Выберите ${ruWord(RU_MASC, n).toUpperCase()} ${ruPlural(n, "ответ", "ответа", "ответов")} из списка и напишите правильную букву (${list}) рядом с ${ruQuestions(m[3], "inst")}.`;
    },
  },
  // Paper-style answer-sheet lines.
  {
    re: rx(`Write the correct letter,? (${LETTER_LIST}),? in boxes (${NUMS}) on your answer sheet\\.?`),
    out: (m, lang) =>
      lang === "uz"
        ? `Javoblar varaqasidagi ${nums(m[2], "uz")}-kataklarga toʻgʻri harfni (${letters(m[1], "uz")}) yozing.`
        : `Запишите правильную букву (${letters(m[1], "ru")}) в клетки ${nums(m[2], "ru")} листа ответов.`,
  },
  {
    re: rx(`Write your answers in boxes (${NUMS}) on your answer sheet\\.?`),
    out: (m, lang) =>
      lang === "uz"
        ? `Javoblaringizni javoblar varaqasidagi ${nums(m[1], "uz")}-kataklarga yozing.`
        : `Запишите ответы в клетки ${nums(m[1], "ru")} листа ответов.`,
  },
  {
    re: rx(`In boxes (${NUMS}) on your answer sheet,? (?:write|choose):?`),
    out: (m, lang) =>
      lang === "uz" ? `Javoblar varaqasidagi ${nums(m[1], "uz")}-kataklarga yozing:` : `В клетках ${nums(m[1], "ru")} листа ответов напишите:`,
  },
  // TRUE / FALSE / NOT GIVEN
  {
    re: rx(`Do the following statements agree with the information given in (${SOURCE})\\??`),
    out: (m, lang) => {
      const n = m[1].match(/(\d+)/)?.[1];
      return lang === "uz"
        ? `Quyidagi fikrlar ${n ? `Reading Passage ${n} matnida` : "matnda"} berilgan maʼlumotga mos keladimi?`
        : `Соответствуют ли следующие утверждения информации ${n ? `в Reading Passage ${n}` : "в тексте"}?`;
    },
  },
  {
    re: rx(`(Choose|Write) TRUE if the statement agrees with the information,? FALSE if the statement contradicts the information,? or NOT GIVEN if there is no information on this\\.?`),
    out: (m, lang) =>
      lang === "uz"
        ? `Agar fikr maʼlumotga mos kelsa TRUE, unga zid boʻlsa FALSE, bu haqda maʼlumot boʻlmasa NOT GIVEN ${/^w/i.test(m[1]) ? "deb yozing" : "ni tanlang"}.`
        : `${/^w/i.test(m[1]) ? "Напишите" : "Выберите"} TRUE, если утверждение соответствует информации, FALSE — если противоречит ей, или NOT GIVEN — если такой информации нет.`,
  },
  { re: rx("TRUE,? if the statement agrees with the information\\.?"), out: fixed("TRUE — fikr maʼlumotga mos kelsa", "TRUE — если утверждение соответствует информации") },
  { re: rx("FALSE,? if the statement contradicts the information\\.?"), out: fixed("FALSE — fikr maʼlumotga zid boʻlsa", "FALSE — если утверждение противоречит информации") },
  { re: rx("NOT GIVEN,? if there is no information on this\\.?"), out: fixed("NOT GIVEN — bu haqda maʼlumot boʻlmasa", "NOT GIVEN — если информации об этом нет") },
  { re: rx("TRUE\\s*\\/\\s*FALSE\\s*\\/\\s*NOT GIVEN"), out: fixed("TRUE / FALSE / NOT GIVEN — toʻgʻri / notoʻgʻri / berilmagan", "TRUE / FALSE / NOT GIVEN — верно / неверно / не указано") },
  // YES / NO / NOT GIVEN
  {
    re: rx(`Do the following statements (?:agree with|reflect) the (?:claims|views|opinions) of the (?:writer|author) in (${SOURCE})\\??`),
    out: (m, lang) => {
      const n = m[1].match(/(\d+)/)?.[1];
      return lang === "uz"
        ? `Quyidagi fikrlar ${n ? `Reading Passage ${n} matni` : "matn"} muallifining fikrlariga mos keladimi?`
        : `Соответствуют ли следующие утверждения мнению автора ${n ? `Reading Passage ${n}` : "текста"}?`;
    },
  },
  {
    re: rx(`(Choose|Write) YES if the statement agrees with the (?:claims|views) of the writer,? NO if the statement contradicts the (?:claims|views) of the writer,? or NOT GIVEN if it is impossible to say what the writer thinks about this\\.?`),
    out: (m, lang) =>
      lang === "uz"
        ? `Agar fikr muallif fikriga mos kelsa YES, unga zid boʻlsa NO, muallif bu haqda nima deb oʻylashini aniqlab boʻlmasa NOT GIVEN ${/^w/i.test(m[1]) ? "deb yozing" : "ni tanlang"}.`
        : `${/^w/i.test(m[1]) ? "Напишите" : "Выберите"} YES, если утверждение соответствует мнению автора, NO — если противоречит ему, или NOT GIVEN — если невозможно сказать, что думает об этом автор.`,
  },
  { re: rx("YES,? if the statement agrees with the (?:claims|views) of the writer\\.?"), out: fixed("YES — fikr muallif fikriga mos kelsa", "YES — если утверждение соответствует мнению автора") },
  { re: rx("NO,? if the statement contradicts the (?:claims|views) of the writer\\.?"), out: fixed("NO — fikr muallif fikriga zid boʻlsa", "NO — если утверждение противоречит мнению автора") },
  {
    re: rx("NOT GIVEN,? if it is impossible to say what the writer thinks about this\\.?"),
    out: fixed("NOT GIVEN — muallif bu haqda nima deb oʻylashini aniqlab boʻlmasa", "NOT GIVEN — если невозможно сказать, что думает об этом автор"),
  },
  { re: rx("YES\\s*\\/\\s*NO\\s*\\/\\s*NOT GIVEN"), out: fixed("YES / NO / NOT GIVEN — ha / yoʻq / berilmagan", "YES / NO / NOT GIVEN — да / нет / не указано") },
  // Matching headings / information
  {
    re: rx(`(?:Reading Passage (\\d+)|The (?:reading )?passage|The text) has (${NUMWORD}) (paragraphs|sections),? (?:labelled |labeled )?(${LETTER_RANGE})\\.?`),
    out: (m, lang) => {
      const n = enNumber(m[2]);
      if (n == null || n < 1 || n > 26) return null;
      const sections = /^s/i.test(m[3]);
      if (lang === "uz") {
        const subject = m[1] ? `Reading Passage ${m[1]} matni` : "Matn";
        return `${subject} ${uzTa(n)} ${sections ? "boʻlimdan" : "xatboshidan"} iborat: ${m[4]}.`;
      }
      const noun = sections ? ruPlural(n, "раздел", "раздела", "разделов") : ruPlural(n, "абзац", "абзаца", "абзацев");
      return `В ${m[1] ? `Reading Passage ${m[1]}` : "тексте"} ${ruWord(RU_MASC, n)} ${noun}: ${m[4]}.`;
    },
  },
  {
    re: rx(`Choose the (?:correct|most suitable) heading for (each paragraph|each section|paragraphs? (${LETTER_LIST})|sections? (${LETTER_LIST})) from the list of headings(?: below)?\\.?`),
    out: (m, lang) => {
      const target = m[1].toLowerCase();
      const list = m[2] ?? m[3];
      const section = target.includes("section");
      if (lang === "uz") {
        const t = list ? `${letters(list, "uz")} ${section ? "boʻlimlari" : "xatboshilari"}` : `har bir ${section ? "boʻlim" : "xatboshi"}`;
        return `Quyidagi sarlavhalar roʻyxatidan ${t} uchun toʻgʻri sarlavhani tanlang.`;
      }
      const t = list ? `${section ? "разделов" : "абзацев"} ${letters(list, "ru")}` : `каждого ${section ? "раздела" : "абзаца"}`;
      return `Выберите для ${t} подходящий заголовок из списка заголовков ниже.`;
    },
  },
  {
    re: rx(`Choose the correct heading from the list of headings,? (${ROMAN_RANGE}|${LETTER_LIST})\\.?`),
    out: (m, lang) =>
      lang === "uz"
        ? `Sarlavhalar roʻyxatidan toʻgʻri sarlavhani tanlang: ${m[1]}.`
        : `Выберите правильный заголовок из списка заголовков: ${m[1]}.`,
  },
  {
    re: rx("Which (paragraph|section) contains the following information\\?"),
    out: (m, lang) => {
      const section = /^s/i.test(m[1]);
      return lang === "uz"
        ? `Qaysi ${section ? "boʻlimda" : "xatboshida"} quyidagi maʼlumot bor?`
        : `В каком ${section ? "разделе" : "абзаце"} содержится следующая информация?`;
    },
  },
  {
    re: rx("(NB:?\\s+)?You may use any letter more than once\\.?"),
    out: (m, lang) =>
      lang === "uz"
        ? `${m[1] ? "Eslatma: istalgan" : "Istalgan"} harfni bir necha marta ishlatishingiz mumkin.`
        : `${m[1] ? "Примечание: любую" : "Любую"} букву можно использовать более одного раза.`,
  },
  // "NB You may choose any paragraph more than once."
  {
    re: rx("(NB:?\\s+)?You may (use|choose) any (paragraph|section|person|practice|option|answer) more than once\\.?"),
    out: (m, lang) => {
      const choose = m[2].toLowerCase() === "choose";
      const noun = m[3].toLowerCase();
      if (lang === "uz") {
        const acc = { paragraph: "xatboshini", section: "boʻlimni", person: "odamni", practice: "amaliyotni", option: "variantni", answer: "javobni" }[noun as "paragraph"];
        return `${m[1] ? "Eslatma: istalgan" : "Istalgan"} ${acc} bir necha marta ${choose ? "tanlashingiz" : "ishlatishingiz"} mumkin.`;
      }
      const any = { paragraph: "любой абзац", section: "любой раздел", person: "любого человека", practice: "любую практику", option: "любой вариант", answer: "любой ответ" }[noun as "paragraph"];
      const phrase = m[1] ? `Примечание: ${any}` : cap(any);
      return `${phrase} можно ${choose ? "выбрать" : "использовать"} более одного раза.`;
    },
  },
  // Matching features
  {
    re: rx(`Look at the following (\\w+) \\(questions? (${NUMS})\\) and the list of (\\w+) below\\.?`),
    out: (m, lang) => {
      const item = own(ITEMS, singular(m[1]));
      const noun = own(LIST_NOUNS, singular(m[3]));
      if (!item || !noun) return null;
      return lang === "uz"
        ? `Quyidagi ${item.uzPl} (${uzQuestions(m[2])}) va pastdagi ${noun.uz} roʻyxatini koʻrib chiqing.`
        : `Посмотрите на следующие ${item.ruPl} (${ruQuestions(m[2], "nom")}) и на список ${noun.ru} ниже.`;
    },
  },
  {
    re: rx(`Match each (\\w+) with the correct (\\w+),? (${LETTER_LIST})\\.?`),
    out: (m, lang) => {
      const item = own(ITEMS, singular(m[1]));
      const noun = own(LIST_NOUNS, singular(m[2]));
      if (!item || !noun) return null;
      const list = letters(m[3], lang);
      return lang === "uz"
        ? `Har bir ${item.uzSg} ${noun.uz} roʻyxatidagi toʻgʻri harf bilan moslang: ${list}.`
        : `Соотнесите ${item.ruEach} с буквой из списка ${noun.ru}: ${list}.`;
    },
  },
  {
    re: rx(`Complete each sentence with the correct ending,? (${LETTER_LIST}),? (?:from the box )?below\\.?`),
    out: (m, lang) =>
      lang === "uz"
        ? `Har bir gapni pastdagi toʻgʻri tugallanma bilan yakunlang: ${letters(m[1], "uz")}.`
        : `Закончите каждое предложение подходящим окончанием из списка ниже: ${letters(m[1], "ru")}.`,
  },
  // Completion
  {
    re: rx(`Complete the (${COMPLETE_KEYS})(?: below)?\\.?`),
    out: (m, lang) => {
      const o = own(COMPLETE_OBJECTS, m[1].toLowerCase());
      if (!o) return null;
      return lang === "uz" ? `Quyidagi ${o.uzLoc} boʻsh joylarni toʻldiring.` : `Заполните пропуски в ${o.ruLoc} ниже.`;
    },
  },
  {
    re: rx(`Complete the (${COMPLETE_KEYS})(?: below)?,? using the list of (words and phrases|words|phrases|names|ideas),? (${LETTER_LIST}),? below\\.?`),
    out: (m, lang) => {
      const o = own(COMPLETE_OBJECTS, m[1].toLowerCase());
      const list = own(WORD_LISTS, m[2].toLowerCase());
      if (!o || !list) return null;
      const keys = letters(m[3], lang);
      return lang === "uz"
        ? `Pastdagi ${list.uz} roʻyxatidan (${keys}) foydalanib ${o.uzAcc} toʻldiring.`
        : `Заполните пропуски в ${o.ruLoc}, используя список ${list.ru} ниже (${keys}).`;
    },
  },
  {
    re: rx(`Complete the (${COMPLETE_KEYS}) below,? using (?:words|answers) from the box\\.?`),
    out: (m, lang) => {
      const o = own(COMPLETE_OBJECTS, m[1].toLowerCase());
      if (!o) return null;
      return lang === "uz"
        ? `Roʻyxatdagi soʻzlardan foydalanib quyidagi ${o.uzAcc} toʻldiring.`
        : `Заполните пропуски в ${o.ruLoc} ниже, используя слова из списка.`;
    },
  },
  {
    re: rx("Label the (map|plan|diagram|chart|picture) below\\.?"),
    out: (m, lang) => {
      const o = own(LABEL_OBJECTS, m[1].toLowerCase());
      if (!o) return null;
      return lang === "uz" ? `Quyidagi ${o.uz} belgilarni yozing.` : `Подпишите ${o.ru} ниже.`;
    },
  },
  {
    re: rx("Choose the (word or phrase|word|phrase|answer) that best completes each sentence\\.?"),
    out: (m, lang) => {
      const what = m[1].toLowerCase();
      if (lang === "uz") {
        const w = what === "word or phrase" ? "soʻz yoki iborani" : what === "word" ? "soʻzni" : what === "phrase" ? "iborani" : "javobni";
        return `Har bir gapni eng yaxshi toʻldiradigan ${w} tanlang.`;
      }
      const w = what === "word or phrase" ? "слово или выражение, которое" : what === "word" ? "слово, которое" : what === "phrase" ? "выражение, которое" : "ответ, который";
      return `Выберите ${w} лучше всего дополняет каждое предложение.`;
    },
  },
  // Listening matching prompts
  {
    re: rx("What (do|does|will|can) (.+?) (say about|decide to do about|see or do in|do in|think about|recommend for|suggest for) each of the following(?: (.+?))?\\?"),
    out: (m, lang) => {
      const aux = m[1].toLowerCase();
      const s = subjectOf(m[2]);
      const verb = m[3].toLowerCase();
      if (!s) return null;
      const pl = aux === "do" ? true : aux === "does" ? false : s.plural;
      if ((aux === "do" || aux === "does") && pl !== s.plural) return null;
      const presentOnly = ["say about", "decide to do about", "think about", "recommend for", "suggest for"];
      if (presentOnly.includes(verb) && aux !== "do" && aux !== "does") return null;
      if (verb === "see or do in" && aux !== "can") return null;
      const x = quoted(m[4]);
      if (lang === "uz") {
        const who = cap(s.uz);
        const of = `quyidagilarning${x}`;
        switch (verb) {
          case "say about": return `${who} ${of} har biri haqida nima deydi?`;
          case "decide to do about": return `${who} ${of} har biri boʻyicha nima qilishga qaror qiladi?`;
          case "do in": return `${who} ${of} har birida nima qiladi?`;
          case "see or do in": return `${who} ${of} har birida nimani koʻrishi yoki qilishi mumkin?`;
          case "think about": return `${who} ${of} har biri haqida qanday fikrda?`;
          case "recommend for": return `${who} ${of} har biri uchun nimani tavsiya qiladi?`;
          case "suggest for": return `${who} ${of} har biri uchun nimani taklif qiladi?`;
        }
        return null;
      }
      const who = s.ru;
      const each = (prep: "о" | "в" | "с" | "для") =>
        `${prep === "о" ? "о каждом" : prep === "в" ? "в каждом" : prep === "с" ? "с каждым" : "для каждого"} из следующих пунктов${x}`;
      switch (verb) {
        case "say about": return `Что ${who} ${pl ? "говорят" : "говорит"} ${each("о")}?`;
        case "decide to do about": return `Что ${who} ${pl ? "решают" : "решает"} сделать ${each("с")}?`;
        case "do in": {
          const v = aux === "will" ? (pl ? "будут делать" : "будет делать") : aux === "can" ? (pl ? "могут делать" : "может делать") : pl ? "делают" : "делает";
          return `Что ${who} ${v} ${each("в")}?`;
        }
        case "see or do in": return `Что ${who} ${pl ? "могут" : "может"} увидеть или сделать ${each("в")}?`;
        case "think about": return `Что ${who} ${pl ? "думают" : "думает"} ${each("о")}?`;
        case "recommend for": return `Что ${who} ${pl ? "рекомендуют" : "рекомендует"} ${each("для")}?`;
        case "suggest for": return `Что ${who} ${pl ? "предлагают" : "предлагает"} ${each("для")}?`;
      }
      return null;
    },
  },
  {
    re: rx("Where (?:is|are) the following(?: (.+?))?\\?"),
    out: (m, lang) =>
      lang === "uz" ? `Quyidagilar${quoted(m[1])} qayerda joylashgan?` : `Где находятся следующие объекты${quoted(m[1])}?`,
  },
  // Reading rubric (passage intro)
  {
    re: rx(`You should spend about (\\d+) minutes? on questions? (${NUMS}),? which (?:is|are) based on Reading Passage (\\d+)(?: below)?\\.?`),
    out: (m, lang) => {
      const min = Number(m[1]);
      return lang === "uz"
        ? `${uzQuestions(m[2])}ga taxminan ${m[1]} daqiqa sarflang, ular quyidagi Reading Passage ${m[3]} matniga asoslangan.`
        : `Потратьте около ${m[1]} ${ruGenCount(min, "минуты", "минут")} на ${plural(m[2]) ? "вопросы" : "вопрос"} ${nums(m[2], "ru")}, которые относятся к тексту Reading Passage ${m[3]} ниже.`;
    },
  },
  {
    re: rx("You should spend about (\\d+) minutes? on Reading Passage (\\d+)\\.?"),
    out: (m, lang) =>
      lang === "uz"
        ? `Reading Passage ${m[2]} matniga taxminan ${m[1]} daqiqa sarflang.`
        : `Потратьте около ${m[1]} ${ruGenCount(Number(m[1]), "минуты", "минут")} на Reading Passage ${m[2]}.`,
  },
  // Writing rubric
  {
    re: rx("You should spend about (\\d+) minutes? on this task\\.?"),
    out: (m, lang) =>
      lang === "uz"
        ? `Bu topshiriqqa taxminan ${m[1]} daqiqa sarflang.`
        : `Потратьте на это задание около ${m[1]} ${ruGenCount(Number(m[1]), "минуты", "минут")}.`,
  },
  {
    re: rx("Write at least (\\d+) words\\.?"),
    out: (m, lang) =>
      lang === "uz" ? `Kamida ${m[1]} soʻz yozing.` : `Напишите не менее ${m[1]} ${ruGenCount(Number(m[1]), "слова", "слов")}.`,
  },
  { re: rx("Write about the following topic:?"), out: fixed("Quyidagi mavzu haqida yozing:", "Напишите на следующую тему:") },
  {
    prompt: true,
    re: rx("Give reasons for your answer and include any relevant examples from your own knowledge or experience\\.?"),
    out: fixed(
      "Javobingizni asoslang va oʻz bilim yoki tajribangizdan tegishli misollar keltiring.",
      "Обоснуйте свой ответ и приведите подходящие примеры из собственных знаний или опыта."
    ),
  },
  { re: rx("Task 2 counts twice as much as Task 1\\.?"), out: fixed("2-topshiriq 1-topshiriqdan ikki baravar koʻp ball beradi.", "Задание 2 оценивается вдвое выше, чем задание 1.") },
  {
    prompt: true,
    re: rx("Summari[sz]e the information by selecting and reporting the main features,? and make comparisons where relevant\\.?"),
    out: fixed(
      "Asosiy jihatlarni tanlab, maʼlumotni umumlashtiring va kerakli joylarda taqqoslang.",
      "Обобщите информацию, выделив и описав главные особенности, и при необходимости сделайте сравнения."
    ),
  },
  {
    prompt: true,
    re: rx("Summari[sz]e the information by selecting and reporting the main features\\.?"),
    out: fixed("Asosiy jihatlarni tanlab, maʼlumotni umumlashtiring.", "Обобщите информацию, выделив и описав главные особенности."),
  },
  {
    prompt: true,
    re: rx("To what extent do you agree or disagree(?: with (?:this|the) (statement|opinion|view|idea))?\\?"),
    out: (m, lang) => {
      if (lang === "uz") return `${m[1] ? "Bu fikrga" : "Siz"} qay darajada qoʻshilasiz yoki qoʻshilmaysiz?`;
      const what = { statement: "этим утверждением", opinion: "этим мнением", view: "этой точкой зрения", idea: "этой идеей" }[m[1]?.toLowerCase() as "statement"];
      return `В какой степени вы согласны или не согласны${what ? ` с ${what}` : ""}?`;
    },
  },
  { prompt: true, re: rx("Discuss both (?:these )?views and give your own opinion\\.?"), out: fixed("Ikkala nuqtai nazarni muhokama qiling va oʻz fikringizni bildiring.", "Обсудите обе точки зрения и выскажите своё мнение.") },
  {
    prompt: true,
    re: rx("Do the advantages(?: of this (approach|change|development|trend|situation|system))? outweigh the disadvantages\\?"),
    out: (m, lang) => {
      const k = m[1]?.toLowerCase();
      if (lang === "uz") {
        const of = { approach: "Bu yondashuvning", change: "Bu oʻzgarishning", development: "Bu oʻzgarishning", trend: "Bu tendensiyaning", situation: "Bu vaziyatning", system: "Bu tizimning" }[k as "approach"];
        return `${of ? `${of} afzalliklari` : "Afzalliklari"} kamchiliklaridan koʻproqmi?`;
      }
      const of = { approach: " этого подхода", change: " этого изменения", development: " этого изменения", trend: " этой тенденции", situation: " этой ситуации", system: " этой системы" }[k as "approach"];
      return `Перевешивают ли преимущества${of ?? ""} недостатки?`;
    },
  },
  { prompt: true, re: rx("Is this a positive or negative development\\?"), out: fixed("Bu ijobiy yoki salbiy oʻzgarishmi?", "Это положительное или отрицательное изменение?") },
  {
    prompt: true,
    re: rx("What are the reasons for this( trend)?\\?"),
    out: (m, lang) =>
      lang === "uz"
        ? `${m[1] ? "Bu tendensiyaning" : "Buning"} sabablari nimada?`
        : `Каковы причины ${m[1] ? "этой тенденции" : "этого"}?`,
  },
  {
    prompt: true,
    re: rx("What are the (main )?causes of this problem,? and what measures could be taken to (reduce|solve|tackle) it\\?"),
    out: (m, lang) => {
      const v = m[2].toLowerCase();
      if (lang === "uz") return `Bu muammoning ${m[1] ? "asosiy " : ""}sabablari nimada va uni ${v === "reduce" ? "kamaytirish" : "hal qilish"} uchun qanday choralar koʻrish mumkin?`;
      return `Каковы ${m[1] ? "основные " : ""}причины этой проблемы и какие меры можно принять, чтобы ${v === "reduce" ? "уменьшить её" : "решить её"}?`;
    },
  },
  // Speaking — the examiner's lines and the intro
  { re: rx("Good morning\\.?"), out: fixed("Xayrli tong.", "Доброе утро.") },
  { re: rx("Good afternoon\\.?"), out: fixed("Xayrli kun.", "Добрый день.") },
  { re: rx("Good evening\\.?"), out: fixed("Xayrli kech.", "Добрый вечер.") },
  { re: rx("Hello\\.?"), out: fixed("Salom.", "Здравствуйте.") },
  { re: rx("Thank you\\.?"), out: fixed("Rahmat.", "Спасибо.") },
  { re: rx("My name is Averna and I'll be your examiner today\\.?"), out: fixed("Mening ismim Averna, bugun men sizning imtihon oluvchingizman.", "Меня зовут Averna, сегодня я ваш экзаменатор.") },
  { re: rx("I'm Averna, your examiner\\.?"), out: fixed("Men Averna, sizning imtihon oluvchingizman.", "Я Averna, ваш экзаменатор.") },
  { re: rx("Can you hear me clearly\\?"), out: fixed("Meni aniq eshityapsizmi?", "Вы хорошо меня слышите?") },
  {
    re: rx("In this first part, I'd like to ask you some questions about yourself\\.?"),
    out: fixed("Birinchi qismda sizga oʻzingiz haqingizda bir nechta savol beraman.", "В первой части я задам вам несколько вопросов о вас самих."),
  },
  {
    re: rx("Let's talk about (.+?)\\."),
    out: (m, lang) => (lang === "uz" ? `Keling, «${m[1]}» haqida gaplashamiz.` : `Давайте поговорим на тему «${m[1]}».`),
  },
  {
    re: rx("Now I'm going to give you a topic and I'd like you to talk about it for one to two minutes\\.?"),
    out: fixed("Hozir sizga bir mavzu beraman, siz u haqida bir-ikki daqiqa gapirasiz.", "Сейчас я дам вам тему, и вы будете говорить о ней одну-две минуты."),
  },
  {
    re: rx("Before you talk, you'll have one minute to think about what you're going to say\\.?"),
    out: fixed("Gapirishdan oldin nima deyishingizni oʻylab olish uchun bir daqiqa vaqtingiz boʻladi.", "Перед ответом у вас будет одна минута, чтобы подумать, что сказать."),
  },
  { re: rx("You can make some notes if you wish\\.?"), out: fixed("Xohlasangiz, qaydlar yozib olishingiz mumkin.", "Если хотите, можете делать заметки.") },
  { re: rx("All right\\?"), out: fixed("Tayyormisiz?", "Готовы?") },
  {
    re: rx("Remember you have one to two minutes for this, so don't worry if I stop you\\.?"),
    out: fixed("Esda tuting, buning uchun bir-ikki daqiqa vaqtingiz bor, shuning uchun sizni toʻxtatsam, xavotir olmang.", "Помните, у вас одна-две минуты, поэтому не волнуйтесь, если я вас остановлю."),
  },
  { re: rx("I'll tell you when the time is up\\.?"), out: fixed("Vaqt tugaganda sizga aytaman.", "Я скажу, когда время закончится.") },
  { re: rx("Can you start speaking now, please\\?"), out: fixed("Endi gapirishni boshlang, iltimos.", "Пожалуйста, начинайте говорить.") },
  {
    re: rx("We've been talking about (.+?), and I'd now like to discuss with you one or two more general questions related to this\\.?"),
    out: (m, lang) =>
      lang === "uz"
        ? `Biz «${m[1]}» haqida gaplashdik, endi shu mavzuga oid yana bir-ikkita umumiyroq savolni muhokama qilamiz.`
        : `Мы говорили на тему «${m[1]}», а теперь обсудим один-два более общих вопроса, связанных с ней.`,
  },
  { re: rx("That is the end of the speaking test\\.?"), out: fixed("Gapirish imtihoni shu bilan tugadi.", "На этом экзамен по говорению окончен.") },
  { re: rx("Welcome back\\.?"), out: fixed("Xush kelibsiz.", "С возвращением.") },
  { re: rx("Let's carry on from where we stopped\\.?"), out: fixed("Toʻxtagan joyimizdan davom etamiz.", "Продолжим с того места, где остановились.") },
  { re: rx("You should say:?"), out: fixed("Quyidagilarni aytib oʻting:", "Вам нужно рассказать:") },
  { re: rx("Short questions about you and familiar topics\\.?"), out: fixed("Siz va tanish mavzular haqida qisqa savollar.", "Короткие вопросы о вас и знакомых темах.") },
  {
    re: rx("One minute to prepare, then talk for up to two minutes about a task card\\.?"),
    out: fixed("Tayyorlanish uchun bir daqiqa, soʻng topshiriq kartasi boʻyicha ikki daqiqagacha gapirasiz.", "Минута на подготовку, затем до двух минут рассказа по карточке с заданием."),
  },
  {
    re: rx("Broader questions linked to the Part 2 topic\\.?"),
    out: fixed("Part 2 mavzusiga bogʻliq kengroq savollar.", "Более общие вопросы, связанные с темой Part 2."),
  },
];

/** Sentences of the standard Writing task wording (the rest of a prompt is the topic itself). */
const WRITING_PROMPT_RULES = RULES.filter((r) => r.prompt);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Straight apostrophes and quotes, single spaces (matching only — outputs copy the captures). */
function normalize(text: string): string {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/** Sentence split without lookbehind (older Safari): after . ? ! or : when a capital or bracket follows. */
function sentences(text: string): string[] {
  return text
    .replace(/([.?!:])\s+(?=[A-Z(«"])/g, "$1\u0000")
    .split("\u0000")
    .map((s) => s.trim())
    .filter(Boolean);
}

function translateSentence(sentence: string, lang: L1Lang): string | null {
  for (const rule of RULES) {
    const m = sentence.match(rule.re);
    if (!m) continue;
    const out = rule.out(m, lang);
    if (out) return out;
  }
  return null;
}

/**
 * The hint for a standard instruction, or null when any part of it is unknown.
 * "Questions 1–6" → "1–6-savollar" / "Вопросы 1–6".
 */
export function l1Hint(text: string | null | undefined, lang: L1Lang): string | null {
  if (typeof text !== "string" || (lang !== "uz" && lang !== "ru")) return null;
  const clean = normalize(text);
  if (!clean || clean.length > 600) return null;
  const out: string[] = [];
  for (const s of sentences(clean)) {
    const t = translateSentence(s, lang);
    if (!t) return null;
    out.push(t);
  }
  return out.length ? out.join(" ") : null;
}

/**
 * The standard rubric sentences inside a Writing prompt ("Summarise the
 * information …", "To what extent do you agree or disagree?"), joined, or null.
 * The topic sentences are the student's to read in English.
 */
export function writingInstructionText(prompt: string | null | undefined): string | null {
  if (typeof prompt !== "string") return null;
  const keep = sentences(normalize(prompt)).filter((s) => WRITING_PROMPT_RULES.some((r) => r.re.test(s)));
  return keep.length ? keep.join(" ") : null;
}

// ---------------------------------------------------------------------------
// Question types
// ---------------------------------------------------------------------------

export interface KindHint {
  name: string;
  tip: string;
}

const KIND_HINTS: Record<PracticeKind, Record<L1Lang, KindHint>> = {
  tfng: {
    uz: { name: "TRUE / FALSE / NOT GIVEN (toʻgʻri / notoʻgʻri / berilmagan)", tip: "FALSE — matnda buning aksi aytilgan; NOT GIVEN — matnda bu haqda umuman maʼlumot yoʻq." },
    ru: { name: "TRUE / FALSE / NOT GIVEN (верно / неверно / не указано)", tip: "FALSE — в тексте сказано обратное; NOT GIVEN — в тексте об этом ничего не сказано." },
  },
  ynng: {
    uz: { name: "YES / NO / NOT GIVEN (muallif fikri)", tip: "Faktlar emas, muallifning fikri soʻraladi: NO — muallif bunga qarshi; NOT GIVEN — muallif bu haqda fikr bildirmagan." },
    ru: { name: "YES / NO / NOT GIVEN (мнение автора)", tip: "Спрашивают мнение автора, а не факты: NO — автор с этим не согласен; NOT GIVEN — автор своего мнения не высказывает." },
  },
  mcq: {
    uz: { name: "Bir nechta variantdan bittasini tanlash", tip: "Avval kerakli joyni toping, keyin notoʻgʻri variantlarni birma-bir chiqarib tashlang." },
    ru: { name: "Выбор одного варианта из нескольких", tip: "Сначала найдите нужное место, затем по очереди исключите неверные варианты." },
  },
  "mcq-multi": {
    uz: { name: "Ikki yoki uchta variantni tanlash", tip: "Har bir variantni alohida tekshiring va aynan soʻralgancha harf tanlang." },
    ru: { name: "Выбор двух или трёх вариантов", tip: "Проверяйте каждый вариант отдельно и выбирайте ровно столько букв, сколько просят." },
  },
  matching: {
    uz: { name: "Moslashtirish", tip: "Bir xil soʻzlarni emas, maʼnoni moslang — sinonimlarni qidiring." },
    ru: { name: "Сопоставление", tip: "Сопоставляйте смысл, а не одинаковые слова — ищите синонимы." },
  },
  "matching-headings": {
    uz: { name: "Sarlavhalarni moslashtirish", tip: "Butun xatboshining asosiy gʻoyasini toping, kichik detalni emas." },
    ru: { name: "Подбор заголовков", tip: "Ищите главную мысль всего абзаца, а не отдельную деталь." },
  },
  "matching-information": {
    uz: { name: "Maʼlumot qaysi xatboshida", tip: "Kalit soʻzni toping, keyin butun gapni oʻqib, maʼno mosligini tekshiring. Bitta harf bir necha marta ishlatilishi mumkin." },
    ru: { name: "В каком абзаце информация", tip: "Найдите ключевое слово, затем прочитайте всё предложение и проверьте смысл. Одна буква может повторяться." },
  },
  gap: {
    uz: { name: "Boʻsh joyni toʻldirish", tip: "Soʻzni matndagi yoki eshitganingizdek aniq yozing, imloni tekshiring va soʻz chegarasidan oshmang." },
    ru: { name: "Заполнение пропусков", tip: "Пишите слово точно как в тексте или записи, проверяйте написание и не превышайте лимит слов." },
  },
  "gap-box": {
    uz: { name: "Qisqacha bayon (soʻzlar roʻyxati bilan)", tip: "Avval boʻsh joyga qanday soʻz kerakligini aniqlang (ot, sifat, feʼl), keyin roʻyxatdan tanlang." },
    ru: { name: "Краткое содержание (со списком слов)", tip: "Сначала определите, какое слово нужно (существительное, прилагательное, глагол), затем выбирайте из списка." },
  },
};

/** Translated question-type name and one-line tip, or null for an unknown type. */
export function kindHint(kind: string | null | undefined, lang: L1Lang): KindHint | null {
  if (lang !== "uz" && lang !== "ru") return null;
  return own(KIND_HINTS, kind ?? undefined)?.[lang] ?? null;
}

export const KIND_HINT_KINDS = Object.keys(KIND_HINTS) as PracticeKind[];
