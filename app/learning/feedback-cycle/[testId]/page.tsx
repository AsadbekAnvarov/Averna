export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CycleError, learningCycleEnabled } from "@/lib/learning-cycle/rules";
import { getCycle } from "@/lib/learning-cycle/service";
import { CycleWorkspace } from "@/components/learning-cycle/workspace";
export const metadata = { title: "Feedback practice cycle" };
export default async function FeedbackCyclePage({ params }: { params: Promise<{ testId: string }> }) {
  if (!learningCycleEnabled()) notFound(); const session = await auth(); if (!session?.user) redirect("/auth/signin");
  let cycle;
  try { cycle = await getCycle(session.user, (await params).testId); } catch (e) { if (e instanceof CycleError && (e.status === 404 || e.status === 403)) notFound(); if (e instanceof CycleError) return <div className="container mx-auto max-w-3xl px-4 py-8"><p role="alert" className="glass rounded-2xl p-6 text-gray-300">{e.message}</p><Link href="/progress" className="mt-4 inline-flex min-h-11 items-center text-averna-cyan">Back to Progress</Link></div>; throw e; }
  return <main className="min-h-screen premium-gradient"><div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8"><Link href={session.user.role === "STUDENT" ? "/progress/portfolio" : "/teacher/reviews/practice"} className="mb-4 inline-flex min-h-11 items-center text-sm text-averna-cyan">← {session.user.role === "STUDENT" ? "Private portfolio" : "Practice review queue"}</Link><CycleWorkspace initial={cycle} /></div></main>;
}
