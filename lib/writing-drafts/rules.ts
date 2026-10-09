import { z } from "zod";
export const draftScopeSchema = z.object({
  taskType: z.enum(["task1", "task2"]),
  promptId: z.string().min(1).max(200),
});
export const draftWriteSchema = draftScopeSchema.extend({
  version: z.number().int().min(0).max(2147483646),
  essay: z.string().max(20000),
  attemptId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  timeLeft: z.number().int().min(0).max(2400),
}).strict();
export type DraftWrite = z.infer<typeof draftWriteSchema>;
export interface DraftSnapshot {
  essay: string; attemptId: string; timeLeft: number; version: number; updatedAt: string;
}
export function draftScope(taskType: string, promptId: string): string {
  return JSON.stringify([taskType, promptId]);
}
export function sameDraft(a: Pick<DraftSnapshot, "essay" | "attemptId" | "timeLeft">, b: Pick<DraftSnapshot, "essay" | "attemptId" | "timeLeft">) {
  return a.essay === b.essay && a.attemptId === b.attemptId && a.timeLeft === b.timeLeft;
}
