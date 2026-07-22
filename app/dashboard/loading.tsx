/**
 * Instant skeleton shown while the dashboard server component fetches data.
 * Mirrors the real layout (hero + stat pills + bento grid) so the page feels
 * fast and doesn't jump when content arrives.
 */
function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 border border-white/5 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="min-h-screen premium-gradient">
      <div className="container mx-auto px-4 py-6 max-w-7xl pb-24 lg:pb-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Block className="h-11 w-11 rounded-full" />
            <div className="space-y-2">
              <Block className="h-4 w-32" />
              <Block className="h-3 w-20" />
            </div>
          </div>
          <Block className="h-9 w-28 rounded-full" />
        </div>

        {/* Hero */}
        <Block className="h-40 md:h-48 mb-6" />

        {/* Stat pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Block key={i} className="h-24" />
          ))}
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Block className="md:col-span-2 lg:col-span-4 h-28" />
          <Block className="md:col-span-2 h-44" />
          <Block className="md:col-span-2 h-44" />
          <Block className="md:col-span-2 h-36" />
          <Block className="md:col-span-1 h-36" />
          <Block className="md:col-span-1 h-36" />
        </div>
      </div>
    </div>
  );
}
