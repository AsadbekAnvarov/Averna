/**
 * "Your next step" after peer speaking (docs/peer-speaking.md, Phase C). Pure and client-safe.
 * The weakest criterion in the partner's ratings (adjusted by the student's own caption
 * stats when captions were on) → one concrete suggestion and a link to an existing page.
 */
import { CRITERIA, type Criterion, type Ratings } from "./feedback-presets";

export interface OwnFluency {
  words: number;
  /** Words per minute of own speaking time; null when too little speech. */
  wpm: number | null;
  fillers: number;
}

export interface NextStep {
  criterion: Criterion;
  title: string;
  text: string;
  href: string;
  linkLabel: string;
}

/** Below these the own stats count against fluency. */
export const SLOW_WPM = 100;
export const FILLER_RATE = 0.05;
/** Own stats need at least this many words to mean anything. */
export const MIN_OWN_WORDS = 30;

const STEPS: Record<Criterion, Omit<NextStep, "criterion" | "text"> & { text: string }> = {
  fluency: {
    title: "Build fluency",
    text: "Answer three Part 1 questions out loud and keep each answer going for 30 seconds: answer, reason, example.",
    href: "/learning/speaking/solo",
    linkLabel: "Practise alone",
  },
  lexical: {
    title: "Grow your vocabulary",
    text: "Review 10 topic words in Flashcards, then use two of them in your next session.",
    href: "/flashcards",
    linkLabel: "Open Flashcards",
  },
  grammar: {
    title: "Strengthen your grammar",
    text: "Do one Grammar lesson on tenses or complex sentences, then try two if-sentences in your next answer.",
    href: "/grammar",
    linkLabel: "Open Grammar",
  },
  pronunciation: {
    title: "Sound clearer",
    text: "Practise five sentences in the Pronunciation coach, stressing the key word in each.",
    href: "/learning/pronunciation",
    linkLabel: "Open Pronunciation",
  },
};

/** Own-stat problems, if any (null when there's too little speech to judge). */
export function fluencyIssue(own: OwnFluency | null | undefined): "slow" | "fillers" | null {
  if (!own || own.words < MIN_OWN_WORDS) return null;
  if (own.fillers / own.words > FILLER_RATE) return "fillers";
  if (own.wpm !== null && own.wpm < SLOW_WPM) return "slow";
  return null;
}

/** Mean of each criterion over feedback rows (null for none). */
export function averageRatings(list: Ratings[]): Ratings | null {
  if (!list.length) return null;
  const out = {} as Ratings;
  for (const c of CRITERIA) out[c] = Math.round((list.reduce((s, r) => s + r[c], 0) / list.length) * 10) / 10;
  return out;
}

/**
 * The next step: the weakest criterion (ties in IELTS order: fluency, lexical, grammar,
 * pronunciation). An own-stat fluency problem lowers fluency by 1. Null with no data.
 */
export function nextStepFor(received: Ratings | null | undefined, own?: OwnFluency | null): NextStep | null {
  const issue = fluencyIssue(own);
  if (!received) {
    if (!issue) return null;
    return withText("fluency", issue, own!);
  }
  let weakest: Criterion = CRITERIA[0];
  let low = Infinity;
  for (const c of CRITERIA) {
    const score = received[c] - (c === "fluency" && issue ? 1 : 0);
    if (score < low) {
      low = score;
      weakest = c;
    }
  }
  return withText(weakest, weakest === "fluency" ? issue : null, own ?? null);
}

function withText(criterion: Criterion, issue: "slow" | "fillers" | null, own: OwnFluency | null): NextStep {
  const step = STEPS[criterion];
  let text = step.text;
  if (issue === "fillers" && own) text = `You used ${own.fillers} fillers in ${own.words} words. Pause silently instead of saying "um" — then ${lowerFirst(step.text)}`;
  else if (issue === "slow" && own?.wpm != null) text = `Your pace was about ${own.wpm} words a minute. Aim for 120+: ${lowerFirst(step.text)}`;
  return { criterion, ...step, text };
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Direction of the last 5 vs the 5 before (per criterion), from newest-first rows. */
export function ratingTrend(newestFirst: Ratings[]): Record<Criterion, "up" | "down" | "flat"> | null {
  if (newestFirst.length < 2) return null;
  const half = Math.min(5, Math.floor(newestFirst.length / 2));
  const recent = averageRatings(newestFirst.slice(0, half))!;
  const before = averageRatings(newestFirst.slice(half, half * 2))!;
  const out = {} as Record<Criterion, "up" | "down" | "flat">;
  for (const c of CRITERIA) {
    const d = recent[c] - before[c];
    out[c] = d >= 0.3 ? "up" : d <= -0.3 ? "down" : "flat";
  }
  return out;
}
