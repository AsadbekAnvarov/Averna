export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { MemoryMatch } from "@/components/games/memory-match";

export const metadata = { title: "Memory Match · Practice Studio" };

export default function MemoryMatchPage() {
  return (
    <StudioToolPage slug="memory-match">
      <MemoryMatch />
    </StudioToolPage>
  );
}
