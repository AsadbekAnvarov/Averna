export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { classroomEnabled, ToolError } from "@/lib/teacher-tools/rules";
import { classroomGroups, getClassroom } from "@/lib/teacher-tools/classroom";
import { Classroom } from "@/components/teacher-tools/classroom";
export const metadata = { title: "Your live lesson" };
export default async function StudentClassroomPage() {
  if (!classroomEnabled()) notFound(); const session = await auth(); if (!session?.user) redirect("/auth/signin"); if (session.user.role !== "STUDENT") notFound();
  const groups = await classroomGroups(session.user); let view; try { view = groups[0] ? await getClassroom(session.user, groups[0].id) : null; } catch (e) { if (e instanceof ToolError && [403, 404].includes(e.status)) notFound(); throw e; }
  return <main className="min-h-screen premium-gradient"><div className="container mx-auto max-w-5xl space-y-6 px-4 py-6 sm:py-8"><Link className="inline-flex min-h-11 items-center text-sm text-averna-cyan" href="/dashboard?tab=class">← Back to Class</Link>{view ? <Classroom key={view.groupId} initial={view} /> : <section className="glass rounded-2xl p-6"><h1 className="text-2xl font-bold text-white">No group assigned yet</h1><p className="mt-3 text-gray-400">Ask the centre to enrol you in a group. Classroom participation is private to its enrolled learners and staff.</p></section>}</div></main>;
}
