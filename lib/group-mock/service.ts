import { randomBytes, randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { listListeningExams, listReadingExams, listWritingTasks, getListeningExam, getWritingTask } from "@/lib/ielts/catalog";
import { mockListeningLibrary, mockReadingLibrary } from "@/lib/ielts/mock-library";
import { listeningClientContent } from "@/lib/ielts/audio/client";
import type { MockSectionResult, MockSection } from "@/lib/ielts/mock";
import { GroupMockError } from "./errors";
export { GroupMockError } from "./errors";
const resultsOf = (value: unknown) => rec(value) as Partial<Record<MockSection, MockSectionResult>>;
import { capacity, assignedPaper, manualBands, reviewSchema, type PaperPool, type Review } from "./rules";

const json = (v: unknown) => v as Prisma.InputJsonValue;
const rec = (v: unknown) => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
type Tx = Prisma.TransactionClient;
function shuffled<T>(items: T[]) { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a; }
export async function buildPool(): Promise<PaperPool> {
 const [ls,rs,t1,t2] = await Promise.all([listListeningExams(),listReadingExams(),listWritingTasks("task1"),listWritingTasks("task2")]);
 const [l,r] = await Promise.all([mockListeningLibrary(ls),mockReadingLibrary(rs)]);
 return { listening:shuffled([...l].map(([id,test])=>({id,milliseconds:test.parts.reduce((n,p)=>n+p.audio!.durationMs,120000)}))),reading:shuffled([...r]),task1:shuffled(t1.map(p=>p.id)),task2:shuffled(t2.map(p=>p.id)) };
}
async function liveUser(tx: Tx,userId:string,role:string) {
 const rows=await tx.$queryRaw<{role:string}[]>`SELECT "role" FROM "users" WHERE "id"=${userId} FOR SHARE`;
 if(rows[0]?.role!==role)throw new GroupMockError(403,"Your account cannot manage this session.");
}
async function groupLock(tx:Tx,groupId:string){await tx.$queryRaw`SELECT "id" FROM "groups" WHERE "id"=${groupId} FOR UPDATE`;}
async function owner(tx:Tx,userId:string,sessionId:string) {
 await liveUser(tx,userId,"TEACHER");
 const initial=await tx.mockSession.findUnique({where:{id:sessionId}});
 if(!initial)throw new GroupMockError(404,"Session unavailable.");
 await groupLock(tx,initial.groupId);
 await tx.$queryRaw`SELECT "id" FROM "mock_sessions" WHERE "id"=${sessionId} FOR UPDATE`;
 const session=await tx.mockSession.findUnique({where:{id:sessionId},include:{group:{select:{teacherId:true}},teacher:{select:{userId:true}}}});
 if(!session||session.teacher.userId!==userId||session.group.teacherId!==session.teacherId)throw new GroupMockError(403,"Only this session's current assigned teacher can control it.");
 return session;
}
export async function createSession(userId:string,input:{groupId:string;title:string;distribution:string}) {
 const pool=await buildPool();if(!capacity(pool))throw new GroupMockError(422,"Prepare full existing Reading/Listening papers, four matching Listening recordings, and both Writing tasks first.");
 return db.$transaction(async tx=>{await liveUser(tx,userId,"TEACHER");await groupLock(tx,input.groupId);const group=await tx.group.findUnique({where:{id:input.groupId},include:{teacher:{select:{userId:true}}}});if(!group||group.teacher.userId!==userId)throw new GroupMockError(403,"Choose a group you currently teach.");
 const running=await tx.mockSession.findFirst({where:{groupId:group.id,state:{in:["lobby","running"]}}});if(running)throw new GroupMockError(409,"This group already has an open session. Open it or cancel it first.");
 return tx.mockSession.create({data:{teacherId:group.teacherId,groupId:group.id,title:input.title,distribution:input.distribution,pool:json(pool),code:randomBytes(4).toString("hex").toUpperCase()}});});
}
export async function joinSession(userId:string,code:string) {
 return db.$transaction(async tx=>{await liveUser(tx,userId,"STUDENT");const initial=await tx.mockSession.findUnique({where:{code:code.toUpperCase()}});if(!initial)throw new GroupMockError(404,"Session unavailable for your class.");await groupLock(tx,initial.groupId);await tx.$queryRaw`SELECT "id" FROM "mock_sessions" WHERE "id"=${initial.id} FOR UPDATE`;
 const session=await tx.mockSession.findUnique({where:{id:initial.id},include:{group:{select:{teacherId:true}},teacher:{include:{user:{select:{role:true}}}}}});
 await tx.$queryRaw`SELECT "id" FROM "students" WHERE "userId"=${userId} FOR UPDATE`;
 const student=await tx.student.findUnique({where:{userId}});if(!session||!student||student.blacklisted||student.groupId!==session.groupId||session.group.teacherId!==session.teacherId||session.teacher.user.role!=="TEACHER")throw new GroupMockError(403,"Session unavailable for your class.");
 const existing=await tx.mockParticipant.findUnique({where:{sessionId_studentId:{sessionId:session.id,studentId:student.id}}});if(existing)return {sessionId:session.id,attemptId:existing.attemptId};
 if(session.state!=="lobby")throw new GroupMockError(409,"Registration has closed. Ask your teacher.");
 if(await tx.mockAttempt.findFirst({where:{studentId:student.id,status:"active"}}))throw new GroupMockError(409,"Finish or leave your existing individual mock before joining this session.");
 const ordinal=await tx.mockParticipant.count({where:{sessionId:session.id}});let papers;try{papers=assignedPaper(session.pool as PaperPool,ordinal,session.distribution,session.id);}catch{throw new GroupMockError(422,"The distinct-paper capacity is full. No extra audio or topics will be generated.");}
 const attempt=await tx.mockAttempt.create({data:{studentId:student.id,papers:json(papers),status:"active",current:0,results:json({})}});
 await tx.mockParticipant.create({data:{sessionId:session.id,studentId:student.id,attemptId:attempt.id,ordinal}});return {sessionId:session.id,attemptId:attempt.id};});
}
export async function markReady(userId:string,sessionId:string) {
 return db.$transaction(async tx=>{await liveUser(tx,userId,"STUDENT");const initial=await tx.mockSession.findUnique({where:{id:sessionId}});if(!initial)throw new GroupMockError(404,"Session unavailable.");await groupLock(tx,initial.groupId);await tx.$queryRaw`SELECT "id" FROM "mock_sessions" WHERE "id"=${sessionId} FOR UPDATE`;
 await tx.$queryRaw`SELECT "id" FROM "students" WHERE "userId"=${userId} FOR UPDATE`;
 const session=await tx.mockSession.findUnique({where:{id:sessionId},include:{group:{select:{teacherId:true}},teacher:{include:{user:{select:{role:true}}}}}});const student=await tx.student.findUnique({where:{userId}});
 if(!session||!student||student.blacklisted||student.groupId!==session.groupId||session.group.teacherId!==session.teacherId||session.teacher.user.role!=="TEACHER")throw new GroupMockError(403,"Class access changed.");if(session.state!=="lobby")throw new GroupMockError(409,"The teacher has already started or closed this session.");
 const r=await tx.mockParticipant.updateMany({where:{sessionId,studentId:student.id},data:{ready:true}});if(!r.count)throw new GroupMockError(404,"Join the session first.");return {ok:true};});
}
export async function controlSession(userId:string,sessionId:string,action:string,version:number) {
 const freshPool=action==="start"?await buildPool():null;
 return db.$transaction(async tx=>{const s=await owner(tx,userId,sessionId);if(s.version!==version)throw new GroupMockError(409,"Session changed. Reload before controlling it.");
 const ps=await tx.mockParticipant.findMany({where:{sessionId},include:{student:{include:{user:{select:{role:true}}}},attempt:true}});
 if(action==="start"){
 if(s.state!=="lobby"||!ps.length||ps.some(p=>!p.ready))throw new GroupMockError(409,"Start requires an open lobby, at least one participant, and every headphone check confirmed.");
 if(ps.some(p=>p.student.blacklisted||p.student.groupId!==s.groupId||p.student.user.role!=="STUDENT"||p.attempt.status!=="active"||p.attempt.sectionStartedAt))throw new GroupMockError(409,"Participant access or attempt state changed. Cancel and reopen the session.");
 for(const p of [...ps].sort((a,b)=>a.studentId.localeCompare(b.studentId))){await tx.$queryRaw`SELECT "id" FROM "students" WHERE "id"=${p.studentId} FOR UPDATE`; const live=await tx.student.findUnique({where:{id:p.studentId},include:{user:{select:{role:true}}}});if(!live||live.blacklisted||live.groupId!==s.groupId||live.user.role!=="STUDENT")throw new GroupMockError(409,"Participant membership changed.");}
 const start=Date.now()+15000;const pool=s.pool as PaperPool;
 for(const p of ps){const audio=pool.listening.find(t=>t.id===rec(p.attempt.papers).listening);if(!audio||!freshPool?.listening.some(x=>x.id===audio.id&&x.milliseconds===audio.milliseconds)||!freshPool.reading.includes(rec(p.attempt.papers).reading)||!freshPool.task1.includes(rec(p.attempt.papers).task1)||!freshPool.task2.includes(rec(p.attempt.papers).task2))throw new GroupMockError(409,"Paper allocation is incomplete.");await tx.mockAttempt.update({where:{id:p.attemptId},data:{sectionStartedAt:new Date(start),sectionDeadline:new Date(start+audio.milliseconds)}});}
 return tx.mockSession.update({where:{id:s.id},data:{state:"running",startedAt:new Date(start),version:{increment:1}}});
 }
 if(action==="end") {if(s.state!=="running")throw new GroupMockError(409,"Only a running session can be collected.");const now=new Date();await tx.mockAttempt.updateMany({where:{id:{in:ps.map(p=>p.attemptId)},status:"active",sectionDeadline:{gt:now}},data:{sectionDeadline:now}});return tx.mockSession.update({where:{id:s.id},data:{state:"review",endedAt:now,version:{increment:1}}});}
 if(action==="cancel") {if(ps.some(p=>p.publishedAt))throw new GroupMockError(409,"Published candidates exist. End the session instead of cancelling it.");if(!["lobby","running"].includes(s.state))throw new GroupMockError(409,"A collected session cannot be cancelled.");await tx.mockAttempt.updateMany({where:{id:{in:ps.map(p=>p.attemptId)},status:"active"},data:{status:"abandoned"}});return tx.mockSession.update({where:{id:s.id},data:{state:"cancelled",endedAt:new Date(),version:{increment:1}}});}
 throw new GroupMockError(400,"Unknown teacher action.");});
}
export async function groupAttemptState(studentId:string,attemptId:string) {
 const p=await db.mockParticipant.findUnique({where:{attemptId},include:{session:{include:{group:{select:{teacherId:true}},teacher:{include:{user:{select:{role:true}}}}}},student:{include:{user:{select:{role:true}}}}}});
 if(!p||p.studentId!==studentId||p.student.blacklisted||p.student.groupId!==p.session.groupId||p.student.user.role!=="STUDENT"||p.session.teacher.user.role!=="TEACHER"||p.session.group.teacherId!==p.session.teacherId)throw new GroupMockError(403,"Group-session access changed. Ask your teacher.");
 if(p.session.state==="cancelled")throw new GroupMockError(409,"Your teacher cancelled this session.");
 return {sessionId:p.sessionId,state:p.session.state,startAt:p.session.startedAt?.getTime()??null,endAt:p.session.endedAt?.getTime()??null};
}
export async function collectExpired(sessionId:string) {
 const ps=await db.mockParticipant.findMany({where:{sessionId,student:{blacklisted:false,user:{role:"STUDENT"}},attempt:{status:"active",sectionDeadline:{lt:new Date(Date.now()-5000)}}},include:{student:{select:{userId:true}}},take:30});
 const { getMockView }=await import("@/lib/ielts/mock");
 for(const p of ps)await getMockView(p.studentId,p.student.userId,p.attemptId);
}
export async function readSession(userId:string,sessionId:string,participantId?:string) {
 const user=await db.user.findUnique({where:{id:userId},select:{role:true}});const s=await db.mockSession.findUnique({where:{id:sessionId},include:{teacher:{include:{user:{select:{role:true}}}},group:{select:{name:true,teacherId:true}}}});
 if(!s||s.group.teacherId!==s.teacherId||s.teacher.user.role!=="TEACHER")throw new GroupMockError(404,"Session unavailable.");
 const teacher=user?.role==="TEACHER"&&s.teacher.userId===userId;const student=user?.role==="STUDENT"?await db.student.findUnique({where:{userId}}):null;
 if(!teacher&&(!student||student.blacklisted||student.groupId!==s.groupId))throw new GroupMockError(403,"This session is private to its teacher and current class.");
 if(teacher)await collectExpired(s.id);
 const all=await db.mockParticipant.findMany({where:{sessionId,student:{groupId:s.groupId,blacklisted:false,user:{role:"STUDENT"}},...(!teacher?{studentId:student!.id}:{})},select:{id:true,attemptId:true,ordinal:true,ready:true,version:true,publishedAt:true,student:{select:{user:{select:{name:true}}}},attempt:{select:{current:true,status:true,sectionDeadline:true,updatedAt:true,results:true}}},orderBy:{ordinal:"asc"}});
 let detail=null;if(teacher&&participantId){detail=await db.mockParticipant.findFirst({where:{id:participantId,sessionId,student:{groupId:s.groupId,blacklisted:false,user:{role:"STUDENT"}}},select:{id:true,version:true,work:true,review:true,publishedAt:true}});if(!detail)throw new GroupMockError(404,"Participant unavailable.");}
 const mine=!teacher?all[0]:null;let audioUrl:string|undefined;
 if(mine&&s.state==="lobby"){const attempt=await db.mockAttempt.findUnique({where:{id:mine.attemptId},select:{papers:true}});const t=await getListeningExam(rec(attempt?.papers).listening);const c=t?await listeningClientContent(t,{recordingsOnly:true}):null;audioUrl=c?.parts[0]?.audio?.url;}
 return {serverNow:Date.now(),id:s.id,title:s.title,groupName:s.group.name,state:s.state,version:s.version,code:teacher?s.code:undefined,distribution:s.distribution,capacity:s.distribution==="unique"?capacity(s.pool as PaperPool):30,uniqueCapacity:capacity(s.pool as PaperPool),startedAt:s.startedAt?.toISOString()??null,endedAt:s.endedAt?.toISOString()??null,teacher,participants:all.map(p=>({...p,name:p.student.user.name,student:undefined,attempt:teacher||p.publishedAt?p.attempt:{...p.attempt,results:undefined}})),detail,audioUrl};
}
export async function listSessions(userId:string) {
 const user=await db.user.findUnique({where:{id:userId},select:{role:true}});
 if(user?.role!=="TEACHER")throw new GroupMockError(403,"Teacher account required.");
 const teacher=await db.teacher.findUnique({where:{userId},select:{id:true}});if(!teacher)throw new GroupMockError(403,"Teacher profile required.");
 const groups=await db.group.findMany({where:{teacherId:teacher.id},select:{id:true,name:true},orderBy:{name:"asc"}});
 const sessions=await db.mockSession.findMany({where:{teacherId:teacher.id,group:{teacherId:teacher.id}},select:{id:true,title:true,state:true,code:true,createdAt:true},orderBy:{createdAt:"desc"},take:15});return {groups,sessions};
}
/** Commit the accepted essay snapshot and finished computer block together. No provider calls. */
export async function commitManualWork(attemptId:string,work:unknown,where:Prisma.MockAttemptWhereInput,data:Prisma.MockAttemptUpdateManyMutationInput){
 const essays=rec(rec(work).essays);const attempt=await db.mockAttempt.findUnique({where:{id:attemptId},select:{papers:true}});const p=rec(attempt?.papers);
 const [task1,task2]=await Promise.all([getWritingTask("task1",p.task1),getWritingTask("task2",p.task2)]);if(!task1||!task2)throw new GroupMockError(410,"Writing prompts are unavailable.");
 const snapshot=(task:typeof task1,key:string)=>({essay:String(essays[key]??""),prompt:task.prompt,title:task.title,promptId:task.id,...(task.chart?{chart:task.chart}:{}),...(task.imageUrl?{imageUrl:task.imageUrl}:{})});
 const saved={task1:snapshot(task1,"task1"),task2:snapshot(task2,"task2")};
 return db.$transaction(async tx=>{
  const initial=await tx.mockParticipant.findUnique({where:{attemptId}});if(!initial)throw new GroupMockError(404,"Participant unavailable.");
  const session=await tx.mockSession.findUnique({where:{id:initial.sessionId}});if(!session)throw new GroupMockError(404,"Session unavailable.");
  await groupLock(tx,session.groupId);await tx.$queryRaw`SELECT "id" FROM "mock_sessions" WHERE "id"=${session.id} FOR SHARE`;
  await tx.$queryRaw`SELECT "id" FROM "students" WHERE "id"=${initial.studentId} FOR UPDATE`;
  const current=await tx.mockSession.findUnique({where:{id:session.id},include:{group:{select:{teacherId:true}},teacher:{select:{userId:true}}}});const student=await tx.student.findUnique({where:{id:initial.studentId}});
  if(!current||!student||student.blacklisted||student.groupId!==current.groupId||current.group.teacherId!==current.teacherId)throw new GroupMockError(403,"Class access changed.");
  await liveUser(tx,student.userId,"STUDENT");await liveUser(tx,current.teacher.userId,"TEACHER");
  if(!["running","review"].includes(current.state))throw new GroupMockError(409,"Session is not collecting work.");
  const result=await tx.mockAttempt.updateMany({where,data});if(!result.count)return result;
  const accepted=await tx.mockParticipant.updateMany({where:{attemptId,work:{equals:Prisma.AnyNull},publishedAt:null},data:{work:json(saved)}});
  if(!accepted.count)throw new GroupMockError(409,"The essay snapshot was already collected. Reload the session.");
  return result;
 });
}
export async function saveReview(userId:string,sessionId:string,input:Review) {
 const parsed=reviewSchema.safeParse(input);if(!parsed.success)throw new GroupMockError(400,"Complete valid half-band rubrics before publication.");input=parsed.data;
 return db.$transaction(async tx=>{const s=await owner(tx,userId,sessionId);if(!["running","review"].includes(s.state))throw new GroupMockError(409,"Start and collect the exam before marking it.");
 await tx.$queryRaw`SELECT "id" FROM "mock_participants" WHERE "id"=${input.participantId} FOR UPDATE`;
 const p=await tx.mockParticipant.findFirst({where:{id:input.participantId,sessionId},include:{attempt:true,student:{include:{user:{select:{role:true}}}}}});
 if(!p||p.student.groupId!==s.groupId||p.student.blacklisted||p.student.user.role!=="STUDENT")throw new GroupMockError(403,"Participant access changed.");await tx.$queryRaw`SELECT "id" FROM "students" WHERE "id"=${p.studentId} FOR UPDATE`;await liveUser(tx,p.student.userId,"STUDENT");const liveStudent=await tx.student.findUnique({where:{id:p.studentId}});if(!liveStudent||liveStudent.groupId!==s.groupId||liveStudent.blacklisted)throw new GroupMockError(403,"Participant access changed.");if(p.publishedAt)throw new GroupMockError(409,"These results are already published; use the existing teacher-review page for a recorded correction.");if(p.version!==input.version)throw new GroupMockError(409,"Another review saved first. Reload before marking.");if(p.attempt.status!=="finished"||!p.work)throw new GroupMockError(409,"This candidate's computer block has not been collected yet.");
 const review={task1:input.task1,task2:input.task2,speaking:input.speaking,speakingConducted:input.speakingConducted,comment:input.comment};
 if(!input.publish)return tx.mockParticipant.update({where:{id:p.id},data:{review:json(review),version:{increment:1}}});
 const results=resultsOf(p.attempt.results);if(!results.LISTENING||!results.READING)throw new GroupMockError(409,"Objective sections are not complete.");const b=manualBands(review,results.LISTENING.band,results.READING.band);const work=rec(p.work);const tests:string[]=[];
 for(const [index,task] of ["task1","task2"].entries()){const w=rec(work[task]);const band=index===0?b.task1:b.task2;const criteria=review[task as "task1"|"task2"];const test=await tx.iELTSTest.create({data:{studentId:p.studentId,module:"WRITING",score:band,timeSpent:0,answers:json({format:"exam-v2",taskType:task,essay:w.essay,prompt:w.prompt,promptId:w.promptId,promptTitle:w.title,...(w.chart?{chart:w.chart}:{}),...(w.imageUrl?{imageUrl:w.imageUrl}:{}),mock:true,mockAttemptId:p.attemptId,examAttemptId:`group:${p.attemptId}`,groupSessionId:s.id}),aiAnalysis:json({source:"teacher",pending:false})}});tests.push(test.id);await tx.testReview.create({data:{testId:test.id,studentId:p.studentId,reviewerId:userId,band,criteria:json(criteria),comment:review.comment}});}
 const spoken=await tx.iELTSTest.create({data:{studentId:p.studentId,module:"SPEAKING",score:b.speaking,timeSpent:0,answers:json({format:"speaking-full",source:"teacher",inputMode:"in-person",title:"Teacher-conducted Speaking · Parts 1–3",mock:true,mockAttemptId:p.attemptId,groupSessionId:s.id,teacherConducted:true}),aiAnalysis:json({source:"teacher",criteria:review.speaking})}});await tx.testReview.create({data:{testId:spoken.id,studentId:p.studentId,reviewerId:userId,band:b.speaking,criteria:json(review.speaking),comment:review.comment}});
 const submittedAt=new Date().toISOString();await tx.mockAttempt.update({where:{id:p.attemptId},data:{papers:json({...rec(p.attempt.papers),groupPublished:true}),results:json({...results,WRITING:{band:b.writing,task1Band:b.task1,task2Band:b.task2,testIds:tests,xp:0,reviewed:true,submittedAt},SPEAKING:{band:b.speaking,testIds:[spoken.id],criteria:review.speaking,xp:0,reviewed:true,submittedAt}}),overall:b.overall}});
 return tx.mockParticipant.update({where:{id:p.id},data:{review:json(review),publishedAt:new Date(),version:{increment:1}}});});
}
