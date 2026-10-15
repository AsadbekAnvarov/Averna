import { db } from "@/lib/db";
import { compareTestTitles } from "@/lib/ielts/catalog-order";
import {
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

/** Published legacy practice data only; teacher-led CDI entry points do not use AI scoring. */
export async function getSpeakingContent(): Promise<SpeakingContent> {
  const genP1: Part1Topic[] = [];
  const genP2: Part2Card[] = [];
  const genP3: Part3Question[] = [];

  try {
    const rows = await db.generatedTest.findMany({
      where: { module: "SPEAKING", published: true },
      orderBy: { createdAt: "desc" },
    });
    for (const r of [...rows].sort(compareTestTitles)) {
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
    /* Unavailable content stays empty, rather than resurrecting retired originals. */
  }

  return {
    part1Topics: genP1,
    part2Cards: genP2,
    part3Questions: genP3,
  };
}
