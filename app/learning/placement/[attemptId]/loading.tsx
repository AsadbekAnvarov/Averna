import { Loader2 } from "lucide-react";

/** While the sitting loads (it may first mark a section whose clock ran out while the student was away). */
export default function PlacementRunLoading() {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto max-w-4xl px-4 py-6 pb-10 sm:py-8 lg:pb-8" aria-busy="true">
        <div className="mb-5 space-y-2" aria-hidden>
          <div className="skeleton h-3 w-28" />
          <div className="skeleton h-3.5 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[58px] rounded-2xl" />
          ))}
        </div>
        <div className="av-panel av-panel-hero mt-5 rounded-3xl p-5 sm:p-8">
          <div className="flex items-start gap-4" aria-hidden>
            <div className="skeleton h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-7 w-48 max-w-full" />
              <div className="skeleton h-3.5 w-72 max-w-full" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
          <p role="status" className="mt-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
            Getting your test ready…
          </p>
        </div>
      </div>
    </div>
  );
}
