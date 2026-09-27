import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function TeacherMockLoading() {
  return <PageSkeleton pills={4} cards={6} banner maxWidth="max-w-6xl" />;
}
