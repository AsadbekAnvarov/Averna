import { cache } from "react";
import { auth } from "@/lib/auth";
import { financeSnapshot } from "./service";
/** React server-render cache only, never a persistent/global financial cache.
 * Dashboard summary, finance and intake reuse one authorized read per render. */
export const getDashboardFinance = cache(async () => {
 const session=await auth();
 if(session?.user.role!=="ADMIN")return null;
 return financeSnapshot(session.user);
});
