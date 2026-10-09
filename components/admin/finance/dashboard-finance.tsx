import { getDashboardFinance } from "@/lib/finance/dashboard";
import { FinanceCenter } from "./finance-center";
import { FinanceSummary } from "../finance-summary";
export async function DashboardFinance(){
 try{const data=await getDashboardFinance();return data?<FinanceCenter initial={data} embedded/>:null}
 catch{return <FinanceSummary/>}
}

/** Intake belongs with people, not the cash journal. The same authorized API is reused. */
export async function DashboardLeads(){
 try{const data=await getDashboardFinance();return data?<FinanceCenter initial={data} embedded view="leads"/>:null}
 catch{return <section className="glass rounded-2xl p-6"><h2 className="text-white font-semibold">Lidlar va sinov darslari</h2><p className="text-gray-400 mt-2">Qabul registri yuklanmadi. Bu roʻyxat boʻsh degani emas. Moliya migratsiyasi va ulanishni tekshiring.</p></section>}
}
