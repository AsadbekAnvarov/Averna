import { LibrarySkeleton } from "@/components/library/library-skeleton";

export default function SpeakingLibraryLoading() {
  return <LibrarySkeleton label="Preparing your tests…" cards={6} filters={false} columns="md:grid-cols-2 xl:grid-cols-3" />;
}
