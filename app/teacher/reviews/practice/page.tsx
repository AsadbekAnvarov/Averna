export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { learningCycleEnabled } from "@/lib/learning-cycle/rules";
import { listCycles } from "@/lib/learning-cycle/service";
import { CycleList, CyclePagination } from "@/components/learning-cycle/cycle-list";
import { PageHeader } from "@/components/ui/page-header";
import { ClipboardCheck } from "lucide-react";
export const metadata = { title: "Practice follow-up reviews" };
export default async function PracticeInbox({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!learningCycleEnabled()) notFound(); const session = await auth(); if (!session?.user) redirect("/auth/signin"); if (session.user.role !== "TEACHER" && session.user.role !== "ADMIN") redirect("/dashboard");
  const page = Math.max(1, Math.min(10000, Math.floor(Number((await searchParams).page) || 1))); const data = await listCycles(session.user, "inbox", page);
  return <main className="min-h-screen premium-gradient"><div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8"><PageHeader back={{ href: "/teacher/reviews", label: "Exam review queue" }} icon={ClipboardCheck} title="Practice follow-ups" subtitle="Review a revision, then check the same focus skills in a different task. Original exam grades and XP remain unchanged." /><CycleList items={data.items} staff /><CyclePagination page={page} hasMore={data.hasMore} base="/teacher/reviews/practice" /></div></main>;
}
