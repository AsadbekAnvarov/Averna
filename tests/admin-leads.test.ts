import { beforeEach,describe,it,expect,vi } from "vitest";
const m=vi.hoisted(()=>({list:vi.fn(),create:vi.fn(),update:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{financeLead:{findMany:m.list,createMany:m.create,updateMany:m.update}}}));
import { leadCommand,listAdminLeads,mutateAdminLead } from "@/lib/admin-leads";
const add={action:"ADD_LEAD" as const,id:"b2b81d80-54f1-48cd-8089-c44992723611",fullName:"Sample",phone:"1234567",groupName:"Group",appointmentDate:"2026-11-03",note:"Trial"};
beforeEach(()=>{vi.resetAllMocks();m.list.mockResolvedValue([]);m.create.mockResolvedValue({count:1});m.update.mockResolvedValue({count:1});});
describe("admissions is independent from accounting",()=>{
 it("accepts contacts without any fee, account or money field",()=>expect(leadCommand.safeParse(add).success).toBe(true));
 it("rejects monetary commands and monetary metadata",()=>{expect(leadCommand.safeParse({...add,monthlyFee:"10000"}).success).toBe(false);expect(leadCommand.safeParse({action:"POST_ENTRY"}).success).toBe(false)});
 it("validates calendar dates",()=>{expect(leadCommand.safeParse({...add,appointmentDate:"2026-02-30"}).success).toBe(false);expect(leadCommand.safeParse({...add,appointmentDate:""}).success).toBe(true)});
 it("reads bounded contact fields only",async()=>{await listAdminLeads();expect(m.list.mock.calls[0][0]).toMatchObject({take:201,select:{fullName:true,phone:true}});expect(m.list.mock.calls[0][0]).not.toHaveProperty("include");});
 it("keeps existing contact records and reports the display limit",async()=>{m.list.mockResolvedValue(Array.from({length:201},(_,i)=>({id:String(i),createdAt:new Date(),appointmentAt:null})));const x=await listAdminLeads();expect(x.leads).toHaveLength(200);expect(x.limited).toBe(true)});
 it("retries create idempotently without generating accounts or invoices",async()=>{await mutateAdminLead(add);expect(m.create.mock.calls[0][0]).toMatchObject({skipDuplicates:true,data:[{id:add.id,fullName:"Sample",phone:"1234567"}]});});
 it("updates only the contact status",async()=>{expect(await mutateAdminLead({action:"UPDATE_LEAD",id:"lead",status:"TRIAL"})).toBe(true);expect(m.update).toHaveBeenCalledWith({where:{id:"lead"},data:{status:"TRIAL"}})});
});
