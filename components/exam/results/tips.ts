import type { GroupKind } from "@/lib/ielts/types";
import type { ObjectiveSkill } from "./attempt";

/**
 * One concrete, exam-specific habit per question type — what to do differently
 * on the next paper. Reading and Listening differ where the skill does
 * (copying from the passage vs. spelling what you hear, locating vs. following
 * the recording).
 */
export interface KindTip {
  /** Short imperative headline. */
  focus: string;
  tip: string;
}

const READING: Record<GroupKind, KindTip> = {
  tfng: {
    focus: "Separate FALSE from NOT GIVEN",
    tip: "FALSE means the passage says the opposite; NOT GIVEN means it says nothing either way. Find the exact sentence first, then compare the qualifiers — all, some, usually, only, never. They usually decide the answer.",
  },
  ynng: {
    focus: "Track the writer's opinion, not the facts",
    tip: "These questions ask what the writer believes. Look for opinion words (should, clearly, surprisingly, it is doubtful) and choose NO only when the writer rejects the claim. If the writer never gives a view on it, the answer is NOT GIVEN.",
  },
  mcq: {
    focus: "Locate first, then eliminate",
    tip: "Find the part of the passage the stem refers to before you read the options. Cross out options that are true but don't answer the question, and distrust options that repeat the passage word for word — correct answers are usually paraphrased.",
  },
  "mcq-multi": {
    focus: "Test every option on its own",
    tip: "Treat each option as a separate TRUE / FALSE statement and check it against the text. Choose exactly as many letters as the question asks — each correct letter is one mark, so never leave a slot empty.",
  },
  matching: {
    focus: "Match the main idea, not a detail",
    tip: "For headings, read the first and last sentences of each paragraph and choose the heading that sums up the whole paragraph. For names or information, scan for the keyword, then read the full sentence to check that the meaning matches, not just the words.",
  },
  gap: {
    focus: "Copy exactly and stay within the word limit",
    tip: "Take the words straight from the passage, spelled exactly as printed. An answer over the word limit is marked wrong. Before you move on, check that your word fits the sentence grammatically — singular or plural, noun or verb.",
  },
  "gap-box": {
    focus: "Predict the word type before you look at the box",
    tip: "Decide what each gap needs (a noun, an adjective, a verb) and what it means, then choose from the box. The summary paraphrases the passage, so the right option rarely uses the passage's own word.",
  },
};

const LISTENING: Record<GroupKind, KindTip> = {
  tfng: {
    focus: "Wait for the speaker's final position",
    tip: "Speakers often agree at first and then correct themselves (\"well, actually…\"). Decide only when the idea is finished, and choose NOT GIVEN when the point is never discussed.",
  },
  ynng: {
    focus: "Listen for opinion signals",
    tip: "Listen for how the speaker feels about the claim (I'm not convinced, I'd agree, that's doubtful). A fact mentioned in passing is not the same as the speaker's view.",
  },
  mcq: {
    focus: "Don't choose the first option you hear",
    tip: "Use the reading time to underline how the options differ. Speakers often mention every option, so wait for the final decision, especially after but, actually or in the end.",
  },
  "mcq-multi": {
    focus: "Tick the options off as they come up",
    tip: "The speakers usually go through the options one by one. Mark each one as accepted or rejected while you listen, and choose exactly as many letters as the question asks.",
  },
  matching: {
    focus: "Follow the order of the items",
    tip: "The recording follows the order of the numbered items. Listen for synonyms of the options rather than the exact words. If you miss one, move straight on to the next item instead of waiting.",
  },
  gap: {
    focus: "Spell exactly and stay within the word limit",
    tip: "Misspelled words and answers over the limit lose the mark. Predict each answer before you hear it (a number, a name, a plural noun). Check plural endings, and names that are spelled out letter by letter.",
  },
  "gap-box": {
    focus: "Match meanings, not sounds",
    tip: "Before the recording starts, predict what each gap means. The speakers won't use the words in the box, so listen for a paraphrase and cross off each option once you've used it.",
  },
};

export function tipFor(skill: ObjectiveSkill, kind: GroupKind): KindTip {
  return (skill === "READING" ? READING : LISTENING)[kind];
}

/** No negative marking in IELTS — the tip shown when answers were left blank. */
export function blankTip(skill: ObjectiveSkill, blanks: number): string {
  const q = blanks === 1 ? "1 question" : `${blanks} questions`;
  return skill === "READING"
    ? `You left ${q} blank. Wrong answers cost nothing in IELTS, so always make a reasoned guess — and keep about a minute at the end of each passage for any gaps.`
    : `You left ${q} blank. Wrong answers cost nothing in IELTS, so use the checking time at the end to fill every gap with your best guess.`;
}
