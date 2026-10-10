import { describe, expect, it } from "vitest";
import { ADVENTURES, EPISODES, CASES, DEBATES, RESCUES } from "@/lib/adventures/catalog";
import { workshopSchema, reviewWorkshopSchema, submitWorkshopSchema, workshopMark, canAdvance, sessionSchema, emptySession } from "@/lib/adventures/rules";
const payload = { title: "The village library", passage: "The village library opens at nine every morning. On Fridays it stays open until six, rather than its usual closing time of five.", questions: [{ prompt: "When does the library close on Fridays?", options: ["At four", "At five", "At six", "At seven"], answer: 2, explanation: "The passage explicitly says that Friday closing time is six." }], rightsConfirmed: true };
describe("six original, bounded Adventures", () => {
  it("has six unique routes with enough material to practise", () => { expect(ADVENTURES).toHaveLength(6); expect(new Set(ADVENTURES.map(item => item.slug)).size).toBe(6); expect(CASES.length).toBeGreaterThanOrEqual(2); expect(DEBATES.length).toBeGreaterThanOrEqual(3); expect(RESCUES.length).toBeGreaterThanOrEqual(3); });
  it.each(EPISODES)("has a valid, terminating branching graph for $id", episode => {
    const ids = new Set(episode.scenes.map(scene => scene.id)); expect(ids.size).toBe(episode.scenes.length); expect(ids.has("start")).toBe(true);
    const visit = (id: string, path: string[]) => { expect(path).not.toContain(id); const scene = episode.scenes.find(item => item.id === id)!; expect(scene).toBeTruthy(); for (const choice of scene.choices) { expect(ids.has(choice.next)).toBe(true); visit(choice.next, [...path, id]); } };
    visit("start", []); expect(episode.scenes.filter(scene => !scene.choices.length)).toHaveLength(1);
    expect(episode.scenes[0].choices[0].next).not.toBe(episode.scenes[0].choices[1].next);
  });
  it("keeps detective answer keys within the options, with distinct evidence", () => { for (const file of CASES) { expect(file.answer).toBeLessThan(file.options.length); expect(file.clues).toHaveLength(3); expect(new Set(file.clues.map(clue => clue.id)).size).toBe(3); expect(file.clues.some(clue => clue.type === "audio")).toBe(true); expect(file.explanation.length).toBeGreaterThan(50); } });
  it("does not mistake a short response for completed practice", () => { expect(canAdvance(" ")).toBe(false); expect(canAdvance("Only two")).toBe(false); expect(canAdvance("I can explain my choice with evidence.")).toBe(true); expect(sessionSchema.safeParse({ ...emptySession(), responses: Array(21).fill("answer") }).success).toBe(false); });
  it("validates clear keys, permission, bounds and distinct options", () => {
    expect(workshopSchema.safeParse(payload).success).toBe(true);
    for (const value of [{ ...payload, rightsConfirmed: false }, { ...payload, passage: "short" }, { ...payload, questions: [{ ...payload.questions[0], answer: 4 }] }, { ...payload, questions: [{ ...payload.questions[0], options: ["Same", "same", "Other", "Third"] }] }, { ...payload, injectedOwner: "other" }]) expect(workshopSchema.safeParse(value).success).toBe(false);
  });
  it("rejects byte-heavy drafts before a bounded network request", () => { expect(workshopSchema.safeParse({ ...payload, passage: "😀".repeat(2000), questions: Array(5).fill({ ...payload.questions[0], prompt: "😀".repeat(120), options: ["😀".repeat(60), "😃".repeat(60), "😄".repeat(60), "😁".repeat(60)], explanation: "😀".repeat(300) }) }).success).toBe(false); });
  it("requires valid idempotency keys and reasoned rejections", () => { expect(submitWorkshopSchema.safeParse({ requestId: "not-a-uuid", payload }).success).toBe(false); expect(reviewWorkshopSchema.safeParse({ id: "one", version: 1, decision: "REJECTED", feedback: "" }).success).toBe(false); expect(reviewWorkshopSchema.safeParse({ id: "one", version: 1, decision: "APPROVED", feedback: "" }).success).toBe(true); });
  it("marks only selected answers against the key, not an IELTS band", () => { const parsed = workshopSchema.parse(payload); expect(workshopMark(parsed, [2])[0].correct).toBe(true); expect(workshopMark(parsed, [1])[0].correct).toBe(false); expect(workshopMark(parsed, [])[0].correct).toBe(false); });
});
