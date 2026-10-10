import { z } from "zod";
import { roundBand, writingBand, overallBand } from "@/lib/ielts/bands";
export const groupMockEnabled = () => process.env.GROUP_MOCK_SESSIONS === "on";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const createSchema = z.object({ groupId: id, title: z.string().trim().min(3).max(100), distribution: z.enum(["unique", "balanced"]).default("unique") }).strict();
export const joinSchema = z.object({ code: z.string().trim().regex(/^[A-Fa-f0-9]{8}$/) }).strict();
export const actionSchema = z.object({ action: z.enum(["ready", "start", "end", "cancel"]), version: z.number().int().min(0) }).strict();
const band = z.number().min(0).max(9).refine(v => Number.isInteger(v * 2));
export const writingCriteria = z.object({ taskAchievement: band, coherenceCohesion: band, lexicalResource: band, grammarAccuracy: band }).strict();
export const speakingCriteria = z.object({ fluency: band, lexical: band, grammar: band, pronunciation: band }).strict();
export const reviewSchema = z.object({ participantId: id, version: z.number().int().min(0), task1: writingCriteria.partial(), task2: writingCriteria.partial(), speaking: speakingCriteria.partial(), speakingConducted: z.boolean(), comment: z.string().trim().max(4000), publish: z.boolean().default(false) }).strict().refine(v=>!v.publish||(v.speakingConducted&&writingCriteria.safeParse(v.task1).success&&writingCriteria.safeParse(v.task2).success&&speakingCriteria.safeParse(v.speaking).success),"Publication requires both full Writing rubrics and an actually conducted full Speaking test.");
export type Review = z.infer<typeof reviewSchema>;
export type PaperPool = { listening: { id: string; milliseconds: number }[]; reading: string[]; task1: string[]; task2: string[] };
export function capacity(pool: PaperPool) { return Math.min(pool.listening.length, pool.reading.length, pool.task1.length, pool.task2.length, 30); }
export function assignedPaper(pool: PaperPool, ordinal: number, distribution: string, sessionId: string) {
  if (!Number.isInteger(ordinal) || ordinal < 0 || !capacity(pool) || ordinal >= 30 || (distribution === "unique" && ordinal >= capacity(pool))) throw new Error("Not enough distinct existing papers for another participant.");
  return { listening: pool.listening[ordinal % pool.listening.length].id, reading: pool.reading[ordinal % pool.reading.length], task1: pool.task1[ordinal % pool.task1.length], task2: pool.task2[ordinal % pool.task2.length], speaking: "", mode: "cd-v1" as const, groupSessionId: sessionId };
}
export function manualBands(review: Pick<Review, "task1" | "task2" | "speaking">, listening: number, reading: number) {
 const task1=writingCriteria.parse(review.task1),task2=writingCriteria.parse(review.task2),spoken=speakingCriteria.parse(review.speaking);
 const t1 = roundBand(Object.values(task1).reduce((a,b)=>a+b,0)/4); const t2 = roundBand(Object.values(task2).reduce((a,b)=>a+b,0)/4); const speaking = roundBand(Object.values(spoken).reduce((a,b)=>a+b,0)/4); const writing = writingBand(t1,t2);
 return { task1: t1, task2: t2, speaking, writing, overall: overallBand([listening,reading,writing,speaking]) };
}
export function isGroupMock(papers: unknown): papers is { groupSessionId: string; groupPublished?: boolean } { return !!papers && typeof papers === "object" && typeof (papers as any).groupSessionId === "string"; }
export function isGroupPublished(papers: unknown) { return isGroupMock(papers) && papers.groupPublished === true; }
