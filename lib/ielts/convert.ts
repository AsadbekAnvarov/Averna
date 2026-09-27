/**
 * Legacy → exam-v2 converters. The original short practice tests (and early
 * AI-generated ones) keep working in the new CD-IELTS runners, while staying
 * marked as `source: "legacy"` and never counting as full exam papers.
 *
 * Minimal local shapes are declared here (instead of importing the data files)
 * so this module stays dependency-free.
 */

import type {
  ExamGroup,
  ExamListeningTest,
  ExamQuestion,
  ExamReadingTest,
  ExamSource,
  ScriptLine,
} from "./types";
import { LETTERS, splitParagraphs } from "./format";

export interface LegacyReadingQuestion {
  id: string;
  type: "multiple-choice" | "true-false-not-given" | "sentence-completion";
  question: string;
  options?: string[];
  correctAnswer: number | string;
  explanation?: string;
}
export interface LegacyReadingTest {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  passages: { id: string; title: string; text: string; questions: LegacyReadingQuestion[] }[];
}

export interface LegacyListeningTest {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  sections: { title: string; transcript: string; questions: { question: string; options: string[]; answer: number }[] }[];
}

const TFNG: Record<string, string> = {
  true: "TRUE",
  false: "FALSE",
  "not-given": "NOT GIVEN",
  "not given": "NOT GIVEN",
  notgiven: "NOT GIVEN",
};

function legacyGroupKind(t: LegacyReadingQuestion["type"]): ExamGroup["kind"] {
  if (t === "multiple-choice") return "mcq";
  if (t === "true-false-not-given") return "tfng";
  return "gap";
}

const INSTRUCTIONS: Record<ExamGroup["kind"], string> = {
  tfng: "Do the following statements agree with the information given in the passage?",
  ynng: "Do the following statements agree with the claims of the writer?",
  mcq: "Choose the correct answer.",
  "mcq-multi": "Choose the correct answers.",
  matching: "Match each statement with the correct option.",
  gap: "Complete the sentences below.",
  "gap-box": "Complete the summary below.",
};

function toQuestion(q: LegacyReadingQuestion, n: number): ExamQuestion {
  if (q.type === "multiple-choice") {
    const options = (q.options ?? []).map((text, i) => ({ key: LETTERS[i], text }));
    const idx = typeof q.correctAnswer === "number" ? q.correctAnswer : Number(q.correctAnswer);
    return { n, text: q.question, options, answer: [LETTERS[idx] ?? "A"], explanation: q.explanation };
  }
  if (q.type === "true-false-not-given") {
    const a = TFNG[String(q.correctAnswer).trim().toLowerCase()] ?? String(q.correctAnswer).toUpperCase();
    return { n, text: q.question, answer: [a], explanation: q.explanation };
  }
  // Sentence completion: turn the blank into a numbered gap.
  const text = /_{3,}/.test(q.question) ? q.question.replace(/_{3,}/, `[[${n}]]`) : `${q.question} [[${n}]]`;
  return { n, text, answer: [String(q.correctAnswer)], explanation: q.explanation };
}

export function convertLegacyReading(t: LegacyReadingTest, source: ExamSource = "legacy"): ExamReadingTest {
  let n = 0;
  return {
    format: "exam-v2",
    skill: "READING",
    id: t.id,
    title: t.title,
    description: t.description,
    difficulty: "Medium",
    timeLimit: t.timeLimit,
    source,
    parts: t.passages.map((p) => {
      const groups: ExamGroup[] = [];
      for (const q of p.questions) {
        n += 1;
        const kind = legacyGroupKind(q.type);
        const last = groups[groups.length - 1];
        const question = toQuestion(q, n);
        if (last && last.kind === kind) last.questions.push(question);
        else groups.push({ kind, instructions: INSTRUCTIONS[kind], questions: [question] });
      }
      return { id: p.id, title: p.title, paragraphs: splitParagraphs(p.text), groups };
    }),
  };
}

/** Split a transcript into readable lines (2 sentences each) for text-to-speech. */
function toScript(transcript: string, speaker: string): ScriptLine[] {
  const sentences = transcript.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [transcript];
  const lines: ScriptLine[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const text = sentences.slice(i, i + 2).join(" ").replace(/\s+/g, " ").trim();
    if (text) lines.push({ speaker, text });
  }
  return lines;
}

export function convertLegacyListening(t: LegacyListeningTest, source: ExamSource = "legacy"): ExamListeningTest {
  let n = 0;
  return {
    format: "exam-v2",
    skill: "LISTENING",
    id: t.id,
    title: t.title,
    description: t.description,
    difficulty: t.difficulty,
    source,
    parts: t.sections.map((s, i) => ({
      id: `part-${i + 1}`,
      title: `Part ${i + 1}`,
      context: s.title.replace(/^Section\s+\d+\s*[—–-]\s*/i, ""),
      speakers: [{ name: "Speaker", gender: i % 2 === 0 ? "female" : "male", accent: "british" }],
      script: toScript(s.transcript, "Speaker"),
      groups: [
        {
          kind: "mcq",
          instructions: "Choose the correct answer.",
          questions: s.questions.map((q) => {
            n += 1;
            return {
              n,
              text: q.question,
              options: q.options.map((text, k) => ({ key: LETTERS[k], text })),
              answer: [LETTERS[q.answer] ?? "A"],
            };
          }),
        },
      ],
    })),
  };
}
