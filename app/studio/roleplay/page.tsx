export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { Roleplay } from "@/components/learning/roleplay";

export const metadata = { title: "Roleplay · Practice Studio" };

export default function RoleplayPage() {
  return (
    <StudioToolPage slug="roleplay">
      <Roleplay />
    </StudioToolPage>
  );
}
