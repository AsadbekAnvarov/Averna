import { LibrarySkeleton } from "@/components/library/library-skeleton";

export default function PlacementHubLoading() {
  return <LibrarySkeleton label="Loading the placement test…" cards={1} filters={false} />;
}
