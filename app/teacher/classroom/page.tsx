export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { classroomEnabled, ToolError } from "@/lib/teacher-tools/rules";
import { classroomGroups, getClassroom } from "@/lib/teacher-tools/classroom";
import { Classroom } from "@/components/teacher-tools/classroom";
export const metadata = { title: "Live classroom" };
export default async function ClassroomPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  if (!classroomEnabled()) notFound(); const session = await auth(); if (!session?.user) redirect("/auth/signin"); if (!["TEACHER", "ADMIN"].includes(session.user.role)) notFound();
  const groups = await classroomGroups(session.user); const selected = (await searchParams).group ?? groups[0]?.id;
  let view; try { view = selected ? await getClassroom(session.user, selected) : null; } catch (e) { if (e instanceof ToolError && [403, 404].includes(e.status)) notFound(); throw e; }
  return <main className="min-h-screen premium-gradient"><div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8"><Link className="inline-flex min-h-11 items-center text-sm text-averna-cyan" href={session.user.role === "ADMIN" ? "/admin/dashboard" : "/teacher/dashboard"}>← Back to workspace</Link><nav aria-label="Choose classroom group" className="flex flex-wrap gap-3">{groups.map(g => <Link key={g.id} href={`/teacher/classroom?group=${g.id}`} aria-current={g.id === selected ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-xl border px-4 text-sm text-white ${g.id === selected ? "border-averna-cyan/40 bg-averna-cyan/10" : "border-white/20"}`}>{g.name}</Link>)}</nav>{view ? <Classroom key={view.groupId} initial={view} /> : <section className="glass rounded-2xl p-6"><h1 className="text-2xl font-bold text-white">No assigned groups</h1><p className="mt-3 text-gray-400">Ask an administrator to assign a group before opening a lesson.</p></section>}</div></main>;
}
