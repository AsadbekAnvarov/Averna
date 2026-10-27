import { redirect } from "next/navigation";
import { AudioLines } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasOpenAI } from "@/lib/ai";
import { PageHeader } from "@/components/ui/page-header";
import { LivePartner } from "@/components/coach/live/live-partner";
import { liveLimits, remainingSeconds } from "@/lib/realtime/limits";
import { usageToday } from "@/lib/realtime/live-store";
import { liveTopicOptions } from "@/lib/realtime/topics";

export const metadata = { title: "Live speaking partner" };
export const dynamic = "force-dynamic";

/** Seconds left today for this student, or null when it can't be read (the start route checks again). */
async function remainingFor(userId: string): Promise<number | null> {
  try {
    const student = await db.student.findUnique({ where: { userId }, select: { id: true } });
    if (!student) return null;
    const usage = await usageToday(student.id);
    return remainingSeconds(liveLimits(), usage.student, usage.global);
  } catch {
    return null;
  }
}

/**
 * Live speaking partner (AI Coach → /coach/live, docs/elegance-roadmap.md idea 3): a
 * short voice conversation with an AI partner, then "How it went" and an honest
 * pronunciation map. Students only; without an OpenAI key the page says so and links
 * to the AI Examiner.
 */
export default async function LivePartnerPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === "TEACHER") redirect("/teacher/dashboard");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const available = hasOpenAI();
  const limits = liveLimits();
  const remaining = available ? await remainingFor(session.user.id) : null;

  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-5xl px-4 py-4 pb-10 sm:py-6">
        <PageHeader
          back={{ href: "/coach", label: "Back to AI Coach" }}
          icon={AudioLines}
          iconClassName="text-averna-neon"
          title={<>Live speaking <span className="neon-text-cyan">partner</span></>}
          subtitle="A short voice chat with an AI partner. Then see how it went and which words to practise."
        />
        <LivePartner
          available={available}
          topics={liveTopicOptions()}
          limits={{ studentSecondsPerDay: limits.studentSecondsPerDay, maxCallSeconds: limits.maxCallSeconds }}
          remainingSec={remaining}
        />
      </div>
    </div>
  );
}
