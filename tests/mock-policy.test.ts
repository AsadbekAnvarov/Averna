import { describe, expect, it } from "vitest";
import { CD_MOCK_MODE, mockSections, mockGrace, nextClock, paperSchema, saveMockSchema, submitMockSchema } from "@/lib/ielts/mock-policy";
describe("versioned computer mock policy", () => {
 const p = { listening:"l",reading:"r",task1:"w1",task2:"w2",speaking:"", mode:CD_MOCK_MODE };
 it("uses three sections without changing legacy", () => { expect(mockSections(p)).toEqual(["LISTENING","READING","WRITING"]); expect(mockSections({})).toHaveLength(4); expect(paperSchema.safeParse(p).success).toBe(true); expect(paperSchema.safeParse({...p,mode:undefined}).success).toBe(false); });
 it("bounds network grace and never grants a free next-section break", () => { expect(mockGrace(p)).toBe(5000); expect(mockGrace({})).toBe(120000); expect(nextClock(100,90)).toBe(90); expect(nextClock(100,999)).toBe(100); });
 it.each([-1,0.5,4,"0",null])("rejects section %s", section => expect(saveMockSchema.safeParse({section,draft:{answers:{}}}).success).toBe(false));
 it.each([{answers:{"41":"A"}},{answers:{"01":"A"}},{answers:{"1":5}},{answers:{"1":"x".repeat(1001)}},{answers:{},__mock:{revision:9}}])("rejects malformed objective drafts", draft => expect(saveMockSchema.safeParse({section:0,draft}).success).toBe(false));
 it("separates essays from objective answers and rejects ownership injection", () => { expect(saveMockSchema.safeParse({section:2,draft:{essays:{task1:"",task2:"essay"}},revision:0}).success).toBe(true); expect(saveMockSchema.safeParse({section:2,draft:{answers:{}}}).success).toBe(false); expect(submitMockSchema.safeParse({section:1,payload:{answers:{}},studentId:"foreign"}).success).toBe(false); });
});
