import { auth } from "@/lib/auth";
import { listAdminLeads } from "@/lib/admin-leads";
import { AdmissionsLeads } from "./admissions-leads";
export async function DashboardLeads(){
 const s=await auth();if(s?.user.role!=="ADMIN")return null;
 try{return <AdmissionsLeads initial={await listAdminLeads()}/>;}
 catch{return <section className="glass rounded-xl p-5"><h2 className="font-semibold text-white">Lidlar va sinov darslari</h2><p className="mt-2 text-gray-300">Qabul roʻyxatini yuklab boʻlmadi. Sahifani yangilab qayta urinib koʻring. Bu roʻyxat boʻsh degani emas.</p></section>;}
}
