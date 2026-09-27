import { LibrarySkeleton } from "@/components/library/library-skeleton";

export default function PlacementResultLoading() {
  return <LibrarySkeleton label="Loading your result…" cards={4} filters={false} columns="md:grid-cols-2" />;
}
