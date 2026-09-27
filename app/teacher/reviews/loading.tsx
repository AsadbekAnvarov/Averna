import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function ReviewQueueLoading() {
  return <PageSkeleton pills={0} cards={6} banner maxWidth="max-w-7xl" />;
}
