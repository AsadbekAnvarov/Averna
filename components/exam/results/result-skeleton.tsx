import { Loader2 } from "lucide-react";

/**
 * Route-level loading state for the exam-v2 result pages — mirrors the result
 * layout (hero with band ring + stats, breakdown, review) so nothing jumps.
 */
export function ResultSkeleton({ label = "Marking your answers…" }: { label?: string }) {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-6 pb-10 sm:py-8 lg:pb-8" aria-busy="true">
        <div className="av-panel av-panel-hero rounded-3xl px-5 pb-6 pt-5 sm:px-8 sm:pb-8">
          <div className="skeleton h-4 w-32" />
          <div className="mt-5 flex items-start gap-4">
            <div className="skeleton h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-7 w-64 max-w-full" />
              <div className="skeleton h-3.5 w-40 max-w-full" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]" aria-hidden>
            <div className="skeleton mx-auto h-36 w-36 rounded-full sm:mx-0" />
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[74px] rounded-xl" />
              ))}
            </div>
          </div>
          <div className="skeleton mt-6 h-16 w-full rounded-2xl" aria-hidden />
          <p role="status" className="mt-5 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
            {label}
          </p>
        </div>

        <div className="av-panel rounded-2xl p-5 sm:p-6" aria-hidden>
          <div className="skeleton h-5 w-48" />
          <div className="mt-5 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-3.5 w-40" />
                <div className="skeleton h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="av-panel rounded-2xl p-5 sm:p-6" aria-hidden>
          <div className="skeleton h-5 w-36" />
          <div className="mt-5 grid grid-cols-6 gap-1.5 sm:grid-cols-10">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton h-11 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
