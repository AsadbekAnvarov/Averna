import Link from "next/link";
import { auth } from "@/lib/auth";
import { financeSnapshot } from "@/lib/finance/service";
import { formatUzs } from "@/lib/finance/rules";
import { Wallet, ArrowUpRight } from "lucide-react";
/** One truthful register for dashboard and finance page. Legacy demos are not revenue. */
export async function FinanceSummary() {
 const session=await auth();if(session?.user.role!=="ADMIN")return null;
 try{
  const s=await financeSnapshot(session.user);
  return <section className="glass rounded-2xl border border-averna-purple/25 p-6"><div className="flex justify-between gap-3"><h2 className="font-semibold text-white flex items-center gap-2"><Wallet className="h-5 w-5 text-averna-purple"/> Moliya va nazorat</h2><Link href="/admin/finance" className="text-sm text-averna-cyan inline-flex items-center min-h-11">Ochish <ArrowUpRight className="h-4 w-4"/></Link></div><p className="text-sm text-gray-400 mt-2">{s.month} · {s.period?.status==="CLOSED"?"Oy yopilgan":s.period?"Ochiq oy":"Oy hali ochilmagan"}</p>{s.period?<dl className="grid grid-cols-2 gap-5 mt-5"><div><dt className="text-sm text-gray-400">Sof pul tushumi</dt><dd className="text-xl font-semibold text-white mt-1">{formatUzs(s.summary.income)} <span className="text-xs">UZS</span></dd></div><div><dt className="text-sm text-gray-400">Toʻlov qarzi</dt><dd className="text-xl font-semibold text-white mt-1">{formatUzs(s.summary.receivables)} <span className="text-xs">UZS</span></dd></div><div><dt className="text-sm text-gray-400">Toʻlangan ish haqi</dt><dd className="text-lg text-white">{formatUzs(s.summary.payrollPaid)} UZS</dd></div><div><dt className="text-sm text-gray-400">Kechikkan hisoblar</dt><dd className="text-lg text-white">{s.summary.overdueCount}</dd></div></dl>:<p className="text-sm text-gray-300 mt-5">Boshlangʻich qoldiqni tasdiqlang, xodimlar va oʻquvchilarni roʻyxatga oling. Eski demo toʻlovlar tushumga qoʻshilmaydi.</p>}</section>;
 }catch{return <section className="glass rounded-2xl border border-amber-500/25 p-6"><h2 className="text-white font-semibold">Moliya va nazorat</h2><p className="text-sm text-gray-300 mt-3">Moliyaviy registrni yuklab boʻlmadi. Bu nol daromad degani emas.</p><Link href="/admin/finance" className="inline-flex min-h-11 items-center text-averna-cyan mt-2">Oʻrnatishni tekshirish →</Link></section>}
}
