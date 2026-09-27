import { LibrarySkeleton } from "@/components/library/library-skeleton";

export default function MockResultLoading() {
  return <LibrarySkeleton label="Loading your results…" cards={4} filters={false} columns="md:grid-cols-2" />;
}
