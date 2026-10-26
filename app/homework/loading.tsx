import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Homework list: header, the summary chips and the task cards (instant feedback on a tap, idea 7). */
export default function HomeworkLoading() {
  return <PageSkeleton pills={4} cards={3} maxWidth="max-w-6xl" />;
}
