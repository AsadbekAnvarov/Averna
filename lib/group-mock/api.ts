import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { boundedJson } from "@/lib/security/json-body";
import { trustedMutation } from "@/lib/security/same-origin";
import { reserveLimits } from "@/lib/security/rate-limit";
import { groupMockEnabled, createSchema, joinSchema, actionSchema, reviewSchema } from "./rules";
import { GroupMockError, createSession, joinSession, markReady, controlSession, readSession, listSessions, saveReview } from "./service";
const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});
export async function groupRequest(request:Request,id?:string) {
 if(!groupMockEnabled())return reply({error:"Teacher sessions are not enabled yet."},404);
 if(request.method!=="GET"&&!trustedMutation(request))return reply({error:"Untrusted origin"},403);
 try{
 const s=await auth();if(!s?.user)return reply({error:"Sign in again. Keep your exam open."},401);
 if(id&&!/^[A-Za-z0-9_-]{1,64}$/.test(id))return reply({error:"Invalid session"},400);
 const rate=await reserveLimits([{key:`group-mock:${request.method}:${s.user.id}`,limit:request.method==="GET"?400:60,seconds:900}]);if(!rate.ok)return reply({error:"Session service temporarily limited."},rate.unavailable?503:429);
 if(request.method==="GET"){const p=new URL(request.url).searchParams.get("participant")||undefined;return reply(id?await readSession(s.user.id,id,p):await listSessions(s.user.id));}
 let body:unknown;try{body=await boundedJson(request,30000);}catch{return reply({error:"Invalid or oversized session request"},400);}
 if(request.method==="PUT"&&id){const p=reviewSchema.safeParse(body);if(!p.success)return reply({error:"Rate every Writing and Speaking criterion in half bands and confirm Speaking was conducted."},400);return reply(await saveReview(s.user.id,id,p.data));}
 if(id){const p=actionSchema.safeParse(body);if(!p.success)return reply({error:"Invalid session action"},400);return reply(p.data.action==="ready"?await markReady(s.user.id,id):await controlSession(s.user.id,id,p.data.action,p.data.version));}
 const join=joinSchema.safeParse(body);if(join.success)return reply(await joinSession(s.user.id,join.data.code));const create=createSchema.safeParse(body);if(!create.success)return reply({error:"Invalid class session"},400);return reply(await createSession(s.user.id,create.data));
 }catch(e){if(e instanceof GroupMockError)return reply({error:e.message},e.status);console.error("Group mock unavailable",e instanceof Error?e.name:"unknown");return reply({error:"Session request could not be confirmed. Reload or retry; do not discard your work."},503);}
}
