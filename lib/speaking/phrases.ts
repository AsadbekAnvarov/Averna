/**
 * Functional phrases for the peer room's phrase helper drawer, chosen by format,
 * phase and role. Static content; nothing is sent anywhere.
 */
import type { PeerFormat } from "./matching";
import type { PhaseKey } from "./session";

export interface PhraseGroup {
  id: string;
  title: string;
  phrases: string[];
}

/** examiner/candidate (exam, quick), speaker/listener (conversation, debate). */
export type PhraseRole = "examiner" | "candidate" | "speaker" | "listener";

export const PHRASES: Record<string, PhraseGroup> = {
  time: {
    id: "time",
    title: "Buying time",
    phrases: [
      "That's an interesting question…",
      "Let me think about that for a moment.",
      "I've never really thought about it, but…",
      "How can I put this?",
      "Well, it depends on what you mean by…",
    ],
  },
  examples: {
    id: "examples",
    title: "Giving examples",
    phrases: ["For example, …", "For instance, …", "A good example of this is…", "Take my own family, for example.", "Just to give you an idea, …"],
  },
  reasons: {
    id: "reasons",
    title: "Explaining and adding",
    phrases: ["The main reason is that…", "On top of that, …", "What's more, …", "That's why I think…", "As a result, …"],
  },
  agree: {
    id: "agree",
    title: "Agreeing",
    phrases: ["I completely agree.", "That's a good point.", "You're right about that.", "I couldn't agree more.", "Exactly — and also…"],
  },
  disagree: {
    id: "disagree",
    title: "Disagreeing politely",
    phrases: [
      "I see your point, but…",
      "I'm not sure I agree.",
      "That's true to some extent, however…",
      "I'd look at it differently.",
      "On the other hand, …",
    ],
  },
  clarify: {
    id: "clarify",
    title: "Asking for clarification",
    phrases: [
      "Sorry, could you repeat the question?",
      "What do you mean by…?",
      "Do you mean…?",
      "Could you say that another way?",
      "Sorry, I didn't catch that.",
    ],
  },
  part2: {
    id: "part2",
    title: "Part 2: structure your talk",
    phrases: [
      "I'm going to talk about…",
      "First of all, I'd like to say…",
      "The reason it was so special is…",
      "Looking back, I'd say…",
      "So that's why it means a lot to me.",
    ],
  },
  examiner: {
    id: "examiner",
    title: "Examiner phrases",
    phrases: [
      "Let's talk about…",
      "Why do you think that is?",
      "Can you tell me a bit more about that?",
      "Thank you. Now let's move on to…",
      "Thank you, that's the end of this part.",
    ],
  },
  followUp: {
    id: "followUp",
    title: "Follow-up questions",
    phrases: ["Why do you think so?", "What about you?", "Has that ever happened to you?", "How did you feel about it?", "Would you do it again?"],
  },
  turns: {
    id: "turns",
    title: "Taking turns",
    phrases: ["What do you think?", "Sorry, go ahead.", "Can I add something?", "Let me finish this point…", "Your turn — how about you?"],
  },
  rebuttal: {
    id: "rebuttal",
    title: "Rebuttal",
    phrases: [
      "My opponent said…, but…",
      "That argument ignores…",
      "Even if that's true, …",
      "The evidence actually shows…",
      "So, on balance, …",
    ],
  },
  opening: {
    id: "opening",
    title: "Opening a debate",
    phrases: ["I'm going to argue that…", "My first point is…", "Secondly, …", "Finally, …", "For these reasons, I believe…"],
  },
};

const pick = (...ids: (keyof typeof PHRASES)[]) => ids.map((id) => PHRASES[id]);

/** The groups that help most right now, most useful first. */
export function phraseGroupsFor(format: PeerFormat, phase: PhaseKey, role: PhraseRole): PhraseGroup[] {
  if (format === "exam" || format === "quick") {
    if (role === "examiner") return pick("examiner", "followUp", "clarify");
    if (phase === "part2-prep" || phase === "part2-talk") return pick("part2", "time", "examples", "reasons");
    return pick("time", "examples", "reasons", "clarify");
  }
  if (format === "debate") {
    if (phase === "rebuttal") return pick("rebuttal", "disagree", "examples", "time");
    return role === "speaker" ? pick("opening", "reasons", "examples", "time") : pick("rebuttal", "disagree", "agree");
  }
  // conversation (and the lobby/swap of any format)
  return role === "speaker"
    ? pick("time", "examples", "reasons", "turns", "clarify")
    : pick("followUp", "agree", "disagree", "turns", "clarify");
}
