export const dynamic="force-dynamic";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { FinanceCenter } from "@/components/admin/finance/finance-center";
import { financeSnapshot } from "@/lib/finance/service";
export default async function AdminFinancePage(props:{searchParams:Promise<{month?:string}>}) {
 const session=await auth();if(!session?.user)redirect("/auth/signin");if(session.user.role!=="ADMIN")redirect(session.user.role==="TEACHER"?"/teacher/dashboard":"/dashboard");
 const {month}=await props.searchParams;
 try {const data=await financeSnapshot(session.user,month);return <FinanceCenter initial={data}/>}
 catch(e){
  console.error("Finance page unavailable",{code:(e as {code?:string}).code??"unknown"});
  return <div className="max-w-3xl mx-auto p-6"><Link href="/admin/dashboard" className="text-averna-cyan underline">Admin paneliga qaytish</Link><h1 className="text-2xl text-white mt-6">Moliya markazi hali tayyor emas</h1><p className="text-gray-300 mt-3">Notoʻgʻri oy yoki oʻrnatilmagan jadval sababli maʼlumotni yuklab boʻlmadi. Nol summalarni haqiqiy hisobot sifatida koʻrsatmaymiz. Test bazasida migratsiyani va oy formatini tekshiring.</p></div>;
 }
}
