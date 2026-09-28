export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { ExplainCoach } from "@/components/learning/explain-coach";

export const metadata = { title: "Teach to Learn · Practice Studio" };

export default function TeachPage() {
  return (
    <StudioToolPage slug="teach">
      <ExplainCoach />
    </StudioToolPage>
  );
}
