import { z } from "zod";
export const answerSchema = z.string().max(1600);
export const sessionSchema = z.object({ activity: z.string().max(80), step: z.number().int().min(0).max(20), responses: z.array(answerSchema).max(20), choice: z.number().int().min(-1).max(10), draft: answerSchema, complete: z.boolean() }).strict();
export type PracticeSession = z.infer<typeof sessionSchema>;
export const emptySession = (): PracticeSession => ({ activity: "", step: 0, responses: [], choice: -1, draft: "", complete: false });
export const questionSchema = z.object({ prompt: z.string().trim().min(8).max(240), options: z.array(z.string().trim().min(1).max(140)).length(4), answer: z.number().int().min(0).max(3), explanation: z.string().trim().min(12).max(600) }).strict().refine(q => new Set(q.options.map(v => v.toLowerCase())).size === 4, "Use four different options");
export const workshopSchema = z.object({ title: z.string().trim().min(5).max(100), passage: z.string().trim().min(80).max(4000), questions: z.array(questionSchema).min(1).max(5), rightsConfirmed: z.literal(true) }).strict().refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 21_000, "Keep the encoded workshop under 21 KB");
export type WorkshopPayload = z.infer<typeof workshopSchema>;
export const workshopDraftSchema = z.object({ title: z.string().max(100), passage: z.string().max(4000), questions: z.array(z.object({ prompt: z.string().max(240), options: z.array(z.string().max(140)).length(4), answer: z.number().int().min(0).max(3), explanation: z.string().max(600) }).strict()).min(1).max(5), rightsConfirmed: z.boolean() }).strict();
export type WorkshopDraft = z.infer<typeof workshopDraftSchema>;
export const blankQuestion = () => ({ prompt: "", options: ["", "", "", ""], answer: 0, explanation: "" });
export const blankWorkshop = (): WorkshopDraft => ({ title: "", passage: "", questions: [blankQuestion()], rightsConfirmed: false });
export const submitWorkshopSchema = z.object({ requestId: z.string().uuid(), payload: workshopSchema }).strict();
export const reviewWorkshopSchema = z.object({ id: z.string().min(1).max(100), version: z.number().int().min(1).max(1_000_000), decision: z.enum(["APPROVED", "REJECTED"]), feedback: z.string().trim().max(800) }).strict().refine(v => v.decision !== "REJECTED" || v.feedback.length >= 8, "Explain what the author should improve");
export function canAdvance(text: string) { return text.trim().split(/\s+/).filter(Boolean).length >= 6; }
export function workshopMark(payload: WorkshopPayload, answers: number[]) {
  return payload.questions.map((q, i) => ({ correct: answers[i] === q.answer, explanation: q.explanation }));
}
export interface WorkshopSummary { id: string; title: string; status: string; version: number; feedback: string | null; createdAt: string; authorName?: string; groupName?: string; payload?: WorkshopPayload; }
