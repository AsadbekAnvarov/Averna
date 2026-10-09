import { beforeEach,describe,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),snapshot:vi.fn()}));
vi.mock("react",()=>({cache:(f:unknown)=>f}));
vi.mock("@/lib/auth",()=>({auth:m.auth}));
vi.mock("@/lib/finance/service",()=>({financeSnapshot:m.snapshot}));
import { getDashboardFinance } from "@/lib/finance/dashboard";
describe("request-scoped financial dashboard loader",()=>{
 beforeEach(()=>{vi.resetAllMocks()});
 it.each([null,{user:{id:"s",role:"STUDENT"}},{user:{id:"t",role:"TEACHER"}}])("does not read finances for non-admin sessions %j",async session=>{m.auth.mockResolvedValue(session);expect(await getDashboardFinance()).toBeNull();expect(m.snapshot).not.toHaveBeenCalled()});
 it("uses the authenticated admin identity",async()=>{const user={id:"a",name:"Admin",role:"ADMIN"};m.auth.mockResolvedValue({user});m.snapshot.mockResolvedValue({month:"2026-10"});expect(await getDashboardFinance()).toEqual({month:"2026-10"});expect(m.snapshot).toHaveBeenCalledWith(user)});
});
