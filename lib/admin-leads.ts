import { z } from "zod";
import { db } from "@/lib/db";
/** Historical table name is retained; only admissions/contact fields are selected. */
const select = { id:true, fullName:true, phone:true, groupName:true, status:true, appointmentAt:true, note:true, createdAt:true } as const;
export const leadStates = ["NEW", "SCHEDULED", "TRIAL", "ENROLLED", "LOST"] as const;
export const leadCommand = z.discriminatedUnion("action", [
 z.object({action:z.literal("ADD_LEAD"),id:z.string().uuid(),fullName:z.string().trim().min(1).max(250),phone:z.string().trim().min(3).max(80),groupName:z.string().trim().max(250),appointmentDate:z.string().refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v)),note:z.string().trim().max(2000)}).strict(),
 z.object({action:z.literal("UPDATE_LEAD"),id:z.string().min(1).max(64),status:z.enum(leadStates)}).strict(),
]);
export async function listAdminLeads() {
 const rows = await db.financeLead.findMany({select,orderBy:[{createdAt:"desc"},{id:"desc"}],take:201});
 return {limited:rows.length>200,leads:rows.slice(0,200).map(r=>({...r,appointmentAt:r.appointmentAt?.toLocaleDateString("en-CA",{timeZone:"Asia/Tashkent"})??null,createdAt:r.createdAt.toISOString()}))};
}
export type AdminLeads = Awaited<ReturnType<typeof listAdminLeads>>;
export async function mutateAdminLead(command:z.infer<typeof leadCommand>) {
 if(command.action==="ADD_LEAD") {
  // A client-generated ID makes transport retries idempotent without an accounting request/ledger.
  const c=command;
  await db.financeLead.createMany({data:[{id:c.id,fullName:c.fullName,phone:c.phone,groupName:c.groupName||null,appointmentAt:c.appointmentDate?new Date(c.appointmentDate+"T00:00:00+05:00"):null,note:c.note||null}],skipDuplicates:true});
  return true;
 }
 const result=await db.financeLead.updateMany({where:{id:command.id},data:{status:command.status}});
 return result.count===1;
}
