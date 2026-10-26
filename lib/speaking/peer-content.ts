/**
 * What a peer pair talks about, chosen once at match time for the pair's average
 * level and stored in the room's session state so both partners see the same.
 *
 * Sources: SPEAKING_SEED (lib/ielts/content/speaking.ts — Part 1 topics, Part 2 cue
 * cards with follow-ups, Part 3 discussions; Part 3 questions run from easier to
 * harder), SPEAKING_TOPICS (lib/speaking-topics.ts — everyday discussion questions)
 * and the debate motions below. Retired as Mock/CDI papers, these are still good
 * conversation material between two students.
 */
import { SPEAKING_SEED } from "@/lib/ielts/content/speaking";
import { SPEAKING_TOPICS } from "@/lib/speaking-topics";
import type { Part1Topic, Part2Card, Part3Question } from "@/lib/speaking-data";
import type { PeerFormat } from "./matching";

export interface PeerCue {
  setId: string;
  cue: string;
  points: string[];
  closing: string;
  followUp: string;
}
export interface ExamRound {
  setId: string;
  part1: { topic: string; q: string }[];
  cue: PeerCue;
  part3: { theme: string; questions: string[] };
}
export interface PromptCard {
  id: string;
  topic: string;
  text: string;
}
export interface DebateMotion {
  id: string;
  text: string;
  tier: "easy" | "mid" | "hard";
}

export type PeerContent =
  | { format: "exam"; level: number; rounds: [ExamRound, ExamRound] }
  | { format: "quick"; level: number; rounds: [PeerCue, PeerCue] }
  | { format: "conversation"; level: number; rounds: [PromptCard[], PromptCard[]] }
  | { format: "debate"; level: number; motion: DebateMotion };

export const DEBATE_MOTIONS: DebateMotion[] = [
  { id: "m-phones-school", tier: "easy", text: "Students should not be allowed to use mobile phones at school." },
  { id: "m-city-village", tier: "easy", text: "Living in a city is better than living in a village." },
  { id: "m-homework", tier: "easy", text: "Homework should be banned for primary school children." },
  { id: "m-pets", tier: "easy", text: "Every family should have a pet." },
  { id: "m-online-learning", tier: "mid", text: "Online learning is as good as learning in a classroom." },
  { id: "m-remote-work", tier: "mid", text: "Working from home is better than working in an office." },
  { id: "m-social-media-age", tier: "mid", text: "Children under 16 should not use social media." },
  { id: "m-public-transport", tier: "mid", text: "Public transport in cities should be free." },
  { id: "m-university-free", tier: "hard", text: "University education should be free for everyone." },
  { id: "m-ai-jobs", tier: "hard", text: "Artificial intelligence will create more jobs than it destroys." },
  { id: "m-tourism", tier: "hard", text: "Mass tourism does more harm than good to local communities." },
  { id: "m-sugar-tax", tier: "hard", text: "Governments should tax unhealthy food and drinks." },
];

type Rand = () => number;
const pickIndex = (n: number, rand: Rand) => Math.min(n - 1, Math.floor(rand() * n));
/** Two different items (when possible). */
function pickTwo<T>(items: readonly T[], rand: Rand): [T, T] {
  const i = pickIndex(items.length, rand);
  if (items.length < 2) return [items[i], items[i]];
  let j = pickIndex(items.length - 1, rand);
  if (j >= i) j += 1;
  return [items[i], items[j]];
}

const FALLBACK_FOLLOW_UP = "Is this something many people in your country would agree with?";

function cueOf(set: (typeof SPEAKING_SEED)[number]): PeerCue {
  return {
    setId: set.id,
    cue: set.part2.cue,
    points: [...set.part2.points],
    closing: set.part2.closing,
    followUp: set.part2.followUp ?? FALLBACK_FOLLOW_UP,
  };
}

/** Part 3 questions run easier → harder: lower levels get the first ones, higher levels the last. */
function part3For(questions: readonly string[], level: number): string[] {
  if (level < 5) return questions.slice(0, 3);
  if (level < 7) return questions.slice(0, 4);
  return questions.slice(-4);
}

