export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { learningCycleEnabled } from "@/lib/learning-cycle/rules";
import { listCycles } from "@/lib/learning-cycle/service";
import { CycleList, CyclePagination } from "@/components/learning-cycle/cycle-list";
export const metadata = { title: "Private progress portfolio" };
export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!learningCycleEnabled()) notFound(); const session = await auth(); if (!session?.user) redirect("/auth/signin"); if (session.user.role !== "STUDENT") redirect(session.user.role === "ADMIN" ? "/admin/dashboard" : "/teacher/dashboard");
  const page = Math.max(1, Math.min(10000, Math.floor(Number((await searchParams).page) || 1))); const data = await listCycles(session.user, "portfolio", page);
  return <section className="space-y-6"><header><p className="text-sm font-semibold text-averna-cyan">Your work, not just a score</p><h2 className="mt-2 text-2xl font-bold text-white">Private portfolio</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">Compare the original response, revision and new-task evidence. Teacher observations are evidence for that response — not a certified band increase or permanent mastery.</p></header><CycleList items={data.items} /><CyclePagination page={page} hasMore={data.hasMore} base="/progress/portfolio" /><p className="text-sm text-gray-400">Drafts are private. Only submitted practice is shared with authorised staff. Public sharing is not enabled.</p></section>;
}
