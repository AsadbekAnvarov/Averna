/**
 * Reusable branded loading skeleton for heavy server-rendered pages.
 * Rendered from route-level `loading.tsx` files so navigation feels instant
 * and content doesn't jump in. Mirrors the common layout: page header,
 * optional stat pills, then a responsive grid of cards.
 */
/** A calm placeholder block (token colours; it only pulses when motion is OK). */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`motion-safe:animate-pulse rounded-2xl bg-white/5 border border-white/5 ${className}`} />;
}
const Block = SkeletonBlock;

interface PageSkeletonProps {
  /** Number of stat pills to show under the header (0 hides the row). */
  pills?: number;
  /** Number of content cards in the grid. */
  cards?: number;
  /** Show a wide full-width banner block above the grid. */
  banner?: boolean;
  /** Constrain width like most content pages. */
  maxWidth?: string;
  /** Only the content blocks — for a route inside a layout that already draws the header. */
  bare?: boolean;
}

export function PageSkeleton({
  pills = 0,
  cards = 6,
  banner = false,
  maxWidth = "max-w-5xl",
  bare = false,
}: PageSkeletonProps) {
  const body = (
    <>
      {pills > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: pills }).map((_, i) => (
            <Block key={i} className="h-24" />
          ))}
        </div>
      )}

      {banner && <Block className="h-24 mb-4 sm:mb-5" />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        {Array.from({ length: cards }).map((_, i) => (
          <Block key={i} className="h-40" />
        ))}
      </div>
    </>
  );
  if (bare)
    return (
      <div aria-busy="true">
        <span className="sr-only">Loading…</span>
        {body}
      </div>
    );

  return (
    <div className="min-h-screen premium-gradient">
      <div aria-busy="true" className={`container mx-auto px-4 py-4 sm:py-6 ${maxWidth} pb-8 lg:pb-6`}>
        <span className="sr-only">Loading…</span>
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Block className="h-4 w-40 mb-3" />
          <div className="flex items-center gap-3">
            <Block className="h-9 w-9 rounded-xl" />
            <div className="space-y-2">
              <Block className="h-6 w-52" />
              <Block className="h-3 w-72 max-w-full" />
            </div>
          </div>
        </div>

        {body}
      </div>
    </div>
  );
}
