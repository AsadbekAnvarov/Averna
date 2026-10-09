import {beforeEach,describe,expect,it,vi} from "vitest";
import { NextRequest } from "next/server";
const m=vi.hoisted(()=>({auth:vi.fn(),snapshot:vi.fn(),mutate:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));vi.mock("@/lib/finance/service",()=>({financeSnapshot:m.snapshot,financeMutate:m.mutate}));
import { GET,POST } from "@/app/api/admin/finance/route";
describe("admin-only finance API",()=>{
 beforeEach(()=>vi.resetAllMocks());
 it.each(["STUDENT","TEACHER","PARENT"])("does not expose private data to %s",async role=>{m.auth.mockResolvedValue({user:{id:"u",role}});const response=await GET(new NextRequest("https://averna.example/api/admin/finance"));expect(response.status).toBe(403);expect(m.snapshot).not.toHaveBeenCalled()});
 it("requires a real session",async()=>{m.auth.mockResolvedValue(null);expect((await GET(new NextRequest("https://averna.example/api/admin/finance"))).status).toBe(401)});
 it("blocks cross-origin money writes before reading the session",async()=>{const r=await POST(new NextRequest("https://averna.example/api/admin/finance",{method:"POST",headers:{origin:"https://evil.example","sec-fetch-site":"cross-site"},body:"{}"}));expect(r.status).toBe(403);expect(m.mutate).not.toHaveBeenCalled()});
 it("never converts a missing migration into a zero-income report",async()=>{m.auth.mockResolvedValue({user:{id:"a",role:"ADMIN"}});m.snapshot.mockRejectedValue({code:"P2021"});const r=await GET(new NextRequest("https://averna.example/api/admin/finance"));expect(r.status).toBe(503);expect(await r.json()).not.toHaveProperty("summary")});
 it("sets private no-store on the data response",async()=>{m.auth.mockResolvedValue({user:{id:"a",role:"ADMIN"}});m.snapshot.mockResolvedValue({month:"2026-10"});const r=await GET(new NextRequest("https://averna.example/api/admin/finance"));expect(r.headers.get("cache-control")).toContain("no-store")});
});
