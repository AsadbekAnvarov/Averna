import { db } from "@/lib/db";
import { LISTENING_TESTS, type ListeningTest } from "@/lib/listening-tests-data";
import { listeningTestSchema } from "@/lib/test-schema";

/**
 * All available listening tests: the built-in ("core") tests plus any published
 * generated tests from the database. DB access is defensive — if the
 * GeneratedTest table isn't there yet (before `db:push`), the core tests still
 * work perfectly.
 */
export async function listListeningTests(): Promise<ListeningTest[]> {
  let generated: ListeningTest[] = [];
  try {
    const rows = await db.generatedTest.findMany({
      where: { module: "LISTENING", published: true },
      orderBy: { createdAt: "desc" },
    });
    generated = rows
      .map((r) => {
        const parsed = listeningTestSchema.safeParse(r.data);
        return parsed.success ? ({ ...parsed.data, id: r.id } as ListeningTest) : null;
      })
      .filter((x): x is ListeningTest => x !== null);
  } catch {
    generated = [];
  }
  return [...LISTENING_TESTS, ...generated];
}
