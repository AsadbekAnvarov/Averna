import { NextRequest,NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { learnerCsv } from "@/lib/finance/csv";
import { FinanceError,money } from "@/lib/finance/rules";
import { trustedMutation } from "@/lib/security/same-origin";
const headers={"Cache-Control":"no-store, private"};
export async function POST(req:NextRequest){
 if(!trustedMutation(req))return NextResponse.json({error:"Untrusted origin"},{status:403,headers});
 const session=await auth();if(!session?.user)return NextResponse.json({error:"Unauthorized"},{status:401,headers});if(session.user.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403,headers});
 try{
  const text=await req.text();if(text.length>100000)throw new FinanceError("CSV juda katta.");const items=learnerCsv(text);if(!items.length)throw new FinanceError("CSV boʻsh.");
  const staff=await db.financeStaff.findMany({select:{id:true,fullName:true,active:true,shareBps:true}});const issues:string[]=[];
  for(const item of items){money(item.monthlyFee);const s=staff.find(s=>s.id===item.staffId);if(!s?.active||s.shareBps===null)issues.push(`${item.fullName}: xodim / ulush tasdiqlanmagan.`)}
  return NextResponse.json({items,issues,count:items.length,message:"Bu faqat preview. Pul, qarz va sayt akkaunti yozilmagan."},{headers});
 }catch(e){return NextResponse.json({error:e instanceof FinanceError?e.message:"CSV tekshiruvini bajarib boʻlmadi."},{status:e instanceof FinanceError?e.status:503,headers})}
}
