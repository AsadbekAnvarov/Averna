/**
 * Native-language hints — the curated translator lib/l1/hints.ts
 * (docs/elegance-roadmap.md, idea 8). Unknown text → null; numbers and
 * letter ranges are copied exactly; proper Uzbek Latin and Russian.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { KIND_HINT_KINDS, kindHint, l1Hint, writingInstructionText, type L1Lang } from "@/lib/l1/hints";
import { LISTENING_SEED, READING_SEED, WRITING_SEED } from "@/lib/ielts/content";
import { READING_TESTS } from "@/lib/reading-tests-data";
import { LISTENING_TESTS } from "@/lib/listening-tests-data";
import { convertLegacyListening, convertLegacyReading } from "@/lib/ielts/convert";
import { PRACTICE_KIND_LABEL, answerRuleFor, groupRange, rangeLabel } from "@/lib/ielts/format";
import { GV_ITEMS_V1, PLACEMENT_LISTENING_V1, PLACEMENT_READING_V1 } from "@/lib/placement/content";
import { grammarGroups } from "@/lib/placement/scoring";
import { WRITING_PROMPTS } from "@/lib/writing-data";
import type { ExamGroup, ExamSkill } from "@/lib/ielts/types";

const LANGS: L1Lang[] = ["uz", "ru"];

// ---------------------------------------------------------------------------
// The built-in papers
// ---------------------------------------------------------------------------

const papers: { skill: ExamSkill; groups: ExamGroup[] }[] = [
  ...[...READING_SEED, ...Object.values(READING_TESTS).map((t) => convertLegacyReading(t, "legacy")), PLACEMENT_READING_V1].map((t) => ({
    skill: "READING" as const,
    groups: t.parts.flatMap((p) => p.groups),
  })),
  ...[...LISTENING_SEED, ...LISTENING_TESTS.map((t) => convertLegacyListening(t, "legacy")), PLACEMENT_LISTENING_V1].map((t) => ({
    skill: "LISTENING" as const,
    groups: t.parts.flatMap((p) => p.groups),
  })),
  { skill: "READING" as const, groups: grammarGroups(GV_ITEMS_V1) },
];

/** Every distinct instruction line a student sees above a question group: instructions, answer rule, "Questions 1–6". */
function instructionLines(): string[] {
  const out = new Set<string>();
  for (const { skill, groups } of papers)
    for (const g of groups) {
      if (g.instructions?.trim()) out.add(g.instructions.trim());
      out.add(answerRuleFor(g, skill));
      const { from, to } = groupRange(g);
      out.add(rangeLabel(from, to));
    }
  return [...out];
}

const allUz: string[] = [];
const allRu: string[] = [];
const keep = (lang: L1Lang, s: string | null) => {
  if (s) (lang === "uz" ? allUz : allRu).push(s);
  return s;
};

