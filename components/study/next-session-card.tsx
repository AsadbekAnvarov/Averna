import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
export function NextSessionCard() {
  return (
    <Link
      href="/study/next"
      className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-averna-cyan/30 bg-averna-cyan/5 p-5 sm:p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-averna-cyan"
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm text-study-ink">
          <Clock3 className="h-4 w-4" /> Small session. Clear direction.
        </p>
        <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-white">
          My next 15 minutes
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          Recall → focused practice → one correction. A plan with a reason
          behind every step.
        </p>
      </div>
      <span className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-study-ink">
        Build my session <ArrowUpRight className="h-5 w-5" />
      </span>
    </Link>
  );
}
