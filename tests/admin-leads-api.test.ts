import { beforeEach,describe,it,expect,vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),list:vi.fn(),mutate:vi.fn(),limit:vi.fn(),audit:vi.fn()}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));vi.mock("@/lib/db",()=>({db:{user:{findUnique:m.user}}}));
vi.mock("@/lib/security/rate-limit",()=>({reserveLimits:m.limit}));vi.mock("@/lib/audit",()=>({recordAudit:m.audit}));
vi.mock("@/lib/admin-leads",async orig=>({...await orig<typeof import("@/lib/admin-leads")>(),listAdminLeads:m.list,mutateAdminLead:m.mutate}));
import {GET,POST} from "@/app/api/admin/leads/route";
const req=(body:unknown,origin="https://averna.test")=>new Request("https://averna.test/api/admin/leads",{method:"POST",headers:{origin},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({user:{id:"a",role:"ADMIN"}});m.user.mockResolvedValue({id:"a",role:"ADMIN",name:"Admin"});m.limit.mockResolvedValue({ok:true});m.list.mockResolvedValue({leads:[],limited:false});m.mutate.mockResolvedValue(true)});
describe("admissions API",()=>{
 it.each(["STUDENT","TEACHER"])("rejects %s",async role=>{m.auth.mockResolvedValue({user:{id:"u",role}});expect((await GET()).status).toBe(403);expect(m.list).not.toHaveBeenCalled()});
 it("rejects a stale admin role",async()=>{m.user.mockResolvedValue({id:"a",role:"STUDENT"});expect((await GET()).status).toBe(403)});
 it("rejects cross-origin before auth",async()=>{expect((await POST(req({},"https://evil.test"))).status).toBe(403);expect(m.auth).not.toHaveBeenCalled()});
 it("never accepts old monetary commands",async()=>{expect((await POST(req({action:"POST_ENTRY",amount:"100000"}))).status).toBe(400);expect(m.mutate).not.toHaveBeenCalled()});
 it("preserves private no-store on contact reads",async()=>{const r=await GET();expect(r.status).toBe(200);expect(r.headers.get("cache-control")).toContain("no-store")});
 it("updates only validated admissions status",async()=>{expect((await POST(req({action:"UPDATE_LEAD",id:"lead",status:"TRIAL"}))).status).toBe(200);expect(m.mutate).toHaveBeenCalledWith({action:"UPDATE_LEAD",id:"lead",status:"TRIAL"})});
 it("rate limits before writes",async()=>{m.limit.mockResolvedValue({ok:false});expect((await POST(req({}))).status).toBe(429);expect(m.mutate).not.toHaveBeenCalled()});
});
