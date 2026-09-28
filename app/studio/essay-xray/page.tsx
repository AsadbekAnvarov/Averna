export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { EssayXray } from "@/components/learning/essay-xray";

export const metadata = { title: "Essay X-Ray · Practice Studio" };

export default function EssayXrayPage() {
  return (
    <StudioToolPage slug="essay-xray">
      <EssayXray />
    </StudioToolPage>
  );
}