describe("coverage of the built-in papers", () => {
  it("gives ≥ 90% of the distinct instruction lines a hint in both languages", () => {
    const lines = instructionLines();
    expect(lines.length).toBeGreaterThan(40);
    for (const lang of LANGS) {
      const uncovered = lines.filter((l) => !keep(lang, l1Hint(l, lang)));
      if (uncovered.length) console.info(`[l1 ${lang}] ${uncovered.length} of ${lines.length} instruction lines without a hint:\n  ${uncovered.join("\n  ")}`);
      expect(1 - uncovered.length / lines.length).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("gives no hint to question content (stems, options, titles)", () => {
    const content = new Set<string>();
    for (const { groups } of papers)
      for (const g of groups) {
        if (g.title) content.add(g.title);
        for (const o of g.options ?? []) content.add(o.text);
        for (const q of g.questions) {
          if (q.text) content.add(q.text.replace(/\[\[\d+\]\]/g, "____"));
          for (const o of q.options ?? []) content.add(o.text);
        }
      }
    const hinted = [...content].filter((c) => l1Hint(c, "uz") || l1Hint(c, "ru"));
    expect(hinted).toEqual([]);
  });

  it("covers the Writing rubric inside every built-in Task 1 / Task 2 prompt that has one", () => {
    const prompts = [...WRITING_SEED.task1, ...WRITING_SEED.task2, ...WRITING_PROMPTS.task1, ...WRITING_PROMPTS.task2];
    let withRubric = 0;
    for (const p of prompts) {
      const rubric = writingInstructionText(p.prompt);
      if (!rubric) continue;
      withRubric += 1;
      for (const lang of LANGS) expect(keep(lang, l1Hint(rubric, lang)), rubric).toBeTruthy();
    }
    expect(withRubric).toBeGreaterThan(5);
    // The topic itself is never a rubric.
    expect(writingInstructionText("Some people think that cities should ban cars from the centre.")).toBeNull();
    expect(writingInstructionText("Many people now work from home. To what extent do you agree or disagree?")).toBe("To what extent do you agree or disagree?");
  });
});

// ---------------------------------------------------------------------------
// Examples
// ---------------------------------------------------------------------------

describe("examples", () => {
  it.each([
    ["Questions 1–6", "1–6-savollar", "Вопросы 1–6"],
    ["Question 7", "7-savol", "Вопрос 7"],
    ["Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.", "Har bir javob uchun koʻpi bilan IKKI soʻz va/yoki raqam yozing.", "Для каждого ответа напишите НЕ БОЛЕЕ ДВУХ СЛОВ И/ИЛИ ЧИСЛО."],
    ["ONE WORD ONLY", "Faqat BITTA soʻz.", "ТОЛЬКО ОДНО СЛОВО."],
    ["Choose the correct letter, A, B, C or D.", "Toʻgʻri harfni tanlang: A, B, C yoki D.", "Выберите правильную букву: A, B, C или D."],
    ["Choose TWO letters, A–E.", "IKKITA harfni tanlang: A–E.", "Выберите ДВЕ буквы: A–E."],
    ["Label the map below.", "Quyidagi xaritaga belgilarni yozing.", "Подпишите карту ниже."],
    ["Complete the flow-chart below.", "Quyidagi blok-sxemadagi boʻsh joylarni toʻldiring.", "Заполните пропуски в блок-схеме ниже."],
    ["Write at least 150 words.", "Kamida 150 soʻz yozing.", "Напишите не менее 150 слов."],
    ["You should spend about 40 minutes on this task.", "Bu topshiriqqa taxminan 40 daqiqa sarflang.", "Потратьте на это задание около 40 минут."],
  ])("%s", (en, uz, ru) => {
    expect(keep("uz", l1Hint(en, "uz"))).toBe(uz);
    expect(keep("ru", l1Hint(en, "ru"))).toBe(ru);
  });

  it("keeps TRUE / FALSE / NOT GIVEN and YES / NO in English", () => {
    const tf = "Choose TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, or NOT GIVEN if there is no information on this.";
    for (const lang of LANGS) {
      const out = keep(lang, l1Hint(tf, lang))!;
      for (const w of ["TRUE", "FALSE", "NOT GIVEN"]) expect(out).toContain(w);
    }
    const yn = "Do the following statements agree with the claims of the writer in Reading Passage 3?";
    expect(keep("uz", l1Hint(yn, "uz"))).toContain("Reading Passage 3");
    expect(keep("ru", l1Hint(yn, "ru"))).toContain("Reading Passage 3");
  });

  it("knows the speaking examiner's lines and keeps the topic in English", () => {
    expect(keep("uz", l1Hint("Let's talk about your hometown.", "uz"))).toBe("Keling, «your hometown» haqida gaplashamiz.");
    expect(keep("ru", l1Hint("Thank you. That is the end of the speaking test.", "ru"))).toBe("Спасибо. На этом экзамен по говорению окончен.");
    expect(l1Hint("Good evening. My name is Averna and I’ll be your examiner today.", "uz")).toContain("Averna");
  });

  it("unknown text → null, and one unknown sentence makes the whole hint null", () => {
    for (const lang of LANGS) {
      expect(l1Hint("", lang)).toBeNull();
      expect(l1Hint(null, lang)).toBeNull();
      expect(l1Hint("The library opens at nine on weekdays.", lang)).toBeNull();
      expect(l1Hint("Complete the notes below. The library opens at nine.", lang)).toBeNull();
      expect(l1Hint("Look at the following statements (Questions 1–5) and the list of wizards below.", lang)).toBeNull();
      expect(l1Hint("Look at the following constructor (Questions 1–5) and the list of toString below.", lang)).toBeNull();
    }
    expect(l1Hint("Questions 1–6", "de" as L1Lang)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const LETTERS = "BCDEFGHIJ".split("");
const WORDS = ["ONE", "TWO", "THREE", "FOUR", "FIVE"] as const;
const UZ_WORD = { ONE: "BITTA", TWO: "IKKI", THREE: "UCH", FOUR: "TOʻRT", FIVE: "BESH" };
const RU_WORD = { ONE: "ОДНО СЛОВО", TWO: "ДВУХ", THREE: "ТРЁХ", FOUR: "ЧЕТЫРЁХ", FIVE: "ПЯТИ" };
const COUNT_WORDS = ["three", "four", "five", "six", "seven", "eight", "nine"];

const dash = fc.constantFrom("–", "-", "—");
const range = fc
  .tuple(fc.integer({ min: 1, max: 35 }), fc.integer({ min: 1, max: 6 }), dash)
  .map(([a, len, d]) => `${a}${d}${a + len}`);
const letterRange = fc.tuple(fc.constantFrom(...LETTERS), dash).map(([l, d]) => `A${d}${l}`);
const letterList = fc.constantFrom("A, B or C", "A, B, C or D", "A, B, C, D or E");

/** Generated instruction variants (all of them standard IELTS wording). */
const instruction = fc.oneof(
  range.map((r) => `Questions ${r}`),
  fc.integer({ min: 1, max: 40 }).map((n) => `Question ${n}`),
  fc.oneof(letterRange, letterList).map((l) => `Choose the correct letter, ${l}.`),
  letterRange.map((l) => `Choose the correct letter, ${l}, for each answer.`),
  fc.tuple(fc.constantFrom("TWO", "THREE"), letterRange).map(([n, l]) => `Choose ${n} letters, ${l}.`),
  fc
    .tuple(fc.constantFrom(...WORDS.slice(1)), fc.boolean(), fc.constantFrom("", " from the passage", " from the text", " from Reading Passage 2"))
    .map(([w, num, src]) => `Write NO MORE THAN ${w} WORDS${num ? " AND/OR A NUMBER" : ""}${src} for each answer.`),
  fc.tuple(fc.constantFrom("THREE", "FIVE", "SIX"), letterRange, range).map(([n, l, r]) => `Choose ${n} answers from the box and write the correct letter, ${l}, next to Questions ${r}.`),
  fc.tuple(fc.integer({ min: 1, max: 3 }), fc.constantFrom(...COUNT_WORDS), letterRange).map(([p, c, l]) => `Reading Passage ${p} has ${c} paragraphs, ${l}.`),
  fc.tuple(range, fc.constantFrom("researchers", "scientists", "people", "experts", "companies")).map(([r, n]) => `Look at the following statements (Questions ${r}) and the list of ${n} below.`),
  fc.tuple(fc.constantFrom("researcher", "scientist", "person", "expert", "company"), letterRange).map(([n, l]) => `Match each statement with the correct ${n}, ${l}.`),
  fc.tuple(fc.integer({ min: 10, max: 60 }), range, fc.integer({ min: 1, max: 3 })).map(([m, r, p]) => `You should spend about ${m} minutes on Questions ${r}, which are based on Reading Passage ${p} below.`),
  fc.integer({ min: 50, max: 400 }).map((n) => `Write at least ${n} words.`),
  fc.constantFrom("v", "vi", "viii", "x").map((r) => `Choose the correct heading from the list of headings, i–${r}.`),
  fc.tuple(letterRange, range).map(([l, r]) => `Write the correct letter, ${l}, in boxes ${r} on your answer sheet.`)
);

/** Numbers, number ranges, letter ranges and roman ranges — copied verbatim into every hint. */
const TOKEN = /\d+\s*[–—-]\s*\d+|\b[A-Z]\s*[–—-]\s*[A-Z]\b|\b[ivx]+\s*[–—-]\s*[ivx]+\b|\d+/g;

describe("properties", () => {
  it("every generated instruction gets a hint that keeps its numbers and letter ranges exactly", () => {
    fc.assert(
      fc.property(instruction, fc.constantFrom(...LANGS), (text, lang) => {
        const out = keep(lang, l1Hint(text, lang));
        expect(out, text).toBeTruthy();
        for (const token of text.match(TOKEN) ?? []) expect(out, `${text} → ${token}`).toContain(token);
        // Single letters of an "A, B or C" list survive too.
        const list = text.match(/[A-Z](?:, [A-Z])* or [A-Z]/)?.[0];
        if (list) for (const l of list.match(/[A-Z]/g)!) expect(out).toContain(l);
      })
    );
  });

  it("translates the word limit itself", () => {
    fc.assert(
      fc.property(fc.constantFrom(...WORDS), fc.boolean(), (w, num) => {
        const text = w === "ONE" ? `Write ONE WORD${num ? " AND/OR A NUMBER" : " ONLY"} for each answer.` : `Write NO MORE THAN ${w} WORDS${num ? " AND/OR A NUMBER" : ""} for each answer.`;
        const uz = keep("uz", l1Hint(text, "uz"))!;
        const ru = keep("ru", l1Hint(text, "ru"))!;
        expect(uz).toContain(UZ_WORD[w]);
        expect(ru).toContain(RU_WORD[w]);
        expect(uz.includes("raqam")).toBe(num);
        expect(ru.includes("ЧИСЛО")).toBe(num);
      })
    );
  });

  it("text that is not a standard instruction → null (never a partial hint)", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), fc.constantFrom(...LANGS), fc.option(instruction, { nil: undefined }), (s, lang, known) => {
        const text = known ? `${known} Zebra ${s}` : `Zebra ${s}`;
        expect(l1Hint(text, lang)).toBeNull();
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Question types
// ---------------------------------------------------------------------------

describe("question types", () => {
  it("every practice kind has a name and a one-line tip in both languages", () => {
    expect(KIND_HINT_KINDS.sort()).toEqual(Object.keys(PRACTICE_KIND_LABEL).sort());
    for (const kind of KIND_HINT_KINDS)
      for (const lang of LANGS) {
        const h = kindHint(kind, lang)!;
        expect(h.name.length).toBeGreaterThan(3);
        expect(h.tip.length).toBeGreaterThan(20);
        expect(h.tip.length).toBeLessThan(200);
        keep(lang, h.name);
        keep(lang, h.tip);
      }
    expect(kindHint("tfng", "uz")!.name).toContain("TRUE / FALSE / NOT GIVEN");
    expect(kindHint("tfng", "ru")!.tip).toMatch(/FALSE.*NOT GIVEN/);
    expect(kindHint("unknown", "uz")).toBeNull();
    expect(kindHint("toString", "ru")).toBeNull();
    expect(kindHint(null, "ru")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Orthography (runs last: checks every hint produced above)
// ---------------------------------------------------------------------------

describe("orthography", () => {
  it("Uzbek uses ʻ (U+02BB) after o/g and ʼ (U+02BC), never an ASCII apostrophe or backtick", () => {
    // The fixed strings the UI shows besides the instruction hints.
    for (const s of ["Hello. I'm Averna, your examiner. Can you hear me clearly?", "Welcome back. Let's carry on from where we stopped.", "Task 2 counts twice as much as Task 1.", "You should say:"])
      keep("uz", l1Hint(s, "uz"));
    expect(allUz.length).toBeGreaterThan(50);
    const text = allUz.join("\n");
    expect(text).not.toMatch(/[oOgG]['`‘’]/);
    expect(text).not.toMatch(/['`]/);
    expect(text).not.toMatch(/(?<![oOgG])\u02BB/);
    expect(text).toContain("maʼlumot");
    expect(text).toContain("toʻgʻri");
    expect(text).toMatch(/\u02BC/);
  });

  it("Russian is Cyrillic: no Latin letter inside a Russian word", () => {
    expect(allRu.length).toBeGreaterThan(50);
    for (const s of allRu)
      for (const word of s.split(/[^\p{L}]+/u))
        if (/[а-яё]/i.test(word)) expect(word, s).not.toMatch(/[a-z]/i);
  });
});
