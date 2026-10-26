/**
 * Skeleton of the tab content, shown while the dashboard page (the active tab)
 * fetches its data. The layout keeps the header, attention bar and tab bar on
 * screen, so only the tab area is mocked: a hero-sized block and a grid.
 */
function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 border border-white/5 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div aria-busy="true" className="space-y-4 sm:space-y-5">
      <span className="sr-only">Loading…</span>

      {/* Hero */}
      <Block className="h-36 md:h-44" />

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5">
        <Block className="h-40" />
        <Block className="h-40" />
        <Block className="h-40" />
        <Block className="h-32" />
        <Block className="h-32" />
        <Block className="h-32" />
      </div>
    </div>
  );
}
