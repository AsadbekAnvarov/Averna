import { Loader2 } from "lucide-react";

/**
 * Route-level loading state for the exam-library pages — mirrors the page
 * layout (hero, filters, card grid) so nothing jumps when the list arrives.
 */
export function LibrarySkeleton({
  label = "Preparing your tests…",
  cards = 4,
  filters = true,
  columns = "md:grid-cols-2",
}: {
  label?: string;
  cards?: number;
  filters?: boolean;
  columns?: string;
}) {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-6xl px-4 py-6 pb-24 sm:py-8 lg:pb-8" aria-busy="true">
        <div className="av-panel av-panel-hero rounded-3xl px-5 pb-6 pt-5 sm:px-8 sm:pb-8">
          <div className="skeleton h-4 w-32" />
          <div className="mt-5 flex items-start gap-4">
            <div className="skeleton h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-7 w-56 max-w-full" />
              <div className="skeleton h-3.5 w-80 max-w-full" />
            </div>
          </div>
          <p role="status" className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
            {label}
          </p>
        </div>

        {filters && (
          <div className="mt-6 flex flex-wrap gap-2" aria-hidden>
            {[88, 104, 128, 76, 84, 72].map((w, i) => (
              <div key={i} className="skeleton h-11 rounded-xl" style={{ width: w }} />
            ))}
          </div>
        )}

        <div className={`mt-6 grid gap-4 ${columns}`} aria-hidden>
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="av-panel rounded-2xl p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="skeleton h-10 w-10 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="skeleton h-6 w-20 rounded-full" />
                <div className="skeleton h-6 w-28 rounded-full" />
              </div>
              <div className="mt-4 space-y-2">
                <div className="skeleton h-11 w-full rounded-xl" />
                <div className="skeleton h-11 w-full rounded-xl" />
              </div>
              <div className="skeleton mt-5 h-12 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
