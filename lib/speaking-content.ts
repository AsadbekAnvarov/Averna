import { db } from "@/lib/db";
import {
  PART1_TOPICS,
  PART2_CARDS,
  PART3_QUESTIONS,
  type Part1Topic,
  type Part2Card,
  type Part3Question,
} from "@/lib/speaking-data";
import { speakingTestSchema } from "@/lib/test-schema";

export interface SpeakingContent {
  part1Topics: Part1Topic[];
  part2Cards: Part2Card[];
  part3Questions: Part3Question[];
}

/**
 * All Speaking practice content: the built-in ("core") Part 1/2/3 material plus
 * any published, AI-generated sets from the database. Each generated set adds
 * one Part 1 topic, one Part 2 cue card and a few Part 3 questions. Inner `id`
 * fields are derived from the row id here (the generator doesn't produce them).
 *
 * DB access is defensive — if the GeneratedTest table isn't there yet (before
 * `db:push`), the core content still works perfectly.
 */
export async function getSpeakingContent(): Promise<SpeakingContent> {
  const genP1: Part1Topic[] = [];
  const genP2: Part2Card[] = [];
  const genP3: Part3Question[] = [];

  try {
    const rows = await db.generatedTest.findMany({
      where: { module: "SPEAKING", published: true },
      orderBy: { createdAt: "desc" },
    });
    for (const r of rows) {
      const parsed = speakingTestSchema.safeParse(r.data);
      if (!parsed.success) continue;
      const t = parsed.data;
      genP1.push({
        id: `gen-${r.id}-p1`,
        emoji: t.part1.emoji || "🗣️",
        name: t.part1.name,
        questions: t.part1.questions,
      });
      genP2.push({ id: `gen-${r.id}-p2`, ...t.part2 });
      t.part3.forEach((q, i) => genP3.push({ id: `gen-${r.id}-p3-${i}`, ...q }));
    }
  } catch {
    /* table not migrated yet — fall back to core content only */
  }

  return {
    part1Topics: [...PART1_TOPICS, ...genP1],
    part2Cards: [...PART2_CARDS, ...genP2],
    part3Questions: [...PART3_QUESTIONS, ...genP3],
  };
}
