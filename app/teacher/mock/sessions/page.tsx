import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { groupMockEnabled } from "@/lib/group-mock/rules";
import { TeacherSessions } from "@/components/group-mock/session-ui";
export const dynamic="force-dynamic";
export default async function Page(){const s=await auth();if(!s?.user)return redirect("/auth/signin");if(s.user.role!=="TEACHER")return redirect("/dashboard");return <><div className="container mx-auto px-4 pt-4"><Link href="/teacher/mock/resources" className="inline-flex min-h-[44px] items-center rounded-xl border border-white/10 px-4 text-averna-light">CDI samples & teacher discussion prompts</Link></div><TeacherSessions enabled={groupMockEnabled()}/></>;}
