export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { MistakeBank } from "@/components/learning/mistake-bank";

export const metadata = { title: "Mistake Bank · Practice Studio" };

export default function MistakesPage() {
  return (
    <StudioToolPage slug="mistakes">
      <MistakeBank />
    </StudioToolPage>
  );
}
