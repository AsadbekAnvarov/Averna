export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { GhostRace } from "@/components/dashboard/ghost-race";

export const metadata = { title: "Ghost Race · Practice Studio" };

export default function GhostRacePage() {
  return (
    <StudioToolPage slug="ghost-race">
      <GhostRace />
    </StudioToolPage>
  );
}
