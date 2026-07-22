import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function LearningLoading() {
  return <PageSkeleton banner cards={6} maxWidth="max-w-6xl" />;
}
