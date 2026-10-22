import { describe, it, expect } from "vitest";
import { mockFocusBatch, validFocusTimes, focusDuration, focusTeacherWhere } from "@/lib/ielts/mock-focus-policy";
const base = Date.parse("2026-10-11T12:00:00Z");
const event = { eventId:"f014449f-665d-48fa-b997-a145fe9c52e1", kind:"hidden", section:1, leftAt:new Date(base).toISOString(), returnedAt:new Date(base+10000).toISOString() };
describe("advisory mock focus policy", () => {
 it("accepts bounded visibility episodes", () => expect(mockFocusBatch.safeParse({events:[event]}).success).toBe(true));
 it.each([{...event,section:3},{...event,eventId:"wrong"},{...event,kind:"clipboard"},{...event,url:"https://private.test"}])("rejects invalid or invasive metadata", e => expect(mockFocusBatch.safeParse({events:[e]}).success).toBe(false));
 it("bounds batches", () => expect(mockFocusBatch.safeParse({events:Array(17).fill(event)}).success).toBe(false));
 it("rejects time travel", () => {expect(validFocusTimes({...event,returnedAt:new Date(base-1).toISOString()},new Date(base-1000),null,base+20000)).toBe(false);expect(validFocusTimes({...event,leftAt:new Date(base+100000).toISOString()},new Date(base-1000),null,base)).toBe(false);});
 it("accepts a late return and caps known duration at exam end", () => {expect(validFocusTimes(event,new Date(base-1000),new Date(base+5000),base+20000)).toBe(true);expect(focusDuration(new Date(base),new Date(base+10000),new Date(base+5000))).toBe(5000);});
 it("rejects events before the attempt and reports more than 24h after end",()=>{expect(validFocusTimes(event,new Date(base+10000),null,base+20000)).toBe(false);expect(validFocusTimes(event,new Date(base-1000),new Date(base+5000),base+90000000)).toBe(false);});
 it("fails closed for teacher scope",()=>{expect(focusTeacherWhere("STUDENT",null)).toBeNull();expect(focusTeacherWhere("TEACHER",null)).toBeNull();expect(focusTeacherWhere("TEACHER","t")).toEqual({student:{group:{teacherId:"t"}}});expect(focusTeacherWhere("ADMIN",null)).toEqual({});});
});
