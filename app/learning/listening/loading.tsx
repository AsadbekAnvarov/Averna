import { LibrarySkeleton } from "@/components/library/library-skeleton";

export default function ListeningLibraryLoading() {
  return <LibrarySkeleton label="Preparing your tests…" cards={4} />;
}
