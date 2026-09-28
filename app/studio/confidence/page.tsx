export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { ConfidenceMeter } from "@/components/dashboard/confidence-meter";

export const metadata = { title: "Confidence Meter · Practice Studio" };

export default function ConfidencePage() {
  return (
    <StudioToolPage slug="confidence">
      <ConfidenceMeter />
    </StudioToolPage>
  );
}
