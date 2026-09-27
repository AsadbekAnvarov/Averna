import { tashkentDayOfYear } from "@/lib/utils";
import { XP_CONFIG } from "@/lib/engine/progression/config";

/**
 * Daily 5-question challenge content. Shared by the page (to render) and the
 * API route (to SCORE server-side), so the XP can't be forged by posting a
 * made-up score.
 */
export interface Question {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  category: string;
}

// A pool of IELTS-style questions. A daily set is selected deterministically.
export const QUESTION_POOL: Question[] = [
  { category: "Vocabulary", question: "Choose the best synonym for \"meticulous\".", options: ["Careless", "Thorough", "Rapid", "Generous"], answer: 1, explanation: "\"Meticulous\" means showing great attention to detail, i.e. thorough." },
  { category: "Grammar", question: "Select the correct sentence.", options: ["She don't like coffee.", "She doesn't likes coffee.", "She doesn't like coffee.", "She not like coffee."], answer: 2, explanation: "With third-person singular, use \"doesn't\" + base verb: doesn't like." },
  { category: "Collocation", question: "Which word collocates with \"make\"?", options: ["a decision", "a photo", "homework", "a mistake quickly"], answer: 0, explanation: "We \"make a decision\". (We \"take a photo\" and \"do homework\".)" },
  { category: "Prepositions", question: "I'm really good ___ solving puzzles.", options: ["in", "at", "on", "for"], answer: 1, explanation: "We say \"good at\" + activity." },
  { category: "Vocabulary", question: "\"Ubiquitous\" most nearly means:", options: ["Rare", "Everywhere", "Expensive", "Ancient"], answer: 1, explanation: "\"Ubiquitous\" means present or found everywhere." },
  { category: "Grammar", question: "Choose the correct conditional: \"If I ___ more time, I would travel.\"", options: ["have", "had", "will have", "having"], answer: 1, explanation: "Second conditional uses past simple: \"If I had ... I would ...\"." },
  { category: "Word form", question: "Complete: \"Her argument was very ___.\" (persuade)", options: ["persuade", "persuasion", "persuasive", "persuaded"], answer: 2, explanation: "An adjective is needed to describe \"argument\": persuasive." },
  { category: "Idiom", question: "\"To hit the books\" means to:", options: ["Get angry", "Study hard", "Travel far", "Waste time"], answer: 1, explanation: "\"Hit the books\" is an idiom meaning to study hard." },
  { category: "Vocabulary", question: "Choose the closest meaning of \"reluctant\".", options: ["Eager", "Unwilling", "Confident", "Curious"], answer: 1, explanation: "\"Reluctant\" means unwilling or hesitant." },
  { category: "Grammar", question: "Pick the correct passive form: \"The report ___ yesterday.\"", options: ["was written", "is wrote", "has wrote", "writes"], answer: 0, explanation: "Past simple passive: was/were + past participle = \"was written\"." },
  { category: "Linking", question: "Which linker best shows contrast?", options: ["Moreover", "Therefore", "However", "Furthermore"], answer: 2, explanation: "\"However\" introduces a contrasting idea." },
  { category: "Vocabulary", question: "A synonym for \"significant\" is:", options: ["Trivial", "Considerable", "Tiny", "Optional"], answer: 1, explanation: "\"Significant\" means considerable or important." },
];

// Deterministic daily selection of 5 questions (Tashkent day)
export function getDailyQuestions(now: Date = new Date()): Question[] {
  const dayOfYear = tashkentDayOfYear(now);
  const result: Question[] = [];
  for (let i = 0; i < XP_CONFIG.dailyQuiz.questions; i++) {
    result.push(QUESTION_POOL[(dayOfYear + i * 5) % QUESTION_POOL.length]);
  }
  return result;
}
