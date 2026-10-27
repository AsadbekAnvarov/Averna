/**
 * Topics for the live speaking partner, built from the existing Speaking material:
 *   casual — SPEAKING_TOPICS (lib/speaking-topics.ts, everyday discussion questions)
 *   part1  — the Part 1 topics of SPEAKING_SEED (lib/ielts/content/speaking.ts), one per name
 *   part3  — the Part 3 discussions of SPEAKING_SEED (easier → harder questions)
 * Pure. Server-side only by convention (the seed is large): the page passes the
 * `{ id, label }` options to the client, the start route resolves the id.
 */
import { SPEAKING_SEED } from "@/lib/ielts/content/speaking";
import { SPEAKING_TOPICS } from "@/lib/speaking-topics";
import { SURPRISE_TOPIC, type LiveMode } from "./modes";

export interface LiveTopic {
  id: string;
  mode: LiveMode;
  label: string;
  /** Curated questions the partner may use (in its own words). */
  questions: string[];
}

export interface LiveTopicOption {
  id: string;
  label: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const MAX_QUESTIONS = 6;

function part1Topics(): LiveTopic[] {
  const byName = new Map<string, LiveTopic>();
  for (const set of SPEAKING_SEED) {
    for (const t of set.part1) {
      const id = `p1-${slug(t.topic)}`;
      const found = byName.get(id);
      if (!found) byName.set(id, { id, mode: "part1", label: t.topic, questions: t.questions.slice(0, MAX_QUESTIONS) });
      else
        for (const q of t.questions)
          if (found.questions.length < MAX_QUESTIONS && !found.questions.includes(q)) found.questions.push(q);
    }
  }
  return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export const LIVE_TOPICS: Readonly<Record<LiveMode, readonly LiveTopic[]>> = {
  casual: SPEAKING_TOPICS.map((t) => ({ id: `casual-${slug(t.topic)}`, mode: "casual" as const, label: t.topic, questions: t.questions.slice(0, MAX_QUESTIONS) })),
  part1: part1Topics(),
  part3: SPEAKING_SEED.map((s) => ({ id: `p3-${s.id}`, mode: "part3" as const, label: s.part3.theme, questions: s.part3.questions.slice(0, MAX_QUESTIONS) })),
};

/** `{ id, label }` per mode, for the setup screen. */
export function liveTopicOptions(): Record<LiveMode, LiveTopicOption[]> {
  const opt = (list: readonly LiveTopic[]) => list.map((t) => ({ id: t.id, label: t.label }));
  return { casual: opt(LIVE_TOPICS.casual), part1: opt(LIVE_TOPICS.part1), part3: opt(LIVE_TOPICS.part3) };
}

/** The topic for a start request: an id of that mode, or "surprise" (a random one). Null for an unknown id. */
export function resolveLiveTopic(mode: LiveMode, topicId: string, rand: () => number = Math.random): LiveTopic | null {
  const list = LIVE_TOPICS[mode];
  if (!list.length) return null;
  if (topicId === SURPRISE_TOPIC) return list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  return list.find((t) => t.id === topicId) ?? null;
}
