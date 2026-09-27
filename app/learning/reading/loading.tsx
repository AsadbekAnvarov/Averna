import { LibrarySkeleton } from "@/components/library/library-skeleton";

export default function ReadingLibraryLoading() {
  return <LibrarySkeleton label="Preparing your tests…" cards={4} />;
}
