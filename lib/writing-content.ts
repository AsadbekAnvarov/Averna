import { db } from "@/lib/db";
import type { WritingPrompt } from "@/lib/writing-data";
import { writingPromptSchema, writingTask1Schema } from "@/lib/test-schema";
import { CDI_WRITING } from "@/lib/ielts/content/cdi";
import { listedWriting } from "@/lib/ielts/listing";

/**
 * Published, AI-generated Writing prompts of one task type (newest first).
 *
 * Generated content is stored under distinct modules so the two task types
 * never mix: Task 2 essays under "WRITING", Task 1 chart tasks under
 * "WRITING_TASK1". DB access is defensive — if the GeneratedTest table isn't
 * there yet (before `db:push`), this is simply empty.
 */
export async function getGeneratedWritingPrompts(taskType: "task1" | "task2"): Promise<WritingPrompt[]> {
  const moduleKey = taskType === "task1" ? "WRITING_TASK1" : "WRITING";
  try {
    const rows = await db.generatedTest.findMany({
      where: { module: moduleKey, published: true },
      orderBy: { createdAt: "desc" },
    });
    return rows
      .map((r) => {
        const parsed =
          taskType === "task1"
            ? writingTask1Schema.safeParse(r.data)
            : writingPromptSchema.safeParse(r.data);
        return parsed.success ? ({ ...parsed.data, id: r.id } as WritingPrompt) : null;
      })
      .filter((x): x is WritingPrompt => x !== null);
  } catch {
    return [];
  }
}

/**
 * The Writing prompts students and teachers can pick for a task type: the CDI
 * prompts (by number), then the published AI-generated ones. The built-in
 * prompts are archived (lib/ielts/content/archive.ts) — still resolvable by id
 * through lib/ielts/catalog getWritingTask, but no longer listed.
 */
export async function getWritingPrompts(taskType: "task1" | "task2"): Promise<WritingPrompt[]> {
  return listedWriting(CDI_WRITING[taskType] ?? [], await getGeneratedWritingPrompts(taskType));
}
