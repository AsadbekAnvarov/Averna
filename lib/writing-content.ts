import { db } from "@/lib/db";
import { WRITING_PROMPTS, type WritingPrompt } from "@/lib/writing-data";
import { writingPromptSchema, writingTask1Schema } from "@/lib/test-schema";

/**
 * All Writing prompts for a given task type: the built-in ("core") prompts plus
 * any published, AI-generated prompts from the database.
 *
 * Generated content is stored under distinct modules so the two task types
 * never mix: Task 2 essays under "WRITING", Task 1 chart tasks under
 * "WRITING_TASK1". DB access is defensive — if the GeneratedTest table isn't
 * there yet (before `db:push`), the core prompts still work perfectly.
 */
export async function getWritingPrompts(taskType: "task1" | "task2"): Promise<WritingPrompt[]> {
  const core = WRITING_PROMPTS[taskType] ?? [];
  const moduleKey = taskType === "task1" ? "WRITING_TASK1" : "WRITING";

  let generated: WritingPrompt[] = [];
  try {
    const rows = await db.generatedTest.findMany({
      where: { module: moduleKey, published: true },
      orderBy: { createdAt: "desc" },
    });
    generated = rows
      .map((r) => {
        const parsed =
          taskType === "task1"
            ? writingTask1Schema.safeParse(r.data)
            : writingPromptSchema.safeParse(r.data);
        return parsed.success ? ({ ...parsed.data, id: r.id } as WritingPrompt) : null;
      })
      .filter((x): x is WritingPrompt => x !== null);
  } catch {
    generated = [];
  }

  return [...core, ...generated];
}
