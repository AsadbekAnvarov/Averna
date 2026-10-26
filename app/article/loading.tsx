import { SkeletonBlock as Block } from "@/components/ui/page-skeleton";

/** Articles library and reader: a title, the level filters and the reading column (idea 7). */
export default function ArticleLoading() {
  return (
    <div className="min-h-screen premium-gradient">
      <div aria-busy="true" className="container mx-auto max-w-3xl px-4 py-4 pb-8 sm:py-6 lg:pb-6">
        <span className="sr-only">Loading…</span>
        <Block className="mb-3 h-4 w-40" />
        <Block className="mb-2 h-8 w-72 max-w-full" />
        <Block className="mb-5 h-4 w-56 max-w-full" />
        <div className="mb-5 flex flex-wrap gap-2">
          <Block className="h-11 w-28 rounded-full" />
          <Block className="h-11 w-36 rounded-full" />
          <Block className="h-11 w-32 rounded-full" />
        </div>
        <div className="space-y-4">
          <Block className="h-40" />
          <Block className="h-40" />
          <Block className="h-40" />
        </div>
      </div>
    </div>
  );
}
