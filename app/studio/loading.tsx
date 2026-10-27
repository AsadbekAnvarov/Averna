import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Practice Studio and its tools: header, then the tool shelf (instant feedback on a tap, idea 7). */
export default function StudioLoading() {
  return <PageSkeleton cards={6} maxWidth="max-w-5xl" />;
}
