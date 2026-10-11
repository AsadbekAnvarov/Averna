import { db } from "@/lib/db";
import { type WritingPrompt } from "@/lib/writing-data";
import { writingPromptSchema, writingTask1Schema, importedWritingPromptSchema } from "@/lib/test-schema";

/** Published Writing tasks only. Retired originals resolve separately for saved Mock history. */
export async function getWritingPrompts(taskType: "task1" | "task2"): Promise<WritingPrompt[]> {
  // Retired original prompts are not offered for new practice or Mock allocation.
  const moduleKey = taskType === "task1" ? "WRITING_TASK1" : "WRITING";

  let generated: WritingPrompt[] = [];
  try {
    const rows = await db.generatedTest.findMany({
      where: { module: moduleKey, published: true },
      orderBy: { createdAt: "desc" },
    });
    generated = rows
      .map((r) => {
        const supplied = importedWritingPromptSchema.safeParse(r.data);
        if (supplied.success) {
          if (taskType === "task1" && !supplied.data.imageUrl) return null;
          return { ...supplied.data, type: supplied.data.type.replace(/Imported CDI/gi, "Averna CDI"), id: r.id } as WritingPrompt;
        }
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

  return generated;
}
