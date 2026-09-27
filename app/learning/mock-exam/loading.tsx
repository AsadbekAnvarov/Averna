import { LibrarySkeleton } from "@/components/library/library-skeleton";

export default function MockExamHubLoading() {
  return <LibrarySkeleton label="Loading the mock exam…" cards={2} filters={false} />;
}
