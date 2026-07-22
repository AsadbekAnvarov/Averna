import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function RankingsLoading() {
  return <PageSkeleton pills={3} cards={3} maxWidth="max-w-4xl" />;
}
