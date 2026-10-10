import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
/** Only the original, currently assigned session teacher may correct published group grades. */
export async function assertSessionReviewer(userId:string,answers:unknown,tx?:Prisma.TransactionClient,studentId?:string):Promise<boolean> {
 const id=answers&&typeof answers==="object"?(answers as Record<string,unknown>).groupSessionId:null;
 if(typeof id!=="string")return true;
 const client=tx??db;
 const initial=await client.mockSession.findUnique({where:{id}});if(!initial)return false;
 if(tx){
  await tx.$queryRaw`SELECT "id" FROM "groups" WHERE "id"=${initial.groupId} FOR UPDATE`;
  const users=await tx.$queryRaw<{role:string}[]>`SELECT "role" FROM "users" WHERE "id"=${userId} FOR SHARE`;
  if(users[0]?.role!=="TEACHER")return false;
  if(studentId){await tx.$queryRaw`SELECT "id" FROM "students" WHERE "id"=${studentId} FOR UPDATE`;const student=await tx.student.findUnique({where:{id:studentId},include:{user:{select:{role:true}}}});if(!student||student.blacklisted||student.groupId!==initial.groupId||student.user.role!=="STUDENT")return false;const learner=await tx.$queryRaw<{role:string}[]>`SELECT "role" FROM "users" WHERE "id"=${student.userId} FOR SHARE`;if(learner[0]?.role!=="STUDENT")return false;}
 }
 const s=await client.mockSession.findUnique({where:{id},include:{teacher:{include:{user:{select:{role:true}}}},group:{select:{teacherId:true}}}});
 return !!s&&s.teacher.userId===userId&&s.teacher.user.role==="TEACHER"&&s.group.teacherId===s.teacherId;
}
