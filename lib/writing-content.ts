import { db } from "@/lib/db";
import { WRITING_PROMPTS, type WritingPrompt } from "@/lib/writing-data";
import { writingPromptSchema } from "@/lib/test-schema";

/**
 * All Writing prompts for a given task type: the built-in ("core") prompts plus
 * any published, AI-generated prompts from the database.
 *
 * Generated prompts are currently Task 2 essays only (Task 1 needs chart data),
 * so they are appended to the "task2" list. DB access is defensive — if the
 * GeneratedTest table isn't there yet (before `db:push`), the core prompts still
 * work perfectly.
 */
export async function getWritingPrompts(taskType: "task1" | "task2"): Promise<WritingPrompt[]> {
  const core = WRITING_PROMPTS[taskType] ?? [];
  if (taskType !== "task2") return core;

  let generated: WritingPrompt[] = [];
  try {
    const rows = await db.generatedTest.findMany({
      where: { module: "WRITING", published: true },
      orderBy: { createdAt: "desc" },
    });
    generated = rows
      .map((r) => {
        const parsed = writingPromptSchema.safeParse(r.data);
        return parsed.success ? ({ ...parsed.data, id: r.id } as WritingPrompt) : null;
      })
      .filter((x): x is WritingPrompt => x !== null);
  } catch {
    generated = [];
  }

  return [...core, ...generated];
}
