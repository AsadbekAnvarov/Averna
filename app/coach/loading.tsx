import { PageSkeleton } from "@/components/ui/page-skeleton";

/** AI Coach hub: header, then the helper cards (instant feedback on a tap, idea 7). */
export default function CoachLoading() {
  return <PageSkeleton cards={6} maxWidth="max-w-5xl" />;
}
