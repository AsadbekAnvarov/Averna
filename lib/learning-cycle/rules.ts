import { aiBandOf, aiCriteriaOf, criteriaFor, readCriteria, type ReviewSkill } from "@/lib/review/scoring";
import { answersOf, asRec, attemptTitle, countWords, str, taskTypeOf } from "@/lib/review/answers";

export type EntryKind = "REVISION" | "TRANSFER";
export type Outcome = "demonstrated" | "developing" | "not_yet";
export interface Focus { key: string; label: string; meaning: string; action: string }
export interface CyclePlan {
  version: 1; skill: ReviewSkill; title: string; prompt: string; original: string;
  baseline: { source: "teacher" | "ai" | "heuristic" | "unavailable"; band: number | null; criteria: Record<string, number | null>; comment: string; capturedAt: string };
  goals: Focus[]; transfer: { id: string; prompt: string; note: string };
}
export interface PracticeReview { outcomes: { key: string; outcome: Outcome; quote: string }[]; comment: string; reviewerName: string; createdAt: string }
export interface PracticeEntry { id: string; kind: EntryKind; status: "DRAFT" | "SUBMITTED"; body: string; reflection: string; version: number; createdAt: string; updatedAt: string; review: PracticeReview | null }
export interface CycleView { id: string | null; sourceId: string; plan: CyclePlan; entries: PracticeEntry[]; isOwner: boolean; canWrite: boolean; canReview: boolean; hasAssignedTeacher: boolean }
export class CycleError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const learningCycleEnabled = () => process.env.LEARNING_CYCLE === "on";
export const validSourceId = (id: string) => /^[A-Za-z0-9_-]{8,64}$/.test(id);
const explanations: Record<string, [string, string]> = {
  taskAchievement: ["How directly the response covers the task and develops its key points.", "Make your central point clear and support it with a relevant detail."],
  coherenceCohesion: ["How logically ideas connect and how clearly the response is organised.", "Give each paragraph one purpose; use connections that make the reasoning clear."],
  lexicalResource: ["How accurately and precisely vocabulary communicates the intended meaning.", "Replace vague wording with precise words and check that they fit the context."],
  grammarAccuracy: ["How accurately sentence structures and grammar support meaning.", "Check sentence boundaries, agreement and tense; vary structures only where useful."],
  lexical: ["How precisely vocabulary communicates an idea in a response.", "Use specific words and explain an idea in your own words."],
  grammar: ["How accurately sentence structures communicate your answer.", "Check tense, agreement and sentence boundaries in the written response."],
};
// Authored micro-tasks, not generated official IELTS papers or automatic band tests.
const topics = [
  { id: "library", words: ["library", "libraries"], prompt: "Your town can improve its public library or build a new sports centre. Recommend one choice and explain one benefit and one possible drawback." },
  { id: "repair", words: ["repair", "reuse", "recycle"], prompt: "A community wants to encourage people to repair everyday objects instead of replacing them. Propose one practical measure, explain how it would help, and address one difficulty." },
  { id: "garden", words: ["garden", "gardens", "park"], prompt: "An unused space near a school could become a community garden or a small car park. Recommend one use, justify it, and respond to a likely objection." },
  { id: "museum", words: ["museum", "museums", "exhibition"], prompt: "A local museum wants more young visitors. Suggest one change, explain why it would work, and discuss one limitation." },
];
export function buildPlan(row: { module: string; answers: unknown; aiAnalysis: unknown; score: number; review?: { band: number; criteria: unknown; comment: string | null } | null }, now = new Date()): CyclePlan {
  if (row.module !== "WRITING" && row.module !== "SPEAKING") throw new CycleError("This practice cycle supports Writing and Speaking.", 404);
  const skill = row.module; const a = answersOf(row.answers); const ai = asRec(row.aiAnalysis) ?? {};
  const parts = Array.isArray(a.answers) ? a.answers.map(asRec).filter(Boolean) as Record<string, unknown>[] : [];
  const original = skill === "WRITING" ? str(a.essay).trim() : (parts.length ? parts.map(p => str(p.transcript)).join("\n\n") : str(a.transcript)).trim();
  const responseWords = skill === "WRITING" ? countWords(original) : countWords(parts.length ? parts.map(p => str(p.transcript)).join(" ") : str(a.transcript));
  if (responseWords < 20 || original.length > 60000) throw new CycleError("A saved response of at least 20 words is needed to start a practice cycle.");
  const prompt = skill === "WRITING" ? str(a.prompt) : (parts.length ? parts.map(p => str(p.question)).join("\n") : str(a.question));
  // Do not use transcripts to rank pronunciation or timing-based fluency.
  const defs = criteriaFor(skill, taskTypeOf(a)).filter(d => skill === "WRITING" || d.key === "lexical" || d.key === "grammar");
  const raw = row.review ? readCriteria(skill, row.review.criteria) : aiCriteriaOf(skill, row.aiAnalysis);
  const criteria = Object.fromEntries(criteriaFor(skill, taskTypeOf(a)).map(d => { const n = raw[d.key]; return [d.key, typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 9 ? n : null]; }));
  const rated = defs.filter(d => criteria[d.key] !== null).sort((x, y) => criteria[x.key]! - criteria[y.key]!);
  const chosen = rated.length ? rated.slice(0, 2) : defs.filter(d => ["coherenceCohesion", "grammarAccuracy", "lexical", "grammar"].includes(d.key)).slice(0, 2);
  const goals = chosen.map(d => ({ key: d.key, label: d.label, meaning: explanations[d.key][0], action: explanations[d.key][1] }));
  if (skill === "WRITING" && taskTypeOf(a) === "task1") {
    for (const g of goals) if (g.key === "taskAchievement") g.action = "Identify the main pattern, then support your overview with two accurate comparisons.";
  }
  const topicText = `${prompt} ${original}`.toLowerCase();
  const leastOverlap = Math.min(...topics.map(t => t.words.filter(w => topicText.includes(w)).length));
  const candidates = topics.filter(t => t.words.filter(w => topicText.includes(w)).length === leastOverlap);
  const seed = Array.from(`${prompt} ${original}`).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  const topic = candidates[seed % candidates.length];
  const task1 = skill === "WRITING" && taskTypeOf(a) === "task1";
  const task1Prompt = prompt.includes("monthly visitors to two community facilities") ? "Practice data (fictional): commuters using two transport modes. Bicycle: 2020 80, 2022 130, 2024 190. Bus: 2020 260, 2022 240, 2024 210. Write an overview and two accurate comparisons using the figures." : "Practice data (fictional): monthly visitors to two community facilities. Library: January 120, February 150, March 210. Sports centre: January 240, February 220, March 180. Write an overview of the main patterns and two comparisons using these figures.";
  return {
    version: 1, skill, title: attemptTitle(skill, a), prompt, original,
    baseline: { source: row.review ? "teacher" : Object.keys(ai).length ? (ai.source === "heuristic" ? "heuristic" : "ai") : "unavailable", band: row.review?.band ?? aiBandOf(skill, row.aiAnalysis), criteria, comment: row.review?.comment ?? str(ai.detailedFeedback), capturedAt: now.toISOString() },
    goals, transfer: { id: task1 ? "practice-table-1" : topic.id, prompt: task1 ? task1Prompt : topic.prompt, note: skill === "SPEAKING" ? "Write 60–180 words as speaking preparation. This checks language in the transcript, not pronunciation, pacing or a Speaking band." : "Write a focused response of 80–220 words. This is a skill-transfer exercise, not a full IELTS Task 1 or Task 2." }  
};
}
export function nextStep(entries: PracticeEntry[]): "REVISION" | "WAIT_REVISION" | "TRANSFER" | "WAIT_TRANSFER" | "COMPLETE" {
  const r = entries.find(e => e.kind === "REVISION"); if (!r || r.status === "DRAFT") return "REVISION"; if (!r.review) return "WAIT_REVISION";
  const t = entries.find(e => e.kind === "TRANSFER"); if (!t || t.status === "DRAFT") return "TRANSFER"; return t.review ? "COMPLETE" : "WAIT_TRANSFER";
}
export function parseEntry(raw: unknown, submit: boolean) {
  const b = asRec(raw); if (!b || (b.kind !== "REVISION" && b.kind !== "TRANSFER")) throw new CycleError("Choose a valid practice step.");
  if (typeof b.body !== "string" || typeof b.reflection !== "string" || !Number.isInteger(b.version) || Number(b.version) < 0) throw new CycleError("The draft could not be read.");
  const body = b.body.replace(/\r\n?/g, "\n").trim(), reflection = b.reflection.trim();
  if (!body || body.length > 20000 || reflection.length > 1500) throw new CycleError("Keep the response to 20,000 characters and the reflection to 1,500.");
  if (submit && (countWords(body) < 20 || reflection.length < 10)) throw new CycleError("Before submitting, write at least 20 words and briefly explain what you changed or applied.");
  return { kind: b.kind as EntryKind, body, reflection, version: Number(b.version) };
}
const normal = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export function parsePracticeReview(raw: unknown, plan: CyclePlan, entry: PracticeEntry) {
  const b = asRec(raw); if (!b || !Array.isArray(b.outcomes) || b.outcomes.length !== plan.goals.length || typeof b.comment !== "string" || b.comment.trim().length < 10 || b.comment.length > 2000) throw new CycleError("Review each focus skill and add a helpful comment (10–2,000 characters).");
  const outcomes = plan.goals.map(g => {    
const matches = (b.outcomes as unknown[]).map(asRec).filter(x => x?.key === g.key); const x = matches[0];
    if (matches.length !== 1 || !x || !["demonstrated", "developing", "not_yet"].includes(String(x.outcome)) || typeof x.quote !== "string" || x.quote.trim().length < 10 || x.quote.length > 500 || !normal(entry.body).includes(normal(x.quote))) throw new CycleError("For each focus skill, quote 10–500 characters from this response as evidence.");
    return { key: g.key, outcome: x.outcome as Outcome, quote: x.quote.trim() };  
});
  return { outcomes, comment: b.comment.trim() };
}
