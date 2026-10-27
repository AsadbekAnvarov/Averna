import { SkeletonBlock as Block } from "@/components/ui/page-skeleton";

/** Flashcards: header, the mode buttons, deck chips and the card (instant feedback on a tap, idea 7). */
export default function FlashcardsLoading() {
  return (
    <div className="min-h-screen premium-gradient">
      <div aria-busy="true" className="container mx-auto max-w-2xl px-4 py-4 pb-8 sm:py-6 lg:pb-6">
        <span className="sr-only">Loading…</span>
        <Block className="mb-3 h-4 w-40" />
        <div className="mb-5 flex items-center gap-3">
          <Block className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Block className="h-6 w-56 max-w-full" />
            <Block className="h-3 w-72 max-w-full" />
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} className="h-11 w-24 rounded-lg sm:h-9" />
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Block key={i} className="h-11 w-28 rounded-full sm:h-8" />
          ))}
        </div>
        <Block className="h-72" />
      </div>
    </div>
  );
}
