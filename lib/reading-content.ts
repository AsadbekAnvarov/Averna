import { db } from "@/lib/db";
import { READING_TESTS, type ReadingTest } from "@/lib/reading-tests-data";
import { readingTestSchema } from "@/lib/test-schema";

export interface ReadingTestSummary {
  id: string;
  title: string;
  description: string;
  passages: number;
  questions: number;
  timeLimit: number;
  source: "core" | "generated";
}

function summarize(t: ReadingTest, source: "core" | "generated"): ReadingTestSummary {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    passages: t.passages.length,
    questions: t.passages.reduce((n, p) => n + p.questions.length, 0),
    timeLimit: t.timeLimit,
    source,
  };
}

/**
 * All available reading tests: the built-in ("core") tests plus any published
 * generated tests from the database. DB access is wrapped defensively so that
 * if the GeneratedTest table doesn't exist yet (before `db:push`) the core
 * tests still work perfectly.
 */
export async function listReadingTests(): Promise<ReadingTestSummary[]> {
  const core = Object.values(READING_TESTS).map((t) => summarize(t, "core"));
  let generated: ReadingTestSummary[] = [];
  try {
    const rows = await db.generatedTest.findMany({
      where: { module: "READING", published: true },
      orderBy: { createdAt: "desc" },
    });
    generated = rows
      .map((r) => {
        const parsed = readingTestSchema.safeParse(r.data);
        return parsed.success ? summarize({ ...parsed.data, id: r.id }, "generated") : null;
      })
      .filter((x): x is ReadingTestSummary => x !== null);
  } catch {
    generated = [];
  }
  return [...core, ...generated];
}

/** Look up a single reading test by id: built-in first, then a published DB test. */
export async function getReadingTest(id: string): Promise<ReadingTest | null> {
  if (READING_TESTS[id]) return READING_TESTS[id];
  try {
    const row = await db.generatedTest.findUnique({ where: { id } });
    if (!row || !row.published || row.module !== "READING") return null;
    const parsed = readingTestSchema.safeParse(row.data);
    if (!parsed.success) return null;
    return { ...parsed.data, id: row.id } as ReadingTest;
  } catch {
    return null;
  }
}
