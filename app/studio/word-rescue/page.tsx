export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { WordRescue } from "@/components/games/word-rescue";

export const metadata = { title: "Word Rescue · Practice Studio" };

export default function WordRescuePage() {
  return (
    <StudioToolPage slug="word-rescue">
      <WordRescue />
    </StudioToolPage>
  );
}
