/** Loading state for the progression block — never a blank screen. */
export function ProgressionSkeleton({ rows = 3, label = "Preparing your mission…" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-4 md:space-y-6" role="status" aria-live="polite">
      <div className="av-panel rounded-3xl p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-averna-neon">{label}</p>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[38%_1fr]">
          <div className="space-y-3">
            <div className="skeleton h-8 w-3/4 rounded-lg" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-2.5 w-full rounded-full" />
            <div className="skeleton h-12 w-48 rounded-xl" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
      {Array.from({ length: Math.max(0, rows - 1) }).map((_, i) => (
        <div key={i} className="grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-2">
          <div className="av-panel skeleton h-48 rounded-2xl" />
          <div className="av-panel skeleton h-48 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
