import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trustedMutation } from "@/lib/security/same-origin";
import { boundedJson } from "@/lib/security/json-body";
import { reserveLimits } from "@/lib/security/rate-limit";
import { leadCommand, listAdminLeads, mutateAdminLead } from "@/lib/admin-leads";
import { recordAudit } from "@/lib/audit";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});
async function viewer(){const s=await auth();if(!s?.user||s.user.role!=="ADMIN")return null;const user=await db.user.findUnique({where:{id:s.user.id},select:{id:true,role:true,name:true}});return user?.role==="ADMIN"?user:null;}
export async function GET(){try{if(!await viewer())return reply({error:"Forbidden"},403);return reply(await listAdminLeads());}catch{return reply({error:"Qabul roʻyxatini yuklab boʻlmadi."},503);}}
export async function POST(request:Request){
 if(!trustedMutation(request))return reply({error:"Untrusted origin"},403);
 try{
  const user=await viewer();if(!user)return reply({error:"Forbidden"},403);
  const limit=await reserveLimits([{key:`admin:leads:${user.id}`,limit:80,seconds:900}]);if(!limit.ok)return reply({error:"Keyinroq qayta urinib koʻring."},limit.unavailable?503:429);
  let raw:unknown;try{raw=await boundedJson(request,10000);}catch{return reply({error:"Invalid request"},400);}
  const command=leadCommand.safeParse(raw);if(!command.success)return reply({error:"Qabul maʼlumotlarini tekshiring."},400);
  if(!await mutateAdminLead(command.data))return reply({error:"Lid topilmadi."},404);
  await recordAudit(user,command.data.action==="ADD_LEAD"?"Added admissions lead":"Updated admissions lead",`leadId=${command.data.id}`);
  return reply({ok:true});
 }catch{return reply({error:"Saqlash tasdiqlanmadi. Xuddi shu soʻrovni qayta yuboring."},503);}
}
