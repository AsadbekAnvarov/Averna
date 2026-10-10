import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionPortal } from "@/components/group-mock/session-ui";
export const dynamic="force-dynamic";
export default async function Page(p:{params:Promise<{id:string}>}){const s=await auth();if(!s?.user)return redirect("/auth/signin");if(s.user.role!=="STUDENT")return redirect("/dashboard");return <SessionPortal id={(await p.params).id}/>;}
