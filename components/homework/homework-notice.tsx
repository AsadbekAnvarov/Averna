import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import type { HomeworkNotice } from "@/lib/homework/exam-homework";
import { cn } from "@/lib/utils";

/**
 * Result pages, for the attempt's owner only: this attempt didn't complete the
 * student's homework for the same content — why, and a link back to it
 * (lib/homework/exam-homework homeworkNoticeFor). Server-safe, no hooks.
 */
export function HomeworkNoticeCard({ notice, className }: { notice: HomeworkNotice; className?: string }) {
  return (
    <section
      aria-labelledby="homework-notice-title"
      className={cn("rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 sm:p-5 print:hidden", className)}
    >
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="homework-notice-title" className="font-semibold text-amber-200">
            This attempt didn&apos;t complete your homework
          </h2>
          <p className="mt-1 text-sm text-gray-200">
            <span className="font-medium text-white">{notice.title}</span> is still on your To do list.
          </p>
          <p className="mt-1 text-sm text-gray-300">{notice.reason}</p>
          <Link
            href={notice.href}
            className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-amber-300/40 px-3 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-neon"
          >
            Go to the homework
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
