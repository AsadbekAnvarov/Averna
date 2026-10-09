import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { financeMutate, financeSnapshot } from "@/lib/finance/service";
import { FinanceError, safeCsvCell } from "@/lib/finance/rules";
import { trustedMutation } from "@/lib/security/same-origin";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"no-store, private"};
function failure(e:unknown) {
 if(e instanceof FinanceError)return NextResponse.json({error:e.message},{status:e.status,headers});
 const code=(e as {code?:string})?.code;
 if(code==="P2021"||code==="P2022")return NextResponse.json({error:"Moliya jadvali hali o‘rnatilmagan. Avval test bazasida migratsiyani tekshiring."},{status:503,headers});
 console.error("Admin finance failed",{code:code??"unknown"});
 return NextResponse.json({error:"Saqlash holati nomaʼlum. Xuddi shu soʻrovni qayta yuboring yoki jurnalni tekshiring."},{status:500,headers});
}
export async function GET(req:NextRequest) {
 const session=await auth();if(!session?.user)return NextResponse.json({error:"Unauthorized"},{status:401,headers});
 if(session.user.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403,headers});
 try{
  const s=await financeSnapshot(session.user,req.nextUrl.searchParams.get("month")??undefined);
  if(req.nextUrl.searchParams.get("export")==="journal"){
   const rows=[["Date","Kind","Channel","Amount UZS","Payroll accrual UZS","Student","Staff","Description","Actor","Reversed"],...s.entries.map(e=>[e.date,e.kind,e.channel,e.amount,e.earned,e.learner??"",e.staff??"",e.description,e.actor,e.reversed?"yes":"no"])];
   return new NextResponse("\uFEFF"+rows.map(r=>r.map(safeCsvCell).join(",")).join("\r\n"),{headers:{...headers,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="averna-finance-${s.month}.csv"`,"X-Content-Type-Options":"nosniff"}});
  }
  return NextResponse.json(s,{headers});
 }catch(e){return failure(e)}
}
export async function POST(req:NextRequest) {
 if(!trustedMutation(req))return NextResponse.json({error:"Untrusted origin"},{status:403,headers});
 const session=await auth();if(!session?.user)return NextResponse.json({error:"Unauthorized"},{status:401,headers});
 if(session.user.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403,headers});
 try{
  const text=await req.text();if(text.length>100000)return NextResponse.json({error:"Soʻrov juda katta."},{status:413,headers});
  let body;try{body=JSON.parse(text)}catch{return NextResponse.json({error:"Invalid JSON"},{status:400,headers})}
  const result=await financeMutate(session.user,body,req.headers.get("Idempotency-Key")??"");
  return NextResponse.json(result,{headers});
 }catch(e){return failure(e)}
}
