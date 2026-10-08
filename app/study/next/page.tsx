export const dynamic = "force-dynamic";
import Link from "next/link";
import { getPageStudent } from "@/lib/student-page";
import { AccountNotice } from "@/components/account-notice";
import { getLearningDna } from "@/lib/engine/learning-dna";
import { db } from "@/lib/db";
import { nextFocusPlan } from "@/lib/study/next-session";
import { FocusSession } from "@/components/study/focus-session";
export const metadata = { title: "Your next 15 minutes · Averna" };
export default async function NextSessionPage() {
  const { student } = await getPageStudent();
  if (!student)
    return (
      <AccountNotice
        title="Student profile needed"
        message="Sign in with your student account to build a practice session."
      />
    );
  const [profile, cards, reviews] = await Promise.all([
    getLearningDna(student.id),
    db.mistakeEntry.findMany({
      where: { studentId: student.id },
      select: { id: true },
      take: 500,
    }),
    db.reviewItem.findMany({
      where: { studentId: student.id, source: "mistake" },
      select: { itemKey: true, dueAt: true },
    }),
  ]);
  const ledger = new Map(reviews.map((r) => [r.itemKey, r.dueAt.getTime()]));
  const due = cards.filter((c) => (ledger.get(c.id) ?? 0) <= Date.now()).length;
  return (
    <main className="min-h-screen premium-gradient">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center text-sm text-study-ink mb-4"
        >
          ← Back to dashboard
        </Link>
        <FocusSession plan={nextFocusPlan(profile, due)} />
      </div>
    </main>
  );
}
