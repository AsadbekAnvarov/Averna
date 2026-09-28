import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import type { Viewer } from "@/lib/access";
import { pendingReviewSummary } from "@/lib/review/queue";
import { queueHref, reviewHref } from "@/lib/review/filters";
import { formatBand } from "@/lib/review/scoring";
import { timeAgo } from "@/lib/utils";
import { SkillIconBox, SourceBadge } from "@/components/review/review-badges";

/**
 * "Reviews waiting" — a compact card for the teacher dashboard: how many
 * Writing / Speaking attempts wait for the teacher's band (last 30 days) and
 * the first three in queue order (homework and mock first, then oldest).
 * Server component: <PendingReviewsCard viewer={{ id: session.user.id, role: session.user.role }} />
 */
export async function PendingReviewsCard({ viewer }: { viewer: Viewer }) {
  const s = await pendingReviewSummary(viewer, 3).catch((e: unknown) => {
    console.error("PendingReviewsCard failed:", e);
    return null;
  });
  if (!s) return null;

  const total = s.total;
  return (
    <section aria-labelledby="pending-reviews-title" className="glass rounded-2xl border border-averna-pink/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pending-reviews-title" className="flex items-center gap-2 text-lg font-semibold text-averna-pink">
          <ClipboardCheck className="h-5 w-5" aria-hidden />
          Reviews waiting
        </h2>
        <span className="rounded-full bg-averna-pink/15 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-averna-pink">
          <span className="sr-only">Waiting: </span>
          {total}
          {s.truncated ? "+" : ""}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-averna-neon">✓ No Writing or Speaking attempts are waiting for your review.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-gray-400">
            {s.stats.writing} Writing · {s.stats.speaking} Speaking
            {s.stats.homework > 0 && ` · ${s.stats.homework} homework`}
            {s.stats.mock > 0 && ` · ${s.stats.mock} mock`} — last 30 days
          </p>
          <ul role="list" className="mt-3 space-y-2">
            {s.top.map((r) => (
              <li key={r.testId}>
                <Link
                  href={reviewHref(r.testId)}
                  className="group flex items-center gap-3 rounded-lg border border-averna-pink/15 bg-averna-pink/[0.04] p-3 transition-colors hover:border-averna-pink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-pink/60"
                >
                  <SkillIconBox skill={r.skill} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-white">
                      {r.studentName}
                      <span className="font-normal text-gray-400"> · {r.label}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                      {r.source !== "practice" && <SourceBadge source={r.source} title={r.homeworkTitle} />}
                      <span className="truncate">
                        AI {formatBand(r.aiBand)} · {timeAgo(r.submittedAt)}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5 group-hover:text-averna-pink motion-reduce:transition-none" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href={queueHref()}
        className="mt-3 inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-averna-pink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-averna-pink/60 rounded"
      >
        {total > 0 ? `Open the review queue (${total}${s.truncated ? "+" : ""})` : "Open the review queue"}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </section>
  );
}