function examRound(set: (typeof SPEAKING_SEED)[number], level: number): ExamRound {
  const topics = level < 5 ? set.part1.slice(0, 2) : set.part1.slice(0, 3);
  return {
    setId: set.id,
    part1: topics.flatMap((t) => t.questions.slice(0, 3).map((q) => ({ topic: t.topic, q }))),
    cue: cueOf(set),
    part3: { theme: set.part3.theme, questions: part3For(set.part3.questions, level) },
  };
}

/** Cards for one conversation round: everyday Part 1 questions (< 5.0), discussion questions (5.0–6.5), Part 3 (≥ 7.0). */
function conversationRound(level: number, rand: Rand, salt: number): PromptCard[] {
  if (level < 5) {
    const set = SPEAKING_SEED[pickIndex(SPEAKING_SEED.length, rand)];
    const topic = set.part1[1 + (salt % Math.max(1, set.part1.length - 1))] ?? set.part1[0];
    return topic.questions.slice(0, 3).map((text, i) => ({ id: `${set.id}-p1-${topic.topic}-${i}`, topic: topic.topic, text }));
  }
  if (level < 7) {
    const t = SPEAKING_TOPICS[pickIndex(SPEAKING_TOPICS.length, rand)];
    return t.questions.slice(0, 3).map((text, i) => ({ id: `topic-${t.topic}-${i}`, topic: t.topic, text }));
  }
  const set = SPEAKING_SEED[pickIndex(SPEAKING_SEED.length, rand)];
  return set.part3.questions.slice(-3).map((text, i) => ({ id: `${set.id}-p3-${i}`, topic: set.part3.theme, text }));
}

export function debateTier(level: number): DebateMotion["tier"] {
  return level < 5 ? "easy" : level < 7 ? "mid" : "hard";
}

/** Content for a new room. `rand` is injectable for tests (Math.random in the route). */
export function buildPeerContent(format: PeerFormat, level: number, rand: Rand = Math.random): PeerContent {
  switch (format) {
    case "exam": {
      const [a, b] = pickTwo(SPEAKING_SEED, rand);
      return { format, level, rounds: [examRound(a, level), examRound(b, level)] };
    }
    case "quick": {
      const [a, b] = pickTwo(SPEAKING_SEED, rand);
      return { format, level, rounds: [cueOf(a), cueOf(b)] };
    }
    case "conversation": {
      const first = conversationRound(level, rand, 0);
      let second = conversationRound(level, rand, 1);
      if (second.length && second[0].id === first[0]?.id) second = conversationRound(level, () => 0.999, 1);
      return { format, level, rounds: [first, second] };
    }
    case "debate": {
      const tier = debateTier(level);
      const motions = DEBATE_MOTIONS.filter((m) => m.tier === tier);
      return { format, level, motion: motions[pickIndex(motions.length, rand)] };
    }
  }
}

/**
 * Questions for solo practice when no practice sets are published: the same
 * conversation material as peer rooms, without sample answers (the runner then
 * hides "Show sample answer").
 */
export function soloPracticeFallback(): { part1Topics: Part1Topic[]; part2Cards: Part2Card[]; part3Questions: Part3Question[] } {
  return {
    part1Topics: SPEAKING_SEED.flatMap((s) =>
      s.part1.slice(1).map((t, i) => ({
        id: `${s.id}-p1-${i}`,
        emoji: "🗣️",
        name: t.topic,
        questions: t.questions.map((q) => ({ q, sample: "" })),
      })),
    ),
    part2Cards: SPEAKING_SEED.map((s) => ({
      id: `${s.id}-p2`,
      topic: s.part2.cue,
      points: [...s.part2.points, s.part2.closing],
      sample: "",
      usefulPhrases: [],
      tipUz: "",
    })),
    part3Questions: SPEAKING_SEED.flatMap((s) =>
      s.part3.questions.map((question, i) => ({
        id: `${s.id}-p3-${i}`,
        theme: s.part3.theme,
        question,
        sample: "",
        usefulPhrases: [],
        tipUz: "",
      })),
    ),
  };
}

/** A short room title ("Topic" column): what the pair talks about. */
export function peerContentTitle(c: PeerContent): string {
  switch (c.format) {
    case "exam":
      return `Mock interview · ${c.rounds[0].part3.theme}`;
    case "quick":
      return `Cue card · ${c.rounds[0].cue}`;
    case "conversation":
      return `Conversation · ${c.rounds[0][0]?.topic ?? "Free talk"}`;
    case "debate":
      return `Debate · ${c.motion.text}`;
  }
}
