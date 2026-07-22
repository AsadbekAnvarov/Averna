/**
 * Reusable branded loading skeleton for heavy server-rendered pages.
 * Rendered from route-level `loading.tsx` files so navigation feels instant
 * and content doesn't jump in. Mirrors the common layout: page header,
 * optional stat pills, then a responsive grid of cards.
 */
function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/5 border border-white/5 ${className}`} />;
}

interface PageSkeletonProps {
  /** Number of stat pills to show under the header (0 hides the row). */
  pills?: number;
  /** Number of content cards in the grid. */
  cards?: number;
  /** Show a wide full-width banner block above the grid. */
  banner?: boolean;
  /** Constrain width like most content pages. */
  maxWidth?: string;
}

export function PageSkeleton({
  pills = 0,
  cards = 6,
  banner = false,
  maxWidth = "max-w-5xl",
}: PageSkeletonProps) {
  return (
    <div className="min-h-screen premium-gradient">
      <div className={`container mx-auto px-4 py-8 ${maxWidth} pb-24 lg:pb-8`}>
        {/* Header */}
        <div className="mb-8">
          <Block className="h-4 w-40 mb-4" />
          <div className="flex items-center gap-3">
            <Block className="h-11 w-11 rounded-xl" />
            <div className="space-y-2">
              <Block className="h-6 w-52" />
              <Block className="h-3 w-72 max-w-full" />
            </div>
          </div>
        </div>

        {pills > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: pills }).map((_, i) => (
              <Block key={i} className="h-24" />
            ))}
          </div>
        )}

        {banner && <Block className="h-28 mb-6" />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: cards }).map((_, i) => (
            <Block key={i} className="h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
