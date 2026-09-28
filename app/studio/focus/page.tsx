export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { PomodoroTimer } from "@/components/dashboard/pomodoro-timer";
import { FocusVault } from "@/components/dashboard/focus-vault";

export const metadata = { title: "Focus Room · Practice Studio" };

export default function FocusPage() {
  return (
    <StudioToolPage slug="focus">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PomodoroTimer />
        <FocusVault />
      </div>
    </StudioToolPage>
  );
}
