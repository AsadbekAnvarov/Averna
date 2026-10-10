import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { groupMockEnabled } from "@/lib/group-mock/rules";
import { TeacherSessions } from "@/components/group-mock/session-ui";
export const dynamic="force-dynamic";
export default async function Page(){const s=await auth();if(!s?.user)return redirect("/auth/signin");if(s.user.role!=="TEACHER")return redirect("/dashboard");return <TeacherSessions enabled={groupMockEnabled()}/>;}
