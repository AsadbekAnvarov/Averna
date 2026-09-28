export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { WarmUp } from "@/components/dashboard/warm-up";

export const metadata = { title: "60-Second Warm-Up · Practice Studio" };

export default function WarmUpPage() {
  return (
    <StudioToolPage slug="warm-up">
      <WarmUp />
    </StudioToolPage>
  );
}
