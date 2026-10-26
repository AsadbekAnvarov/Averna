export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { WordScramble } from "@/components/games/word-scramble";

export const metadata = { title: "Word Scramble · Practice Studio" };

export default function WordScramblePage() {
  return (
    <StudioToolPage slug="word-scramble">
      <WordScramble />
    </StudioToolPage>
  );
}
