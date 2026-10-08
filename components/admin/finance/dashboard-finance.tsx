import { auth } from "@/lib/auth";
import { financeSnapshot } from "@/lib/finance/service";
import { FinanceCenter } from "./finance-center";
import { FinanceSummary } from "../finance-summary";
export async function DashboardFinance(){
 const session=await auth();if(session?.user.role!=="ADMIN")return null;
 try{return <FinanceCenter initial={await financeSnapshot(session.user)}/>}
 catch{return <FinanceSummary/>}
}
