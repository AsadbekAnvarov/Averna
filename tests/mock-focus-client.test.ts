// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from "vitest";
import { MockFocusQueue } from "@/components/exam/mock-focus-client";
beforeEach(()=>{localStorage.clear();vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true}));});
describe("durable mock visibility queue",()=>{
 it("counts one episode for duplicate hidden notifications",()=>{const q=new MockFocusQueue("a");q.hide(0,1000);q.hide(0,2000);expect(q.events).toHaveLength(1);expect(q.show(5000)).toBe(4000);expect(q.show(6000)).toBeNull();expect(q.events).toHaveLength(1);expect(q.events[0].returnedAt).not.toBeNull();});
 it("retains an offline episode through refresh",()=>{const q=new MockFocusQueue("a");q.hide(1,1000);const copy=new MockFocusQueue("a");expect(copy.show(4000)).toBe(3000);expect(copy.events[0].section).toBe(1);expect(copy.events[0].eventId).toBe(q.events[0].eventId);});
 it("retries failures with the same id",async()=>{const q=new MockFocusQueue("a");q.hide(0);const id=q.events[0].eventId;vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));await q.flush();expect(q.events[0].eventId).toBe(id);await q.flush();expect(q.events).toHaveLength(0);});
 it("keeps a return that arrives during the hidden-event request",async()=>{let release!:()=>void;vi.mocked(fetch).mockImplementationOnce(()=>new Promise(r=>{release=()=>r({ok:true} as Response);}));const q=new MockFocusQueue("a");q.hide(2,1000);const sending=q.flush();q.show(5000);release();await sending;expect(q.events).toHaveLength(1);expect(q.events[0].returnedAt).not.toBeNull();});
 it("isolates attempts and bounds device storage",()=>{const q=new MockFocusQueue("a");for(let i=0;i<100;i++)q.monitor(0);expect(q.events).toHaveLength(64);expect(new MockFocusQueue("b").events).toHaveLength(0);});
});
