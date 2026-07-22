import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function ProgressLoading() {
  return <PageSkeleton pills={4} cards={6} maxWidth="max-w-6xl" />;
}
