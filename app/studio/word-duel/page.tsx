export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { WordDuel } from "@/components/dashboard/word-duel";

export const metadata = { title: "Word Duel · Practice Studio" };

export default function WordDuelPage() {
  return (
    <StudioToolPage slug="word-duel">
      <WordDuel />
    </StudioToolPage>
  );
}
