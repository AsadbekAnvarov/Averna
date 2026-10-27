import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Live speaking partner: header, then the setup card (instant feedback on a tap, idea 7). */
export default function LivePartnerLoading() {
  return <PageSkeleton cards={2} maxWidth="max-w-5xl" />;
}
