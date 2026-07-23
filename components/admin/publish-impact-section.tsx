import { getReachStats } from "@/lib/admin-analytics";
import { PublishImpact } from "@/components/admin/publish-impact";

/** Server wrapper: fetches real reach stats and hands them to the estimator. */
export async function PublishImpactSection() {
  const stats = await getReachStats();
  return <PublishImpact stats={stats} />;
}
