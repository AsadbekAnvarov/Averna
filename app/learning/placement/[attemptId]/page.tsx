export const dynamic = "force-dynamic";
// Opening the view may first mark a section whose clock ran out while the student was away
// (Writing may go to the AI examiner).
export const maxDuration = 60;

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlacementView } from "@/lib/placement/placement";
import { PLACEMENT_HUB_HREF, placementResultHref } from "@/lib/placement/config";
import { PlacementOrchestrator } from "@/components/placement/placement-orchestrator";

export const metadata = { title: "Placement test" };

/** One sitting of the placement test. */
export default async function PlacementRunPage(props: { params: Promise<{ attemptId: string }> }) {
  const params = await props.params;
  const session = await auth();
  if (!session?.user) return redirect("/auth/signin");

  const student = await db.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!student) return redirect(PLACEMENT_HUB_HREF);

  const view = await getPlacementView(student.id, session.user.id, params.attemptId);
  if (!view) return redirect(PLACEMENT_HUB_HREF);
  if (view.stage.kind === "finished") return redirect(placementResultHref(view.attemptId));
  if (view.stage.kind === "abandoned") return redirect(PLACEMENT_HUB_HREF);

  return <PlacementOrchestrator view={view} serverNow={Date.now()} />;
}
