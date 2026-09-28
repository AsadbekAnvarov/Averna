export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { BossBattle } from "@/components/dashboard/boss-battle";

export const metadata = { title: "Boss Battle · Practice Studio" };

export default function BossBattlePage() {
  return (
    <StudioToolPage slug="boss-battle">
      <BossBattle />
    </StudioToolPage>
  );
}
