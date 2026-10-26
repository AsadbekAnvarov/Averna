/**
 * The AI draft of a teacher review (idea 10) — pure, shared by the review page
 * (server) and the one-tap approval panel (browser).
 *
 * A draft is the stored AI assessment turned into what a teacher sends: the
 * bands (per criterion, snapped to half bands), 2–4 sentences of feedback and
 * 1–3 next steps. It REUSES what the attempt already has — the AI examiner's
 * assessment written at submission, or a draft generated earlier and kept in
 * aiAnalysis.teacherDraft — so opening an item costs no AI call. Only when no
 * feedback text is stored is one generated (lib/review/draft.ts).
 */

import {
  aiBandOf,
  aiCriteriaOf,
  criteriaBand,
  criteriaComplete,
  prefillFromAi,
  snapBand,
  MAX_COMMENT_CHARS,
  type ReviewCriteria,
  type ReviewSkill,
} from "./scoring";

/** Where the draft's words come from. */
export type DraftSource =
  /** The AI examiner's assessment stored with the attempt. */
  | "stored"
  /** Generated for the teacher (now or earlier), kept in aiAnalysis.teacherDraft. */
  | "ai"
  /** The automatic text-metrics estimate (no AI examiner was available). */
  | "heuristic"
  /** Nothing to draft from: the teacher writes the feedback. */
  | "none";

export interface ReviewDraft {
  /** Overall band (half band), null when the AI gave none. */
  band: number | null;
  criteria: ReviewCriteria;
  /** 2–4 sentences ("" when there is nothing to draft from). */
  feedback: string;
  /** 1–3 short bullets. */
  nextSteps: string[];
  source: DraftSource;
}

const asRec = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const clean = (s: unknown, max = 400) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
const strings = (x: unknown, max = 6) =>
  (Array.isArray(x) ? x : []).map((s) => clean(s, 240)).filter((s) => s.length > 0).slice(0, max);

/** The first `max` sentences of a text (at most `chars` characters). */
export function firstSentences(text: string, max = 4, chars = 700): string {
  const t = clean(text, 4000);
  if (!t) return "";
  const parts = t.match(/[^.!?]+[.!?]+(?:["'”’)]+)?|[^.!?]+$/g) ?? [t];
  let out = "";
  for (const p of parts.slice(0, max)) {
    const next = `${out} ${p.trim()}`.trim();
    if (next.length > chars && out) break;
    out = next;
  }
  return out.slice(0, chars).trim();
}

/** Sentences joined into a paragraph (each ending in punctuation). */
function paragraph(items: string[]): string {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`))
    .join(" ");
}

/** The text the heuristic scorer writes for the student ("… an OpenAI API key can be added …") isn't feedback for a teacher to send. */
const SYSTEM_TEXT = /api key|automatic estimate|site settings/i;

/** Bands + words of a draft from a stored assessment; `heuristic` fills in when nothing else is there (Writing). */
export function draftFromAnalysis(
  skill: ReviewSkill,
  aiAnalysis: unknown,
  opts: { aiBand?: number | null; heuristic?: Record<string, unknown> | null } = {}
): ReviewDraft {
  const ai = asRec(aiAnalysis) ?? {};
  let criteria = prefillFromAi(skill, aiCriteriaOf(skill, ai));
  let band = snapBand(opts.aiBand ?? aiBandOf(skill, ai));
  const h = opts.heuristic ? asRec(opts.heuristic) : null;
  if (h && skill === "WRITING" && !criteriaComplete(skill, criteria)) {
    criteria = prefillFromAi(skill, aiCriteriaOf(skill, h));
    band = band ?? snapBand(aiBandOf(skill, h));
  }
  band = band ?? criteriaBand(skill, criteria);

  // 1) A draft generated earlier for a teacher.
  const kept = asRec(ai.teacherDraft);
  if (kept && clean(kept.feedback)) {
    return { band, criteria, feedback: firstSentences(String(kept.feedback)), nextSteps: strings(kept.nextSteps, 3), source: "ai" };
  }

  const heuristicRun = ai.assessedBy === "heuristic" || ai.source === "heuristic";
  if (skill === "WRITING") {
    const fromAi = !heuristicRun && clean(ai.detailedFeedback) && !SYSTEM_TEXT.test(String(ai.detailedFeedback));
    const strengths = strings(ai.strengths);
    const weaknesses = strings(ai.weaknesses);
    const recs = strings(ai.recommendations, 3);
    if (fromAi) {
      return { band, criteria, feedback: firstSentences(String(ai.detailedFeedback)), nextSteps: recs, source: "stored" };
    }
    if (strengths.length || weaknesses.length) {
      return {
        band,
        criteria,
        feedback: firstSentences(paragraph([...strengths.slice(0, 2), ...weaknesses.slice(0, 2)])),
        nextSteps: recs,
        source: heuristicRun ? "heuristic" : "stored",
      };
    }
    if (h) {
      return {
        band,
        criteria,
        feedback: firstSentences(paragraph([...strings(h.strengths).slice(0, 2), ...strings(h.weaknesses).slice(0, 2)])),
        nextSteps: strings(h.recommendations, 3),
        source: "heuristic",
      };
    }
    return { band, criteria, feedback: "", nextSteps: [], source: "none" };
  }

  // Speaking: the examiner's 3–5 feedback sentences (each with a tip).
  const fb = strings(ai.feedback, 6);
  if (fb.length) {
    return {
      band,
      criteria,
      feedback: firstSentences(paragraph(fb.slice(0, 2))),
      nextSteps: fb.slice(2, 5),
      source: heuristicRun ? "heuristic" : "stored",
    };
  }
  return { band, criteria, feedback: "", nextSteps: [], source: "none" };
}

/** The comment saved with the review: the feedback, then "Next steps" bullets. */
export function composeComment(feedback: string, nextSteps: readonly string[]): string {
  const steps = nextSteps.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 5);
  const body = feedback.trim();
  const text = steps.length ? `${body}${body ? "\n\n" : ""}Next steps:\n${steps.map((s) => `- ${s}`).join("\n")}` : body;
  return text.slice(0, MAX_COMMENT_CHARS);
}

/** Next steps typed one per line (leading "-", "•" or "1." removed). */
export function parseSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}
