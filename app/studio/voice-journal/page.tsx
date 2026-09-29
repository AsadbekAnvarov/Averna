export const dynamic = "force-dynamic";

import { StudioToolPage } from "@/components/studio/studio-tool-page";
import { VoiceJournal } from "@/components/dashboard/voice-journal";

export const metadata = { title: "Voice Journal · Practice Studio" };

export default function VoiceJournalPage() {
  return (
    <StudioToolPage slug="voice-journal">
      <VoiceJournal />
    </StudioToolPage>
  );
}
