import type { LearningDnaProfile } from "@/lib/engine/learning-dna/types";
export interface FocusStep {
  id: string;
  title: string;
  minutes: number;
  href: string;
  why: string;
}
export interface FocusPlan {
  title: string;
  basis: string;
  personalised: boolean;
  steps: FocusStep[];
}
const FOCUSED: Record<string, { title: string; href: string }> = {
  WRITING: { title: "Rework a paragraph", href: "/studio/essay-xray" },
  SPEAKING: {
    title: "Practise one speaking exchange",
    href: "/studio/roleplay",
  },
  LISTENING: {
    title: "Listen actively to a short extract",
    href: "/studio/podcast",
  },
  READING: { title: "Read for one main idea", href: "/article" },
  VOCABULARY: { title: "Recall your vocabulary", href: "/flashcards" },
  GRAMMAR: { title: "Practise one grammar pattern", href: "/grammar" },
};
/** Suggestions, not predicted IELTS gains. No full timed exam is compressed into 8 minutes. */
export function nextFocusPlan(
  profile: Pick<LearningDnaProfile, "confidence" | "weakest" | "dataPoints">,
  dueMistakes: number,
): FocusPlan {
  const measured =
    profile.confidence !== "insufficient" &&
    profile.weakest &&
    profile.weakest.events >= 3
      ? profile.weakest
      : null;
  const focus = measured ? FOCUSED[measured.key] : null;
  return {
    title: "Your next 15 minutes",
    personalised: Boolean(focus),
    basis:
      focus && measured
        ? `Your recent Learning DNA identifies ${measured.label} as a skill to reinforce. This is a practice suggestion, not a score prediction.`
        : "We need more learning evidence before claiming to know your weakest skill. Start with a balanced short session.",
    steps: [
      {
        id: "recall",
        title:
          dueMistakes > 0 ? "Recall a correction" : "Wake up your vocabulary",
        minutes: 3,
        href: dueMistakes > 0 ? "/studio/mistakes" : "/flashcards",
        why:
          dueMistakes > 0
            ? `${dueMistakes} saved correction${dueMistakes === 1 ? " is" : "s are"} ready for review.`
            : "A few retrieval attempts make a clear, manageable start.",
      },
      {
        id: "focus",
        title: focus?.title ?? "Practise one speaking exchange",
        minutes: 8,
        href: focus?.href ?? "/studio/roleplay",
        why:
          focus && measured
            ? `Focus on ${measured.label.toLowerCase()} using a short practice tool rather than a full exam.`
            : "Try a short exchange to produce new evidence for your learning profile.",
      },
      {
        id: "apply",
        title: "Capture one thing you improved",
        minutes: 4,
        href: "/studio/mistakes",
        why: "Save one original phrase and your correction, or rewrite a correction you already saved.",
      },
    ],
  };
}
